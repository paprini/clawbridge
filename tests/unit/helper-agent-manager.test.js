'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function makeConfigDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'clawbridge-helper-manager-'));
}

describe('helper agent manager', () => {
  const originalConfigDir = process.env.A2A_CONFIG_DIR;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env.A2A_CONFIG_DIR;
    } else {
      process.env.A2A_CONFIG_DIR = originalConfigDir;
    }
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('uses local-only mode when gateway bootstrap is disabled', async () => {
    const configDir = makeConfigDir();
    const workspaceDir = path.join(configDir, 'helper-workspace');
    process.env.A2A_CONFIG_DIR = configDir;

    writeJson(path.join(configDir, 'agent.json'), {
      id: 'demo',
      name: 'Demo Agent',
      url: 'http://localhost:9100/a2a',
    });
    writeJson(path.join(configDir, 'helper-agent.json'), {
      enabled: true,
      sessionKey: 'helper-demo',
      workspaceDir,
      bootstrapViaGateway: false,
    });

    jest.doMock('../../src/openclaw-gateway', () => ({
      invokeGatewayTool: jest.fn(),
      expandHome: (value) => value,
    }));
    jest.doMock('../../src/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    const manager = require('../../src/helper-agent/manager');
    const gateway = require('../../src/openclaw-gateway');

    await manager.bootstrapHelperAgent();

    expect(gateway.invokeGatewayTool).not.toHaveBeenCalled();
    expect(manager.getHelperAgentStatus()).toMatchObject({
      status: 'ready_local_only',
      gatewayBootstrap: 'skipped',
    });
    expect(manager.getHelperAgentStatus().bootstrapNote).toContain('local-only mode');
    expect(fs.existsSync(path.join(workspaceDir, 'instructions.md'))).toBe(true);
    expect(fs.existsSync(path.join(workspaceDir, 'state.json'))).toBe(true);
    manager.__resetHelperAgentManagerForTests();
  });

  test('uses local-only mode when gateway bootstrap is requested but unsupported', async () => {
    const configDir = makeConfigDir();
    const workspaceDir = path.join(configDir, 'helper-workspace');
    const openclawConfigPath = path.join(configDir, 'openclaw.json');
    process.env.A2A_CONFIG_DIR = configDir;

    writeJson(path.join(configDir, 'agent.json'), {
      id: 'demo',
      name: 'Demo Agent',
      url: 'http://localhost:9100/a2a',
    });
    writeJson(path.join(configDir, 'helper-agent.json'), {
      enabled: true,
      sessionKey: 'helper-demo',
      workspaceDir,
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

    jest.doMock('../../src/openclaw-gateway', () => ({
      invokeGatewayTool: jest.fn(),
      expandHome: (value) => value,
    }));
    jest.doMock('../../src/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    const manager = require('../../src/helper-agent/manager');
    const gateway = require('../../src/openclaw-gateway');

    await manager.bootstrapHelperAgent();

    expect(gateway.invokeGatewayTool).not.toHaveBeenCalled();
    expect(manager.getHelperAgentStatus()).toMatchObject({
      status: 'ready_local_only',
      gatewayBootstrap: 'unsupported',
    });
    expect(manager.getHelperAgentStatus().bootstrapNote).toContain('sessions_spawn');
    expect(manager.getHelperAgentStatus().lastError).toBeNull();
    manager.__resetHelperAgentManagerForTests();
  });

  test('bootstraps through the gateway when prerequisites exist', async () => {
    const configDir = makeConfigDir();
    const workspaceDir = path.join(configDir, 'helper-workspace');
    const openclawConfigPath = path.join(configDir, 'openclaw.json');
    process.env.A2A_CONFIG_DIR = configDir;

    writeJson(path.join(configDir, 'agent.json'), {
      id: 'demo',
      name: 'Demo Agent',
      url: 'http://localhost:9100/a2a',
    });
    writeJson(path.join(configDir, 'helper-agent.json'), {
      enabled: true,
      sessionKey: 'helper-demo',
      workspaceDir,
      bootstrapViaGateway: true,
      gateway: {
        tokenPath: openclawConfigPath,
      },
    });
    writeJson(openclawConfigPath, {
      gateway: {
        auth: { token: 'test-token' },
        tools: {
          allow: ['sessions_spawn'],
        },
      },
    });

    jest.doMock('../../src/openclaw-gateway', () => ({
      invokeGatewayTool: jest.fn().mockResolvedValue({ status: 'ok' }),
      expandHome: (value) => value,
    }));
    jest.doMock('../../src/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    const manager = require('../../src/helper-agent/manager');
    const gateway = require('../../src/openclaw-gateway');

    await manager.bootstrapHelperAgent();

    expect(gateway.invokeGatewayTool).toHaveBeenCalledTimes(1);
    expect(manager.getHelperAgentStatus()).toMatchObject({
      status: 'ready',
      gatewayBootstrap: 'ready',
    });
    expect(manager.getHelperAgentStatus().bootstrapResult).toEqual({ status: 'ok' });
    manager.__resetHelperAgentManagerForTests();
  });
});
