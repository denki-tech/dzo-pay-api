const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const FeeCalculator = require('../utils/calculateFees');
const ReferenceGenerator = require('../utils/generateReference');
const logger = require('../config/logger');

class SubscriptionService {
  async createSubscription(userId, data) {
    const { plan, billingCycle, paymentMethod, provider, autoRenew, couponCode } = data;

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Check if user already has active subscription
    const existingSub = await Subscription.findOne({ userId, status: 'active' });
    if (existingSub && existingSub.plan !== 'free') {
      throw new Error('User already has an active subscription. Please upgrade instead.');
    }

    // Calculate price
    const pricing = FeeCalculator.calculateSubscriptionFee(plan, billingCycle);
    let finalPrice = pricing.totalPrice;

    // Apply coupon if provided
    if (couponCode) {
      const discount = await this.applyCoupon(couponCode, plan, billingCycle);
      finalPrice = Math.max(0, finalPrice - discount);
    }

    // Calculate end date
    const startDate = new Date();
    const endDate = new Date();
    switch (billingCycle) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    // Create subscription
    const subscription = await Subscription.create({
      userId,
      plan,
      status: 'active',
      billingCycle,
      price: finalPrice,
      startDate,
      endDate,
      paymentMethod,
      provider,
      autoRenew,
      features: this.getPlanFeatures(plan),
    });

    // Update user plan
    user.plan = plan;
    user.subscriptionId = subscription._id;
    await user.save();

    // If paid plan, process payment
    if (finalPrice > 0) {
      // This would integrate with payment service
      logger.info('Subscription payment required', {
        subscriptionId: subscription._id,
        amount: finalPrice,
      });
    }

    // Log audit
    await AuditLog.createLog({
      userId,
      action: 'subscription.create',
      category: 'subscription',
      description: `Subscription created: ${plan} (${billingCycle})`,
      details: { price: finalPrice, provider },
    });

    return {
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        price: subscription.price,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        features: subscription.features,
      },
      pricing,
    };
  }

  async upgradeSubscription(userId, data) {
    const { plan, billingCycle, immediate, prorate } = data;

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const currentSub = await Subscription.findById(user.subscriptionId);
    if (!currentSub) throw new Error('No active subscription found');

    const currentPricing = FeeCalculator.calculateSubscriptionFee(currentSub.plan, currentSub.billingCycle);
    const newPricing = FeeCalculator.calculateSubscriptionFee(plan, billingCycle || currentSub.billingCycle);

    let upgradePrice = newPricing.totalPrice;

    // Calculate prorated amount if applicable
    if (prorate && currentSub.plan !== 'free') {
      const daysUsed = Math.floor((Date.now() - currentSub.startDate) / (1000 * 60 * 60 * 24));
      const daysTotal = Math.floor((currentSub.endDate - currentSub.startDate) / (1000 * 60 * 60 * 24));
      const remainingValue = currentPricing.totalPrice * (1 - daysUsed / daysTotal);
      upgradePrice = Math.max(0, newPricing.totalPrice - remainingValue);
    }

    // Update subscription
    currentSub.plan = plan;
    currentSub.billingCycle = billingCycle || currentSub.billingCycle;
    currentSub.price = newPricing.totalPrice;
    currentSub.features = this.getPlanFeatures(plan);

    if (immediate) {
      currentSub.startDate = new Date();
      const endDate = new Date();
      switch (currentSub.billingCycle) {
        case 'monthly': endDate.setMonth(endDate.getMonth() + 1); break;
        case 'quarterly': endDate.setMonth(endDate.getMonth() + 3); break;
        case 'yearly': endDate.setFullYear(endDate.getFullYear() + 1); break;
      }
      currentSub.endDate = endDate;
    }

    await currentSub.save();

    // Update user
    user.plan = plan;
    await user.save();

    // Log audit
    await AuditLog.createLog({
      userId,
      action: 'subscription.update',
      category: 'subscription',
      description: `Subscription upgraded to ${plan}`,
      details: { previousPlan: currentSub.plan, upgradePrice },
    });

    return {
      subscription: {
        id: currentSub._id,
        plan: currentSub.plan,
        status: currentSub.status,
        billingCycle: currentSub.billingCycle,
        price: currentSub.price,
        endDate: currentSub.endDate,
      },
      upgradePrice,
      pricing: newPricing,
    };
  }

  async cancelSubscription(userId, data) {
    const { reason, immediate } = data;

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const subscription = await Subscription.findById(user.subscriptionId);
    if (!subscription) throw new Error('No active subscription found');

    subscription.status = immediate ? 'cancelled' : 'active';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason;
    subscription.autoRenew = false;

    if (immediate) {
      subscription.endDate = new Date();
      user.plan = 'free';
      await user.save();
    }

    await subscription.save();

    // Log audit
    await AuditLog.createLog({
      userId,
      action: 'subscription.cancel',
      category: 'subscription',
      description: `Subscription cancelled: ${subscription.plan}`,
      details: { reason, immediate },
    });

    return {
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        status: subscription.status,
        cancelledAt: subscription.cancelledAt,
        endDate: subscription.endDate,
      },
      message: immediate ? 'Subscription cancelled immediately' : 'Subscription will cancel at end of billing period',
    };
  }

  async renewSubscription(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const subscription = await Subscription.findById(user.subscriptionId);
    if (!subscription) throw new Error('No subscription found');

    if (!subscription.autoRenew) {
      throw new Error('Auto-renew is disabled for this subscription');
    }

    const pricing = FeeCalculator.calculateSubscriptionFee(subscription.plan, subscription.billingCycle);

    // Update dates
    const startDate = subscription.endDate;
    const endDate = new Date(startDate);
    switch (subscription.billingCycle) {
      case 'monthly': endDate.setMonth(endDate.getMonth() + 1); break;
      case 'quarterly': endDate.setMonth(endDate.getMonth() + 3); break;
      case 'yearly': endDate.setFullYear(endDate.getFullYear() + 1); break;
    }

    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.status = 'active';
    await subscription.save();

    // Log audit
    await AuditLog.createLog({
      userId,
      action: 'subscription.renew',
      category: 'subscription',
      description: `Subscription renewed: ${subscription.plan}`,
      details: { newEndDate: endDate, price: pricing.totalPrice },
    });

    return {
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      },
    };
  }

  async getSubscription(userId) {
    const subscription = await Subscription.findOne({ userId }).sort({ createdAt: -1 });
    if (!subscription) {
      return { subscription: null, message: 'No subscription found' };
    }

    // Check usage
    const usage = {
      transactions: subscription.checkUsage('transactions'),
      apiCalls: subscription.checkUsage('apiCalls'),
      paymentLinks: subscription.checkUsage('paymentLinks'),
    };

    return {
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        price: subscription.price,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
        features: subscription.features,
      },
      usage,
      isActive: subscription.isActive(),
    };
  }

  getPlanFeatures(plan) {
    const features = {
      free: {
        maxWallets: 1,
        maxTransactionsPerMonth: 100,
        maxApiCallsPerMinute: 60,
        maxPaymentLinks: 5,
        maxTeamMembers: 1,
        advancedAnalytics: false,
        prioritySupport: false,
        customBranding: false,
        webhookSupport: false,
        apiAccess: false,
        whiteLabel: false,
      },
      basic: {
        maxWallets: 3,
        maxTransactionsPerMonth: 1000,
        maxApiCallsPerMinute: 120,
        maxPaymentLinks: 20,
        maxTeamMembers: 3,
        advancedAnalytics: false,
        prioritySupport: false,
        customBranding: false,
        webhookSupport: true,
        apiAccess: true,
        whiteLabel: false,
      },
      pro: {
        maxWallets: 10,
        maxTransactionsPerMonth: 10000,
        maxApiCallsPerMinute: 300,
        maxPaymentLinks: 100,
        maxTeamMembers: 10,
        advancedAnalytics: true,
        prioritySupport: true,
        customBranding: true,
        webhookSupport: true,
        apiAccess: true,
        whiteLabel: false,
      },
      enterprise: {
        maxWallets: 50,
        maxTransactionsPerMonth: 100000,
        maxApiCallsPerMinute: 1000,
        maxPaymentLinks: 1000,
        maxTeamMembers: 50,
        advancedAnalytics: true,
        prioritySupport: true,
        customBranding: true,
        webhookSupport: true,
        apiAccess: true,
        whiteLabel: true,
      },
    };

    return features[plan] || features.free;
  }

  async applyCoupon(couponCode, plan, billingCycle) {
    // In production, validate coupon against database
    const coupons = {
      'WELCOME50': { discount: 0.5, maxUses: 1 },
      'PRO20': { discount: 0.2, maxUses: 100 },
      'ENTERPRISE10': { discount: 0.1, maxUses: 50 },
    };

    const coupon = coupons[couponCode];
    if (!coupon) return 0;

    const pricing = FeeCalculator.calculateSubscriptionFee(plan, billingCycle);
    return pricing.totalPrice * coupon.discount;
  }

  async getAvailablePlans() {
    return [
      {
        name: 'free',
        displayName: 'Free',
        description: 'For individuals getting started',
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: this.getPlanFeatures('free'),
      },
      {
        name: 'basic',
        displayName: 'Basic',
        description: 'For small businesses',
        monthlyPrice: 5000,
        yearlyPrice: 13500,
        features: this.getPlanFeatures('basic'),
      },
      {
        name: 'pro',
        displayName: 'Pro',
        description: 'For growing businesses',
        monthlyPrice: 15000,
        yearlyPrice: 43200,
        features: this.getPlanFeatures('pro'),
      },
      {
        name: 'enterprise',
        displayName: 'Enterprise',
        description: 'For large organizations',
        monthlyPrice: 50000,
        yearlyPrice: 144000,
        features: this.getPlanFeatures('enterprise'),
      },
    ];
  }
}

module.exports = new SubscriptionService();
