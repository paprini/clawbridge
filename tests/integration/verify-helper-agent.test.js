'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function buildConfigDir({ helperAgent }) {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawbridge-verify-helper-'));
  writeJson(path.join(configDir, 'agent.json'), {
    id: 'demo',
    name: 'Demo Agent',
    url: 'http://localhost:9100/a2a',
  });
  writeJson(path.join(configDir, 'peers.json'), { peers: [] });
  fs.chmodSync(path.join(configDir, 'peers.json'), 0o600);
  writeJson(path.join(configDir, 'skills.json'), {
    exposed_skills: [
      { name: 'ping', public: true },
    ],
  });
  if (helperAgent) {
    writeJson(path.join(configDir, 'helper-agent.json'), helperAgent);
  }
  return configDir;
}

function runVerify(configDir) {
  return spawnSync(process.execPath, ['src/verify.js'], {
    cwd: path.join(__dirname, '..', '..'),
    env: {
      ...process.env,
      A2A_CONFIG_DIR: configDir,
      A2A_SHARED_TOKEN: 'test-shared-token-1234567890abcdef',
    },
    encoding: 'utf8',
  });
}

describe('verify helper-agent readiness', () => {
  test('passes and reports local-only helper mode by default', () => {
    const configDir = buildConfigDir({
      helperAgent: {
        enabled: true,
        sessionKey: 'helper-demo',
        workspaceDir: '~/.clawbridge/helper-demo',
        bootstrapViaGateway: false,
      },
    });

    const result = runVerify(configDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Helper agent bootstrap readiness');
    expect(result.stdout).toContain('local-only mode');
  });

  test('fails when gateway bootstrap is requested but sessions_spawn is not allowed', () => {
    const configDir = buildConfigDir({});
    const openclawConfigPath = path.join(configDir, 'openclaw.json');
    writeJson(path.join(configDir, 'helper-agent.json'), {
      enabled: true,
      sessionKey: 'helper-demo',
      workspaceDir: '~/.clawbridge/helper-demo',
      bootstrapViaGateway: true,
      gateway: {
        tokenPath: openclawConfigPath,
      },
    });
    writeJson(openclawConfigPath, {
      gateway: {
        auth: { token: 'test-token' },
      },
    });

    const result = runVerify(configDir);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Helper agent bootstrap readiness');
    expect(result.stdout).toContain('sessions_spawn');
  });
});
