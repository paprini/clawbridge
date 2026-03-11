'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `clawbridge-helper-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });

process.env.A2A_CONFIG_DIR = path.join(__dirname, '..', '..', 'config');

const { loadHelperAgentConfig, getHelperGatewayBootstrapReadiness } = require('../../src/helper-agent/config');
const { getHelperAgentPaths, renderHelperInstructions } = require('../../src/helper-agent/instructions');

describe('helper agent support', () => {
  test('loads helper agent defaults from config', () => {
    const config = loadHelperAgentConfig();
    expect(config.enabled).toBe(true);
    expect(config.sessionKey).toBe('clawbridge-helper');
    expect(config.workspaceDir).toContain('.clawbridge');
    expect(config.bootstrapViaGateway).toBe(false);
  });

  test('defaults helper gateway bootstrap to local-only mode', () => {
    const readiness = getHelperGatewayBootstrapReadiness(loadHelperAgentConfig());
    expect(readiness.requested).toBe(false);
    expect(readiness.gatewayBootstrap).toBe('skipped');
    expect(readiness.reason).toContain('local-only mode');
  });

  test('builds helper workspace paths', () => {
    const paths = getHelperAgentPaths(tmpDir);
    expect(paths.instructionsPath).toBe(path.join(tmpDir, 'instructions.md'));
    expect(paths.statePath).toBe(path.join(tmpDir, 'state.json'));
  });

  test('renders helper instructions with correct boundary', () => {
    const text = renderHelperInstructions({
      agent: { id: 'demo', name: 'Demo Agent' },
      helperConfig: {
        sessionKey: 'clawbridge-helper',
        workspaceDir: tmpDir,
      },
    });

    expect(text).toContain('ClawBridge helper agent');
    expect(text).toContain('not the live execution bridge');
    expect(text).toContain('Demo Agent');
  });
});
