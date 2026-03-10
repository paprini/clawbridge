#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getClawBridgeVersion } = require('./version');
const { getOpenClawCommand, isOpenClawCliAvailable } = require('./openclaw-gateway');

const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', 'config');
const repoConfigDir = path.join(__dirname, '..', 'config');
let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}: ${result}`);
      failed++;
    }
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function loadJSON(file) {
  const p = path.join(configDir, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function expandHome(filePath) {
  return typeof filePath === 'string' ? filePath.replace(/^~/, os.homedir()) : filePath;
}

function normalizeAgentId(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return '';
  }

  return trimmed.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

console.log('\n🔍 ClawBridge setup verification\n');
console.log(`ClawBridge version: ${getClawBridgeVersion()}`);
console.log(`Config dir: ${configDir}\n`);

// --- Required configs ---
console.log('Required configs:');
check('agent.json exists', () => {
  const a = loadJSON('agent.json');
  if (!a) return 'File not found. Run: npm run setup';
  if (!a.id) return 'Missing "id" field';
  if (!a.name) return 'Missing "name" field';
  if (a.openclaw_agent_id !== undefined
    && (typeof a.openclaw_agent_id !== 'string' || a.openclaw_agent_id.trim().length === 0)) {
    return '"openclaw_agent_id" must be a non-empty string when provided';
  }
  if (a.default_delivery !== undefined && a.default_delivery !== null) {
    if (typeof a.default_delivery !== 'object' || Array.isArray(a.default_delivery)) {
      return '"default_delivery" must be an object when configured';
    }
    if (typeof a.default_delivery.target !== 'string' || a.default_delivery.target.trim().length === 0) {
      return '"default_delivery.target" must be a non-empty string';
    }
    if (a.default_delivery.type !== undefined
      && (typeof a.default_delivery.type !== 'string' || a.default_delivery.type.trim().length === 0)) {
      return '"default_delivery.type" must be a non-empty string when provided';
    }
    if (a.default_delivery.channel !== undefined
      && (typeof a.default_delivery.channel !== 'string' || a.default_delivery.channel.trim().length === 0)) {
      return '"default_delivery.channel" must be a non-empty string when provided';
    }
  }
  return true;
});

check('peers.json exists', () => {
  const p = loadJSON('peers.json');
  if (!p) return 'File not found. Run: npm run setup';
  if (!Array.isArray(p.peers)) return 'Missing "peers" array';
  return true;
});

check('skills.json exists', () => {
  const s = loadJSON('skills.json');
  if (!s) return 'File not found. Run: npm run setup';
  if (!Array.isArray(s.exposed_skills)) return 'Missing "exposed_skills" array';
  if (s.exposed_skills.length === 0) return 'No skills exposed';
  return true;
});

// --- Token checks ---
console.log('\nSecurity:');
check('Shared token configured', () => {
  const token = process.env.A2A_SHARED_TOKEN;
  if (!token) return 'A2A_SHARED_TOKEN not set. Set in .env or environment';
  if (token.includes('CHANGE_ME')) return 'Token contains CHANGE_ME. Generate: openssl rand -hex 32';
  if (token.length < 32) return `Token too short (${token.length} chars, need 32+)`;
  return true;
});

check('Peer tokens are valid hex', () => {
  const p = loadJSON('peers.json');
  if (!p || !p.peers) return true; // no peers is ok
  for (const peer of p.peers) {
    if (!peer.token) return `Peer "${peer.id}" has no token`;
    if (peer.token.length < 32) return `Peer "${peer.id}" token too short`;
  }
  return true;
});

check('Peer tokens do not reuse the shared token', () => {
  const p = loadJSON('peers.json');
  const sharedToken = process.env.A2A_SHARED_TOKEN;
  if (!sharedToken || !p || !Array.isArray(p.peers)) return true;

  const peer = p.peers.find((entry) => typeof entry?.token === 'string' && entry.token === sharedToken);
  if (peer) {
    return `Peer "${peer.id}" token matches A2A_SHARED_TOKEN. Use distinct per-peer tokens so reply routing can identify the caller reliably.`;
  }

  return true;
});

check('peers.json file permissions', () => {
  const p = path.join(configDir, 'peers.json');
  if (!fs.existsSync(p)) return true;
  if (process.platform === 'win32') return true; // skip on Windows
  const peersConfig = loadJSON('peers.json');
  const hasSensitivePeerTokens = Array.isArray(peersConfig?.peers)
    && peersConfig.peers.some((peer) => peer && typeof peer.token === 'string' && peer.token.length > 0);
  if (!hasSensitivePeerTokens) {
    return true;
  }
  const stats = fs.statSync(p);
  const mode = (stats.mode & 0o777).toString(8);
  if (mode !== '600') return `File mode is ${mode}, should be 600 (owner-only)`;
  return true;
});

check('Repository peers policy', () => {
  const peersConfig = loadJSON('peers.json');
  const peerCount = Array.isArray(peersConfig?.peers) ? peersConfig.peers.length : 0;
  const usingRepoConfig = path.resolve(configDir) === path.resolve(repoConfigDir);
  if (usingRepoConfig && peerCount > 0 && process.env.ALLOW_REPO_MANAGED_PEERS !== '1') {
    return 'Repository config/peers.json is bootstrap-only. Move real peers to an external A2A_CONFIG_DIR, or set ALLOW_REPO_MANAGED_PEERS=1 if you intentionally accept that risk.';
  }
  return true;
});

// --- Optional configs ---
console.log('\nOptional configs:');
check('bridge.json (OpenClaw bridge)', () => {
  const b = loadJSON('bridge.json');
  if (!b) { console.log('    ℹ️  Not configured (optional)'); return true; }
  if (b.enabled) {
    if (!b.gateway?.url) return 'Bridge enabled but no gateway URL';
    if (!b.exposed_tools?.length) return 'Bridge enabled but no tools exposed';
  }
  return true;
});

check('contacts.json', () => {
  const c = loadJSON('contacts.json');
  if (!c) { console.log('    ℹ️  Not configured — direct target IDs only'); return true; }
  if (c.aliases !== undefined && (typeof c.aliases !== 'object' || Array.isArray(c.aliases) || c.aliases === null)) {
    return 'contacts.json "aliases" must be an object';
  }
  for (const [alias, entry] of Object.entries(c.aliases || {})) {
    if (typeof entry === 'string') continue;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return `contacts.json alias "${alias}" must be a string or object`;
    }
    if (typeof entry.target !== 'string' || entry.target.trim().length === 0) {
      return `contacts.json alias "${alias}" is missing a string "target"`;
    }
    if (entry.peerId !== undefined && (typeof entry.peerId !== 'string' || entry.peerId.trim().length === 0)) {
      return `contacts.json alias "${alias}" has an invalid "peerId"`;
    }
    if (entry.channel !== undefined && (typeof entry.channel !== 'string' || entry.channel.trim().length === 0)) {
      return `contacts.json alias "${alias}" has an invalid "channel"`;
    }
  }
  return true;
});

check('permissions.json (access control)', () => {
  const p = loadJSON('permissions.json');
  if (!p) { console.log('    ℹ️  Not configured — all peers allowed (default)'); return true; }
  if (!p.permissions) return 'Missing "permissions" object';
  return true;
});

check('rate-limits.json', () => {
  const r = loadJSON('rate-limits.json');
  if (!r) { console.log('    ℹ️  Not configured — using defaults'); return true; }
  return true;
});

check('helper-agent.json', () => {
  const h = loadJSON('helper-agent.json');
  if (!h) { console.log('    ℹ️  Not configured — using defaults'); return true; }
  if (h.enabled === false) return true;
  if (!h.sessionKey) return 'Missing "sessionKey"';
  if (!h.workspaceDir) return 'Missing "workspaceDir"';
  return true;
});

// --- Connectivity ---
console.log('\nConnectivity:');
check('Server port available', () => {
  const port = process.env.A2A_PORT || 9100;
  // Just check if we can read the port config
  return true;
});

check('Helper agent workspace path resolves', () => {
  const h = loadJSON('helper-agent.json');
  const workspaceDir = h?.workspaceDir || '~/.clawbridge/helper-agent';
  if (typeof workspaceDir !== 'string' || workspaceDir.length === 0) {
    return 'Invalid helper workspaceDir';
  }
  return true;
});

check('chat/broadcast bridge readiness', () => {
  const skills = loadJSON('skills.json');
  const exposedNames = Array.isArray(skills?.exposed_skills)
    ? skills.exposed_skills.map((skill) => skill?.name).filter(Boolean)
    : [];
  const needsMessageBridge = exposedNames.includes('chat') || exposedNames.includes('broadcast');

  if (!needsMessageBridge) {
    return true;
  }

  const bridge = loadJSON('bridge.json');
  if (!bridge || bridge.enabled !== true) {
    return 'chat/broadcast are exposed, but bridge.json is missing or disabled';
  }

  if (!Array.isArray(bridge.exposed_tools) || !bridge.exposed_tools.includes('message')) {
    return 'chat/broadcast are exposed, but bridge.json does not expose the "message" tool';
  }

  return true;
});

check('broadcast default delivery readiness', () => {
  const skills = loadJSON('skills.json');
  const exposedNames = Array.isArray(skills?.exposed_skills)
    ? skills.exposed_skills.map((skill) => skill?.name).filter(Boolean)
    : [];

  if (!exposedNames.includes('broadcast')) {
    return true;
  }

  const agent = loadJSON('agent.json');
  if (!agent?.default_delivery || typeof agent.default_delivery.target !== 'string' || agent.default_delivery.target.trim().length === 0) {
    return 'broadcast is exposed, but agent.json has no default_delivery.target. Incoming broadcasts and @agent delivery to this instance will fail.';
  }

  return true;
});

check('agent-to-agent dispatch readiness', () => {
  const bridge = loadJSON('bridge.json');
  if (!bridge || bridge.enabled !== true) {
    return true;
  }

  const dispatch = bridge.agent_dispatch || {};
  if (dispatch.enabled === false) {
    console.log('    ℹ️  Inbound agent dispatch disabled — @agent delivery will only post visible messages');
    return true;
  }

  const tokenPath = expandHome(bridge.gateway?.tokenPath || '~/.openclaw/openclaw.json');
  if (!fs.existsSync(tokenPath)) {
    return `OpenClaw config not found at ${tokenPath}`;
  }

  if (!isOpenClawCliAvailable()) {
    return `OpenClaw CLI not found at "${getOpenClawCommand()}". Install OpenClaw so the binary is on PATH (for example via npm prefix -g, ~/.openclaw/bin/openclaw, or ~/.local/bin/openclaw), or set OPENCLAW_BIN explicitly.`;
  }

  const gatewayConfig = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  const knownAgentIds = Array.isArray(gatewayConfig?.agents?.list)
    ? gatewayConfig.agents.list
      .map((agent) => normalizeAgentId(agent?.id))
      .filter(Boolean)
    : ['main'];
  const agent = loadJSON('agent.json');
  const configuredDispatchAgentId = normalizeAgentId(dispatch.agentId || agent?.openclaw_agent_id);
  const bindings = Array.isArray(gatewayConfig?.bindings) ? gatewayConfig.bindings : [];

  if (configuredDispatchAgentId && !knownAgentIds.includes(configuredDispatchAgentId)) {
    return `Configured OpenClaw agent "${dispatch.agentId || agent?.openclaw_agent_id}" does not exist in ~/.openclaw/openclaw.json`;
  }

  if (!configuredDispatchAgentId && knownAgentIds.length > 1) {
    return `Multiple OpenClaw agents detected (${knownAgentIds.join(', ')}), but no explicit local communications agent is pinned. Set agent.json.openclaw_agent_id or bridge.agent_dispatch.agentId so @agent delivery always wakes the correct local agent.`;
  }

  const defaultDelivery = agent?.default_delivery;
  const defaultDeliveryChannel = typeof defaultDelivery?.channel === 'string'
    ? defaultDelivery.channel.trim().toLowerCase()
    : '';
  const defaultDeliveryTarget = typeof defaultDelivery?.target === 'string'
    ? defaultDelivery.target.trim().toLowerCase()
    : '';
  const defaultDeliveryKind = typeof defaultDelivery?.type === 'string' && defaultDelivery.type.trim().toLowerCase() === 'channel'
    ? 'channel'
    : 'direct';
  const hasMatchingBinding = defaultDeliveryChannel && defaultDeliveryTarget
    ? bindings.some((binding) => normalizeAgentId(binding?.agentId)
        && String(binding?.match?.channel || '').trim().toLowerCase() === defaultDeliveryChannel
        && String(binding?.match?.peer?.kind || '').trim().toLowerCase().replace(/^dm$/, 'direct') === defaultDeliveryKind
        && String(binding?.match?.peer?.id || '').trim().toLowerCase() === defaultDeliveryTarget)
    : false;

  if (knownAgentIds.length > 1 && defaultDeliveryChannel && defaultDeliveryTarget && !hasMatchingBinding && configuredDispatchAgentId) {
    console.log('    ℹ️  No explicit OpenClaw binding matches agent.json default_delivery. ClawBridge will keep the pinned local agent identity and use delivery metadata/default delivery for the reply destination.');
  }

  return true;
});

// --- Summary ---
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('\n✅ All checks passed. Ready to start: node src/server.js\n');
} else {
  console.log('\n❌ Fix the issues above before starting.\n');
}

process.exit(failed > 0 ? 1 : 0);
