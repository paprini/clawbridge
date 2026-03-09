'use strict';

const path = require('path');
process.env.A2A_CONFIG_DIR = path.join(__dirname, '..', '..', 'config');
process.env.A2A_SHARED_TOKEN = 'integration_test_token';

const request = require('supertest');
const { createServer } = require('../../src/server');

describe('A2A Server Integration', () => {
  let app;

  beforeAll(() => {
    app = createServer();
  });

  describe('GET /health', () => {
    test('returns healthy status without auth', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /.well-known/agent-card.json', () => {
    test('returns valid Agent Card without auth', async () => {
      const res = await request(app).get('/.well-known/agent-card.json');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('skills');
      expect(res.body).toHaveProperty('protocolVersion', '0.3.0');
      expect(res.body.skills.length).toBeGreaterThan(0);
    });

    test('Agent Card has required A2A fields', async () => {
      const res = await request(app).get('/.well-known/agent-card.json');
      const card = res.body;
      expect(card).toHaveProperty('name');
      expect(card).toHaveProperty('description');
      expect(card).toHaveProperty('url');
      expect(card).toHaveProperty('version');
      expect(card).toHaveProperty('protocolVersion');
      expect(card).toHaveProperty('capabilities');
      expect(card).toHaveProperty('defaultInputModes');
      expect(card).toHaveProperty('defaultOutputModes');
      expect(card).toHaveProperty('skills');
    });
  });

  describe('POST /a2a (JSON-RPC)', () => {
    test('rejects request without auth', async () => {
      const res = await request(app)
        .post('/a2a')
        .send({ jsonrpc: '2.0', method: 'message/send', params: {}, id: 1 });
      expect(res.status).toBe(401);
    });

    test('rejects request with invalid token', async () => {
      const res = await request(app)
        .post('/a2a')
        .set('Authorization', 'Bearer wrong_token')
        .send({ jsonrpc: '2.0', method: 'message/send', params: {}, id: 1 });
      expect(res.status).toBe(403);
    });

    test('ping returns pong', async () => {
      const res = await request(app)
        .post('/a2a')
        .set('Authorization', 'Bearer integration_test_token')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'message/send',
          params: {
            message: {
              kind: 'message',
              messageId: 'int-test-1',
              role: 'user',
              parts: [{ kind: 'text', text: 'ping' }],
            },
          },
          id: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.jsonrpc).toBe('2.0');
      expect(res.body.id).toBe(1);
      expect(res.body.result).toHaveProperty('kind', 'message');

      const text = res.body.result.parts[0].text;
      const parsed = JSON.parse(text);
      expect(parsed.status).toBe('pong');
    });

    test('get_status returns agent info', async () => {
      const res = await request(app)
        .post('/a2a')
        .set('Authorization', 'Bearer integration_test_token')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'message/send',
          params: {
            message: {
              kind: 'message',
              messageId: 'int-test-2',
              role: 'user',
              parts: [{ kind: 'text', text: 'get_status' }],
            },
          },
          id: 2,
        });

      expect(res.status).toBe(200);
      const text = res.body.result.parts[0].text;
      const parsed = JSON.parse(text);
      expect(parsed.agent).toHaveProperty('id');
      expect(parsed).toHaveProperty('uptime');
      expect(parsed).toHaveProperty('skills');
    });

    test('unknown skill returns error in response', async () => {
      const res = await request(app)
        .post('/a2a')
        .set('Authorization', 'Bearer integration_test_token')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'message/send',
          params: {
            message: {
              kind: 'message',
              messageId: 'int-test-3',
              role: 'user',
              parts: [{ kind: 'text', text: 'drop_database' }],
            },
          },
          id: 3,
        });

      expect(res.status).toBe(200);
      const text = res.body.result.parts[0].text;
      const parsed = JSON.parse(text);
      expect(parsed).toHaveProperty('error');
    });
  });
});
