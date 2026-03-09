'use strict';

const crypto = require('crypto');
const { loadPeersConfig } = require('./config');
const { validateAdvancedToken, scopeAllowsSkill } = require('./token-manager');
const logger = require('./logger');

/**
 * Constant-time string comparison to prevent timing attacks.
 * Pads shorter string to avoid leaking length information.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const maxLen = Math.max(a.length, b.length);
  const bufA = Buffer.alloc(maxLen);
  const bufB = Buffer.alloc(maxLen);
  bufA.write(a);
  bufB.write(b);
  const equal = crypto.timingSafeEqual(bufA, bufB);
  return equal && a.length === b.length;
}

/**
 * Validate a bearer token against configured peers and advanced tokens.
 * Checks: basic peers.json tokens, shared env token, AND tokens.json (expiry/scopes/revocation).
 * @param {string} token
 * @returns {string|null} Peer ID if valid, null otherwise
 */
function validateToken(token) {
  if (!token || typeof token !== 'string') return null;

  // Check advanced tokens first (tokens.json — expiry, scopes, revocation)
  const advanced = validateAdvancedToken(token);
  if (advanced.peerId) {
    // Token found in tokens.json
    if (!advanced.valid) return null; // expired or revoked
    return advanced.peerId;
  }

  // Fall back to basic auth (peers.json + shared token)
  const peers = loadPeersConfig();
  const sharedToken = process.env.A2A_SHARED_TOKEN;

  if (sharedToken && safeEqual(token, sharedToken)) {
    return '__shared__';
  }

  const peer = peers.find((p) => safeEqual(p.token, token));
  return peer ? peer.id : null;
}

/**
 * Build a UserBuilder function for the A2A SDK Express middleware.
 * Returns a User object with isAuthenticated and userName.
 * @returns {function} UserBuilder compatible with @a2a-js/sdk/server/express
 */
function createUserBuilder() {
  return async function userBuilder(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { get isAuthenticated() { return false; }, get userName() { return 'anonymous'; } };
    }

    const token = authHeader.slice(7);
    const peerId = validateToken(token);

    if (!peerId) {
      logger.warn(`Invalid token attempt: ${token.slice(0, 8)}...`);
      return { get isAuthenticated() { return false; }, get userName() { return 'anonymous'; } };
    }

    logger.info(`Authenticated peer: ${peerId}`);
    return { get isAuthenticated() { return true; }, get userName() { return peerId; }, _token: token };
  };
}

// Simple in-memory rate limiter for auth failures
const _authFailures = {};
const AUTH_FAIL_LIMIT = 10;
const AUTH_FAIL_WINDOW = 60000; // 1 minute

// Periodic cleanup of old auth failure entries
setInterval(() => {
  const now = Date.now();
  for (const ip of Object.keys(_authFailures)) {
    _authFailures[ip].timestamps = _authFailures[ip].timestamps.filter(t => now - t < AUTH_FAIL_WINDOW);
    if (_authFailures[ip].timestamps.length === 0) delete _authFailures[ip];
  }
}, AUTH_FAIL_WINDOW).unref();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = _authFailures[ip];
  if (!entry) return false;
  // Clean old entries
  entry.timestamps = entry.timestamps.filter(t => now - t < AUTH_FAIL_WINDOW);
  return entry.timestamps.length >= AUTH_FAIL_LIMIT;
}

function recordAuthFailure(ip) {
  const now = Date.now();
  if (!_authFailures[ip]) _authFailures[ip] = { timestamps: [] };
  _authFailures[ip].timestamps.push(now);
}

/**
 * Express middleware that rejects unauthenticated requests.
 * Use this on endpoints that require auth BEFORE the SDK middleware.
 */
function requireAuth(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress;

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many failed authentication attempts. Try again later.' });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    recordAuthFailure(ip);
    return res.status(401).json({ error: 'Missing or invalid Authorization header. Include: Authorization: Bearer <your-token>' });
  }

  const token = authHeader.slice(7);
  const peerId = validateToken(token);

  if (!peerId) {
    recordAuthFailure(ip);
    logger.warn(`Rejected token: ${token.slice(0, 8)}...`);
    return res.status(403).json({ error: 'Invalid bearer token. Check your token matches the peer config. See: docs/TROUBLESHOOTING.md' });
  }

  req.peerId = peerId;
  next();
}

module.exports = { validateToken, createUserBuilder, requireAuth };
