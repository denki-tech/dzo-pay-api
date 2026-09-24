const crypto = require('crypto');
const { PaystackSignatureVerifier, StripeSignatureVerifier, FlutterwaveSignatureVerifier } = require('../utils/verifyPaystackSignature');
const { config } = require('../config/env');
const logger = require('../config/logger');

const verifyWebhook = (provider) => {
  return (req, res, next) => {
    try {
      let isValid = false;
      const signature = req.headers['x-paystack-signature'] || 
                        req.headers['stripe-signature'] || 
                        req.headers['verif-hash'];

      switch (provider) {
        case 'paystack':
          isValid = PaystackSignatureVerifier.verify(req.body, signature);
          break;
        case 'stripe':
          isValid = StripeSignatureVerifier.verify(req.body, signature, config.providers.stripe.webhookSecret);
          break;
        case 'flutterwave':
          isValid = FlutterwaveSignatureVerifier.verify(req.body, signature, config.providers.flutterwave.webhookSecret);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Unknown webhook provider',
          });
      }

      if (!isValid) {
        logger.warn('Invalid webhook signature', {
          provider,
          ip: req.ip,
          signature: signature?.substring(0, 20),
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature',
        });
      }

      logger.info('Webhook signature verified', { provider });
      next();
    } catch (error) {
      logger.error('Webhook verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Webhook verification failed',
      });
    }
  };
};

module.exports = verifyWebhook;
