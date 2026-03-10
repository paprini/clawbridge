'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = path.join(os.tmpdir(), `clawbridge-gateway-test-${Date.now()}`);
const openClawConfigPath = path.join(tmpDir, 'openclaw.json');

const { invokeGatewayTool, unwrapGatewayToolResult } = require('../../src/openclaw-gateway');

describe('openclaw gateway helpers', () => {
  const originalConfigDir = process.env.A2A_CONFIG_DIR;
  const originalFetch = global.fetch;

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    process.env.A2A_CONFIG_DIR = tmpDir;

    fs.writeFileSync(path.join(tmpDir, 'bridge.json'), JSON.stringify({
      enabled: true,
      gateway: {
        url: 'http://127.0.0.1:18789',
        tokenPath: openClawConfigPath,
        sessionKey: 'main',
      },
      timeout_ms: 5000,
    }));

    fs.writeFileSync(openClawConfigPath, JSON.stringify({
      gateway: {
        auth: {
          token: 'test-token',
        },
      },
    }));
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalConfigDir === undefined) {
      delete process.env.A2A_CONFIG_DIR;
    } else {
      process.env.A2A_CONFIG_DIR = originalConfigDir;
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('unwraps tool details payloads', () => {
    expect(unwrapGatewayToolResult({
      content: [{ type: 'text', text: '{"status":"accepted"}' }],
      details: { status: 'accepted' },
    })).toEqual({ status: 'accepted' });
  });

  test('parses JSON text payloads when details are missing', () => {
    expect(unwrapGatewayToolResult({
      content: [{ type: 'text', text: '{"status":"ok","reply":"done"}' }],
    })).toEqual({ status: 'ok', reply: 'done' });
  });

  test('invokeGatewayTool returns the unwrapped result payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        ok: true,
        result: {
          content: [{ type: 'text', text: '{"status":"accepted","sessionKey":"agent:test:main"}' }],
          details: { status: 'accepted', sessionKey: 'agent:test:main' },
        },
      }),
    });

    await expect(invokeGatewayTool('sessions_send', { sessionKey: 'agent:test:main', message: 'hello' }))
      .resolves
      .toEqual({ status: 'accepted', sessionKey: 'agent:test:main' });
  });
});
