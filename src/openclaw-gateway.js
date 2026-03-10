'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
let cachedOpenClawCommandKey = null;
let cachedOpenClawCommand = null;

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

function isExecutableFile(candidate) {
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    return false;
  }

  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function getExecutableNames(commandName = 'openclaw') {
  if (process.platform === 'win32') {
    return [`${commandName}.cmd`, `${commandName}.exe`, `${commandName}.bat`, commandName];
  }

  return [commandName];
}

function pushCommandCandidates(candidates, basePath, commandName = 'openclaw') {
  for (const name of getExecutableNames(commandName)) {
    candidates.push(path.join(basePath, name));
  }
}

function getNpmExecutableNames() {
  return process.platform === 'win32'
    ? ['npm.cmd', 'npm.exe', 'npm.bat', 'npm']
    : ['npm'];
}

function buildNpmCommandCandidates() {
  const candidates = [];
  const pathEntries = typeof process.env.PATH === 'string'
    ? process.env.PATH.split(path.delimiter).filter(Boolean)
    : [];
  const nodeDir = path.dirname(process.execPath);

  for (const name of getNpmExecutableNames()) {
    candidates.push(path.join(nodeDir, name));
  }

  for (const entry of pathEntries) {
    for (const name of getNpmExecutableNames()) {
      candidates.push(path.join(entry, name));
    }
  }

  return [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
}

function resolveOpenClawFromNpmPrefix() {
  const npmCommand = buildNpmCommandCandidates().find((candidate) => isExecutableFile(candidate));
  if (!npmCommand) {
    return null;
  }

  try {
    const prefix = String(execFileSync(npmCommand, ['prefix', '-g'], {
      encoding: 'utf8',
      timeout: 5000,
    })).trim();

    if (!prefix) {
      return null;
    }

    const binDir = process.platform === 'win32' ? prefix : path.join(prefix, 'bin');
    const candidate = path.join(binDir, process.platform === 'win32' ? 'openclaw.cmd' : 'openclaw');
    return isExecutableFile(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function buildOpenClawCommandCandidates() {
  const configured = typeof process.env.OPENCLAW_BIN === 'string'
    ? process.env.OPENCLAW_BIN.trim()
    : '';
  const pathEntries = typeof process.env.PATH === 'string'
    ? process.env.PATH.split(path.delimiter).filter(Boolean)
    : [];
  const bareCommand = configured && !configured.includes(path.sep) ? configured : 'openclaw';
  const names = getExecutableNames(bareCommand);
  const candidates = [];

  if (configured) {
    candidates.push(expandHome(configured));
  }

  for (const entry of pathEntries) {
    for (const name of names) {
      candidates.push(path.join(entry, name));
    }
  }

  if (process.platform === 'darwin') {
    pushCommandCandidates(candidates, '/opt/homebrew/bin');
    pushCommandCandidates(candidates, '/usr/local/bin');
  } else if (process.platform === 'linux') {
    pushCommandCandidates(candidates, '/usr/local/bin');
    pushCommandCandidates(candidates, '/usr/bin');
    pushCommandCandidates(candidates, '/snap/bin');
  }

  pushCommandCandidates(candidates, path.join(os.homedir(), '.openclaw', 'bin'));
  pushCommandCandidates(candidates, path.join(os.homedir(), '.local', 'bin'));
  pushCommandCandidates(candidates, path.join(os.homedir(), '.npm-global', 'bin'));
  pushCommandCandidates(candidates, path.join(os.homedir(), 'bin'));

  const npmPrefixCandidate = resolveOpenClawFromNpmPrefix();
  if (npmPrefixCandidate) {
    candidates.push(npmPrefixCandidate);
  }

  return [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
}

function resolveOpenClawCommand() {
  const cacheKey = JSON.stringify({
    openclawBin: process.env.OPENCLAW_BIN || '',
    path: process.env.PATH || '',
    execPath: process.execPath,
  });
  if (cachedOpenClawCommandKey === cacheKey && cachedOpenClawCommand) {
    return cachedOpenClawCommand;
  }

  const configured = typeof process.env.OPENCLAW_BIN === 'string'
    ? process.env.OPENCLAW_BIN.trim()
    : '';

  if (configured && !configured.includes(path.sep) && !configured.startsWith('.')) {
    const pathMatch = buildOpenClawCommandCandidates().find((candidate) => isExecutableFile(candidate));
    if (pathMatch) {
      cachedOpenClawCommandKey = cacheKey;
      cachedOpenClawCommand = pathMatch;
      return pathMatch;
    }
    return configured;
  }

  if (configured && isExecutableFile(expandHome(configured))) {
    const resolved = expandHome(configured);
    cachedOpenClawCommandKey = cacheKey;
    cachedOpenClawCommand = resolved;
    return resolved;
  }

  const discovered = buildOpenClawCommandCandidates().find((candidate) => isExecutableFile(candidate));
  if (discovered) {
    cachedOpenClawCommandKey = cacheKey;
    cachedOpenClawCommand = discovered;
    return discovered;
  }

  return configured || 'openclaw';
}

function getOpenClawCommand() {
  return resolveOpenClawCommand();
}

function parseOpenClawJsonOutput(stdout) {
  const trimmed = typeof stdout === 'string' ? stdout.trim() : '';
  if (!trimmed) {
    return {};
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error(`Failed to parse OpenClaw JSON output: ${trimmed.slice(0, 200)}`);
  }
}

async function runOpenClawAgentTurn({
  message,
  agentId,
  sessionId,
  target,
  channel,
  replyTo,
  replyChannel,
  replyAccountId,
  timeoutSeconds,
  deliver = true,
}) {
  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('OpenClaw agent activation requires a non-empty message');
  }

  const args = ['agent', '--json'];

  if (deliver !== false) {
    args.push('--deliver');
  }

  args.push('--message', message);

  if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
    args.push('--session-id', sessionId.trim());
  } else if (typeof target === 'string' && target.trim().length > 0) {
    args.push('--to', target.trim());
  }

  if (typeof agentId === 'string' && agentId.trim().length > 0) {
    args.push('--agent', agentId.trim());
  }

  if (typeof channel === 'string' && channel.trim().length > 0) {
    args.push('--channel', channel.trim());
  }

  if (typeof replyTo === 'string' && replyTo.trim().length > 0) {
    args.push('--reply-to', replyTo.trim());
  }

  if (typeof replyChannel === 'string' && replyChannel.trim().length > 0) {
    args.push('--reply-channel', replyChannel.trim());
  }

  if (typeof replyAccountId === 'string' && replyAccountId.trim().length > 0) {
    args.push('--reply-account', replyAccountId.trim());
  }

  const normalizedTimeoutSeconds = typeof timeoutSeconds === 'number' && Number.isFinite(timeoutSeconds)
    ? Math.max(1, Math.floor(timeoutSeconds))
    : null;
  if (normalizedTimeoutSeconds) {
    args.push('--timeout', String(normalizedTimeoutSeconds));
  }

  const command = resolveOpenClawCommand();

  try {
    const result = await execFileAsync(command, args, {
      timeout: normalizedTimeoutSeconds ? (normalizedTimeoutSeconds + 30) * 1000 : 330000,
      maxBuffer: 1024 * 1024,
    });

    return parseOpenClawJsonOutput(result.stdout);
  } catch (err) {
    const stdout = typeof err?.stdout === 'string' ? err.stdout.trim() : '';
    const stderr = typeof err?.stderr === 'string' ? err.stderr.trim() : '';
    const details = [stderr, stdout].filter(Boolean).join(' | ');
    const notFound = err?.code === 'ENOENT'
      ? `OpenClaw CLI not found at "${command}". Set OPENCLAW_BIN or install the binary in PATH.`
      : null;
    const messageText = details || notFound || err.message || 'OpenClaw agent activation failed';
    throw new Error(messageText);
  }
}

function isOpenClawCliAvailable() {
  return isExecutableFile(resolveOpenClawCommand());
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
  buildOpenClawCommandCandidates,
  expandHome,
  getOpenClawCommand,
  isOpenClawCliAvailable,
  loadGatewayConfig,
  loadGatewayDefaults,
  loadGatewayToken,
  invokeGatewayTool,
  listGatewayAgentIds,
  resolveGatewayAgentId,
  resolveGatewayBindingAgentId,
  resolveGatewayDefaultAgentId,
  normalizeGatewayAgentId,
  parseOpenClawJsonOutput,
  resolveOpenClawCommand,
  runOpenClawAgentTurn,
  unwrapGatewayToolResult,
};
