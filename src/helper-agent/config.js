'use strict';

const fs = require('fs');
const path = require('path');
const { expandHome } = require('../openclaw-gateway');

const DEFAULT_CONFIG = {
  enabled: true,
  agentId: 'clawbridge-helper',
  sessionKey: 'clawbridge-helper',
  workspaceDir: '~/.clawbridge/helper-agent',
  healInBackground: true,
  visibleTo: ['main'],
  alertSession: 'main',
  bootstrapViaGateway: false,
  retryIntervalMs: 60000,
  gateway: {
    url: 'http://127.0.0.1:18789',
    tokenPath: '~/.openclaw/openclaw.json',
  },
};

function loadHelperAgentConfig() {
  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', '..', 'config');
  const filePath = path.join(configDir, 'helper-agent.json');
  let rawConfig = {};

  if (fs.existsSync(filePath)) {
    rawConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  const config = {
    ...DEFAULT_CONFIG,
    ...rawConfig,
    gateway: {
      ...DEFAULT_CONFIG.gateway,
      ...(rawConfig.gateway || {}),
    },
  };

  config.workspaceDir = expandHome(config.workspaceDir);
  config.gateway.tokenPath = expandHome(config.gateway.tokenPath);
  return config;
}

function getHelperGatewayBootstrapReadiness(inputConfig = null) {
  const config = inputConfig || loadHelperAgentConfig();

  if (config.enabled === false) {
    return {
      enabled: false,
      requested: false,
      supported: false,
      gatewayBootstrap: 'disabled',
      reason: 'Helper agent is disabled.',
    };
  }

  if (!config.bootstrapViaGateway) {
    return {
      enabled: true,
      requested: false,
      supported: false,
      gatewayBootstrap: 'skipped',
      reason: 'Gateway bootstrap is disabled. Helper will run in local-only mode.',
    };
  }

  const tokenPath = expandHome(config.gateway?.tokenPath || DEFAULT_CONFIG.gateway.tokenPath);
  if (!fs.existsSync(tokenPath)) {
    return {
      enabled: true,
      requested: true,
      supported: false,
      gatewayBootstrap: 'unsupported',
      reason: `OpenClaw config not found at ${tokenPath}. Helper will stay in local-only mode until gateway bootstrap prerequisites exist.`,
    };
  }

  let gatewayConfig;
  try {
    gatewayConfig = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  } catch (err) {
    return {
      enabled: true,
      requested: true,
      supported: false,
      gatewayBootstrap: 'unsupported',
      reason: `OpenClaw config at ${tokenPath} could not be read: ${err.message}`,
    };
  }

  const allowedTools = Array.isArray(gatewayConfig?.gateway?.tools?.allow)
    ? gatewayConfig.gateway.tools.allow.map((value) => String(value).trim()).filter(Boolean)
    : [];

  if (!allowedTools.includes('sessions_spawn')) {
    return {
      enabled: true,
      requested: true,
      supported: false,
      gatewayBootstrap: 'unsupported',
      reason: 'OpenClaw gateway.tools.allow does not include "sessions_spawn". Helper will run in local-only mode unless gateway bootstrap is explicitly allowed.',
    };
  }

  return {
    enabled: true,
    requested: true,
    supported: true,
    gatewayBootstrap: 'ready',
    reason: null,
  };
}

module.exports = {
  loadHelperAgentConfig,
  getHelperGatewayBootstrapReadiness,
};
