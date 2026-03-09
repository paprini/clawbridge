'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_REGISTRY_URL = 'https://registry.openclaw.ai/agents.json';

/**
 * Fetch public agents from a registry URL.
 * @param {string} registryUrl - URL to fetch agent listings from
 * @returns {Promise<Array<{name: string, url: string, skills: string[], description: string}>>}
 */
async function fetchPublicAgents(registryUrl) {
  const url = registryUrl || getRegistryUrl();

  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Registry fetch failed: ${res.status} from ${url}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.agents || [];
}

/**
 * Search public agents by skill name.
 * @param {string} skillQuery - Skill to search for (partial match)
 * @param {string} registryUrl - Optional registry URL override
 * @returns {Promise<Array>} Matching agents
 */
async function searchPublicAgents(skillQuery, registryUrl) {
  const agents = await fetchPublicAgents(registryUrl);
  const query = skillQuery.toLowerCase();

  return agents.filter(agent => {
    const skills = agent.skills || [];
    return skills.some(s => (typeof s === 'string' ? s : s.name || '').toLowerCase().includes(query));
  });
}

/**
 * Get configured registry URL from config or env.
 * @returns {string}
 */
function getRegistryUrl() {
  if (process.env.A2A_REGISTRY_URL) return process.env.A2A_REGISTRY_URL;

  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', 'config');
  const bridgePath = path.join(configDir, 'bridge.json');

  if (fs.existsSync(bridgePath)) {
    try {
      const config = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));
      if (config.registry_url) return config.registry_url;
    } catch { /* use default */ }
  }

  return DEFAULT_REGISTRY_URL;
}

module.exports = { fetchPublicAgents, searchPublicAgents, getRegistryUrl };
