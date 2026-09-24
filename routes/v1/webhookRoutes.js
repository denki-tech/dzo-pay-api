const express = require('express');
const router = express.Router();
const webhookController = require('../../controllers/webhookController');
const verifyWebhook = require('../../middleware/verifyWebhook');
const requireLogin = require('../../middleware/requireLogin');

// Provider webhooks (no auth, signature verification only)
router.post('/paystack', verifyWebhook('paystack'), webhookController.handlePaystackWebhook);
router.post('/stripe', verifyWebhook('stripe'), webhookController.handleStripeWebhook);
router.post('/flutterwave', verifyWebhook('flutterwave'), webhookController.handleFlutterwaveWebhook);

// User webhook management (requires auth)
router.use(requireLogin);

router.get('/logs', webhookController.getWebhookLogs);
router.get('/failed', webhookController.getFailedWebhooks);
router.post('/:webhookId/retry', webhookController.retryWebhook);

module.exports = router;
