const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');
const { config } = require('../config/env');
const logger = require('../config/logger');

// Create rate limiter with Redis store
const createRateLimiter = (options = {}) => {
  const {
    windowMs = config.rateLimit.windowMs,
    max = config.rateLimit.maxRequests,
    keyPrefix = 'rl',
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
  } = options;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use API key if available, otherwise IP
      return `${keyPrefix}:${req.apiKey?.key || req.ip}`;
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        apiKey: req.apiKey?.key,
        path: req.path,
      });

      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
    skip: (req) => {
      // Skip rate limiting for health checks and admin
      return req.path === '/api/v1/health' || req.isAdmin;
    },
  });
};

// Plan-based rate limiter
const planRateLimit = async (req, res, next) => {
  try {
    const user = req.user || req.apiKey?.userId;
    if (!user) return next();

    const planLimits = {
      free: { requestsPerMinute: 60, requestsPerHour: 500, requestsPerDay: 2000 },
      basic: { requestsPerMinute: 120, requestsPerHour: 2000, requestsPerDay: 10000 },
      pro: { requestsPerMinute: 300, requestsPerHour: 10000, requestsPerDay: 50000 },
      enterprise: { requestsPerMinute: 1000, requestsPerHour: 50000, requestsPerDay: 200000 },
    };

    const limits = planLimits[user.plan] || planLimits.free;
    const key = `ratelimit:${user._id || user.id}`;

    // Check minute limit
    const minuteKey = `${key}:minute`;
    const minuteCount = await redis.incr(minuteKey);
    if (minuteCount === 1) {
      await redis.expire(minuteKey, 60);
    }

    if (minuteCount > limits.requestsPerMinute) {
      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded for ${user.plan} plan. Max ${limits.requestsPerMinute} requests/minute.`,
        limitType: 'per_minute',
      });
    }

    // Check hour limit
    const hourKey = `${key}:hour`;
    const hourCount = await redis.incr(hourKey);
    if (hourCount === 1) {
      await redis.expire(hourKey, 3600);
    }

    if (hourCount > limits.requestsPerHour) {
      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded for ${user.plan} plan. Max ${limits.requestsPerHour} requests/hour.`,
        limitType: 'per_hour',
      });
    }

    // Check day limit
    const dayKey = `${key}:day`;
    const dayCount = await redis.incr(dayKey);
    if (dayCount === 1) {
      await redis.expire(dayKey, 86400);
    }

    if (dayCount > limits.requestsPerDay) {
      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded for ${user.plan} plan. Max ${limits.requestsPerDay} requests/day.`,
        limitType: 'per_day',
      });
    }

    // Attach rate limit info to response headers
    res.setHeader('X-RateLimit-Limit-Minute', limits.requestsPerMinute);
    res.setHeader('X-RateLimit-Remaining-Minute', limits.requestsPerMinute - minuteCount);
    res.setHeader('X-RateLimit-Limit-Hour', limits.requestsPerHour);
    res.setHeader('X-RateLimit-Remaining-Hour', limits.requestsPerHour - hourCount);

    next();
  } catch (error) {
    logger.error('Rate limit error:', error);
    next();
  }
};

module.exports = {
  createRateLimiter,
  planRateLimit,
  standard: createRateLimiter(),
  strict: createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'rl_strict' }),
  auth: createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: 'rl_auth' }),
};
