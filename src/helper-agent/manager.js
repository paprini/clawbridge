'use strict';

const fs = require('fs');
const { loadAgentConfig } = require('../config');
const logger = require('../logger');
const { invokeGatewayTool } = require('../openclaw-gateway');
const { loadHelperAgentConfig, getHelperGatewayBootstrapReadiness } = require('./config');
const { getHelperAgentPaths, renderHelperInstructions } = require('./instructions');

const state = {
  enabled: true,
  status: 'idle',
  agentId: null,
  sessionKey: null,
  workspaceDir: null,
  lastSyncAt: null,
  lastAttemptAt: null,
  lastError: null,
  bootstrapNote: null,
  gatewayBootstrap: 'not_started',
  bootstrapResult: null,
};

let started = false;
let retryTimer = null;

function getHelperAgentStatus() {
  return { ...state };
}

function ensureWorkspace(paths, content) {
  fs.mkdirSync(paths.workspaceDir, { recursive: true });
  fs.writeFileSync(paths.instructionsPath, content);
  fs.writeFileSync(paths.statePath, JSON.stringify({
    lastSyncAt: new Date().toISOString(),
  }, null, 2));
}

async function bootstrapHelperAgent() {
  const helperConfig = loadHelperAgentConfig();
  const readiness = getHelperGatewayBootstrapReadiness(helperConfig);
  const agent = loadAgentConfig();
  const paths = getHelperAgentPaths(helperConfig.workspaceDir);
  const instructions = renderHelperInstructions({ agent, helperConfig });

  state.enabled = helperConfig.enabled !== false;
  state.agentId = helperConfig.agentId;
  state.sessionKey = helperConfig.sessionKey;
  state.workspaceDir = helperConfig.workspaceDir;
  state.lastAttemptAt = new Date().toISOString();
  state.bootstrapResult = null;

  if (!state.enabled) {
    state.status = 'disabled';
    state.gatewayBootstrap = 'disabled';
    state.bootstrapNote = readiness.reason;
    state.lastError = null;
    return;
  }

  ensureWorkspace(paths, instructions);
  state.lastSyncAt = new Date().toISOString();
  state.status = 'workspace_ready';
  state.gatewayBootstrap = 'workspace_ready';
  state.bootstrapNote = null;
  state.lastError = null;

  if (!readiness.requested) {
    state.status = 'ready_local_only';
    state.gatewayBootstrap = readiness.gatewayBootstrap;
    state.bootstrapNote = readiness.reason;
    return;
  }

  if (!readiness.supported) {
    state.status = 'ready_local_only';
    state.gatewayBootstrap = readiness.gatewayBootstrap;
    state.bootstrapNote = readiness.reason;
    logger.info('Helper agent gateway bootstrap unavailable; running in local-only mode', {
      reason: readiness.reason,
      sessionKey: helperConfig.sessionKey,
    });
    return;
  }

  try {
    const task = [
      'Create or refresh the dedicated ClawBridge helper agent/session for this installation.',
      'Load the helper instructions from the synced helper workspace.',
      'This helper is for installation, configuration, diagnostics, and context preservation only.',
      'It is not the live bridge for incoming A2A request execution.',
      `Helper workspace: ${paths.workspaceDir}`,
      `Instructions file: ${paths.instructionsPath}`,
      `Session key: ${helperConfig.sessionKey}`,
    ].join('\n');

    const result = await invokeGatewayTool('sessions_spawn', {
      runtime: 'subagent',
      agentId: helperConfig.agentId,
      mode: 'run',
      task,
      streamTo: 'parent',
    }, {
      gateway: helperConfig.gateway,
      sessionKey: helperConfig.alertSession || 'main',
      timeoutMs: 30000,
    });

    state.status = 'ready';
    state.gatewayBootstrap = 'ready';
    state.bootstrapResult = result || null;
    state.bootstrapNote = null;
    state.lastError = null;
  } catch (err) {
    state.status = 'degraded';
    state.gatewayBootstrap = 'failed';
    state.bootstrapNote = null;
    state.lastError = err.message;
    logger.warn('Helper agent bootstrap failed', { error: err.message, sessionKey: helperConfig.sessionKey });

    if (helperConfig.healInBackground && !retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        bootstrapHelperAgent().catch((retryErr) => {
          logger.warn('Helper agent retry failed', { error: retryErr.message });
        });
      }, helperConfig.retryIntervalMs || 60000);
      retryTimer.unref?.();
    }
  }
}

function startHelperAgentManager() {
  if (started) return;
  started = true;
  state.status = 'starting';

  Promise.resolve()
    .then(() => bootstrapHelperAgent())
    .catch((err) => {
      state.status = 'failed';
      state.lastError = err.message;
      logger.error('Helper agent manager failed to start', { error: err.message });
    });
}

module.exports = {
  getHelperAgentStatus,
  startHelperAgentManager,
  bootstrapHelperAgent,
  __resetHelperAgentManagerForTests() {
    started = false;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    state.enabled = true;
    state.status = 'idle';
    state.agentId = null;
    state.sessionKey = null;
    state.workspaceDir = null;
    state.lastSyncAt = null;
    state.lastAttemptAt = null;
    state.lastError = null;
    state.bootstrapNote = null;
    state.gatewayBootstrap = 'not_started';
    state.bootstrapResult = null;
  },
};
