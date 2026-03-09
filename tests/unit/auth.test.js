'use strict';

const path = require('path');
process.env.A2A_CONFIG_DIR = path.join(__dirname, '..', '..', 'config');
process.env.A2A_SHARED_TOKEN = 'test_shared_token';

const { validateToken, createUserBuilder } = require('../../src/auth');

describe('Bearer Token Authentication', () => {
  describe('validateToken', () => {
    test('returns peer ID for valid peer token', () => {
      const result = validateToken('a2a_peer_beta_token_789');
      expect(result).toBe('openclaw-test');
    });

    test('returns __shared__ for valid shared token', () => {
      const result = validateToken('test_shared_token');
      expect(result).toBe('__shared__');
    });

    test('returns null for invalid token', () => {
      expect(validateToken('wrong_token')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(validateToken('')).toBeNull();
    });

    test('returns null for null', () => {
      expect(validateToken(null)).toBeNull();
    });

    test('returns null for undefined', () => {
      expect(validateToken(undefined)).toBeNull();
    });

    test('returns null for non-string', () => {
      expect(validateToken(12345)).toBeNull();
    });
  });

  describe('createUserBuilder', () => {
    const userBuilder = createUserBuilder();

    test('returns unauthenticated user when no auth header', async () => {
      const req = { headers: {} };
      const user = await userBuilder(req);
      expect(user.isAuthenticated).toBe(false);
    });

    test('returns unauthenticated user for malformed header', async () => {
      const req = { headers: { authorization: 'Basic abc123' } };
      const user = await userBuilder(req);
      expect(user.isAuthenticated).toBe(false);
    });

    test('returns unauthenticated user for invalid token', async () => {
      const req = { headers: { authorization: 'Bearer invalid' } };
      const user = await userBuilder(req);
      expect(user.isAuthenticated).toBe(false);
    });

    test('returns authenticated user for valid token', async () => {
      const req = { headers: { authorization: 'Bearer test_shared_token' } };
      const user = await userBuilder(req);
      expect(user.isAuthenticated).toBe(true);
      expect(user.userName).toBe('__shared__');
    });
  });
});
