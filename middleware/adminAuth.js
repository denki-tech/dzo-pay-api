const JWTUtil = require('../utils/jwt');
const User = require('../models/User');
const { config } = require('../config/env');
const logger = require('../config/logger');

const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const adminKey = req.headers['x-admin-key'];

    // Check admin secret key
    if (adminKey !== config.admin.secretKey) {
      return res.status(403).json({
        success: false,
        message: 'Invalid admin key',
      });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Admin access token is required',
      });
    }

    const token = authHeader.substring(7);

    // Verify admin token
    let decoded;
    try {
      decoded = JWTUtil.verifyAdminToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired admin token',
      });
    }

    // Verify user is admin
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Admin user not found',
      });
    }

    if (!['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    req.user = user;
    req.token = token;
    req.isAdmin = true;
    req.isSuperAdmin = user.role === 'superadmin';

    next();
  } catch (error) {
    logger.error('Admin auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Admin authentication error',
    });
  }
};

module.exports = adminAuth;
