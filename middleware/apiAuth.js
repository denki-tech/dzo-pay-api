const ApiKey = require('../models/ApiKey');
const User = require('../models/User');
const redis = require('../config/redis');
const logger = require('../config/logger');

const apiAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key is required',
      });
    }

    // Check Redis cache first
    const cachedKey = await redis.get(`apikey:${apiKey}`);
    let keyData;

    if (cachedKey) {
      keyData = JSON.parse(cachedKey);
    } else {
      // Find API key in database
      keyData = await ApiKey.findOne({ key: apiKey, status: 'active' })
        .populate('userId', 'status plan role');

      if (!keyData) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or revoked API key',
        });
      }

      // Cache for 5 minutes
      await redis.setex(`apikey:${apiKey}`, 300, JSON.stringify(keyData));
    }

    // Check if key is expired
    if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'API key has expired',
      });
    }

    // Check if user is active
    if (keyData.userId.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'User account is not active',
      });
    }

    // Check IP whitelist/blacklist
    const clientIp = req.ip || req.connection.remoteAddress;
    if (keyData.ipWhitelist.length > 0 && !keyData.ipWhitelist.includes(clientIp)) {
      return res.status(403).json({
        success: false,
        message: 'IP address not whitelisted',
      });
    }
    if (keyData.ipBlacklist.includes(clientIp)) {
      return res.status(403).json({
        success: false,
        message: 'IP address is blacklisted',
      });
    }

    // Check permissions
    const requiredPermission = req.requiredPermission || 'read';
    if (!keyData.hasPermission(requiredPermission)) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required: ${requiredPermission}`,
      });
    }

    // Attach API key and user to request
    req.apiKey = keyData;
    req.user = keyData.userId;
    req.authMethod = 'api_key';

    // Update last used
    await ApiKey.findByIdAndUpdate(keyData._id, {
      lastUsedAt: new Date(),
      lastUsedIp: clientIp,
      $inc: { 'usageStats.totalRequests': 1 },
    });

    next();
  } catch (error) {
    logger.error('API auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

module.exports = apiAuth;
