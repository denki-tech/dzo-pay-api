const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const WebhookLog = require('../models/WebhookLog');
const Subscription = require('../models/Subscription');
const FeatureFlag = require('../models/FeatureFlag');
const analyticsService = require('../services/analyticsService');
const authService = require('../services/authService');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

class AdminController {
  async getUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, status, plan, role, search } = req.query;
      const query = {};

      if (status) query.status = status;
      if (plan) query.plan = plan;
      if (role) query.role = role;
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password -mfaSecret -mfaBackupCodes')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        User.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async getUserDetails(req, res, next) {
    try {
      const user = await User.findById(req.params.id)
        .select('-password -mfaSecret -mfaBackupCodes')
        .lean();

      if (!user) {
        return next(new AppError('User not found', 404));
      }

      const [wallets, transactions, subscription, auditLogs] = await Promise.all([
        Wallet.find({ userId: user._id }).lean(),
        Transaction.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        Subscription.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean(),
        AuditLog.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

      res.status(200).json({
        success: true,
        data: {
          user,
          wallets,
          recentTransactions: transactions,
          subscription,
          recentActivity: auditLogs,
        },
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async updateUserStatus(req, res, next) {
    try {
      const { status } = req.body;
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { status } },
        { new: true }
      ).select('-password');

      if (!user) {
        return next(new AppError('User not found', 404));
      }

      // Log audit
      await AuditLog.createLog({
        userId: user._id,
        action: `user.${status}`,
        category: 'admin',
        description: `User status changed to ${status}`,
        details: { previousStatus: user.status },
        impersonatedBy: req.user._id,
      });

      res.status(200).json({
        success: true,
        message: `User ${status} successfully`,
        data: { user },
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async impersonateUser(req, res, next) {
    try {
      const result = await authService.impersonateUser(req.user._id, req.params.id);

      res.status(200).json({
        success: true,
        message: 'Impersonation token generated',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async getStats(req, res, next) {
    try {
      const result = await analyticsService.getDashboardStats(req.query.period || '30d');

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async getAuditLogs(req, res, next) {
    try {
      const { userId, action, category, severity, status, startDate, endDate, page = 1, limit = 50 } = req.query;

      const query = {};
      if (userId) query.userId = userId;
      if (action) query.action = action;
      if (category) query.category = category;
      if (severity) query.severity = severity;
      if (status) query.status = status;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('userId', 'email firstName lastName')
          .populate('impersonatedBy', 'email firstName')
          .lean(),
        AuditLog.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        data: {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async getWebhookLogs(req, res, next) {
    try {
      const { status, provider, page = 1, limit = 50 } = req.query;

      const query = {};
      if (status) query.status = status;
      if (provider) query.provider = provider;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [logs, total] = await Promise.all([
        WebhookLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        WebhookLog.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        data: {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async getFeatureFlags(req, res, next) {
    try {
      const flags = await FeatureFlag.find().sort({ createdAt: -1 }).lean();

      res.status(200).json({
        success: true,
        data: { featureFlags: flags },
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async createFeatureFlag(req, res, next) {
    try {
      const flag = await FeatureFlag.create({
        ...req.body,
        createdBy: req.user._id,
      });

      res.status(201).json({
        success: true,
        message: 'Feature flag created',
        data: { featureFlag: flag },
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async toggleFeatureFlag(req, res, next) {
    try {
      const flag = await FeatureFlag.toggle(req.params.key, req.body.enabled, req.user._id);

      res.status(200).json({
        success: true,
        message: `Feature flag ${req.body.enabled ? 'enabled' : 'disabled'}`,
        data: { featureFlag: flag },
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async getSystemHealth(req, res, next) {
    try {
      const health = await analyticsService.getSystemHealth();

      res.status(200).json({
        success: true,
        data: health,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async getDeliveryStats(req, res, next) {
    try {
      const { type, period = '30d' } = req.query;

      // Get email delivery stats
      const emailStats = { sent: 0, delivered: 0, failed: 0 };

      // Get SMS delivery stats
      const smsStats = { sent: 0, delivered: 0, failed: 0 };

      // Get push notification stats
      const pushStats = { sent: 0, delivered: 0, failed: 0 };

      // In production, these would come from actual delivery tracking
      res.status(200).json({
        success: true,
        data: {
          email: emailStats,
          sms: smsStats,
          push: pushStats,
          period,
        },
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }
}

module.exports = new AdminController();
