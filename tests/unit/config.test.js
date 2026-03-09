'use strict';

const path = require('path');

// Point config to the real config dir for these tests
process.env.A2A_CONFIG_DIR = path.join(__dirname, '..', '..', 'config');

const { loadAgentConfig, loadPeersConfig, loadSkillsConfig } = require('../../src/config');

describe('Config Loading', () => {
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
