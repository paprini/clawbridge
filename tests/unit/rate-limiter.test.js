'use strict';

const { RateLimiter } = require('../../src/rate-limiter');

describe('RateLimiter', () => {
  test('allows requests within limit', () => {
    const limiter = new RateLimiter();
    // Default: 200/min global, 60/min per-peer
    for (let i = 0; i < 15; i++) {
      expect(limiter.check('peer1', 'ping').allowed).toBe(true);
    }
  });

  test('rate limits after burst exceeded', () => {
    const limiter = new RateLimiter();
    // Override config with tight limits for testing
    limiter.config = {
      global: { requests_per_minute: 1000, burst: 1000 },
      per_peer: { requests_per_minute: 10, burst: 3 },
      per_skill: {},
    };

    // Burst of 3 should be allowed
    expect(limiter.check('peer1', 'ping').allowed).toBe(true);
    expect(limiter.check('peer1', 'ping').allowed).toBe(true);
    expect(limiter.check('peer1', 'ping').allowed).toBe(true);

    // 4th should be denied
    const result = limiter.check('peer1', 'ping');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test('different peers have separate limits', () => {
    const limiter = new RateLimiter();
    limiter.config = {
      global: { requests_per_minute: 1000, burst: 1000 },
      per_peer: { requests_per_minute: 10, burst: 2 },
      per_skill: {},
    };

    expect(limiter.check('peer1', 'ping').allowed).toBe(true);
    expect(limiter.check('peer1', 'ping').allowed).toBe(true);
    expect(limiter.check('peer1', 'ping').allowed).toBe(false);

    // peer2 should still have tokens
    expect(limiter.check('peer2', 'ping').allowed).toBe(true);
  });

  test('per-skill limits work', () => {
    const limiter = new RateLimiter();
    limiter.config = {
      global: { requests_per_minute: 1000, burst: 1000 },
      per_peer: { requests_per_minute: 1000, burst: 1000 },
      per_skill: { expensive: { requests_per_minute: 6, burst: 1 } },
    };

    expect(limiter.check('peer1', 'expensive').allowed).toBe(true);
    expect(limiter.check('peer1', 'expensive').allowed).toBe(false);

    // Non-limited skill still works
    expect(limiter.check('peer1', 'ping').allowed).toBe(true);
  });
});
