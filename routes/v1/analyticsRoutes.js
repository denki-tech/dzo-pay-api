const express = require('express');
const router = express.Router();
const analyticsService = require('../../services/analyticsService');
const requireLogin = require('../../middleware/requireLogin');
const { AppError } = require('../../middleware/errorHandler');

router.use(requireLogin);

router.get('/dashboard', async (req, res, next) => {
  try {
    const result = await analyticsService.getDashboardStats(req.query.period);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const result = await analyticsService.getTransactionAnalytics(
      req.query.period,
      req.query.groupBy
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const result = await analyticsService.getUserAnalytics(req.query.period);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
});

router.get('/revenue', async (req, res, next) => {
  try {
    const result = await analyticsService.getRevenueAnalytics(req.query.period);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
});

router.get('/webhooks', async (req, res, next) => {
  try {
    const result = await analyticsService.getWebhookAnalytics(req.query.period);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
});

router.get('/realtime', async (req, res, next) => {
  try {
    const result = await analyticsService.getRealtimeStats();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
});

module.exports = router;
