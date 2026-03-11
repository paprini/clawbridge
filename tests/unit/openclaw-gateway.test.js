'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('child_process', () => ({
  execFile: jest.fn(),
  execFileSync: jest.fn(),
}));

const tmpDir = path.join(os.tmpdir(), `clawbridge-gateway-test-${Date.now()}`);
const openClawConfigPath = path.join(tmpDir, 'openclaw.json');
const fakeOpenClawPath = path.join(tmpDir, 'openclaw');
const fakePrefixedOpenClawPath = path.join(tmpDir, 'openclaw-prefix', 'bin', 'openclaw');
const { execFile, execFileSync } = require('child_process');

const {
  buildOpenClawCommandCandidates,
  getOpenClawCommand,
  isOpenClawCliAvailable,
  invokeGatewayTool,
  listGatewayAgentIds,
  parseOpenClawJsonOutput,
  resolveGatewayAgentId,
  resolveGatewayBindingAgentId,
  resolveGatewayDefaultAgentId,
  resolveOpenClawCommand,
  runOpenClawAgentTurn,
  unwrapGatewayToolResult,
} = require('../../src/openclaw-gateway');

describe('openclaw gateway helpers', () => {
  const originalConfigDir = process.env.A2A_CONFIG_DIR;
  const originalOpenClawBin = process.env.OPENCLAW_BIN;
  const originalFetch = global.fetch;

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(fakeOpenClawPath, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(fakeOpenClawPath, 0o755);
    fs.mkdirSync(path.dirname(fakePrefixedOpenClawPath), { recursive: true });
    fs.writeFileSync(fakePrefixedOpenClawPath, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(fakePrefixedOpenClawPath, 0o755);
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
            peer: { kind: 'channel', id: '1234567890123456789' },
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

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENCLAW_BIN = fakeOpenClawPath;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalConfigDir === undefined) {
      delete process.env.A2A_CONFIG_DIR;
    } else {
      process.env.A2A_CONFIG_DIR = originalConfigDir;
    }
    if (originalOpenClawBin === undefined) {
      delete process.env.OPENCLAW_BIN;
    } else {
      process.env.OPENCLAW_BIN = originalOpenClawBin;
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

  test('parses OpenClaw JSON output with banner noise', () => {
    expect(parseOpenClawJsonOutput('banner\n{"result":{"status":"ok"}}\n'))
      .toEqual({ result: { status: 'ok' } });
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
      peerId: '1234567890123456789',
    })).toBe('discord-helper');
  });

  test('prefers a known explicit agent id, otherwise falls back to binding/default', () => {
    expect(resolveGatewayAgentId({
      tokenPath: openClawConfigPath,
      preferredAgentId: 'discord-helper',
      channel: 'discord',
      peerKind: 'channel',
      peerId: '1234567890123456789',
    })).toBe('discord-helper');

    expect(resolveGatewayAgentId({
      tokenPath: openClawConfigPath,
      preferredAgentId: 'missing-agent',
      channel: 'discord',
      peerKind: 'channel',
      peerId: '1234567890123456789',
    })).toBe('discord-helper');

    expect(resolveGatewayAgentId({
      tokenPath: openClawConfigPath,
      preferredAgentId: 'missing-agent',
      channel: 'telegram',
      peerKind: 'direct',
      peerId: '1234567890',
    })).toBe('main');
  });

  test('builds an OpenClaw agent command with explicit reply overrides', async () => {
    execFile.mockImplementation((command, args, options, callback) => {
      callback(null, {
        stdout: JSON.stringify({ result: { status: 'ok', payloads: [] } }),
        stderr: '',
      });
    });

    await expect(runOpenClawAgentTurn({
      message: 'Hello from ClawBridge',
      agentId: 'discord-helper',
      sessionId: 'abc-session',
      target: '1234567890123456789',
      channel: 'discord',
      replyTo: '1234567890123456789',
      replyChannel: 'discord',
      replyAccountId: 'default',
      timeoutSeconds: 45,
    })).resolves.toEqual({ result: { status: 'ok', payloads: [] } });

    expect(execFile).toHaveBeenCalledWith(
      fakeOpenClawPath,
      [
        'agent',
        '--json',
        '--deliver',
        '--message',
        'Hello from ClawBridge',
        '--session-id',
        'abc-session',
        '--channel',
        'discord',
        '--reply-to',
        '1234567890123456789',
        '--reply-channel',
        'discord',
        '--reply-account',
        'default',
        '--timeout',
        '45',
      ],
      expect.objectContaining({
        timeout: 75000,
        maxBuffer: 1024 * 1024,
      }),
      expect.any(Function),
    );
  });

  test('does not pass --agent when an explicit session id is provided', async () => {
    execFile.mockImplementation((command, args, options, callback) => {
      callback(null, {
        stdout: JSON.stringify({ result: { status: 'ok', payloads: [] } }),
        stderr: '',
      });
    });

    await expect(runOpenClawAgentTurn({
      message: 'Stay on the explicit session',
      agentId: 'discord-helper',
      sessionId: 'provider-bound-session',
      channel: 'discord',
      replyTo: '1234567890123456789',
      replyChannel: 'discord',
      deliver: false,
      timeoutSeconds: 30,
    })).resolves.toEqual({ result: { status: 'ok', payloads: [] } });

    const calledArgs = execFile.mock.calls[0][1];
    expect(calledArgs).toEqual(expect.arrayContaining([
      'agent',
      '--json',
      '--message',
      'Stay on the explicit session',
      '--session-id',
      'provider-bound-session',
      '--channel',
      'discord',
      '--reply-to',
      '1234567890123456789',
      '--reply-channel',
      'discord',
    ]));
    expect(calledArgs).not.toContain('--agent');
    expect(calledArgs).not.toContain('discord-helper');
  });

  test('can run an OpenClaw agent turn without local provider delivery', async () => {
    execFile.mockImplementation((command, args, options, callback) => {
      callback(null, {
        stdout: JSON.stringify({ result: { status: 'ok', payloads: [{ text: 'reply' }] } }),
        stderr: '',
      });
    });

    await expect(runOpenClawAgentTurn({
      message: 'Relay this back remotely',
      agentId: 'main',
      sessionId: 'relay-session',
      channel: 'discord',
      replyTo: '1234567890123456789',
      replyChannel: 'discord',
      deliver: false,
      timeoutSeconds: 30,
    })).resolves.toEqual({ result: { status: 'ok', payloads: [{ text: 'reply' }] } });

    const calledArgs = execFile.mock.calls[0][1];
    expect(calledArgs).toEqual(expect.arrayContaining([
      'agent',
      '--json',
      '--message',
      'Relay this back remotely',
      '--session-id',
      'relay-session',
    ]));
    expect(calledArgs).not.toContain('--deliver');
    expect(calledArgs).not.toContain('--agent');
  });

  test('detects OpenClaw CLI availability', () => {
    expect(resolveOpenClawCommand()).toBe(fakeOpenClawPath);
    expect(getOpenClawCommand()).toBe(fakeOpenClawPath);
    expect(buildOpenClawCommandCandidates()).toContain(fakeOpenClawPath);
    expect(buildOpenClawCommandCandidates()).toContain(path.join(os.homedir(), '.openclaw', 'bin', 'openclaw'));
    expect(isOpenClawCliAvailable()).toBe(true);
  });

  test('includes the documented npm prefix fallback candidate', () => {
    const originalPath = process.env.PATH;
    delete process.env.OPENCLAW_BIN;
    process.env.PATH = '';
    execFileSync.mockReturnValue(`${path.join(tmpDir, 'openclaw-prefix')}\n`);

    try {
      expect(buildOpenClawCommandCandidates()).toContain(fakePrefixedOpenClawPath);
      expect(execFileSync).toHaveBeenCalled();
    } finally {
      process.env.PATH = originalPath;
    }
  });
});
