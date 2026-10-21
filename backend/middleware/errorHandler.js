/**
 * Centralized error handling and not-found middlewares for JammuMove.
 * Formats errors consistently without leaking stack traces or sensitive environment variables.
 */

function notFoundHandler(req, res, next) {
  res.status(404).json({
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
}

function centralErrorHandler(err, req, res, next) {
  // If response has already started streaming, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const isProduction = process.env.NODE_ENV === 'production';

  // Log error securely
  if (statusCode >= 500) {
    console.error(`[SERVER ERROR] ${req.method} ${req.originalUrl}:`, err.message || err);
  } else {
    console.warn(`[CLIENT ERROR ${statusCode}] ${req.method} ${req.originalUrl}:`, err.message || err);
  }

  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    ...(err.errors && { errors: err.errors }),
    ...(!isProduction && statusCode >= 500 && { stack: err.stack })
  });
}

module.exports = {
  notFoundHandler,
  centralErrorHandler
};
