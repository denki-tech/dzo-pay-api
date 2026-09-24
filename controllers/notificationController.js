const notificationService = require('../services/notificationService');
const { AppError } = require('../middleware/errorHandler');

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const result = await notificationService.getNotifications(req.user._id, {
        read: req.query.read !== undefined ? req.query.read === 'true' : undefined,
        type: req.query.type,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async markAsRead(req, res, next) {
    try {
      const result = await notificationService.markAsRead(
        req.user._id,
        req.params.notificationId
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(req.user._id);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async deleteNotification(req, res, next) {
    try {
      const result = await notificationService.deleteNotification(
        req.user._id,
        req.params.notificationId
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async getPreferences(req, res, next) {
    try {
      const result = await notificationService.getNotificationPreferences(req.user._id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async updatePreferences(req, res, next) {
    try {
      const result = await notificationService.updateNotificationPreferences(
        req.user._id,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Preferences updated',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }
}

module.exports = new NotificationController();
