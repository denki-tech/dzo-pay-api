const Joi = require('joi');

const paymentValidator = {
  initializePayment: Joi.object({
    amount: Joi.number().positive().min(100).required().messages({
      'number.positive': 'Amount must be positive',
      'number.min': 'Minimum amount is 100',
      'any.required': 'Amount is required',
    }),
    currency: Joi.string().valid('NGN', 'USD', 'GHS', 'KES', 'ZAR', 'EUR', 'GBP').default('NGN'),
    description: Joi.string().max(255).required(),
    provider: Joi.string().valid('paystack', 'stripe', 'flutterwave').default('paystack'),
    walletId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    metadata: Joi.object().optional(),
    callbackUrl: Joi.string().uri().optional(),
    channels: Joi.array().items(
      Joi.string().valid('card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer', 'crypto')
    ).optional(),
    customer: Joi.object({
      email: Joi.string().email().optional(),
      phone: Joi.string().optional(),
      name: Joi.string().optional(),
    }).optional(),
    split: Joi.array().items(
      Joi.object({
        subaccount: Joi.string().required(),
        share: Joi.number().positive().required(),
      })
    ).optional(),
    idempotencyKey: Joi.string().optional(),
  }),

  verifyPayment: Joi.object({
    reference: Joi.string().required(),
    provider: Joi.string().valid('paystack', 'stripe', 'flutterwave').required(),
  }),

  createPaymentLink: Joi.object({
    name: Joi.string().max(100).required(),
    description: Joi.string().max(500).optional(),
    amount: Joi.number().positive().min(100).required(),
    currency: Joi.string().valid('NGN', 'USD', 'GHS', 'KES', 'ZAR', 'EUR', 'GBP').default('NGN'),
    isFixedAmount: Joi.boolean().default(true),
    minAmount: Joi.number().positive().when('isFixedAmount', {
      is: false,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    maxAmount: Joi.number().positive().when('isFixedAmount', {
      is: false,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    expiresAt: Joi.date().greater('now').optional(),
    maxPayments: Joi.number().integer().positive().optional(),
    redirectUrl: Joi.string().uri().optional(),
    customFields: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        type: Joi.string().valid('text', 'number', 'email', 'date', 'select').default('text'),
        required: Joi.boolean().default(false),
        options: Joi.array().items(Joi.string()).optional(),
      })
    ).optional(),
    branding: Joi.object({
      logoUrl: Joi.string().uri().optional(),
      primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
      backgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
      buttonText: Joi.string().max(50).optional(),
    }).optional(),
    thankYouMessage: Joi.string().max(500).optional(),
  }),

  updatePaymentLink: Joi.object({
    name: Joi.string().max(100).optional(),
    description: Joi.string().max(500).optional(),
    status: Joi.string().valid('active', 'inactive').optional(),
    amount: Joi.number().positive().optional(),
    expiresAt: Joi.date().greater('now').optional(),
    maxPayments: Joi.number().integer().positive().optional(),
    redirectUrl: Joi.string().uri().optional(),
  }),

  refundPayment: Joi.object({
    transactionId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
    amount: Joi.number().positive().optional(),
    reason: Joi.string().max(255).optional(),
  }),

  processWebhook: Joi.object({
    event: Joi.string().required(),
    data: Joi.object().required(),
  }).unknown(true),
};

module.exports = paymentValidator;
