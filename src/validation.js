'use strict';

/**
 * Input validation and sanitization framework.
 * Validates JSON-RPC params, skill arguments, and config inputs.
 */

/**
 * Validate a string is safe (no control chars, reasonable length).
 * @param {string} input
 * @param {number} maxLen
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateString(input, maxLen = 10000) {
  if (typeof input !== 'string') return { valid: false, reason: 'Expected string' };
  if (input.length > maxLen) return { valid: false, reason: `String too long (max ${maxLen})` };
  // Reject null bytes and other control chars (except newline, tab)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(input)) {
    return { valid: false, reason: 'String contains invalid control characters' };
  }
  return { valid: true };
}

/**
 * Validate a URL is safe (http/https only, no credentials in URL).
 * @param {string} url
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateUrl(url) {
  if (typeof url !== 'string') return { valid: false, reason: 'Expected string URL' };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: `Invalid protocol: ${parsed.protocol} (only http/https)` };
    }
    if (parsed.username || parsed.password) {
      return { valid: false, reason: 'URL must not contain credentials' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }
}

/**
 * Validate a file path is safe (no traversal, no absolute paths to sensitive dirs).
 * @param {string} filePath
 * @returns {{ valid: boolean, reason?: string }}
 */
function validatePath(filePath) {
  if (typeof filePath !== 'string') return { valid: false, reason: 'Expected string path' };
  if (filePath.includes('..')) return { valid: false, reason: 'Path traversal not allowed' };
  if (filePath.startsWith('/etc/') || filePath.startsWith('/root/')) {
    return { valid: false, reason: 'Access to system directories not allowed' };
  }
  return { valid: true };
}

/**
 * Validate JSON-RPC message params.
 * @param {object} params
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateMessageParams(params) {
  if (!params || typeof params !== 'object') return { valid: false, reason: 'Missing params' };
  if (!params.message) return { valid: false, reason: 'Missing message in params' };
  if (!params.message.parts || !Array.isArray(params.message.parts)) {
    return { valid: false, reason: 'Message must have parts array' };
  }
  if (params.message.parts.length === 0) {
    return { valid: false, reason: 'Message parts cannot be empty' };
  }
  // Validate each text part
  for (const part of params.message.parts) {
    if (part.kind === 'text') {
      const check = validateString(part.text);
      if (!check.valid) return { valid: false, reason: `Invalid text part: ${check.reason}` };
    }
  }
  return { valid: true };
}

/**
 * Sanitize a string for safe logging (remove tokens, truncate).
 * @param {string} input
 * @param {number} maxLen
 * @returns {string}
 */
function sanitizeForLog(input, maxLen = 200) {
  if (typeof input !== 'string') return String(input).slice(0, maxLen);
  // Mask anything that looks like a token (32+ hex chars)
  let sanitized = input.replace(/[0-9a-f]{32,}/gi, '[REDACTED]');
  return sanitized.slice(0, maxLen);
}

module.exports = { validateString, validateUrl, validatePath, validateMessageParams, sanitizeForLog };
