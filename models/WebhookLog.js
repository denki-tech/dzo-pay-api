const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
  webhookId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  event: {
    type: String,
    required: true,
    enum: [
      'payment.success', 'payment.failed', 'payment.pending',
      'transfer.success', 'transfer.failed', 'transfer.reversed',
      'subscription.created', 'subscription.renewed', 'subscription.cancelled',
      'wallet.credited', 'wallet.debited',
      'user.registered', 'user.updated', 'user.suspended',
      'kyc.submitted', 'kyc.approved', 'kyc.rejected',
      'dispute.created', 'dispute.resolved',
      'refund.processed', 'refund.failed',
    ],
  },
  provider: {
    type: String,
    enum: ['paystack', 'stripe', 'flutterwave', 'internal'],
    required: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed', 'retrying', 'permanent_fail'],
    default: 'pending',
  },
  responseStatus: {
    type: Number,
    default: null,
  },
  responseBody: {
    type: String,
    default: null,
  },
  responseHeaders: {
    type: Map,
    of: String,
    default: new Map(),
  },
  attempts: {
    type: Number,
    default: 0,
  },
  maxAttempts: {
    type: Number,
    default: 5,
  },
  nextRetryAt: {
    type: Date,
    default: null,
  },
  retryHistory: [{
    attempt: Number,
    timestamp: { type: Date, default: Date.now },
    status: String,
    responseStatus: Number,
    error: String,
  }],
  signature: {
    type: String,
    default: null,
  },
  deliveryDuration: {
    type: Number,
    default: null,
  },
  ipAddress: {
    type: String,
    default: null,
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
}, {
  timestamps: true,
});

// Indexes
webhookLogSchema.index({ webhookId: 1, createdAt: -1 });
webhookLogSchema.index({ userId: 1, status: 1 });
webhookLogSchema.index({ status: 1, nextRetryAt: 1 });
webhookLogSchema.index({ event: 1, createdAt: -1 });
webhookLogSchema.index({ provider: 1, createdAt: -1 });

// TTL index for old logs (30 days)
webhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

// Method to record attempt
webhookLogSchema.methods.recordAttempt = async function(status, responseStatus, error = null) {
  this.attempts += 1;
  this.retryHistory.push({
    attempt: this.attempts,
    timestamp: new Date(),
    status,
    responseStatus,
    error: error ? error.message || error : null,
  });

  if (status === 'delivered') {
    this.status = 'delivered';
    this.responseStatus = responseStatus;
  } else if (this.attempts >= this.maxAttempts) {
    this.status = 'permanent_fail';
  } else {
    this.status = 'retrying';
    // Exponential backoff: 1min, 5min, 15min, 30min, 1hour
    const delays = [60000, 300000, 900000, 1800000, 3600000];
    const delay = delays[Math.min(this.attempts - 1, delays.length - 1)];
    this.nextRetryAt = new Date(Date.now() + delay);
  }

  await this.save();
  return this;
};

// Static method to get failed webhooks
webhookLogSchema.statics.getFailed = async function(limit = 100) {
  return this.find({
    status: { $in: ['failed', 'retrying'] },
    attempts: { $lt: { $ref: 'maxAttempts' } },
  })
    .sort({ nextRetryAt: 1 })
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('WebhookLog', webhookLogSchema);
