'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Load and parse a JSON config file from the config directory.
 * @param {string} filename
 * @returns {object}
 */
function loadConfig(filename) {
  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', 'config');
  // Prevent path traversal
  const safe = path.basename(filename);
  const filePath = path.join(configDir, safe);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${safe}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
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

module.exports = { loadAgentConfig, loadPeersConfig, loadSkillsConfig };
