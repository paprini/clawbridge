'use strict';

const crypto = require('crypto');
const { loadPeersConfig } = require('./config');

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
 * @returns {Promise<object>} Parsed result from the peer
 */
async function callPeerSkill(peerId, skillText) {
  const peers = loadPeersConfig();
  const peer = peers.find((p) => p.id === peerId);

  if (!peer) {
    throw new Error(`Peer not found: ${peerId}`);
  }

  validatePeerUrl(peer.url);
  const rpcUrl = new URL('/a2a', peer.url).href;

  const body = {
    jsonrpc: '2.0',
    method: 'message/send',
    params: {
      message: {
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'user',
        parts: [{ kind: 'text', text: skillText }],
      },
    },
    id: Date.now(),
  };

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${peer.token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

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

module.exports = { fetchAgentCard, callPeerSkill };
