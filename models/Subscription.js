const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  plan: {
    type: String,
    enum: ['free', 'basic', 'pro', 'enterprise'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'past_due', 'paused', 'trialing'],
    default: 'active',
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    default: 'monthly',
  },
  price: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'NGN',
  },
  features: {
    maxWallets: { type: Number, default: 1 },
    maxTransactionsPerMonth: { type: Number, default: 100 },
    maxApiCallsPerMinute: { type: Number, default: 60 },
    maxPaymentLinks: { type: Number, default: 5 },
    maxTeamMembers: { type: Number, default: 1 },
    advancedAnalytics: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    customBranding: { type: Boolean, default: false },
    webhookSupport: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    whiteLabel: { type: Boolean, default: false },
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
  trialEndsAt: {
    type: Date,
    default: null,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  cancellationReason: {
    type: String,
    default: null,
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'wallet', 'crypto'],
    default: 'card',
  },
  provider: {
    type: String,
    enum: ['paystack', 'stripe', 'flutterwave', 'internal'],
    default: 'paystack',
  },
  providerSubscriptionId: {
    type: String,
    default: null,
  },
  autoRenew: {
    type: Boolean,
    default: true,
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
  usage: {
    transactionsThisMonth: { type: Number, default: 0 },
    apiCallsThisMonth: { type: Number, default: 0 },
    paymentLinksCreated: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now },
  },
  invoices: [{
    invoiceNumber: String,
    amount: Number,
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'] },
    paidAt: Date,
    dueDate: Date,
    pdfUrl: String,
  }],
}, {
  timestamps: true,
});

// Indexes
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });
subscriptionSchema.index({ plan: 1 });

// Method to check if subscription is active
subscriptionSchema.methods.isActive = function() {
  if (this.status !== 'active' && this.status !== 'trialing') return false;
  if (this.endDate < new Date()) return false;
  return true;
};

// Method to check feature availability
subscriptionSchema.methods.hasFeature = function(featureName) {
  return this.features[featureName] === true;
};

// Method to check usage limit
subscriptionSchema.methods.checkUsage = function(metric) {
  const limits = {
    transactions: this.features.maxTransactionsPerMonth,
    apiCalls: this.features.maxApiCallsPerMinute,
    paymentLinks: this.features.maxPaymentLinks,
  };

  const current = {
    transactions: this.usage.transactionsThisMonth,
    apiCalls: this.usage.apiCallsThisMonth,
    paymentLinks: this.usage.paymentLinksCreated,
  };

  return {
    allowed: current[metric] < limits[metric],
    current: current[metric],
    limit: limits[metric],
    remaining: limits[metric] - current[metric],
  };
};

// Method to increment usage
subscriptionSchema.methods.incrementUsage = async function(metric, amount = 1) {
  const field = `usage.${metric}ThisMonth`;
  await this.updateOne({ $inc: { [field]: amount } });
};

// Method to reset monthly usage
subscriptionSchema.methods.resetMonthlyUsage = async function() {
  this.usage.transactionsThisMonth = 0;
  this.usage.apiCallsThisMonth = 0;
  this.usage.paymentLinksCreated = 0;
  this.usage.lastResetDate = new Date();
  await this.save();
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
