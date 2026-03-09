'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `a2a-token-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });
process.env.A2A_CONFIG_DIR = tmpDir;

const { validateAdvancedToken, scopeAllowsSkill, generateManagedToken, revokeToken } = require('../../src/token-manager');

describe('Token Manager', () => {
  afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  describe('no tokens.json (backward compat)', () => {
    test('returns valid with no peerId', () => {
      const result = validateAdvancedToken('any-token');
      expect(result.valid).toBe(true);
    });
  });

  describe('with tokens.json', () => {
    const testToken = 'a'.repeat(64);
    const expiredToken = 'b'.repeat(64);
    const revokedToken = 'c'.repeat(64);

    beforeAll(() => {
      fs.writeFileSync(path.join(tmpDir, 'tokens.json'), JSON.stringify({
        tokens: [
          { id: 'test-1', token: testToken, peerId: 'laptop', scopes: ['read', 'write'], expiresAt: '2030-01-01T00:00:00Z', revoked: false },
          { id: 'test-2', token: expiredToken, peerId: 'old-device', scopes: ['read'], expiresAt: '2020-01-01T00:00:00Z', revoked: false },
          { id: 'test-3', token: revokedToken, peerId: 'stolen', scopes: ['admin'], revoked: true },
        ],
      }));
    });

    test('validates good token', () => {
      const result = validateAdvancedToken(testToken);
      expect(result.valid).toBe(true);
      expect(result.peerId).toBe('laptop');
      expect(result.scopes).toContain('read');
    });

    test('rejects expired token', () => {
      const result = validateAdvancedToken(expiredToken);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('expired');
    });

    test('rejects revoked token', () => {
      const result = validateAdvancedToken(revokedToken);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('revoked');
    });

    test('rejects unknown token', () => {
      const result = validateAdvancedToken('x'.repeat(64));
      expect(result.valid).toBe(false);
    });
  });

  describe('scopeAllowsSkill', () => {
    test('read scope allows ping', () => {
      expect(scopeAllowsSkill(['read'], 'ping')).toBe(true);
    });

    test('read scope denies exec', () => {
      expect(scopeAllowsSkill(['read'], 'openclaw_exec')).toBe(false);
    });

    test('admin scope allows everything', () => {
      expect(scopeAllowsSkill(['admin'], 'anything')).toBe(true);
    });

    test('empty scopes allows all (backward compat)', () => {
      expect(scopeAllowsSkill([], 'anything')).toBe(true);
    });
  });

  describe('generateManagedToken', () => {
    test('generates valid token', () => {
      const t = generateManagedToken({ peerId: 'test', scopes: ['read'] });
      expect(t.token).toHaveLength(64);
      expect(t.peerId).toBe('test');
      expect(t.scopes).toContain('read');
      expect(t.revoked).toBe(false);
    });

    test('generates token with expiry', () => {
      const t = generateManagedToken({ peerId: 'test', expiresInDays: 30 });
      expect(t.expiresAt).toBeTruthy();
      expect(new Date(t.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('revokeToken', () => {
    test('revokes existing token', () => {
      const result = revokeToken('test-1');
      expect(result.success).toBe(true);
    });

    test('fails for unknown token', () => {
      const result = revokeToken('nonexistent');
      expect(result.success).toBe(false);
    });
  });
});
