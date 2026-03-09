'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Advanced token management: expiry, scopes, revocation.
 *
 * Token format in config/tokens.json:
 * {
 *   "tokens": [
 *     {
 *       "id": "laptop-token",
 *       "token": "64-char-hex",
 *       "peerId": "laptop",
 *       "scopes": ["read", "write"],
 *       "expiresAt": "2026-06-01T00:00:00Z",
 *       "revoked": false
 *     }
 *   ]
 * }
 */

const SCOPES = {
  read: ['ping', 'get_status', 'openclaw_web_search', 'openclaw_memory_search', 'openclaw_session_status'],
  write: ['openclaw_Write', 'openclaw_Edit'],
  execute: ['openclaw_exec'],
  admin: ['*'],
};

/**
 * Load tokens config.
 * @returns {object|null}
 */
function loadTokensConfig() {
  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', 'config');
  const filePath = path.join(configDir, 'tokens.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Validate a token with expiry and revocation checks.
 * @param {string} token
 * @returns {{ valid: boolean, peerId?: string, scopes?: string[], reason?: string }}
 */
function validateAdvancedToken(token) {
  const config = loadTokensConfig();
  if (!config) return { valid: true, peerId: null }; // No tokens.json = fall back to basic auth

  const entry = (config.tokens || []).find(t => {
    if (t.token.length !== token.length) return false;
    return crypto.timingSafeEqual(Buffer.from(t.token), Buffer.from(token));
  });

  if (!entry) return { valid: false, reason: 'Token not found' };
  if (entry.revoked) return { valid: false, reason: 'Token has been revoked' };

  if (entry.expiresAt) {
    const expiry = new Date(entry.expiresAt);
    if (Date.now() > expiry.getTime()) {
      return { valid: false, reason: `Token expired at ${entry.expiresAt}` };
    }
  }

  return {
    valid: true,
    peerId: entry.peerId || entry.id,
    scopes: entry.scopes || ['read'],
  };
}

/**
 * Check if a token's scopes allow calling a specific skill.
 * @param {string[]} scopes - Token scopes (e.g. ['read', 'write'])
 * @param {string} skillName - Skill being called
 * @returns {boolean}
 */
function scopeAllowsSkill(scopes, skillName) {
  if (!scopes || scopes.length === 0) return true; // No scopes = allow all (backward compat)

  for (const scope of scopes) {
    const allowedSkills = SCOPES[scope];
    if (!allowedSkills) continue;
    if (allowedSkills.includes('*') || allowedSkills.includes(skillName)) return true;
  }

  return false;
}

/**
 * Generate a new managed token.
 * @param {object} opts - { peerId, scopes, expiresInDays }
 * @returns {{ id: string, token: string, peerId: string, scopes: string[], expiresAt: string|null }}
 */
function generateManagedToken({ peerId, scopes = ['read'], expiresInDays = null }) {
  const token = crypto.randomBytes(32).toString('hex');
  const id = `${peerId}-${Date.now()}`;
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null;

  return { id, token, peerId, scopes, expiresAt, revoked: false };
}

/**
 * Revoke a token by ID. Updates tokens.json.
 * @param {string} tokenId
 * @returns {{ success: boolean, reason?: string }}
 */
function revokeToken(tokenId) {
  const configDir = process.env.A2A_CONFIG_DIR || path.join(__dirname, '..', 'config');
  const filePath = path.join(configDir, 'tokens.json');

  if (!fs.existsSync(filePath)) return { success: false, reason: 'No tokens.json found' };

  const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const entry = (config.tokens || []).find(t => t.id === tokenId);

  if (!entry) return { success: false, reason: `Token "${tokenId}" not found` };

  entry.revoked = true;
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
  try { fs.chmodSync(filePath, 0o600); } catch { /* Windows */ }

  return { success: true };
}

module.exports = { validateAdvancedToken, scopeAllowsSkill, generateManagedToken, revokeToken, loadTokensConfig, SCOPES };
