const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/adminController');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

// User management
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.post('/users/:id/impersonate', adminController.impersonateUser);

// Stats & Analytics
router.get('/stats', adminController.getStats);
router.get('/health', adminController.getSystemHealth);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

// Webhook logs
router.get('/webhook-logs', adminController.getWebhookLogs);

// Feature flags
router.get('/feature-flags', adminController.getFeatureFlags);
router.post('/feature-flags', adminController.createFeatureFlag);
router.patch('/feature-flags/:key', adminController.toggleFeatureFlag);

// Delivery stats
router.get('/delivery-stats', adminController.getDeliveryStats);

module.exports = router;
