'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `a2a-config-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(path.join(tmpDir, 'agent.json'), JSON.stringify({
  id: 'config-test-agent',
  name: 'Config Test Agent',
  description: 'Config test fixture',
  url: 'http://127.0.0.1:9100/a2a',
  version: '0.2.0',
}, null, 2));
fs.writeFileSync(path.join(tmpDir, 'peers.json'), JSON.stringify({ peers: [] }, null, 2));
fs.copyFileSync(path.join(__dirname, '..', '..', 'config', 'skills.json'), path.join(tmpDir, 'skills.json'));

// Point config to an isolated config dir for these tests
process.env.A2A_CONFIG_DIR = tmpDir;

const { loadAgentConfig, loadPeersConfig, loadSkillsConfig } = require('../../src/config');

describe('Config Loading', () => {
  afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  test('loadAgentConfig returns agent config', () => {
    const agent = loadAgentConfig();
    expect(agent).toHaveProperty('id');
    expect(agent).toHaveProperty('name');
    expect(typeof agent.id).toBe('string');
  });

  test('loadPeersConfig returns array of peers', () => {
    const peers = loadPeersConfig();
    expect(Array.isArray(peers)).toBe(true);
    if (peers.length > 0) {
      expect(peers[0]).toHaveProperty('id');
      expect(peers[0]).toHaveProperty('url');
      expect(peers[0]).toHaveProperty('token');
    }
  });

  test('loadSkillsConfig returns array of skills', () => {
    const skills = loadSkillsConfig();
    expect(Array.isArray(skills)).toBe(true);
    expect(skills.length).toBeGreaterThan(0);
    expect(skills[0]).toHaveProperty('name');
    expect(skills[0]).toHaveProperty('public');
  });

  test('loadConfig throws on missing file', () => {
    // Clear cache and module cache so config re-reads env
    const { clearCache } = require('../../src/config');
    const orig = process.env.A2A_CONFIG_DIR;
    clearCache();
    process.env.A2A_CONFIG_DIR = '/nonexistent';
    delete require.cache[require.resolve('../../src/config')];
    const { loadAgentConfig: reload } = require('../../src/config');
    expect(() => reload()).toThrow('Config file not found');
    process.env.A2A_CONFIG_DIR = orig;
    delete require.cache[require.resolve('../../src/config')];
  });
});
