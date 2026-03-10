'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = path.join(os.tmpdir(), `clawbridge-gateway-test-${Date.now()}`);
const openClawConfigPath = path.join(tmpDir, 'openclaw.json');

const {
  invokeGatewayTool,
  listGatewayAgentIds,
  resolveGatewayAgentId,
  resolveGatewayBindingAgentId,
  resolveGatewayDefaultAgentId,
  unwrapGatewayToolResult,
} = require('../../src/openclaw-gateway');

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
      agents: {
        list: [
          { id: 'main' },
          { id: 'discord-helper' },
        ],
      },
      bindings: [
        {
          agentId: 'discord-helper',
          match: {
            channel: 'discord',
            peer: { kind: 'channel', id: '1480310282961289216' },
          },
        },
      ],
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

  test('lists configured gateway agent ids', () => {
    expect(listGatewayAgentIds(openClawConfigPath)).toEqual(['main', 'discord-helper']);
    expect(resolveGatewayDefaultAgentId(openClawConfigPath)).toBe('main');
  });

  test('resolves a bound agent id from gateway bindings', () => {
    expect(resolveGatewayBindingAgentId({
      tokenPath: openClawConfigPath,
      channel: 'discord',
      peerKind: 'channel',
      peerId: '1480310282961289216',
    })).toBe('discord-helper');
  });

  test('prefers a known explicit agent id, otherwise falls back to binding/default', () => {
    expect(resolveGatewayAgentId({
      tokenPath: openClawConfigPath,
      preferredAgentId: 'discord-helper',
      channel: 'discord',
      peerKind: 'channel',
      peerId: '1480310282961289216',
    })).toBe('discord-helper');

    expect(resolveGatewayAgentId({
      tokenPath: openClawConfigPath,
      preferredAgentId: 'missing-agent',
      channel: 'discord',
      peerKind: 'channel',
      peerId: '1480310282961289216',
    })).toBe('discord-helper');

    expect(resolveGatewayAgentId({
      tokenPath: openClawConfigPath,
      preferredAgentId: 'missing-agent',
      channel: 'telegram',
      peerKind: 'direct',
      peerId: '5914004682',
    })).toBe('main');
  });
});
