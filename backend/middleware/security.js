/**
 * Security headers and in-memory rate limiting middleware.
 * Zero-dependency, lightweight, production-grade security enhancements.
 */

// Basic security headers
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
  next();
}

// In-memory token bucket / sliding window rate limiter
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests, please try again later.' }) {
  const hits = new Map();

  // Periodic cleanup of stale IPs every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref(); // unref so it doesn't block process exit in tests

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = hits.get(ip);
    if (!record || now > record.resetTime) {
      hits.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    record.count++;
    if (record.count > max) {
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      return res.status(429).json({ message });
    }

    next();
  };
}

// Pre-configured rate limiters
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per 15 mins
  message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
});

const sosRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 attempts per 5 mins
  message: 'Too many SOS alerts dispatched in a short window. Please wait before re-triggering.'
});

const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 general API requests
  message: 'API rate limit exceeded. Please throttle your requests.'
});

module.exports = {
  securityHeaders,
  createRateLimiter,
  authRateLimiter,
  sosRateLimiter,
  apiRateLimiter
};
