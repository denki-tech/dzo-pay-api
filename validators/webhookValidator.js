const Joi = require('joi');

const webhookValidator = {
  registerWebhook: Joi.object({
    url: Joi.string().uri().required().messages({
      'string.uri': 'Please provide a valid URL',
      'any.required': 'Webhook URL is required',
    }),
    events: Joi.array().items(
      Joi.string().valid(
        'payment.success', 'payment.failed', 'payment.pending',
        'transfer.success', 'transfer.failed',
        'subscription.created', 'subscription.renewed', 'subscription.cancelled',
        'wallet.credited', 'wallet.debited',
        'user.registered', 'user.updated',
        'kyc.submitted', 'kyc.approved', 'kyc.rejected'
      )
    ).min(1).required(),
    secret: Joi.string().min(16).optional(),
    active: Joi.boolean().default(true),
    maxRetries: Joi.number().integer().min(1).max(10).default(5),
    headers: Joi.object().optional(),
  }),

  updateWebhook: Joi.object({
    url: Joi.string().uri().optional(),
    events: Joi.array().items(
      Joi.string().valid(
        'payment.success', 'payment.failed', 'payment.pending',
        'transfer.success', 'transfer.failed',
        'subscription.created', 'subscription.renewed', 'subscription.cancelled',
        'wallet.credited', 'wallet.debited'
      )
    ).optional(),
    secret: Joi.string().min(16).optional(),
    active: Joi.boolean().optional(),
    maxRetries: Joi.number().integer().min(1).max(10).optional(),
    headers: Joi.object().optional(),
  }),

  testWebhook: Joi.object({
    webhookId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
    event: Joi.string().required(),
  }),
};

module.exports = webhookValidator;
