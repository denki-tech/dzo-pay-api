const mongoose = require('mongoose');

const featureFlagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  description: {
    type: String,
    default: '',
  },
  enabled: {
    type: Boolean,
    default: false,
  },
  environment: {
    type: String,
    enum: ['development', 'staging', 'production', 'all'],
    default: 'all',
  },
  rolloutPercentage: {
    type: Number,
    default: 100,
    min: 0,
    max: 100,
  },
  allowedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  allowedPlans: [{
    type: String,
    enum: ['free', 'basic', 'pro', 'enterprise'],
  }],
  allowedRoles: [{
    type: String,
    enum: ['user', 'admin', 'superadmin'],
  }],
  startDate: {
    type: Date,
    default: null,
  },
  endDate: {
    type: Date,
    default: null,
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  changeHistory: [{
    action: { type: String, enum: ['created', 'enabled', 'disabled', 'updated', 'deleted'] },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    details: { type: String, default: '' },
  }],
}, {
  timestamps: true,
});

// Indexes
featureFlagSchema.index({ key: 1 });
featureFlagSchema.index({ enabled: 1, environment: 1 });
featureFlagSchema.index({ startDate: 1, endDate: 1 });

// Method to check if feature is enabled for a user
featureFlagSchema.methods.isEnabledFor = function(user) {
  if (!this.enabled) return false;

  // Check environment
  if (this.environment !== 'all' && this.environment !== process.env.NODE_ENV) {
    return false;
  }

  // Check date range
  const now = new Date();
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;

  // Check allowed users
  if (this.allowedUsers.length > 0) {
    const userId = user._id.toString();
    const allowed = this.allowedUsers.map(id => id.toString());
    if (!allowed.includes(userId)) return false;
  }

  // Check allowed plans
  if (this.allowedPlans.length > 0 && !this.allowedPlans.includes(user.plan)) {
    return false;
  }

  // Check allowed roles
  if (this.allowedRoles.length > 0 && !this.allowedRoles.includes(user.role)) {
    return false;
  }

  // Check rollout percentage
  if (this.rolloutPercentage < 100) {
    const hash = require('crypto')
      .createHash('md5')
      .update(user._id.toString() + this.key)
      .digest('hex');
    const userPercentage = parseInt(hash.substring(0, 2), 16) % 100;
    if (userPercentage >= this.rolloutPercentage) return false;
  }

  return true;
};

// Static method to get all enabled features for a user
featureFlagSchema.statics.getEnabledForUser = async function(user) {
  const flags = await this.find({ enabled: true });
  return flags.filter(flag => flag.isEnabledFor(user)).map(flag => flag.key);
};

// Static method to toggle feature
featureFlagSchema.statics.toggle = async function(key, enabled, userId) {
  const flag = await this.findOne({ key });
  if (!flag) throw new Error('Feature flag not found');

  flag.enabled = enabled;
  flag.updatedBy = userId;
  flag.changeHistory.push({
    action: enabled ? 'enabled' : 'disabled',
    performedBy: userId,
    details: `Feature ${enabled ? 'enabled' : 'disabled'}`,
  });

  await flag.save();
  return flag;
};

module.exports = mongoose.model('FeatureFlag', featureFlagSchema);
