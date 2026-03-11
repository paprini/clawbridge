'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

describe('cli session-proof', () => {
  test('reports collapsed direct-session evidence', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawbridge-cli-session-proof-'));
    const openclawRoot = path.join(configDir, '.openclaw');
    const openclawConfigPath = path.join(openclawRoot, 'openclaw.json');

    writeJson(path.join(configDir, 'agent.json'), {
      id: 'demo',
      name: 'Demo Agent',
      url: 'http://localhost:9100/a2a',
      openclaw_agent_id: 'main',
    });
    writeJson(path.join(configDir, 'peers.json'), { peers: [] });
    writeJson(path.join(configDir, 'skills.json'), { exposed_skills: [{ name: 'ping', public: true }] });
    writeJson(path.join(configDir, 'bridge.json'), {
      gateway: {
        tokenPath: openclawConfigPath,
      },
    });
    writeJson(openclawConfigPath, { gateway: { auth: { token: 'test' } } });
    writeJson(path.join(openclawRoot, 'agents', 'main', 'sessions', 'sessions.json'), {
      'agent:main:main': {
        deliveryContext: {
          channel: 'telegram',
          to: '1234567890',
        },
      },
    });

    const result = spawnSync(process.execPath, ['src/cli.js', 'session-proof', 'telegram', '1234567890'], {
      cwd: path.join(__dirname, '..', '..'),
      env: {
        ...process.env,
        A2A_CONFIG_DIR: configDir,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.provider_bound).toBe(false);
    expect(parsed.collapsed_to_non_provider_session).toBe(true);
    expect(parsed.matching_rows[0].key).toBe('agent:main:main');
  });
});
