'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

// Use a temp dir for config writes
const tmpDir = path.join(os.tmpdir(), `a2a-test-${Date.now()}`);
process.env.A2A_CONFIG_DIR = tmpDir;

const { generateToken, getCurrentConfig, writeConfig, getLocalSubnet, executeTool } = require('../../src/setup/tools');

beforeAll(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Setup Tools', () => {
  describe('generateToken', () => {
    test('returns 64-char hex string', () => {
      const token = generateToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    test('generates unique tokens', () => {
      const t1 = generateToken();
      const t2 = generateToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('getLocalSubnet', () => {
    test('returns subnet and localIp or null', () => {
      const result = getLocalSubnet();
      // Could be null in CI/containers with no external interface
      if (result) {
        expect(result).toHaveProperty('subnet');
        expect(result).toHaveProperty('localIp');
        expect(result.subnet.split('.')).toHaveLength(3);
      }
    });
  });

  describe('getCurrentConfig', () => {
    test('returns exists:false when no config', () => {
      // tmpDir is empty
      const result = getCurrentConfig();
      expect(result.exists).toBe(false);
      expect(result.agent).toBeNull();
    });
  });

  describe('writeConfig', () => {
    test('writes agent.json, peers.json, skills.json', () => {
      const result = writeConfig({
        agentName: 'test-agent',
        agentDescription: 'Test agent',
        agentUrl: 'http://localhost:9100/a2a',
        peers: [{ id: 'peer1', url: 'http://10.0.1.11:9100', token: 'tok123' }],
        token: 'shared_tok',
      });

      expect(result.agent.id).toBe('test-agent');
      expect(result.peers).toHaveLength(1);

      // Verify files exist
      expect(fs.existsSync(path.join(tmpDir, 'agent.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'peers.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'skills.json'))).toBe(true);

      // Verify content
      const agent = JSON.parse(fs.readFileSync(path.join(tmpDir, 'agent.json'), 'utf8'));
      expect(agent.name).toBe('test-agent');

      const peers = JSON.parse(fs.readFileSync(path.join(tmpDir, 'peers.json'), 'utf8'));
      expect(peers.peers[0].id).toBe('peer1');

      const skills = JSON.parse(fs.readFileSync(path.join(tmpDir, 'skills.json'), 'utf8'));
      expect(skills.exposed_skills).toHaveLength(2);
      expect(skills.exposed_skills[0].name).toBe('ping');
    });

    test('getCurrentConfig reads written config', () => {
      const result = getCurrentConfig();
      expect(result.exists).toBe(true);
      expect(result.agent.name).toBe('test-agent');
      expect(result.peers).toHaveLength(1);
      expect(result.skills).toHaveLength(2);
    });
  });

  describe('executeTool', () => {
    test('get_local_network returns subnet info', async () => {
      const result = await executeTool('get_local_network', {});
      // May return error in containers, that's ok
      expect(result).toBeDefined();
    });

    test('generate_token returns token', async () => {
      const result = await executeTool('generate_token', {});
      expect(result.token).toHaveLength(64);
    });

    test('get_current_config returns config', async () => {
      const result = await executeTool('get_current_config', {});
      expect(result.exists).toBe(true);
    });

    test('unknown tool returns error', async () => {
      const result = await executeTool('hack_the_planet', {});
      expect(result.error).toContain('Unknown tool');
    });

    test('check_agent returns offline for bad host', async () => {
      const result = await executeTool('check_agent', { host: '192.0.2.1', port: 9100 });
      expect(result.online).toBe(false);
    });
  });
});
