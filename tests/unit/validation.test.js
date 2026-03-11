'use strict';

const { validateString, validateUrl, validatePath, validateMessageParams, sanitizeForLog } = require('../../src/validation');

describe('Input Validation', () => {
  describe('validateString', () => {
    test('accepts normal strings', () => {
      expect(validateString('hello world').valid).toBe(true);
    });

    test('rejects null bytes', () => {
      expect(validateString('hello\x00world').valid).toBe(false);
    });

    test('rejects too-long strings', () => {
      expect(validateString('x'.repeat(20000), 10000).valid).toBe(false);
    });

    test('allows newlines and tabs', () => {
      expect(validateString('line1\nline2\ttab').valid).toBe(true);
    });
  });

  describe('validateUrl', () => {
    test('accepts http URLs', () => {
      expect(validateUrl('http://10.0.1.10:9100').valid).toBe(true);
    });

    test('accepts https URLs', () => {
      expect(validateUrl('https://example.com').valid).toBe(true);
    });

    test('rejects file:// URLs', () => {
      expect(validateUrl('file:///etc/passwd').valid).toBe(false);
    });

    test('rejects URLs with credentials', () => {
      expect(validateUrl('http://user-pass-at-host.invalid').valid).toBe(false);
    });

    test('rejects invalid URLs', () => {
      expect(validateUrl('not a url').valid).toBe(false);
    });
  });

  describe('validatePath', () => {
    test('accepts normal paths', () => {
      expect(validatePath('/home/user/file.txt').valid).toBe(true);
    });

    test('rejects path traversal', () => {
      expect(validatePath('../../etc/passwd').valid).toBe(false);
    });

    test('rejects /etc/ access', () => {
      expect(validatePath('/etc/shadow').valid).toBe(false);
    });

    test('rejects /root/ access', () => {
      expect(validatePath('/root/.ssh/id_rsa').valid).toBe(false);
    });
  });

  describe('validateMessageParams', () => {
    test('accepts valid message', () => {
      const params = { message: { parts: [{ kind: 'text', text: 'ping' }] } };
      expect(validateMessageParams(params).valid).toBe(true);
    });

    test('rejects missing message', () => {
      expect(validateMessageParams({}).valid).toBe(false);
    });

    test('rejects empty parts', () => {
      expect(validateMessageParams({ message: { parts: [] } }).valid).toBe(false);
    });

    test('rejects null byte in text', () => {
      const params = { message: { parts: [{ kind: 'text', text: 'hello\x00' }] } };
      expect(validateMessageParams(params).valid).toBe(false);
    });
  });

  describe('sanitizeForLog', () => {
    test('redacts hex tokens', () => {
      const input = 'token=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      expect(sanitizeForLog(input)).toContain('[REDACTED]');
    });

    test('truncates long strings', () => {
      const input = 'x'.repeat(500);
      expect(sanitizeForLog(input).length).toBe(200);
    });
  });
});
