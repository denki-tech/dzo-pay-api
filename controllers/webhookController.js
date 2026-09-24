const webhookService = require('../services/webhookService');
const paymentService = require('../services/paymentService');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

class WebhookController {
  async handlePaystackWebhook(req, res, next) {
    try {
      const event = req.body.event;
      const data = req.body.data;

      logger.info('Paystack webhook received', { event, reference: data?.reference });

      switch (event) {
        case 'charge.success':
          await paymentService.verifyPayment(data.reference, 'paystack');
          break;
        case 'transfer.success':
          // Handle transfer success
          break;
        case 'transfer.failed':
          // Handle transfer failure
          break;
        default:
          logger.warn('Unhandled Paystack webhook event', { event });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Paystack webhook error:', error);
      // Always return 200 to prevent retries
      res.status(200).json({ success: true });
    }
  }

  async handleStripeWebhook(req, res, next) {
    try {
      const event = req.body.type;
      const data = req.body.data?.object;

      logger.info('Stripe webhook received', { event, id: data?.id });

      switch (event) {
        case 'payment_intent.succeeded':
          // Handle payment success
          break;
        case 'payment_intent.payment_failed':
          // Handle payment failure
          break;
        case 'invoice.payment_succeeded':
          // Handle subscription payment
          break;
        default:
          logger.warn('Unhandled Stripe webhook event', { event });
      }

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Stripe webhook error:', error);
      res.status(200).json({ received: true });
    }
  }

  async handleFlutterwaveWebhook(req, res, next) {
    try {
      const event = req.body.event;
      const data = req.body.data;

      logger.info('Flutterwave webhook received', { event, txRef: data?.tx_ref });

      switch (event) {
        case 'charge.completed':
          if (data.status === 'successful') {
            await paymentService.verifyPayment(data.tx_ref, 'flutterwave');
          }
          break;
        default:
          logger.warn('Unhandled Flutterwave webhook event', { event });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Flutterwave webhook error:', error);
      res.status(200).json({ success: true });
    }
  }

  async getWebhookLogs(req, res, next) {
    try {
      const result = await webhookService.getWebhookLogs(req.user._id, {
        status: req.query.status,
        event: req.query.event,
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

  async getFailedWebhooks(req, res, next) {
    try {
      const result = await webhookService.getFailedWebhooks(req.user._id);

      res.status(200).json({
        success: true,
        data: { failedWebhooks: result },
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async retryWebhook(req, res, next) {
    try {
      const log = await require('../models/WebhookLog').findById(req.params.webhookId);
      if (!log) {
        return next(new AppError('Webhook log not found', 404));
      }

      const result = await webhookService.attemptDelivery(log);

      res.status(200).json({
        success: true,
        message: result.success ? 'Webhook delivered' : 'Webhook retry failed',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }
}

module.exports = new WebhookController();
