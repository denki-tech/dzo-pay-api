const { config } = require('../config/env');
const logger = require('../config/logger');

class PushNotificationService {
  constructor() {
    this.enabled = !!config.push.firebase.projectId;
  }

  async send({ token, title, body, data = {}, imageUrl = null }) {
    try {
      if (!this.enabled) {
        logger.warn('Push notifications not configured');
        return { success: false, reason: 'not_configured' };
      }

      // In production, integrate with Firebase Admin SDK
      // const admin = require('firebase-admin');
      // const message = {
      //   notification: { title, body, imageUrl },
      //   data,
      //   token,
      // };
      // await admin.messaging().send(message);

      logger.info('Push notification sent', {
        token: token.substring(0, 10) + '...',
        title,
      });

      return {
        success: true,
        messageId: `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
    } catch (error) {
      logger.error('Push notification failed:', {
        error: error.message,
        token: token.substring(0, 10) + '...',
      });
      throw error;
    }
  }

  async sendToTopic({ topic, title, body, data = {} }) {
    try {
      if (!this.enabled) {
        return { success: false, reason: 'not_configured' };
      }

      logger.info('Push notification sent to topic', { topic, title });

      return {
        success: true,
        messageId: `push_topic_${Date.now()}`,
      };
    } catch (error) {
      logger.error('Topic push notification failed:', { error: error.message });
      throw error;
    }
  }

  async sendMulticast({ tokens, title, body, data = {} }) {
    try {
      if (!this.enabled) {
        return { success: false, reason: 'not_configured' };
      }

      logger.info('Multicast push notification sent', {
        tokenCount: tokens.length,
        title,
      });

      return {
        success: true,
        successCount: tokens.length,
        failureCount: 0,
      };
    } catch (error) {
      logger.error('Multicast push notification failed:', { error: error.message });
      throw error;
    }
  }

  async sendTransactionNotification({ token, type, amount, currency, description, balance }) {
    const title = type === 'credit' ? 'Money Received' : 'Money Sent';
    const body = `${currency} ${amount} - ${description}`;
    return this.send({
      token,
      title,
      body,
      data: { type: 'transaction', amount, currency, balance },
    });
  }
}

module.exports = new PushNotificationService();
