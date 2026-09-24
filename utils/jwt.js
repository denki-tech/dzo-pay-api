const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

class JWTUtil {
  static generateAccessToken(payload) {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
      issuer: 'dzo-pay',
      audience: 'dzo-pay-api',
    });
  }

  static generateRefreshToken(payload) {
    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
      issuer: 'dzo-pay',
      audience: 'dzo-pay-api',
    });
  }

  static generateAdminToken(payload) {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.adminExpiresIn,
      issuer: 'dzo-pay',
      audience: 'dzo-pay-admin',
    });
  }

  static generateImpersonationToken(userId, adminId) {
    return jwt.sign(
      { userId, adminId, type: 'impersonation' },
      config.jwt.secret,
      { expiresIn: '1h', issuer: 'dzo-pay' }
    );
  }

  static verifyAccessToken(token) {
    return jwt.verify(token, config.jwt.secret, {
      issuer: 'dzo-pay',
      audience: 'dzo-pay-api',
    });
  }

  static verifyRefreshToken(token) {
    return jwt.verify(token, config.jwt.refreshSecret, {
      issuer: 'dzo-pay',
      audience: 'dzo-pay-api',
    });
  }

  static verifyAdminToken(token) {
    return jwt.verify(token, config.jwt.secret, {
      issuer: 'dzo-pay',
      audience: 'dzo-pay-admin',
    });
  }

  static verifyImpersonationToken(token) {
    return jwt.verify(token, config.jwt.secret, {
      issuer: 'dzo-pay',
    });
  }

  static decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }

  static generatePasswordResetToken(userId) {
    return jwt.sign(
      { userId, type: 'password_reset' },
      config.jwt.secret,
      { expiresIn: '1h', issuer: 'dzo-pay' }
    );
  }

  static verifyPasswordResetToken(token) {
    return jwt.verify(token, config.jwt.secret, {
      issuer: 'dzo-pay',
    });
  }
}

module.exports = JWTUtil;
