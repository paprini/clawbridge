'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function expandHome(filePath) {
  return typeof filePath === 'string' ? filePath.replace(/^~/, os.homedir()) : filePath;
}

function loadGatewayConfig(tokenPath) {
  const resolved = expandHome(tokenPath || '~/.openclaw/openclaw.json');
  if (!fs.existsSync(resolved)) {
    throw new Error(`OpenClaw config not found: ${resolved}. Is OpenClaw installed?`);
  }

  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function loadGatewayToken(tokenPath) {
  const config = loadGatewayConfig(tokenPath);
  const token = config?.gateway?.auth?.token;
  if (!token) {
    throw new Error('No gateway auth token found in OpenClaw config');
  }

  return token;
}

function normalizeGatewayAgentId(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return 'main';
  }

  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
  return normalized || 'main';
}

function normalizeGatewayPeerKind(value) {
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!trimmed) {
    return 'direct';
  }

  if (trimmed === 'dm') {
    return 'direct';
  }

  if (trimmed === 'owner' || trimmed === 'target') {
    return 'direct';
  }

  return trimmed;
}

function listGatewayAgentIds(tokenPath) {
  const config = loadGatewayConfig(tokenPath);
  const agents = Array.isArray(config?.agents?.list) ? config.agents.list : [];
  const ids = agents
    .map((agent) => normalizeGatewayAgentId(agent?.id))
    .filter(Boolean);

  return ids.length > 0 ? ids : ['main'];
}

function resolveGatewayDefaultAgentId(tokenPath) {
  const ids = listGatewayAgentIds(tokenPath);
  if (ids.includes('main')) {
    return 'main';
  }

  return ids[0] || 'main';
}

function resolveGatewayBindingAgentId({ tokenPath, channel, peerKind, peerId }) {
  const config = loadGatewayConfig(tokenPath);
  const bindings = Array.isArray(config?.bindings) ? config.bindings : [];
  const normalizedChannel = typeof channel === 'string' ? channel.trim().toLowerCase() : '';
  const normalizedPeerKind = normalizeGatewayPeerKind(peerKind);
  const normalizedPeerId = typeof peerId === 'string' ? peerId.trim().toLowerCase() : '';

  if (!normalizedChannel || !normalizedPeerId) {
    return null;
  }

  const matched = bindings.find((binding) => {
    const matchChannel = typeof binding?.match?.channel === 'string'
      ? binding.match.channel.trim().toLowerCase()
      : '';
    const matchPeerKind = normalizeGatewayPeerKind(binding?.match?.peer?.kind);
    const matchPeerId = typeof binding?.match?.peer?.id === 'string'
      ? binding.match.peer.id.trim().toLowerCase()
      : '';

    return matchChannel === normalizedChannel
      && matchPeerKind === normalizedPeerKind
      && matchPeerId === normalizedPeerId;
  });

  return matched?.agentId ? normalizeGatewayAgentId(matched.agentId) : null;
}

function resolveGatewayAgentId({ tokenPath, preferredAgentId, channel, peerKind, peerId }) {
  const normalizedPreferred = typeof preferredAgentId === 'string' && preferredAgentId.trim().length > 0
    ? normalizeGatewayAgentId(preferredAgentId)
    : null;

  const knownIds = listGatewayAgentIds(tokenPath);
  if (normalizedPreferred && knownIds.includes(normalizedPreferred)) {
    return normalizedPreferred;
  }

  const boundAgentId = resolveGatewayBindingAgentId({
    tokenPath,
    channel,
    peerKind,
    peerId,
  });
  if (boundAgentId) {
    return boundAgentId;
  }

  return resolveGatewayDefaultAgentId(tokenPath);
}

function tryParseTextPayload(content) {
  if (!Array.isArray(content)) {
    return null;
  }

  for (const part of content) {
    if (part?.type !== 'text' || typeof part.text !== 'string') {
      continue;
    }

    try {
      return JSON.parse(part.text);
    } catch {
      // Keep scanning until a structured text payload is found.
    }
  }

  return null;
}

function unwrapGatewayToolResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return result;
  }

  if (result.details && typeof result.details === 'object' && !Array.isArray(result.details)) {
    return result.details;
  }

  if (result.structuredContent && typeof result.structuredContent === 'object' && !Array.isArray(result.structuredContent)) {
    return result.structuredContent;
  }

  const parsed = tryParseTextPayload(result.content);
  return parsed || result;
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

  return unwrapGatewayToolResult(data.result);
}

module.exports = {
  expandHome,
  loadGatewayConfig,
  loadGatewayDefaults,
  loadGatewayToken,
  invokeGatewayTool,
  listGatewayAgentIds,
  resolveGatewayAgentId,
  resolveGatewayBindingAgentId,
  resolveGatewayDefaultAgentId,
  normalizeGatewayAgentId,
  unwrapGatewayToolResult,
};
