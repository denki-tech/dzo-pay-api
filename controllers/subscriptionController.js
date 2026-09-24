const subscriptionService = require('../services/subscriptionService');
const { AppError } = require('../middleware/errorHandler');

class SubscriptionController {
  async createSubscription(req, res, next) {
    try {
      const result = await subscriptionService.createSubscription(req.user._id, req.body);

      res.status(201).json({
        success: true,
        message: 'Subscription created',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async getSubscription(req, res, next) {
    try {
      const result = await subscriptionService.getSubscription(req.user._id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async upgradeSubscription(req, res, next) {
    try {
      const result = await subscriptionService.upgradeSubscription(req.user._id, req.body);

      res.status(200).json({
        success: true,
        message: 'Subscription upgraded',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async cancelSubscription(req, res, next) {
    try {
      const result = await subscriptionService.cancelSubscription(req.user._id, req.body);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async renewSubscription(req, res, next) {
    try {
      const result = await subscriptionService.renewSubscription(req.user._id);

      res.status(200).json({
        success: true,
        message: 'Subscription renewed',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async getPlans(req, res, next) {
    try {
      const result = await subscriptionService.getAvailablePlans();

      res.status(200).json({
        success: true,
        data: { plans: result },
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async applyCoupon(req, res, next) {
    try {
      const result = await subscriptionService.applyCoupon(
        req.body.couponCode,
        req.body.plan,
        req.body.billingCycle
      );

      res.status(200).json({
        success: true,
        data: { discount: result },
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }
}

module.exports = new SubscriptionController();
