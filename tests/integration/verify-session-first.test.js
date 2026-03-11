'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function writeFakeOpenClaw(rootDir) {
  const binPath = path.join(rootDir, 'openclaw');
  fs.writeFileSync(binPath, '#!/bin/sh\necho "{}"\n');
  fs.chmodSync(binPath, 0o755);
  return binPath;
}

function buildConfigDir({ sessionRows }) {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawbridge-verify-session-'));
  const openclawRoot = path.join(configDir, '.openclaw');
  const openclawConfigPath = path.join(openclawRoot, 'openclaw.json');

  writeJson(path.join(configDir, 'agent.json'), {
    id: 'demo',
    name: 'Demo Agent',
    url: 'http://localhost:9100/a2a',
    openclaw_agent_id: 'main',
    default_delivery: {
      type: 'owner',
      target: '1234567890',
      channel: 'telegram',
    },
  });
  writeJson(path.join(configDir, 'peers.json'), { peers: [] });
  fs.chmodSync(path.join(configDir, 'peers.json'), 0o600);
  writeJson(path.join(configDir, 'skills.json'), {
    exposed_skills: [
      { name: 'ping', public: true },
      { name: 'chat', public: true },
    ],
  });
  writeJson(path.join(configDir, 'bridge.json'), {
    enabled: true,
    gateway: {
      url: 'http://127.0.0.1:18789',
      tokenPath: openclawConfigPath,
      sessionKey: 'main',
    },
    agent_dispatch: {
      enabled: true,
      sessionKey: 'auto',
      timeoutSeconds: 30,
    },
    exposed_tools: ['message'],
  });
  writeJson(openclawConfigPath, {
    gateway: {
      auth: { token: 'test-token' },
    },
    agents: {
      list: [{ id: 'main' }],
    },
    session: {
      dmScope: 'per-channel-peer',
    },
  });
  writeJson(path.join(openclawRoot, 'agents', 'main', 'sessions', 'sessions.json'), sessionRows);

  return { configDir, openclawRoot };
}

function runVerify(configDir, openclawBin) {
  return spawnSync(process.execPath, ['src/verify.js'], {
    cwd: path.join(__dirname, '..', '..'),
    env: {
      ...process.env,
      A2A_CONFIG_DIR: configDir,
      A2A_SHARED_TOKEN: 'test-shared-token-1234567890abcdef',
      OPENCLAW_BIN: openclawBin,
    },
    encoding: 'utf8',
  });
}

describe('verify direct session evidence', () => {
  test('fails when OpenClaw collapses a direct Telegram target onto the main session', () => {
    const { configDir, openclawRoot } = buildConfigDir({
      sessionRows: {
        'agent:main:main': {
          deliveryContext: {
            channel: 'telegram',
            to: '1234567890',
          },
          lastChannel: 'telegram',
          lastTo: '1234567890',
        },
      },
    });

    const result = runVerify(configDir, writeFakeOpenClaw(openclawRoot));

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('agent-to-agent dispatch readiness');
    expect(result.stdout).toContain('agent:main:main');
    expect(result.stdout).toContain('provider-bound direct session');
  });

  test('passes when a provider-bound direct Telegram session exists', () => {
    const { configDir, openclawRoot } = buildConfigDir({
      sessionRows: {
        'agent:main:telegram:direct:1234567890': {
          deliveryContext: {
            channel: 'telegram',
            to: '1234567890',
          },
          lastChannel: 'telegram',
          lastTo: '1234567890',
        },
      },
    });

    const result = runVerify(configDir, writeFakeOpenClaw(openclawRoot));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Found provider-bound direct OpenClaw session');
  });
});
