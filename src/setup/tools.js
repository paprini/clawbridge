'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { fetchAgentCard, validatePeerUrl } = require('../client');

/**
 * Get the local subnet (e.g. "192.168.1") from network interfaces.
 * Returns the first non-internal IPv4 address's /24 prefix.
 */
function getLocalSubnet() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        return { subnet: `${parts[0]}.${parts[1]}.${parts[2]}`, localIp: iface.address };
      }
    }
  }
  return null;
}

/**
 * Scan a /24 subnet for A2A agents on port 9100.
 * Limits concurrency to avoid flooding the network.
 * @param {string} subnet - e.g. "192.168.1"
 * @param {function} onFound - called with each discovered agent
 * @returns {Promise<Array>} all discovered agents
 */
async function scanNetwork(subnet, onFound) {
  const found = [];
  const CONCURRENCY = 20;
  const ips = [];
  for (let i = 1; i < 255; i++) ips.push(`${subnet}.${i}`);

  for (let i = 0; i < ips.length; i += CONCURRENCY) {
    const batch = ips.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map(async (ip) => {
      try {
        const card = await fetchAgentCard(`http://${ip}:9100`);
        const agent = { ip, port: 9100, name: card.name, skills: card.skills?.map(s => s.id || s.name) || [] };
        found.push(agent);
        if (onFound) onFound(agent);
      } catch {
        // not an A2A agent, skip
      }
    }));
  }

  return found;
}

/**
 * Check a single host for an A2A agent.
 */
async function checkAgent(host, port = 9100) {
  try {
    validatePeerUrl(`http://${host}:${port}`);
    const card = await fetchAgentCard(`http://${host}:${port}`);
    return { online: true, name: card.name, skills: card.skills?.map(s => s.id || s.name) || [], url: `http://${host}:${port}` };
  } catch (err) {
    return { online: false, error: err.message, url: `http://${host}:${port}` };
  }
}

/**
 * Generate a cryptographically secure bearer token.
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Rotate token for a specific peer. Updates peers.json in place.
 * @param {string} peerId
 * @returns {{ peerId: string, newToken: string }}
 */
function rotatePeerToken(peerId) {
  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', '..', 'config');
  const peersPath = path.join(configDir, 'peers.json');

  if (!fs.existsSync(peersPath)) {
    return { error: 'No peers.json found' };
  }

  const data = JSON.parse(fs.readFileSync(peersPath, 'utf8'));
  const peer = (data.peers || []).find(p => p.id === peerId);

  if (!peer) {
    return { error: `Peer "${peerId}" not found` };
  }

  const newToken = generateToken();
  peer.token = newToken;

  fs.writeFileSync(peersPath, JSON.stringify(data, null, 2) + '\n');
  try { fs.chmodSync(peersPath, 0o600); } catch { /* Windows */ }

  return { peerId, newToken, note: 'Update this token on the peer side too' };
}

/**
 * Read existing config if present.
 */
function getCurrentConfig() {
  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', '..', 'config');
  const result = { exists: false, agent: null, peers: [], skills: [], bridge: null, contacts: null };

  try {
    const agentPath = path.join(configDir, 'agent.json');
    if (fs.existsSync(agentPath)) {
      result.agent = JSON.parse(fs.readFileSync(agentPath, 'utf8'));
      result.exists = true;
    }
  } catch { /* no config yet */ }

  try {
    const peersPath = path.join(configDir, 'peers.json');
    if (fs.existsSync(peersPath)) {
      const data = JSON.parse(fs.readFileSync(peersPath, 'utf8'));
      result.peers = data.peers || [];
    }
  } catch { /* no peers yet */ }

  try {
    const skillsPath = path.join(configDir, 'skills.json');
    if (fs.existsSync(skillsPath)) {
      const data = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
      result.skills = data.exposed_skills || [];
    }
  } catch { /* no skills yet */ }

  try {
    const bridgePath = path.join(configDir, 'bridge.json');
    if (fs.existsSync(bridgePath)) {
      result.bridge = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));
    }
  } catch { /* no bridge yet */ }

  try {
    const contactsPath = path.join(configDir, 'contacts.json');
    if (fs.existsSync(contactsPath)) {
      result.contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
    }
  } catch { /* no contacts yet */ }

  return result;
}

function normalizeDefaultDelivery(defaultDelivery) {
  if (!defaultDelivery) {
    return null;
  }

  if (typeof defaultDelivery !== 'object' || Array.isArray(defaultDelivery)) {
    return null;
  }

  if (typeof defaultDelivery.target !== 'string' || defaultDelivery.target.trim().length === 0) {
    return null;
  }

  return {
    type: typeof defaultDelivery.type === 'string' && defaultDelivery.type.trim().length > 0
      ? defaultDelivery.type.trim()
      : 'target',
    target: defaultDelivery.target.trim(),
    ...(typeof defaultDelivery.channel === 'string' && defaultDelivery.channel.trim().length > 0
      ? { channel: defaultDelivery.channel.trim() }
      : {}),
  };
}

/**
 * Write config files with validation.
 */
function writeConfig({ agentName, agentDescription, agentUrl, peers, token, defaultDelivery }) {
  // Validate inputs
  if (!agentName || typeof agentName !== 'string' || agentName.trim().length === 0) {
    return { error: 'Agent name is required' };
  }
  if (agentUrl) {
    try { validatePeerUrl(agentUrl.replace(/\/a2a$/, '')); } catch (e) {
      return { error: `Invalid agent URL: ${e.message}` };
    }
  }
  if (peers) {
    for (const p of peers) {
      if (!p.url) return { error: `Peer "${p.id || 'unknown'}" is missing a URL` };
      try { validatePeerUrl(p.url); } catch (e) {
        return { error: `Invalid peer URL for "${p.id}": ${e.message}` };
      }
    }
  }

  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', '..', 'config');
  const existing = getCurrentConfig();
  const normalizedDefaultDelivery = normalizeDefaultDelivery(defaultDelivery)
    || normalizeDefaultDelivery(existing.agent?.default_delivery)
    || null;

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // agent.json
  const agent = {
    id: agentName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name: agentName,
    description: agentDescription || `A2A agent: ${agentName}`,
    url: agentUrl || 'http://localhost:9100/a2a',
    version: '0.1.0',
    default_delivery: normalizedDefaultDelivery,
  };
  fs.writeFileSync(path.join(configDir, 'agent.json'), JSON.stringify(agent, null, 2) + '\n');

  // peers.json
  const peersData = {
    peers: (peers || []).map(p => ({
      id: p.id || p.name,
      url: p.url,
      token: p.token || generateToken(), // unique token per peer
    })),
  };
  fs.writeFileSync(path.join(configDir, 'peers.json'), JSON.stringify(peersData, null, 2) + '\n');
  // Restrict permissions — peers.json contains tokens
  try { fs.chmodSync(path.join(configDir, 'peers.json'), 0o600); } catch { /* Windows doesn't support chmod */ }

  // skills.json (default safe skills)
  const skills = existing.skills.length > 0
    ? { exposed_skills: existing.skills }
    : {
        exposed_skills: [
          { name: 'ping', description: 'Health check. Returns pong with timestamp.', tags: ['health', 'status'], public: true },
          { name: 'get_status', description: 'Returns agent status including uptime and version.', tags: ['status', 'info'], public: true },
          { name: 'chat', description: 'Send a chat message to this agent.', tags: ['messaging', 'gateway'], public: true },
          { name: 'broadcast', description: 'Broadcast a message to connected peers.', tags: ['messaging', 'fanout'], public: true },
        ],
      };
  fs.writeFileSync(path.join(configDir, 'skills.json'), JSON.stringify(skills, null, 2) + '\n');

  const bridge = existing.bridge || {
    enabled: true,
    gateway: {
      url: 'http://127.0.0.1:18789',
      tokenPath: '~/.openclaw/openclaw.json',
      sessionKey: 'main',
    },
    exposed_tools: ['message', 'web_search', 'web_fetch', 'memory_search', 'session_status'],
    timeout_ms: 300000,
    max_concurrent: 5,
  };
  fs.writeFileSync(path.join(configDir, 'bridge.json'), JSON.stringify(bridge, null, 2) + '\n');

  const contacts = existing.contacts || { aliases: {} };
  fs.writeFileSync(path.join(configDir, 'contacts.json'), JSON.stringify(contacts, null, 2) + '\n');

  return { agent, peers: peersData.peers, token, configDir, bridge, contacts };
}

/**
 * Test connectivity to a peer by pinging it.
 */
async function testConnection(peerUrl, token) {
  try {
    validatePeerUrl(peerUrl);
    const rpcUrl = new URL('/a2a', peerUrl).href;
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'message/send',
        params: { message: { kind: 'message', messageId: crypto.randomUUID(), role: 'user', parts: [{ kind: 'text', text: 'ping' }] } },
        id: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (data.result) {
      const text = data.result.parts?.[0]?.text;
      const parsed = text ? JSON.parse(text) : {};
      return { success: true, latency: 'ok', status: parsed.status || 'connected' };
    }
    return { success: false, error: data.error?.message || 'Unknown error' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Tool definitions for the LLM (OpenAI function calling format)
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_local_network',
      description: 'Get the local network subnet and IP address of this machine',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scan_network',
      description: 'Scan the local /24 subnet for A2A agents. Returns list of discovered agents.',
      parameters: {
        type: 'object',
        properties: { subnet: { type: 'string', description: 'Subnet prefix like "192.168.1". If omitted, auto-detects.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_agent',
      description: 'Check if a specific host has an A2A agent running',
      parameters: {
        type: 'object',
        properties: { host: { type: 'string', description: 'IP or hostname' }, port: { type: 'number', description: 'Port (default 9100)' } },
        required: ['host'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_token',
      description: 'Generate a secure bearer token for peer authentication. Returns the token string. NEVER show the full token to the user — just confirm it was generated.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_config',
      description: 'Read the current A2A configuration (agent info, peers, skills). Use this to understand current state.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_config',
      description: 'Write A2A configuration files (agent.json, peers.json, skills.json, bridge.json, contacts.json)',
      parameters: {
        type: 'object',
        properties: {
          agentName: { type: 'string', description: 'Name for this agent' },
          agentDescription: { type: 'string', description: 'Description of this agent' },
          agentUrl: { type: 'string', description: 'URL where this agent is reachable (e.g. http://10.0.1.10:9100/a2a)' },
          peers: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, url: { type: 'string' }, token: { type: 'string' } },
            },
            description: 'List of peer agents to connect to',
          },
          defaultDelivery: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Delivery type, e.g. owner or channel' },
              target: { type: 'string', description: 'Local default delivery target id or alias' },
              channel: { type: 'string', description: 'Optional local platform/channel namespace' },
            },
            description: 'Default local delivery target used for @agent delivery and broadcasts',
          },
          token: { type: 'string', description: 'Shared bearer token (from generate_token)' },
        },
        required: ['agentName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'test_connection',
      description: 'Test connectivity to a peer agent by sending a ping',
      parameters: {
        type: 'object',
        properties: { peerUrl: { type: 'string', description: 'Peer base URL' }, token: { type: 'string', description: 'Bearer token' } },
        required: ['peerUrl', 'token'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rotate_peer_token',
      description: 'Generate a new token for a specific peer. The old token stops working. The user must update the token on the peer side too.',
      parameters: {
        type: 'object',
        properties: { peerId: { type: 'string', description: 'Peer ID to rotate token for' } },
        required: ['peerId'],
      },
    },
  },
];

/**
 * Execute a tool call by name.
 */
async function executeTool(name, args) {
  switch (name) {
    case 'get_local_network': {
      const info = getLocalSubnet();
      return info || { error: 'Could not detect local network' };
    }
    case 'scan_network': {
      const subnet = args.subnet || getLocalSubnet()?.subnet;
      if (!subnet) return { error: 'Could not detect subnet. Provide one manually.' };
      const agents = await scanNetwork(subnet);
      return { subnet, agents, count: agents.length };
    }
    case 'check_agent':
      return checkAgent(args.host, args.port || 9100);
    case 'generate_token':
      return { token: generateToken() };
    case 'get_current_config':
      return getCurrentConfig();
    case 'write_config':
      return writeConfig(args);
    case 'test_connection':
      return testConnection(args.peerUrl, args.token);
    case 'rotate_peer_token':
      return rotatePeerToken(args.peerId);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { TOOL_DEFINITIONS, executeTool, getLocalSubnet, scanNetwork, checkAgent, generateToken, rotatePeerToken, getCurrentConfig, writeConfig, testConnection };
