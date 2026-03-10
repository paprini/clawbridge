'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function expandHome(filePath) {
  return typeof filePath === 'string' ? filePath.replace(/^~/, os.homedir()) : filePath;
}

function loadGatewayToken(tokenPath) {
  const resolved = expandHome(tokenPath || '~/.openclaw/openclaw.json');
  if (!fs.existsSync(resolved)) {
    throw new Error(`OpenClaw config not found: ${resolved}. Is OpenClaw installed?`);
  }

  const config = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const token = config?.gateway?.auth?.token;
  if (!token) {
    throw new Error('No gateway auth token found in OpenClaw config');
  }

  return token;
}

function loadGatewayDefaults() {
  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', 'config');
  const bridgePath = path.join(configDir, 'bridge.json');

  if (!fs.existsSync(bridgePath)) {
    return {
      url: 'http://127.0.0.1:18789',
      tokenPath: '~/.openclaw/openclaw.json',
      sessionKey: 'main',
      timeoutMs: 300000,
    };
  }

  const bridgeConfig = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));
  return {
    url: bridgeConfig.gateway?.url || 'http://127.0.0.1:18789',
    tokenPath: bridgeConfig.gateway?.tokenPath || '~/.openclaw/openclaw.json',
    sessionKey: bridgeConfig.gateway?.sessionKey || 'main',
    timeoutMs: bridgeConfig.timeout_ms || 300000,
  };
}

async function invokeGatewayTool(toolName, args = {}, opts = {}) {
  const defaults = loadGatewayDefaults();
  const gateway = { ...defaults, ...(opts.gateway || {}) };
  const token = loadGatewayToken(gateway.tokenPath);
  const sessionKey = opts.sessionKey || gateway.sessionKey || 'main';
  const timeoutMs = opts.timeoutMs || gateway.timeoutMs || 300000;

  const res = await fetch(`${gateway.url}/tools/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tool: toolName,
      args,
      sessionKey,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 401) throw new Error('Gateway auth failed. Check OpenClaw token.');
  if (res.status === 404) throw new Error(`Tool "${toolName}" not found or not allowed on gateway.`);
  if (res.status === 429) throw new Error('Gateway rate limited. Try again later.');

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error?.message || `Tool "${toolName}" execution failed`);
  }

  return data.result;
}

module.exports = {
  expandHome,
  loadGatewayDefaults,
  loadGatewayToken,
  invokeGatewayTool,
};
