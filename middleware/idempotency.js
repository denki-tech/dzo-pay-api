const redis = require('../config/redis');
const logger = require('../config/logger');

const idempotency = async (req, res, next) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

    if (!idempotencyKey) {
      return next();
    }

    const cacheKey = `idempotency:${idempotencyKey}`;
    const cachedResponse = await redis.get(cacheKey);

    if (cachedResponse) {
      const parsed = JSON.parse(cachedResponse);
      logger.info('Idempotency cache hit', { key: idempotencyKey });

      return res.status(parsed.statusCode).json({
        success: parsed.success,
        message: parsed.message,
        data: parsed.data,
        cached: true,
      });
    }

    // Store original res.json to capture response
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      // Cache successful responses for 24 hours
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheData = {
          statusCode: res.statusCode,
          success: body.success,
          message: body.message,
          data: body.data,
          cachedAt: new Date().toISOString(),
        };

        redis.setex(cacheKey, 86400, JSON.stringify(cacheData))
          .catch((err) => logger.error('Idempotency cache error:', err));
      }

      return originalJson(body);
    };

    next();
  } catch (error) {
    logger.error('Idempotency middleware error:', error);
    next();
  }
};

module.exports = idempotency;
