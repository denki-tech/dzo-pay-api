const express = require('express');
const router = express.Router();
const subscriptionController = require('../../controllers/subscriptionController');
const validateRequest = require('../../middleware/validateRequest');
const requireLogin = require('../../middleware/requireLogin');
const subscriptionValidator = require('../../validators/subscriptionValidator');

router.get('/plans', subscriptionController.getPlans);
router.post('/coupon', subscriptionController.applyCoupon);

router.use(requireLogin);

router.get('/', subscriptionController.getSubscription);
router.post('/', validateRequest(subscriptionValidator.createSubscription), subscriptionController.createSubscription);
router.post('/upgrade', validateRequest(subscriptionValidator.upgradeSubscription), subscriptionController.upgradeSubscription);
router.post('/cancel', validateRequest(subscriptionValidator.cancelSubscription), subscriptionController.cancelSubscription);
router.post('/renew', subscriptionController.renewSubscription);

module.exports = router;
