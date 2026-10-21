const crypto = require('crypto');
const logger = require('../utils/logger');

function correlationIdMiddleware(req, res, next) {
  // Use incoming correlation header if available, otherwise generate standard UUID
  const correlationId = req.headers['x-correlation-id'] || 
                        req.headers['x-request-id'] || 
                        crypto.randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  const startTime = Date.now();

  // Log on response completion
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    if (process.env.NODE_ENV !== 'test') {
      logger.info(`${req.method} ${req.originalUrl || req.url} ${res.statusCode} [${durationMs}ms]`, {
        correlationId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs
      });
    }
  });

  next();
}

module.exports = correlationIdMiddleware;
