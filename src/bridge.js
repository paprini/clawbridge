'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SAFE_TOOL_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const DANGEROUS_TOOLS = new Set(['exec', 'Write', 'Edit', 'Read', 'browser']);

/**
 * Load bridge configuration from config/bridge.json.
 * @returns {object|null} Bridge config or null if not configured
 */
function loadBridgeConfig() {
  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', 'config');
  const filePath = path.join(configDir, 'bridge.json');

  if (!fs.existsSync(filePath)) return null;
  const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  validateBridgeConfig(config);
  return config;
}

function validateBridgeConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid bridge configuration');
  }

  const exposedTools = config.exposed_tools;
  if (exposedTools === undefined) return;

  if (!Array.isArray(exposedTools)) {
    throw new Error('Bridge config "exposed_tools" must be an array');
  }

  const seen = new Set();
  for (const toolName of exposedTools) {
    if (typeof toolName !== 'string' || !SAFE_TOOL_NAME.test(toolName)) {
      throw new Error(`Invalid bridge tool name "${toolName}"`);
    }

    if (seen.has(toolName)) {
      throw new Error(`Duplicate bridge tool "${toolName}"`);
    }
    seen.add(toolName);

    if (!config.allow_dangerous_tools && DANGEROUS_TOOLS.has(toolName)) {
      throw new Error(
        `Bridge tool "${toolName}" is blocked by default. ` +
        'Set "allow_dangerous_tools": true only if you explicitly accept the risk.'
      );
    }
  }
}

/**
 * Load OpenClaw gateway auth token from the OpenClaw config file.
 * @param {string} tokenPath - Path to openclaw.json (supports ~ for home dir)
 * @returns {string} Bearer token
 * @throws {Error} If config not found or token missing
 */
function loadGatewayToken(tokenPath) {
  const resolved = tokenPath.replace(/^~/, os.homedir());
  if (!fs.existsSync(resolved)) {
    throw new Error(`OpenClaw config not found: ${resolved}. Is OpenClaw installed?`);
  }
  const config = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const token = config?.gateway?.auth?.token;
  if (!token) throw new Error('No gateway auth token found in OpenClaw config');
  return token;
}

// Concurrency tracking
let _activeCalls = 0;

/**
 * Call an OpenClaw tool via the gateway HTTP API.
 * @param {string} toolName - Tool to invoke (e.g. "exec", "Read", "web_search")
 * @param {object} args - Tool-specific arguments
 * @param {object} opts - Optional overrides { sessionKey, timeoutMs }
 * @returns {Promise<object>} Tool result
 */
async function callOpenClawTool(toolName, args = {}, opts = {}) {
  const config = loadBridgeConfig();
  if (!config || !config.enabled) {
    throw new Error('Bridge not configured. Create config/bridge.json with enabled: true');
  }

  // Check tool is in whitelist
  if (config.exposed_tools && !config.exposed_tools.includes(toolName)) {
    throw new Error(`Tool "${toolName}" is not in the bridge whitelist`);
  }

  // Check concurrency limit
  const maxConcurrent = config.max_concurrent || 5;
  if (_activeCalls >= maxConcurrent) {
    throw new Error(`Bridge concurrency limit reached (${maxConcurrent}). Try again later.`);
  }

  const gatewayUrl = config.gateway?.url || 'http://127.0.0.1:18789';
  const tokenPath = config.gateway?.tokenPath || '~/.openclaw/openclaw.json';
  const sessionKey = opts.sessionKey || config.gateway?.sessionKey || 'main';
  const timeoutMs = opts.timeoutMs || config.timeout_ms || 300000;

  let token;
  try {
    token = loadGatewayToken(tokenPath);
  } catch (err) {
    throw new Error(`Bridge auth failed: ${err.message}`);
  }

  _activeCalls++;
  try {
    const res = await fetch(`${gatewayUrl}/tools/invoke`, {
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
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(`Tool "${toolName}" timed out after ${timeoutMs}ms`);
    }
    if (err.code === 'ECONNREFUSED') {
      throw new Error(`OpenClaw gateway not running at ${gatewayUrl}. Start with: openclaw gateway start`);
    }
    throw err;
  } finally {
    _activeCalls--;
  }
}

/**
 * Get list of bridged tools (from config whitelist).
 * @returns {Array<{name: string, description: string}>}
 */
function getBridgedTools() {
  const config = loadBridgeConfig();
  if (!config || !config.enabled) return [];

  const TOOL_DESCRIPTIONS = {
    exec: 'Run shell commands on the remote machine',
    Read: 'Read file contents',
    Write: 'Write file contents',
    Edit: 'Edit file (find and replace)',
    message: 'Send a message through the local OpenClaw gateway',
    web_search: 'Search the web',
    web_fetch: 'Fetch URL content',
    memory_search: 'Search agent memory',
    image: 'Analyze images',
    pdf: 'Analyze PDF documents',
    session_status: 'Get OpenClaw session status',
    sessions_list: 'List active OpenClaw sessions',
    browser: 'Control browser',
  };

  return (config.exposed_tools || []).map(name => ({
    name: `openclaw_${name}`,
    description: TOOL_DESCRIPTIONS[name] || `OpenClaw tool: ${name}`,
    bridged: true,
    originalTool: name,
  }));
}

/**
 * Check if a skill name is a bridged OpenClaw tool.
 */
function isBridgedTool(skillName) {
  if (!skillName || !skillName.startsWith('openclaw_')) return false;
  const config = loadBridgeConfig();
  if (!config || !config.enabled) return false;
  const toolName = skillName.replace(/^openclaw_/, '');
  return (config.exposed_tools || []).includes(toolName);
}

module.exports = {
  callOpenClawTool,
  getBridgedTools,
  isBridgedTool,
  loadBridgeConfig,
  loadGatewayToken,
};
