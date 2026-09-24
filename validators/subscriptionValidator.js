const Joi = require('joi');

const subscriptionValidator = {
  createSubscription: Joi.object({
    plan: Joi.string().valid('free', 'basic', 'pro', 'enterprise').required(),
    billingCycle: Joi.string().valid('monthly', 'quarterly', 'yearly').default('monthly'),
    paymentMethod: Joi.string().valid('card', 'bank_transfer', 'wallet').default('card'),
    provider: Joi.string().valid('paystack', 'stripe', 'flutterwave', 'internal').default('paystack'),
    autoRenew: Joi.boolean().default(true),
    couponCode: Joi.string().optional(),
  }),

  upgradeSubscription: Joi.object({
    plan: Joi.string().valid('free', 'basic', 'pro', 'enterprise').required(),
    billingCycle: Joi.string().valid('monthly', 'quarterly', 'yearly').optional(),
    immediate: Joi.boolean().default(true),
    prorate: Joi.boolean().default(true),
  }),

  cancelSubscription: Joi.object({
    reason: Joi.string().max(500).optional(),
    immediate: Joi.boolean().default(false),
  }),

  renewSubscription: Joi.object({
    paymentMethod: Joi.string().valid('card', 'bank_transfer', 'wallet').optional(),
  }),

  applyCoupon: Joi.object({
    couponCode: Joi.string().required(),
    plan: Joi.string().valid('free', 'basic', 'pro', 'enterprise').required(),
    billingCycle: Joi.string().valid('monthly', 'quarterly', 'yearly').required(),
  }),
};

module.exports = subscriptionValidator;
