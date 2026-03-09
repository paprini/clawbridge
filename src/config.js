'use strict';

const fs = require('fs');
const path = require('path');

// In-memory config cache. Loaded once at first access, reusable across requests.
// Call clearCache() or send SIGHUP to reload.
const _cache = {};

/**
 * Load and parse a JSON config file from the config directory.
 * Results are cached in memory to avoid sync I/O on every request.
 * @param {string} filename
 * @returns {object}
 */
function loadConfig(filename) {
  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', 'config');
  // Prevent path traversal
  const safe = path.basename(filename);
  const cacheKey = `${configDir}:${safe}`;

  if (_cache[cacheKey]) return _cache[cacheKey];

  const filePath = path.join(configDir, safe);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${safe}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  _cache[cacheKey] = parsed;
  return parsed;
}

function loadAgentConfig() {
  return loadConfig('agent.json');
}

function loadPeersConfig() {
  const config = loadConfig('peers.json');
  return config.peers || [];
}

function loadSkillsConfig() {
  const config = loadConfig('skills.json');
  return config.exposed_skills || [];
}

/**
 * Clear the config cache. Call on SIGHUP or when configs change.
 */
function clearCache() {
  for (const key of Object.keys(_cache)) {
    delete _cache[key];
  }
}

// Reload configs on SIGHUP (Unix signal)
process.on('SIGHUP', () => {
  console.log('[CONFIG] Received SIGHUP, reloading configs');
  clearCache();
});

module.exports = { loadAgentConfig, loadPeersConfig, loadSkillsConfig, clearCache };
