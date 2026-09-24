const Joi = require('joi');

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const phoneRegex = /^\+?[1-9]\d{1,14}$/;

const authValidator = {
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().pattern(passwordRegex).required().messages({
      'string.pattern.base': 'Password must be at least 8 characters with uppercase, lowercase, number and special character',
      'any.required': 'Password is required',
    }),
    firstName: Joi.string().min(2).max(50).required().messages({
      'string.min': 'First name must be at least 2 characters',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required',
    }),
    lastName: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Last name must be at least 2 characters',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required',
    }),
    phoneNumber: Joi.string().pattern(phoneRegex).optional().messages({
      'string.pattern.base': 'Please provide a valid phone number with country code',
    }),
    plan: Joi.string().valid('free', 'basic', 'pro', 'enterprise').default('free'),
    referralCode: Joi.string().optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
    mfaCode: Joi.string().length(6).optional(),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token is required',
    }),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().pattern(passwordRegex).required().messages({
      'string.pattern.base': 'Password must be at least 8 characters with uppercase, lowercase, number and special character',
    }),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Passwords do not match',
    }),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().pattern(passwordRegex).required().messages({
      'string.pattern.base': 'Password must be at least 8 characters with uppercase, lowercase, number and special character',
    }),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'any.only': 'Passwords do not match',
    }),
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phoneNumber: Joi.string().pattern(phoneRegex).optional(),
    avatar: Joi.string().uri().optional(),
    notificationPreferences: Joi.object({
      email: Joi.boolean().optional(),
      sms: Joi.boolean().optional(),
      push: Joi.boolean().optional(),
      transactionAlerts: Joi.boolean().optional(),
      marketingEmails: Joi.boolean().optional(),
      securityAlerts: Joi.boolean().optional(),
    }).optional(),
  }),

  verifyEmail: Joi.object({
    token: Joi.string().required(),
  }),

  setupMFA: Joi.object({
    method: Joi.string().valid('app', 'sms', 'email').required(),
  }),

  verifyMFA: Joi.object({
    code: Joi.string().length(6).required(),
    method: Joi.string().valid('app', 'sms', 'email').required(),
  }),

  disableMFA: Joi.object({
    password: Joi.string().required(),
    code: Joi.string().length(6).required(),
  }),

  verifyOTP: Joi.object({
    code: Joi.string().length(6).required(),
    type: Joi.string().valid('email_verification', 'phone_verification', 'password_reset', 'mfa_login', 'transaction_confirmation').required(),
  }),
};

module.exports = authValidator;
