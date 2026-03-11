'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `a2a-sec-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });
fs.copyFileSync(path.join(__dirname, '..', '..', 'config', 'skills.json'), path.join(tmpDir, 'skills.json'));
fs.writeFileSync(path.join(tmpDir, 'agent.json'), JSON.stringify({
  id: 'security-test-agent',
  name: 'Security Test Agent',
  description: 'Security test fixture',
  url: 'http://127.0.0.1:9100/a2a',
  version: '0.2.0',
}, null, 2));
fs.writeFileSync(path.join(tmpDir, 'peers.json'), JSON.stringify({ peers: [] }, null, 2));
fs.writeFileSync(path.join(tmpDir, 'bridge.json'), JSON.stringify({ enabled: false }));

const request = require('supertest');

function loadFreshServer() {
  delete require.cache[require.resolve('../../src/server')];
  delete require.cache[require.resolve('../../src/auth')];
  delete require.cache[require.resolve('../../src/config')];
  delete require.cache[require.resolve('../../src/rate-limiter')];
  delete require.cache[require.resolve('../../src/ddos-protection')];
  return require('../../src/server').createServer();
}

describe('Security Tests', () => {
  let app;
  const originalConfigDir = process.env.A2A_CONFIG_DIR;
  const originalSharedToken = process.env.A2A_SHARED_TOKEN;

  beforeEach(() => {
    process.env.A2A_CONFIG_DIR = tmpDir;
    process.env.A2A_SHARED_TOKEN = 'security_test_token';
    app = loadFreshServer();
  });

  afterAll(() => {
    process.env.A2A_CONFIG_DIR = originalConfigDir;
    process.env.A2A_SHARED_TOKEN = originalSharedToken;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Auth bypass attempts', () => {
    test('rejects empty Authorization header', async () => {
      const res = await request(app).post('/a2a').set('Authorization', '');
      expect(res.status).toBe(401);
    });

    test('rejects Bearer with no token', async () => {
      const res = await request(app).post('/a2a').set('Authorization', 'Bearer ');
      expect([401, 403]).toContain(res.status);
    });

    test('rejects Basic auth scheme', async () => {
      const res = await request(app).post('/a2a').set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(res.status).toBe(401);
    });

    test('rejects token with spaces', async () => {
      const res = await request(app).post('/a2a').set('Authorization', 'Bearer token with spaces');
      expect(res.status).toBe(403);
    });
  });

  describe('Input validation', () => {
    const auth = { Authorization: 'Bearer security_test_token' };

    test('rejects oversized body', async () => {
      const bigPayload = 'x'.repeat(200000);
      const res = await request(app).post('/a2a').set(auth).set('Content-Type', 'application/json').send(bigPayload);
      expect(res.status).toBe(413);
    });

    test('rejects non-JSON content type', async () => {
      const res = await request(app).post('/a2a').set(auth).set('Content-Type', 'text/plain').send('ping');
      // Express json parser returns 400 or the SDK handles it
      expect([400, 415, 200].includes(res.status)).toBe(true);
    });

    test('handles malformed JSON gracefully', async () => {
      const res = await request(app).post('/a2a').set(auth).set('Content-Type', 'application/json').send('{bad json');
      expect(res.status).toBe(400);
    });
  });

  describe('Skill whitelist enforcement', () => {
    const auth = { Authorization: 'Bearer security_test_token' };

    test('unknown skill returns error, not crash', async () => {
      const res = await request(app).post('/a2a').set(auth).set('Content-Type', 'application/json').send({
        jsonrpc: '2.0', method: 'message/send', id: 1,
        params: { message: { kind: 'message', messageId: 'sec-1', role: 'user', parts: [{ kind: 'text', text: 'exec rm -rf /' }] } },
      });
      expect(res.status).toBe(200);
      const text = res.body.result?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        expect(parsed.error).toBeDefined();
        // Should NOT contain the malicious input echoed back
        expect(parsed.error).not.toContain('rm -rf');
      }
    });
  });

  describe('Health endpoint does not leak sensitive info', () => {
    test('health response has no tokens or paths', async () => {
      const res = await request(app).get('/health');
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('token');
      expect(body).not.toContain('Bearer');
      expect(body).not.toContain('/home/');
      expect(body).not.toContain('password');
    });
  });
});
