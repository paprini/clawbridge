'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Load permissions config. Returns null if no permissions file exists
 * (meaning all authenticated peers can call all exposed skills — Phase 1 default).
 */
function loadPermissions() {
  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', 'config');
  const filePath = path.join(configDir, 'permissions.json');

  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Check if a peer has permission to call a specific skill.
 * @param {string} peerId - The authenticated peer ID
 * @param {string} skillName - The skill being called
 * @returns {{ allowed: boolean, reason?: string }}
 */
function checkPermission(peerId, skillName) {
  const perms = loadPermissions();

  // No permissions file = allow all (Phase 1 backward compat)
  if (!perms) return { allowed: true };

  // Check if peer has explicit permissions
  const peerPerms = perms.permissions?.[peerId];

  if (!peerPerms) {
    // Check default policy
    const defaultPolicy = perms.default || 'allow';
    if (defaultPolicy === 'deny') {
      return { allowed: false, reason: `Peer "${peerId}" has no permissions configured` };
    }
    return { allowed: true };
  }

  // Check if skill is in peer's allowed list
  if (Array.isArray(peerPerms)) {
    if (peerPerms.includes('*') || peerPerms.includes(skillName)) {
      return { allowed: true };
    }
    return { allowed: false, reason: `Peer "${peerId}" not authorized for skill "${skillName}"` };
  }

  return { allowed: true };
}

/**
 * Get all permissions for a peer.
 * @param {string} peerId
 * @returns {string[]|null} List of allowed skills, or null if no restrictions
 */
function getPeerPermissions(peerId) {
  const perms = loadPermissions();
  if (!perms) return null;
  return perms.permissions?.[peerId] || null;
}

/**
 * Get full permissions map.
 * @returns {object|null}
 */
function getAllPermissions() {
  const perms = loadPermissions();
  if (!perms) return { default: 'allow', permissions: {}, note: 'No permissions.json — all peers allowed' };
  return perms;
}

module.exports = { checkPermission, getPeerPermissions, getAllPermissions, loadPermissions };
