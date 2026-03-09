'use strict';

/**
 * DDoS protection middleware.
 * - Connection rate limiting per IP
 * - IP blocklist/allowlist
 * - Slowloris protection (request timeout)
 * - Request size already handled by express.json({ limit: '100kb' })
 */

const _connectionCounts = new Map(); // ip → { count, firstSeen }
const _blocklist = new Set();
const _allowlist = new Set();

const CONFIG = {
  maxConnectionsPerMinute: 300,  // Per IP
  blockDurationMs: 600000,       // 10 minutes
  requestTimeoutMs: 30000,       // 30 seconds max per request
  cleanupIntervalMs: 60000,      // Clean old entries every minute
};

// Periodic cleanup
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [ip, data] of _connectionCounts) {
    if (data.firstSeen < cutoff) _connectionCounts.delete(ip);
  }
}, CONFIG.cleanupIntervalMs).unref();

/**
 * Add IP to blocklist.
 * @param {string} ip
 */
function blockIp(ip) { _blocklist.add(ip); }

/**
 * Remove IP from blocklist.
 * @param {string} ip
 */
function unblockIp(ip) { _blocklist.delete(ip); }

/**
 * Add IP to allowlist (bypasses rate limiting).
 * @param {string} ip
 */
function allowIp(ip) { _allowlist.add(ip); }

/**
 * Express middleware for DDoS protection.
 */
function ddosProtection(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress;

  // Check blocklist
  if (_blocklist.has(ip)) {
    return res.status(403).json({ error: 'IP blocked. Contact administrator.' });
  }

  // Skip rate limiting for allowlisted IPs
  if (_allowlist.has(ip)) return next();

  // Connection rate limiting
  const now = Date.now();
  let entry = _connectionCounts.get(ip);

  if (!entry || (now - entry.firstSeen) > 60000) {
    entry = { count: 0, firstSeen: now };
    _connectionCounts.set(ip, entry);
  }

  entry.count++;

  if (entry.count > CONFIG.maxConnectionsPerMinute) {
    // Auto-block for repeated abuse
    if (entry.count > CONFIG.maxConnectionsPerMinute * 2) {
      _blocklist.add(ip);
      setTimeout(() => _blocklist.delete(ip), CONFIG.blockDurationMs);
    }
    return res.status(429).json({
      error: 'Too many requests from this IP. Slow down.',
      retryAfter: 60,
    });
  }

  // Slowloris protection: set request timeout
  req.setTimeout(CONFIG.requestTimeoutMs, () => {
    res.status(408).json({ error: 'Request timeout' });
    req.destroy();
  });

  next();
}

module.exports = { ddosProtection, blockIp, unblockIp, allowIp, CONFIG };
