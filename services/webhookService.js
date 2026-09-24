const WebhookLog = require('../models/WebhookLog');
const axios = require('axios');
const logger = require('../config/logger');
const { config } = require('../config/env');

class WebhookService {
  async deliverWebhook(webhookId, event, payload, url, secret, maxRetries = 5) {
    const log = await WebhookLog.create({
      webhookId,
      userId: payload.userId,
      event,
      payload,
      url,
      maxAttempts: maxRetries,
      signature: secret ? this.generateSignature(payload, secret) : null,
    });

    return this.attemptDelivery(log);
  }

  async attemptDelivery(log) {
    try {
      const startTime = Date.now();

      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': log.event,
        'X-Webhook-Id': log._id.toString(),
        'X-Webhook-Attempt': log.attempts + 1,
        'X-Webhook-Signature': log.signature,
        'User-Agent': 'D-ZO-Pay-Webhook/1.0',
      };

      const response = await axios.post(log.url, log.payload, {
        headers,
        timeout: config.webhook.timeoutMs,
        validateStatus: () => true, // Don't throw on non-2xx
      });

      const duration = Date.now() - startTime;
      log.deliveryDuration = duration;

      if (response.status >= 200 && response.status < 300) {
        await log.recordAttempt('delivered', response.status);
        logger.info('Webhook delivered', {
          webhookId: log._id,
          event: log.event,
          duration,
          attempts: log.attempts,
        });
        return { success: true, log };
      }

      await log.recordAttempt('failed', response.status);
      logger.warn('Webhook delivery failed', {
        webhookId: log._id,
        status: response.status,
        attempts: log.attempts,
      });

      if (log.attempts < log.maxAttempts) {
        // Schedule retry
        await this.scheduleRetry(log);
      }

      return { success: false, log, status: response.status };
    } catch (error) {
      await log.recordAttempt('failed', null, error.message);
      logger.error('Webhook delivery error', {
        webhookId: log._id,
        error: error.message,
        attempts: log.attempts,
      });

      if (log.attempts < log.maxAttempts) {
        await this.scheduleRetry(log);
      }

      return { success: false, log, error: error.message };
    }
  }

  async scheduleRetry(log) {
    // Retry delays: 1min, 5min, 15min, 30min, 1hour
    const delays = [60000, 300000, 900000, 1800000, 3600000];
    const delay = delays[Math.min(log.attempts - 1, delays.length - 1)];

    log.nextRetryAt = new Date(Date.now() + delay);
    await log.save();

    logger.info('Webhook retry scheduled', {
      webhookId: log._id,
      nextRetry: log.nextRetryAt,
      attempt: log.attempts + 1,
    });
  }

  async retryFailedWebhooks() {
    const failedWebhooks = await WebhookLog.find({
      status: { $in: ['failed', 'retrying'] },
      attempts: { $lt: { $ref: 'maxAttempts' } },
      nextRetryAt: { $lte: new Date() },
    }).limit(100);

    const results = [];
    for (const webhook of failedWebhooks) {
      const result = await this.attemptDelivery(webhook);
      results.push(result);
    }

    logger.info('Webhook retry batch completed', {
      processed: results.length,
      successful: results.filter(r => r.success).length,
    });

    return results;
  }

  generateSignature(payload, secret) {
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  async getWebhookLogs(userId, options = {}) {
    const { status, event, page = 1, limit = 20 } = options;

    const query = { userId };
    if (status) query.status = status;
    if (event) query.event = event;

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      WebhookLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebhookLog.countDocuments(query),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getFailedWebhooks(userId) {
    return WebhookLog.find({
      userId,
      status: { $in: ['failed', 'retrying', 'permanent_fail'] },
    }).sort({ createdAt: -1 }).lean();
  }
}

module.exports = new WebhookService();
