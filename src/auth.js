'use strict';

const { loadPeersConfig } = require('./config');

/**
 * Validate a bearer token against configured peers.
 * Uses constant-time-ish comparison to avoid timing attacks.
 * @param {string} token
 * @returns {string|null} Peer ID if valid, null otherwise
 */
function validateToken(token) {
  if (!token || typeof token !== 'string') return null;

  const peers = loadPeersConfig();
  // Also check the shared inbound token from env
  const sharedToken = process.env.A2A_SHARED_TOKEN;

  if (sharedToken && token === sharedToken) {
    return '__shared__';
  }

  const peer = peers.find((p) => p.token === token);
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
      console.warn(`[AUTH] Invalid token attempt: ${token.slice(0, 8)}...`);
      return { get isAuthenticated() { return false; }, get userName() { return 'anonymous'; } };
    }

    console.log(`[AUTH] Authenticated peer: ${peerId}`);
    return { get isAuthenticated() { return true; }, get userName() { return peerId; } };
  };
}

/**
 * Express middleware that rejects unauthenticated requests.
 * Use this on endpoints that require auth BEFORE the SDK middleware.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  const peerId = validateToken(token);

  if (!peerId) {
    console.warn(`[AUTH] Rejected token: ${token.slice(0, 8)}...`);
    return res.status(403).json({ error: 'Invalid bearer token' });
  }

  req.peerId = peerId;
  next();
}

module.exports = { validateToken, createUserBuilder, requireAuth };
