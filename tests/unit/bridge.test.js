'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `a2a-bridge-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });
process.env.A2A_CONFIG_DIR = tmpDir;

// Write a bridge config for testing
fs.writeFileSync(path.join(tmpDir, 'bridge.json'), JSON.stringify({
  enabled: true,
  gateway: { url: 'http://127.0.0.1:18789', tokenPath: '/nonexistent', sessionKey: 'main' },
  exposed_tools: ['web_search', 'memory_search', 'session_status'],
  timeout_ms: 5000,
  max_concurrent: 2,
}));

const { getBridgedTools, isBridgedTool, loadBridgeConfig, callOpenClawTool } = require('../../src/bridge');

describe('Bridge', () => {
  afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  describe('loadBridgeConfig', () => {
    test('loads bridge config', () => {
      const config = loadBridgeConfig();
      expect(config.enabled).toBe(true);
      expect(config.exposed_tools).toContain('web_search');
    });

    test('rejects dangerous tools unless explicitly allowed', () => {
      fs.writeFileSync(path.join(tmpDir, 'bridge.json'), JSON.stringify({
        enabled: true,
        gateway: { url: 'http://127.0.0.1:18789', tokenPath: '/nonexistent', sessionKey: 'main' },
        exposed_tools: ['exec'],
      }));

      expect(() => loadBridgeConfig()).toThrow('blocked by default');

      fs.writeFileSync(path.join(tmpDir, 'bridge.json'), JSON.stringify({
        enabled: true,
        gateway: { url: 'http://127.0.0.1:18789', tokenPath: '/nonexistent', sessionKey: 'main' },
        exposed_tools: ['web_search', 'memory_search', 'session_status'],
        timeout_ms: 5000,
        max_concurrent: 2,
      }));
    });

    test('rejects invalid bridge tool names', () => {
      fs.writeFileSync(path.join(tmpDir, 'bridge.json'), JSON.stringify({
        enabled: true,
        gateway: { url: 'http://127.0.0.1:18789', tokenPath: '/nonexistent', sessionKey: 'main' },
        exposed_tools: ['web-search'],
      }));

      expect(() => loadBridgeConfig()).toThrow('Invalid bridge tool name');

      fs.writeFileSync(path.join(tmpDir, 'bridge.json'), JSON.stringify({
        enabled: true,
        gateway: { url: 'http://127.0.0.1:18789', tokenPath: '/nonexistent', sessionKey: 'main' },
        exposed_tools: ['web_search', 'memory_search', 'session_status'],
        timeout_ms: 5000,
        max_concurrent: 2,
      }));
    });
  });

  describe('getBridgedTools', () => {
    test('returns bridged tools with openclaw_ prefix', () => {
      const tools = getBridgedTools();
      expect(tools.length).toBe(3);
      expect(tools[0].name).toBe('openclaw_web_search');
      expect(tools[0].bridged).toBe(true);
      expect(tools[0].originalTool).toBe('web_search');
    });
  });

  describe('isBridgedTool', () => {
    test('recognizes bridged tools', () => {
      expect(isBridgedTool('openclaw_web_search')).toBe(true);
      expect(isBridgedTool('openclaw_memory_search')).toBe(true);
    });

    test('rejects non-bridged tools', () => {
      expect(isBridgedTool('ping')).toBe(false);
      expect(isBridgedTool('openclaw_exec')).toBe(false); // not in whitelist
      expect(isBridgedTool('web_search')).toBe(false); // missing prefix
    });
  });

  describe('callOpenClawTool', () => {
    test('rejects tool not in whitelist', async () => {
      await expect(callOpenClawTool('exec', {})).rejects.toThrow('not in the bridge whitelist');
    });

    test('rejects when gateway token not found', async () => {
      await expect(callOpenClawTool('web_search', { query: 'test' }))
        .rejects.toThrow('Bridge auth failed');
    });
  });

  describe('disabled bridge', () => {
    test('getBridgedTools returns empty when disabled', () => {
      fs.writeFileSync(path.join(tmpDir, 'bridge.json'), JSON.stringify({ enabled: false }));
      // Clear require cache to reload
      delete require.cache[require.resolve('../../src/bridge')];
      const { getBridgedTools: reload } = require('../../src/bridge');
      expect(reload()).toHaveLength(0);

      // Restore
      fs.writeFileSync(path.join(tmpDir, 'bridge.json'), JSON.stringify({
        enabled: true,
        gateway: { url: 'http://127.0.0.1:18789', tokenPath: '/nonexistent' },
        exposed_tools: ['web_search', 'memory_search', 'session_status'],
        timeout_ms: 5000,
        max_concurrent: 2,
      }));
      delete require.cache[require.resolve('../../src/bridge')];
    });
  });
});
