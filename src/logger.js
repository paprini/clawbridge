'use strict';

/**
 * Structured JSON logger. Replaces console.log/warn/error with
 * structured output suitable for log aggregation (ELK, CloudWatch, etc).
 *
 * In production (NODE_ENV=production), outputs JSON lines.
 * In development, outputs human-readable format.
 */

const isProduction = process.env.NODE_ENV === 'production';

function formatLog(level, message, data = {}) {
  if (isProduction) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
    });
  }
  // Dev format: [LEVEL] message key=value
  const extras = Object.keys(data).length > 0
    ? ' ' + Object.entries(data).map(([k, v]) => `${k}=${v}`).join(' ')
    : '';
  return `[${level.toUpperCase()}] ${message}${extras}`;
}

const logger = {
  info(message, data) { console.log(formatLog('info', message, data)); },
  warn(message, data) { console.warn(formatLog('warn', message, data)); },
  error(message, data) { console.error(formatLog('error', message, data)); },
  audit(message, data) { console.log(formatLog('audit', message, data)); },
};

module.exports = logger;
