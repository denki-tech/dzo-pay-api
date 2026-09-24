const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'user.register', 'user.login', 'user.logout', 'user.update', 'user.delete',
      'user.suspend', 'user.activate', 'user.impersonate',
      'wallet.create', 'wallet.update', 'wallet.delete', 'wallet.freeze', 'wallet.unfreeze',
      'transaction.create', 'transaction.verify', 'transaction.refund', 'transaction.reverse',
      'payment.initialize', 'payment.verify', 'payment.cancel',
      'payment_link.create', 'payment_link.update', 'payment_link.delete', 'payment_link.deactivate',
      'subscription.create', 'subscription.update', 'subscription.cancel', 'subscription.renew',
      'api_key.create', 'api_key.revoke', 'api_key.rotate',
      'mfa.enable', 'mfa.disable', 'mfa.verify',
      'kyc.submit', 'kyc.approve', 'kyc.reject',
      'webhook.deliver', 'webhook.retry', 'webhook.fail',
      'notification.send', 'notification.read',
      'settings.update', 'password.change', 'email.change', 'phone.change',
      'transfer.initiate', 'transfer.complete', 'transfer.fail',
      'admin.action', 'feature_flag.toggle', 'rate_limit.update',
    ],
    index: true,
  },
  category: {
    type: String,
    enum: ['auth', 'payment', 'wallet', 'user', 'admin', 'system', 'security'],
    required: true,
    index: true,
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info',
  },
  description: {
    type: String,
    required: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ipAddress: {
    type: String,
    default: null,
  },
  userAgent: {
    type: String,
    default: null,
  },
  deviceInfo: {
    type: String,
    default: null,
  },
  location: {
    country: String,
    city: String,
    latitude: Number,
    longitude: Number,
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'pending'],
    default: 'success',
  },
  errorMessage: {
    type: String,
    default: null,
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
  impersonatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  requestId: {
    type: String,
    default: null,
    index: true,
  },
  sessionId: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Compound indexes for filtering
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });
auditLogSchema.index({ status: 1, createdAt: -1 });
auditLogSchema.index({ requestId: 1 });

// TTL index for auto-cleanup (90 days)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Static method to create audit log
auditLogSchema.statics.createLog = async function(data) {
  return this.create(data);
};

// Static method to get recent logs by user
auditLogSchema.statics.getRecentByUser = async function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get logs by action
auditLogSchema.statics.getByAction = async function(action, startDate, endDate, limit = 100) {
  const query = { action };
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
