const Notification = require('../models/Notification');
const User = require('../models/User');
const emailService = require('../utils/sendEmail');
const smsService = require('../utils/sendSMS');
const pushService = require('../utils/sendPush');
const logger = require('../config/logger');

class NotificationService {
  async createNotification(data) {
    const { userId, type, channel, title, message, htmlContent, data: notificationData, priority, actionUrl, actionText, icon, relatedEntity, expiresAt } = data;

    const notification = await Notification.create({
      userId,
      type,
      channel,
      title,
      message,
      htmlContent,
      data: notificationData,
      priority: priority || 'normal',
      actionUrl,
      actionText,
      icon,
      relatedEntity,
      expiresAt,
    });

    // Send immediately if high priority
    if (priority === 'urgent') {
      await this.sendNotification(notification);
    }

    return notification;
  }

  async sendNotification(notification) {
    const user = await User.findById(notification.userId);
    if (!user) {
      logger.warn('User not found for notification', { notificationId: notification._id });
      return;
    }

    // Check user preferences
    if (!this.shouldSendToUser(user, notification)) {
      logger.info('Notification skipped due to user preferences', {
        notificationId: notification._id,
        userId: user._id,
      });
      return;
    }

    try {
      switch (notification.channel) {
        case 'email':
          if (user.notificationPreferences?.email !== false) {
            await emailService.send({
              to: user.email,
              subject: notification.title,
              html: notification.htmlContent || notification.message,
            });
            await notification.markAsSent();
          }
          break;

        case 'sms':
          if (user.notificationPreferences?.sms !== false && user.phoneNumber) {
            await smsService.send({
              to: user.phoneNumber,
              message: notification.message,
            });
            await notification.markAsSent();
          }
          break;

        case 'push':
          if (user.notificationPreferences?.push !== false) {
            // In production, get FCM token from user device
            await pushService.send({
              token: user.pushToken || 'dummy-token',
              title: notification.title,
              body: notification.message,
              data: notification.data,
            });
            await notification.markAsSent();
          }
          break;

        case 'in_app':
          // In-app notifications are stored and retrieved via API
          await notification.markAsSent();
          break;

        case 'webhook':
          // Handled by webhook service
          await notification.markAsSent();
          break;
      }
    } catch (error) {
      logger.error('Notification sending failed:', {
        notificationId: notification._id,
        channel: notification.channel,
        error: error.message,
      });
      await notification.markAsFailed(error.message);
    }
  }

  shouldSendToUser(user, notification) {
    // Check notification type preferences
    switch (notification.type) {
      case 'transaction':
        return user.notificationPreferences?.transactionAlerts !== false;
      case 'security':
        return user.notificationPreferences?.securityAlerts !== false;
      case 'marketing':
        return user.notificationPreferences?.marketingEmails === true;
      default:
        return true;
    }
  }

  async getNotifications(userId, options = {}) {
    const { read, type, page = 1, limit = 20 } = options;

    const query = { userId };
    if (read !== undefined) query.read = read;
    if (type) query.type = type;

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.getUnreadCount(userId),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(userId, notificationId) {
    const notification = await Notification.findOne({ _id: notificationId, userId });
    if (!notification) throw new Error('Notification not found');

    await notification.markAsRead();
    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId) {
    await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true, readAt: new Date(), status: 'read' } }
    );
    return { message: 'All notifications marked as read' };
  }

  async deleteNotification(userId, notificationId) {
    const notification = await Notification.findOneAndDelete({ _id: notificationId, userId });
    if (!notification) throw new Error('Notification not found');
    return { message: 'Notification deleted' };
  }

  async sendBulkNotifications(data) {
    const { userIds, type, channel, title, message, priority } = data;

    const notifications = [];
    for (const userId of userIds) {
      const notification = await this.createNotification({
        userId,
        type,
        channel,
        title,
        message,
        priority,
      });
      notifications.push(notification);
    }

    return {
      sent: notifications.length,
      notifications,
    };
  }

  async getNotificationPreferences(userId) {
    const user = await User.findById(userId).select('notificationPreferences');
    return user?.notificationPreferences || {};
  }

  async updateNotificationPreferences(userId, preferences) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { notificationPreferences: preferences } },
      { new: true }
    ).select('notificationPreferences');

    return user.notificationPreferences;
  }
}

module.exports = new NotificationService();
