const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/paymentController');
const validateRequest = require('../../middleware/validateRequest');
const requireLogin = require('../../middleware/requireLogin');
const idempotency = require('../../middleware/idempotency');
const paymentValidator = require('../../validators/paymentValidator');

router.use(requireLogin);

router.post('/initialize', idempotency, validateRequest(paymentValidator.initializePayment), paymentController.initializePayment);
router.post('/verify/:reference', validateRequest(paymentValidator.verifyPayment), paymentController.verifyPayment);

// Payment links
router.post('/links', validateRequest(paymentValidator.createPaymentLink), paymentController.createPaymentLink);
router.get('/links', paymentController.getPaymentLinks);
router.get('/links/:slug', paymentController.getPaymentLink);
router.post('/links/:slug/pay', paymentController.processPaymentLink);

// Refunds
router.post('/refund', validateRequest(paymentValidator.refundPayment), paymentController.refundPayment);

// Transaction history
router.get('/history', paymentController.getTransactionHistory);
router.get('/history/:transactionId', paymentController.getTransactionDetails);
router.get('/stats', paymentController.getPaymentStats);

// Receipts
router.get('/receipt/:transactionId', paymentController.getReceipt);
router.get('/receipt/:transactionId/download', paymentController.downloadReceipt);

module.exports = router;
