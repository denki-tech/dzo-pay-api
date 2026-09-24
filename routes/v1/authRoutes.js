const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const validateRequest = require('../../middleware/validateRequest');
const requireLogin = require('../../middleware/requireLogin');
const { createRateLimiter } = require('../../middleware/rateLimit');
const authValidator = require('../../validators/authValidator');

// Public routes with strict rate limiting
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

router.post('/register', authLimiter, validateRequest(authValidator.register), authController.register);
router.post('/login', authLimiter, validateRequest(authValidator.login), authController.login);
router.post('/refresh-token', validateRequest(authValidator.refreshToken), authController.refreshToken);
router.post('/forgot-password', authLimiter, validateRequest(authValidator.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validateRequest(authValidator.resetPassword), authController.resetPassword);
router.get('/verify-email', authController.verifyEmail);

// Protected routes
router.use(requireLogin);

router.get('/profile', authController.getProfile);
router.patch('/profile', validateRequest(authValidator.updateProfile), authController.updateProfile);
router.post('/change-password', validateRequest(authValidator.changePassword), authController.changePassword);
router.post('/logout', authController.logout);

// MFA routes
router.post('/mfa/setup', validateRequest(authValidator.setupMFA), authController.setupMFA);
router.post('/mfa/verify-setup', validateRequest(authValidator.verifyMFA), authController.verifyMFASetup);
router.post('/mfa/disable', validateRequest(authValidator.disableMFA), authController.disableMFA);

// OTP routes
router.post('/otp/send', authController.sendOTP);
router.post('/otp/verify', validateRequest(authValidator.verifyOTP), authController.verifyOTP);

module.exports = router;
