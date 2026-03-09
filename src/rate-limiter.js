'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Token bucket rate limiter with global, per-peer, and per-skill limits.
 * Loads config from config/rate-limits.json or uses sensible defaults.
 */
class RateLimiter {
  constructor() {
    this.buckets = new Map(); // key → { tokens, lastRefill }
    this.config = this._loadConfig();
  }

  _loadConfig() {
    const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', 'config');
    const filePath = path.join(configDir, 'rate-limits.json');

    if (!fs.existsSync(filePath)) {
      // Sensible defaults
      return {
        global: { requests_per_minute: 200, burst: 50 },
        per_peer: { requests_per_minute: 60, burst: 15 },
        per_skill: {},
      };
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  /**
   * Check if a request is allowed. Consumes a token if allowed.
   * @param {string} peerId
   * @param {string} skillName
   * @returns {{ allowed: boolean, retryAfter?: number }}
   */
  check(peerId, skillName) {
    const now = Date.now();

    // Check global limit
    const globalResult = this._checkBucket('global', this.config.global, now);
    if (!globalResult.allowed) return globalResult;

    // Check per-peer limit
    const peerResult = this._checkBucket(`peer:${peerId}`, this.config.per_peer, now);
    if (!peerResult.allowed) return peerResult;

    // Check per-skill limit (if configured)
    const skillConfig = this.config.per_skill?.[skillName];
    if (skillConfig) {
      const skillResult = this._checkBucket(`skill:${skillName}:${peerId}`, skillConfig, now);
      if (!skillResult.allowed) return skillResult;
    }

    return { allowed: true };
  }

  _checkBucket(key, config, now) {
    if (!config || !config.requests_per_minute) return { allowed: true };

    let bucket = this.buckets.get(key);
    const rate = config.requests_per_minute / 60000; // tokens per ms
    const maxTokens = config.burst || config.requests_per_minute;

    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed * rate);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }

    // Calculate retry-after in seconds
    const retryAfter = Math.ceil((1 - bucket.tokens) / rate / 1000);
    return { allowed: false, retryAfter };
  }
}

// Singleton
let _instance = null;
function getRateLimiter() {
  if (!_instance) _instance = new RateLimiter();
  return _instance;
}

module.exports = { RateLimiter, getRateLimiter };
