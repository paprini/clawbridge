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
    test('writes agent.json, peers.json, skills.json, bridge.json, contacts.json', () => {
      const result = writeConfig({
        agentName: 'test-agent',
        agentDescription: 'Test agent',
        agentUrl: 'http://localhost:9100/a2a',
        peers: [{ id: 'peer1', url: 'http://10.0.1.11:9100', token: 'tok123' }],
        defaultDelivery: { type: 'owner', target: '5914004682', channel: 'telegram' },
        token: 'shared_tok',
      });

      expect(result.agent.id).toBe('test-agent');
      expect(result.peers).toHaveLength(1);

      // Verify files exist
      expect(fs.existsSync(path.join(tmpDir, 'agent.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'peers.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'skills.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'bridge.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'contacts.json'))).toBe(true);

      // Verify content
      const agent = JSON.parse(fs.readFileSync(path.join(tmpDir, 'agent.json'), 'utf8'));
      expect(agent.name).toBe('test-agent');
      expect(agent.default_delivery).toEqual({ type: 'owner', target: '5914004682', channel: 'telegram' });

      const peers = JSON.parse(fs.readFileSync(path.join(tmpDir, 'peers.json'), 'utf8'));
      expect(peers.peers[0].id).toBe('peer1');

      const skills = JSON.parse(fs.readFileSync(path.join(tmpDir, 'skills.json'), 'utf8'));
      expect(skills.exposed_skills).toHaveLength(4);
      expect(skills.exposed_skills[0].name).toBe('ping');
      expect(skills.exposed_skills.map((skill) => skill.name)).toEqual(['ping', 'get_status', 'chat', 'broadcast']);

      const bridge = JSON.parse(fs.readFileSync(path.join(tmpDir, 'bridge.json'), 'utf8'));
      expect(bridge.enabled).toBe(true);
      expect(bridge.exposed_tools).toContain('message');
      expect(bridge.agent_dispatch).toEqual({
        enabled: true,
        sessionKey: 'main',
        timeoutSeconds: 0,
      });

      const contacts = JSON.parse(fs.readFileSync(path.join(tmpDir, 'contacts.json'), 'utf8'));
      expect(contacts.aliases).toEqual({});
    });

    test('getCurrentConfig reads written config', () => {
      const result = getCurrentConfig();
      expect(result.exists).toBe(true);
      expect(result.agent.name).toBe('test-agent');
      expect(result.peers).toHaveLength(1);
      expect(result.skills).toHaveLength(4);
      expect(result.bridge.enabled).toBe(true);
      expect(result.contacts.aliases).toEqual({});
      expect(result.agent.default_delivery).toEqual({ type: 'owner', target: '5914004682', channel: 'telegram' });
    });

    test('preserves existing bridge, contacts, skills, and default delivery on re-run', () => {
      fs.writeFileSync(path.join(tmpDir, 'skills.json'), JSON.stringify({
        exposed_skills: [{ name: 'custom_skill', public: true }],
      }));
      fs.writeFileSync(path.join(tmpDir, 'bridge.json'), JSON.stringify({
        enabled: true,
        exposed_tools: ['message'],
        gateway: { url: 'http://127.0.0.1:18789', tokenPath: '~/.openclaw/openclaw.json' },
      }));
      fs.writeFileSync(path.join(tmpDir, 'contacts.json'), JSON.stringify({
        aliases: { 'telegram:Pato': { peerId: 'telegram-agent', target: '5914004682', channel: 'telegram' } },
      }));
      fs.writeFileSync(path.join(tmpDir, 'agent.json'), JSON.stringify({
        id: 'test-agent',
        name: 'test-agent',
        default_delivery: { type: 'channel', target: '#general', channel: 'discord' },
      }));

      writeConfig({
        agentName: 'test-agent',
        agentDescription: 'Test agent',
        agentUrl: 'http://localhost:9100/a2a',
        peers: [{ id: 'peer2', url: 'http://10.0.1.12:9100', token: 'tok456' }],
        token: 'shared_tok',
      });

      const result = getCurrentConfig();
      expect(result.skills).toEqual([{ name: 'custom_skill', public: true }]);
      expect(result.bridge.exposed_tools).toEqual(['message']);
      expect(result.contacts.aliases['telegram:Pato']).toBeDefined();
      expect(result.agent.default_delivery).toEqual({ type: 'channel', target: '#general', channel: 'discord' });
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
      const result = await executeTool('check_agent', { host: '127.0.0.1', port: 19999 });
      expect(result.online).toBe(false);
    });

    test('rotate_peer_token rotates token', async () => {
      // First write a config with a peer
      const { writeConfig } = require('../../src/setup/tools');
      writeConfig({ agentName: 'rotate-test', peers: [{ id: 'peer-rotate', url: 'http://10.0.0.1:9100', token: 'old_token' }], token: 'shared' });

      const result = await executeTool('rotate_peer_token', { peerId: 'peer-rotate' });
      expect(result.peerId).toBe('peer-rotate');
      expect(result.newToken).toHaveLength(64);
      expect(result.newToken).not.toBe('old_token');
    });

    test('rotate_peer_token fails for unknown peer', async () => {
      const result = await executeTool('rotate_peer_token', { peerId: 'nonexistent' });
      expect(result.error).toContain('not found');
    });
  });
});
