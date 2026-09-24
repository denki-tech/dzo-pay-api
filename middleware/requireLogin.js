const JWTUtil = require('../utils/jwt');
const User = require('../models/User');
const redis = require('../config/redis');
const logger = require('../config/logger');

const requireLogin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
      });
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = JWTUtil.verifyAccessToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    // Check Redis cache for user
    let user;
    const cachedUser = await redis.get(`user:${decoded.userId}`);

    if (cachedUser) {
      user = JSON.parse(cachedUser);
    } else {
      user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }

      // Cache user for 10 minutes
      await redis.setex(`user:${decoded.userId}`, 600, JSON.stringify(user));
    }

    // Check if user is active
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended',
      });
    }

    if (user.status === 'deactivated') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated',
      });
    }

    // Check if account is locked
    if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
      const remainingTime = Math.ceil((new Date(user.lockUntil) - new Date()) / 60000);
      return res.status(403).json({
        success: false,
        message: `Account is locked. Try again in ${remainingTime} minutes`,
      });
    }

    req.user = user;
    req.token = token;
    req.authMethod = 'jwt';

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

module.exports = requireLogin;
