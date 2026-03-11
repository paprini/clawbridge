'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

// Isolated config with permissions
const tmpDir = path.join(os.tmpdir(), `a2a-pipeline-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });
fs.copyFileSync(path.join(__dirname, '..', '..', 'config', 'skills.json'), path.join(tmpDir, 'skills.json'));
fs.writeFileSync(path.join(tmpDir, 'agent.json'), JSON.stringify({
  id: 'pipeline-test-agent',
  name: 'Pipeline Test Agent',
  description: 'Pipeline test fixture',
  url: 'http://127.0.0.1:9100/a2a',
  version: '0.2.0',
}, null, 2));
fs.writeFileSync(path.join(tmpDir, 'peers.json'), JSON.stringify({ peers: [] }, null, 2));
fs.writeFileSync(path.join(tmpDir, 'bridge.json'), JSON.stringify({ enabled: false }));

// Permissions: allow 'allowed-peer' ping+get_status, deny 'denied-peer'
fs.writeFileSync(path.join(tmpDir, 'permissions.json'), JSON.stringify({
  default: 'deny',
  permissions: {
    '__shared__': ['ping', 'get_status'],
    'denied-peer': [],
  },
}));

// Tight rate limits for testing
fs.writeFileSync(path.join(tmpDir, 'rate-limits.json'), JSON.stringify({
  global: { requests_per_minute: 1000, burst: 1000 },
  per_peer: { requests_per_minute: 10, burst: 3 },
  per_skill: {},
}));

const request = require('supertest');

function loadFreshServer() {
  delete require.cache[require.resolve('../../src/server')];
  delete require.cache[require.resolve('../../src/auth')];
  delete require.cache[require.resolve('../../src/config')];
  delete require.cache[require.resolve('../../src/rate-limiter')];
  delete require.cache[require.resolve('../../src/ddos-protection')];
  return require('../../src/server').createServer();
}

describe('Full Pipeline Integration', () => {
  let app;
  const originalConfigDir = process.env.A2A_CONFIG_DIR;
  const originalSharedToken = process.env.A2A_SHARED_TOKEN;

  beforeEach(() => {
    process.env.A2A_CONFIG_DIR = tmpDir;
    process.env.A2A_SHARED_TOKEN = 'pipeline_test_token_1234567890abcdef';
    app = loadFreshServer();
  });

  afterAll(() => {
    process.env.A2A_CONFIG_DIR = originalConfigDir;
    process.env.A2A_SHARED_TOKEN = originalSharedToken;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const auth = { Authorization: 'Bearer pipeline_test_token_1234567890abcdef' };

  function sendMessage(text) {
    return request(app).post('/a2a').set(auth).set('Content-Type', 'application/json').send({
      jsonrpc: '2.0', method: 'message/send', id: Date.now(),
      params: { message: { kind: 'message', messageId: `test-${Date.now()}`, role: 'user', parts: [{ kind: 'text', text }] } },
    });
  }

  describe('Permissions in pipeline', () => {
    test('allowed peer can ping', async () => {
      const res = await sendMessage('ping');
      expect(res.status).toBe(200);
      const text = res.body.result?.parts?.[0]?.text;
      const parsed = JSON.parse(text);
      expect(parsed.status).toBe('pong');
    });

    test('allowed peer can get_status', async () => {
      const res = await sendMessage('get_status');
      expect(res.status).toBe(200);
      const text = res.body.result?.parts?.[0]?.text;
      const parsed = JSON.parse(text);
      expect(parsed.agent).toBeDefined();
    });
  });

  describe('Rate limiting in pipeline', () => {
    test('rate limits after burst exceeded', async () => {
      // Burn through the per-peer burst (3)
      // Note: previous tests already used some tokens
      let rateLimited = false;
      for (let i = 0; i < 20; i++) {
        const res = await sendMessage('ping');
        const text = res.body.result?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed.error && parsed.error.includes('Rate limited')) {
            rateLimited = true;
            expect(parsed.retryAfter).toBeGreaterThan(0);
            break;
          }
        }
      }
      expect(rateLimited).toBe(true);
    });
  });

  describe('DDoS protection in pipeline', () => {
    test('health endpoint works through DDoS middleware', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });

    test('status endpoint works through DDoS middleware', async () => {
      const res = await request(app).get('/status');
      expect(res.status).toBe(200);
      expect(res.body.name).toBeDefined();
      expect(res.body.skills).toBeDefined();
      // Should NOT contain sensitive info
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('token');
      expect(body).not.toContain('Bearer');
    });

    test('metrics endpoint returns Prometheus format', async () => {
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toContain('a2a_calls_total');
      expect(res.text).toContain('# TYPE');
    });
  });

  describe('Input validation in pipeline', () => {
    test('rejects null bytes in message', async () => {
      const res = await request(app).post('/a2a').set(auth).set('Content-Type', 'application/json').send({
        jsonrpc: '2.0', method: 'message/send', id: 1,
        params: { message: { kind: 'message', messageId: 'val-1', role: 'user', parts: [{ kind: 'text', text: 'ping\x00inject' }] } },
      });
      expect(res.status).toBe(200);
      const text = res.body.result?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        expect(parsed.error).toContain('Invalid input');
      }
    });
  });
});
