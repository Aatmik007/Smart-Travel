/**
 * Production structured logger for JammuMove.
 * Outputs sanitized logs with correlation IDs, masking sensitive commuter
 * data, passwords, authorization tokens, and API credentials.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'jwt',
  'authorization',
  'cookie',
  'apikey',
  'secret',
  'gemini_api_key',
  'jwt_secret',
  'refreshtoken',
  'accesstoken'
]);

function redactValue(key, val) {
  if (typeof key === 'string' && SENSITIVE_KEYS.has(key.toLowerCase())) {
    return '[REDACTED]';
  }
  if (typeof val === 'string') {
    // Redact Bearer tokens
    if (/^bearer\s+/i.test(val)) {
      return 'Bearer [REDACTED]';
    }
    // Redact JWT-like strings
    if (/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(val) && val.length > 30) {
      return '[REDACTED_TOKEN]';
    }
  }
  return val;
}

function sanitize(obj, depth = 0) {
  if (depth > 4 || !obj || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item, depth + 1));
  }
  const cleaned = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null) {
      cleaned[k] = sanitize(v, depth + 1);
    } else {
      cleaned[k] = redactValue(k, v);
    }
  }
  return cleaned;
}

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const sanitizedMeta = sanitize(meta);

  // In test mode, keep logs quiet unless explicit debugging or error
  if (process.env.NODE_ENV === 'test' && level === 'debug') {
    return null;
  }

  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...(sanitizedMeta && Object.keys(sanitizedMeta).length > 0 ? sanitizedMeta : {})
  };

  return JSON.stringify(logEntry);
}

const logger = {
  info(message, meta) {
    const formatted = formatLog('info', message, meta);
    if (formatted) console.log(formatted);
  },
  warn(message, meta) {
    const formatted = formatLog('warn', message, meta);
    if (formatted) console.warn(formatted);
  },
  error(message, meta) {
    const formatted = formatLog('error', message, meta);
    if (formatted) console.error(formatted);
  },
  debug(message, meta) {
    const formatted = formatLog('debug', message, meta);
    if (formatted) console.debug(formatted);
  },
  sanitize
};

module.exports = logger;
