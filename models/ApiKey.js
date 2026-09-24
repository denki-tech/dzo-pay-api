const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  prefix: {
    type: String,
    required: true,
  },
  hashedKey: {
    type: String,
    required: true,
    select: false,
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'delete', 'webhook', 'admin'],
  }],
  scopes: [{
    type: String,
    enum: ['payments', 'wallets', 'transactions', 'users', 'webhooks', 'analytics'],
  }],
  status: {
    type: String,
    enum: ['active', 'revoked', 'expired'],
    default: 'active',
  },
  lastUsedAt: {
    type: Date,
    default: null,
  },
  lastUsedIp: {
    type: String,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  rateLimit: {
    requestsPerMinute: { type: Number, default: 60 },
    requestsPerHour: { type: Number, default: 1000 },
    requestsPerDay: { type: Number, default: 10000 },
  },
  usageStats: {
    totalRequests: { type: Number, default: 0 },
    successfulRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 },
    lastRequestAt: { type: Date, default: null },
  },
  ipWhitelist: [{
    type: String,
  }],
  ipBlacklist: [{
    type: String,
  }],
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
}, {
  timestamps: true,
});

// Indexes
apiKeySchema.index({ userId: 1, status: 1 });
apiKeySchema.index({ key: 1 });

// Method to check if key is valid
apiKeySchema.methods.isValid = function() {
  if (this.status !== 'active') return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  return true;
};

// Method to check permissions
apiKeySchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || this.permissions.includes('admin');
};

// Method to check scope
apiKeySchema.methods.hasScope = function(scope) {
  return this.scopes.includes(scope) || this.scopes.includes('admin');
};

// Method to record usage
apiKeySchema.methods.recordUsage = async function(success = true) {
  this.usageStats.totalRequests += 1;
  if (success) {
    this.usageStats.successfulRequests += 1;
  } else {
    this.usageStats.failedRequests += 1;
  }
  this.usageStats.lastRequestAt = new Date();
  await this.save();
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
