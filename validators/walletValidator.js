const Joi = require('joi');

const walletValidator = {
  createWallet: Joi.object({
    name: Joi.string().max(100).required(),
    currency: Joi.string().valid('NGN', 'USD', 'GHS', 'KES', 'ZAR', 'EUR', 'GBP').default('NGN'),
    type: Joi.string().valid('primary', 'savings', 'business', 'escrow').default('primary'),
    dailyLimit: Joi.number().positive().optional(),
    monthlyLimit: Joi.number().positive().optional(),
    singleTransactionLimit: Joi.number().positive().optional(),
  }),

  transfer: Joi.object({
    sourceWalletId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
    destinationWalletId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    destinationAccountNumber: Joi.string().length(10).pattern(/^\d+$/).optional(),
    amount: Joi.number().positive().min(100).required(),
    description: Joi.string().max(255).required(),
    pin: Joi.string().length(4).pattern(/^\d+$/).optional(),
    otp: Joi.string().length(6).optional(),
    idempotencyKey: Joi.string().optional(),
  }).xor('destinationWalletId', 'destinationAccountNumber'),

  updateWallet: Joi.object({
    name: Joi.string().max(100).optional(),
    dailyLimit: Joi.number().positive().optional(),
    monthlyLimit: Joi.number().positive().optional(),
    singleTransactionLimit: Joi.number().positive().optional(),
    status: Joi.string().valid('active', 'frozen').optional(),
  }),

  withdraw: Joi.object({
    walletId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
    amount: Joi.number().positive().min(100).required(),
    bankCode: Joi.string().required(),
    accountNumber: Joi.string().required(),
    accountName: Joi.string().optional(),
    description: Joi.string().max(255).optional(),
    otp: Joi.string().length(6).optional(),
  }),

  deposit: Joi.object({
    walletId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
    amount: Joi.number().positive().min(100).required(),
    provider: Joi.string().valid('paystack', 'stripe', 'flutterwave').required(),
    description: Joi.string().max(255).optional(),
  }),

  setPin: Joi.object({
    pin: Joi.string().length(4).pattern(/^\d+$/).required(),
    confirmPin: Joi.string().valid(Joi.ref('pin')).required().messages({
      'any.only': 'PINs do not match',
    }),
  }),

  verifyPin: Joi.object({
    pin: Joi.string().length(4).pattern(/^\d+$/).required(),
  }),
};

module.exports = walletValidator;
