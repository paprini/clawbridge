'use strict';

/**
 * Structured JSON logger. Replaces console.log/warn/error with
 * structured output suitable for log aggregation (ELK, CloudWatch, etc).
 *
 * In production (NODE_ENV=production), outputs JSON lines.
 * In development, outputs human-readable format.
 */

const isProduction = process.env.NODE_ENV === 'production';
const REDACT_KEYS = /(authorization|token|secret|password|api[_-]?key)/i;
const HEX_SECRET = /\b[0-9a-f]{32,}\b/gi;
const BEARER_SECRET = /Bearer\s+[A-Za-z0-9._-]+/gi;

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value
      .replace(BEARER_SECRET, 'Bearer [REDACTED]')
      .replace(HEX_SECRET, '[REDACTED]');
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === 'object') {
    const sanitized = {};
    for (const [key, nested] of Object.entries(value)) {
      sanitized[key] = REDACT_KEYS.test(key) ? '[REDACTED]' : sanitizeValue(nested);
    }
    return sanitized;
  }

  return value;
}

function formatLog(level, message, data = {}) {
  const sanitizedMessage = sanitizeValue(message);
  const sanitizedData = sanitizeValue(data);

  if (isProduction) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message: sanitizedMessage,
      ...sanitizedData,
    });
  }
  // Dev format: [LEVEL] message key=value
  const extras = Object.keys(sanitizedData).length > 0
    ? ' ' + Object.entries(sanitizedData).map(([k, v]) => `${k}=${v}`).join(' ')
    : '';
  return `[${level.toUpperCase()}] ${sanitizedMessage}${extras}`;
}

const logger = {
  info(message, data) { console.log(formatLog('info', message, data)); },
  warn(message, data) { console.warn(formatLog('warn', message, data)); },
  error(message, data) { console.error(formatLog('error', message, data)); },
  audit(message, data) { console.log(formatLog('audit', message, data)); },
};

module.exports = { ...logger, formatLog };
