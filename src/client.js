'use strict';

const crypto = require('crypto');
const { loadPeersConfig } = require('./config');

const DEFAULT_PEER_TIMEOUT_MS = 10000;
const DEFAULT_PEER_SHORT_TIMEOUT_MS = 5000;
const DEFAULT_PEER_CHAT_TIMEOUT_MS = 60000;

function buildMessageParts(skillText, params) {
  const parts = [{ kind: 'text', text: skillText }];

  if (params && typeof params === 'object' && Object.keys(params).length > 0) {
    parts.push({ kind: 'text', text: JSON.stringify(params) });
  }

  return parts;
}

/**
 * Validate that a URL uses http or https protocol only.
 * @param {string} urlStr
 * @returns {string} validated URL
 */
function validatePeerUrl(urlStr) {
  const parsed = new URL(urlStr);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid peer URL protocol: ${parsed.protocol} (only http/https allowed)`);
  }
  return urlStr;
}

function parseTimeoutEnv(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeSkillName(skillText) {
  if (typeof skillText !== 'string') {
    return '';
  }

  return skillText.trim().split(/\s+/, 1)[0].toLowerCase();
}

function resolvePeerCallTimeoutMs(skillText, opts = {}) {
  if (typeof opts.timeoutMs === 'number' && Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0) {
    return Math.floor(opts.timeoutMs);
  }

  const skillName = normalizeSkillName(skillText);
  const shortTimeoutMs = parseTimeoutEnv('A2A_PEER_TIMEOUT_SHORT_MS', DEFAULT_PEER_SHORT_TIMEOUT_MS);
  const defaultTimeoutMs = parseTimeoutEnv('A2A_PEER_TIMEOUT_DEFAULT_MS', DEFAULT_PEER_TIMEOUT_MS);
  const chatTimeoutMs = parseTimeoutEnv('A2A_PEER_TIMEOUT_CHAT_MS', DEFAULT_PEER_CHAT_TIMEOUT_MS);

  if (skillName === 'chat' || skillName === 'broadcast') {
    return chatTimeoutMs;
  }

  if (skillName === 'ping' || skillName === 'get_status') {
    return shortTimeoutMs;
  }

  return defaultTimeoutMs;
}

function isPeerCallTimeoutError(err) {
  if (!err || typeof err !== 'object') {
    return false;
  }

  if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.code === 'ABORT_ERR') {
    return true;
  }

  return typeof err.message === 'string' && /timed? out|aborted/i.test(err.message);
}

/**
 * Fetch Agent Card from a peer.
 * @param {string} baseUrl - Peer's base URL (e.g. http://localhost:9101)
 * @returns {Promise<object>} Agent Card
 */
async function fetchAgentCard(baseUrl) {
  validatePeerUrl(baseUrl);
  const url = new URL('/.well-known/agent-card.json', baseUrl).href;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

  if (!res.ok) {
    throw new Error(`Failed to fetch Agent Card from ${url}: ${res.status}`);
  }

  return res.json();
}

/**
 * Call a skill on a remote peer via JSON-RPC message/send.
 * @param {string} peerId - Peer identifier from peers.json
 * @param {string} skillText - Text to send (skill name like "ping" or "get_status")
 * @param {object} [params] - Optional JSON params sent as a second text part
 * @returns {Promise<object>} Parsed result from the peer
 */
async function callPeerSkill(peerId, skillText, params, opts = {}) {
  const peers = loadPeersConfig();
  const peer = peers.find((p) => p.id === peerId);

  if (!peer) {
    throw new Error(`Peer not found: ${peerId}`);
  }

  validatePeerUrl(peer.url);
  const rpcUrl = new URL('/a2a', peer.url).href;
  const timeoutMs = resolvePeerCallTimeoutMs(skillText, opts);
  const skillName = normalizeSkillName(skillText) || 'request';

  const body = {
    jsonrpc: '2.0',
    method: 'message/send',
    params: {
      message: {
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'user',
        parts: buildMessageParts(skillText, params),
      },
    },
    id: Date.now(),
  };

  let res;
  try {
    res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${peer.token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (isPeerCallTimeoutError(err)) {
      const remoteMayHaveCompleted = skillName === 'chat' || skillName === 'broadcast'
        ? ' The remote side may still have completed successfully.'
        : '';
      throw new Error(`Peer call to ${skillName} on ${peerId} timed out after ${timeoutMs}ms.${remoteMayHaveCompleted}`);
    }
    throw err;
  }

  if (!res.ok) {
    throw new Error(`HTTP error from peer ${peerId}: ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`JSON-RPC error from ${peerId}: ${data.error.message}`);
  }

  // Extract the text content from the response message
  const result = data.result;
  if (result && result.parts) {
    const textPart = result.parts.find((p) => p.kind === 'text');
    if (textPart) {
      try {
        return JSON.parse(textPart.text);
      } catch {
        return { text: textPart.text };
      }
    }
  }

  return result;
}

/**
 * Call multiple peers in parallel (fan-out).
 * @param {Array<{peerId: string, skill: string, params?: object}>|string[]} callsOrPeerIds
 * @param {string} [skill]
 * @param {object} [params]
 * @returns {Promise<Array<{peerId: string, result?: object, error?: string}>>}
 */
async function callPeers(callsOrPeerIds, skill, params, opts = {}) {
  let calls = callsOrPeerIds;

  if (Array.isArray(callsOrPeerIds) && callsOrPeerIds.length === 0) {
    return [];
  }

  if (!Array.isArray(callsOrPeerIds) || typeof callsOrPeerIds[0] === 'string') {
    const peerIds = Array.isArray(callsOrPeerIds) && callsOrPeerIds.length > 0
      ? callsOrPeerIds
      : loadPeersConfig().map((peer) => peer.id);
    calls = peerIds.map((peerId) => ({ peerId, skill, params, timeoutMs: opts.timeoutMs }));
  }

  return Promise.all(calls.map(async ({ peerId, skill: callSkill, params: callParams, timeoutMs }) => {
    try {
      const result = await callPeerSkill(peerId, callSkill, callParams, { timeoutMs });
      return { peerId, result };
    } catch (err) {
      return { peerId, error: err.message };
    }
  }));
}

/**
 * Chain calls sequentially, passing each result to the next.
 * @param {Array<{peerId: string, skill: string}>} steps
 * @returns {Promise<object>} Final result
 */
async function chainCalls(steps) {
  let lastResult = null;
  for (const step of steps) {
    const skill = lastResult
      ? `${step.skill} ${JSON.stringify(lastResult)}`
      : step.skill;
    lastResult = await callPeerSkill(step.peerId, skill, step.params, { timeoutMs: step.timeoutMs });
  }
  return lastResult;
}

module.exports = {
  buildMessageParts,
  callPeerSkill,
  callPeers,
  chainCalls,
  fetchAgentCard,
  resolvePeerCallTimeoutMs,
  validatePeerUrl,
};
