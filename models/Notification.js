const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['transaction', 'security', 'marketing', 'system', 'alert', 'reminder'],
    required: true,
  },
  channel: {
    type: String,
    enum: ['email', 'sms', 'push', 'in_app', 'webhook'],
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
  },
  htmlContent: {
    type: String,
    default: null,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read', 'dismissed'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  read: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
    default: null,
  },
  sentAt: {
    type: Date,
    default: null,
  },
  deliveredAt: {
    type: Date,
    default: null,
  },
  failedAt: {
    type: Date,
    default: null,
  },
  failReason: {
    type: String,
    default: null,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  maxRetries: {
    type: Number,
    default: 3,
  },
  actionUrl: {
    type: String,
    default: null,
  },
  actionText: {
    type: String,
    default: null,
  },
  icon: {
    type: String,
    default: null,
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
  relatedEntity: {
    type: { type: String, enum: ['transaction', 'wallet', 'user', 'subscription', 'payment_link'] },
    id: mongoose.Schema.Types.ObjectId,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ status: 1, createdAt: -1 });

// TTL index for old notifications (30 days)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

// Method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.read = true;
  this.readAt = new Date();
  this.status = 'read';
  await this.save();
  return this;
};

// Method to mark as sent
notificationSchema.methods.markAsSent = async function() {
  this.status = 'sent';
  this.sentAt = new Date();
  await this.save();
  return this;
};

// Method to mark as delivered
notificationSchema.methods.markAsDelivered = async function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  await this.save();
  return this;
};

// Method to mark as failed
notificationSchema.methods.markAsFailed = async function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failReason = reason;
  this.retryCount += 1;

  if (this.retryCount >= this.maxRetries) {
    this.status = 'permanent_fail';
  }

  await this.save();
  return this;
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ userId, read: false });
};

// Static method to get recent notifications
notificationSchema.statics.getRecent = async function(userId, limit = 20) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('Notification', notificationSchema);
