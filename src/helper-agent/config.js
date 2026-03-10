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
  bootstrapViaGateway: true,
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

module.exports = { loadHelperAgentConfig };
