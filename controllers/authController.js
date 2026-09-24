const authService = require('../services/authService');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register({
        ...req.body,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.login({
        ...req.body,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        deviceInfo: req.headers['user-agent'],
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 401));
    }
  }

  async refreshToken(req, res, next) {
    try {
      const result = await authService.refreshToken(req.body.refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 401));
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const result = await authService.forgotPassword(req.body.email);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async resetPassword(req, res, next) {
    try {
      const result = await authService.resetPassword(req.body.token, req.body.password);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async changePassword(req, res, next) {
    try {
      const result = await authService.changePassword(
        req.user._id,
        req.body.currentPassword,
        req.body.newPassword
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async getProfile(req, res, next) {
    try {
      const user = req.user;
      res.status(200).json({
        success: true,
        data: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          plan: user.plan,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          mfaEnabled: user.mfaEnabled,
          kycStatus: user.kycStatus,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          notificationPreferences: user.notificationPreferences,
        },
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async updateProfile(req, res, next) {
    try {
      const user = await require('../models/User').findByIdAndUpdate(
        req.user._id,
        { $set: req.body },
        { new: true, runValidators: true }
      ).select('-password');

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async setupMFA(req, res, next) {
    try {
      const result = await authService.setupMFA(req.user._id, req.body.method);

      res.status(200).json({
        success: true,
        message: 'MFA setup initiated',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async verifyMFASetup(req, res, next) {
    try {
      const result = await authService.verifyMFASetup(
        req.user._id,
        req.body.code,
        req.body.method
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async disableMFA(req, res, next) {
    try {
      const result = await authService.disableMFA(
        req.user._id,
        req.body.password,
        req.body.code
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async sendOTP(req, res, next) {
    try {
      const result = await authService.sendOTP(
        req.user._id,
        req.body.type,
        req.body.channel || 'email'
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: { otpId: result.otpId, expiresAt: result.expiresAt },
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async verifyOTP(req, res, next) {
    try {
      const result = await authService.verifyOTP(
        req.user._id,
        req.body.code,
        req.body.type
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async logout(req, res, next) {
    try {
      const result = await authService.logout(req.user._id, req.token);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const decoded = require('../utils/jwt').verifyPasswordResetToken(req.query.token);
      const user = await require('../models/User').findByIdAndUpdate(
        decoded.userId,
        { $set: { emailVerified: true } },
        { new: true }
      );

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }
}

module.exports = new AuthController();
