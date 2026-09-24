const mongoose = require('mongoose');

const paymentLinkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Link name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [100, 'Minimum amount is 100'],
  },
  currency: {
    type: String,
    enum: ['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'EUR', 'GBP'],
    default: 'NGN',
  },
  isFixedAmount: {
    type: Boolean,
    default: true,
  },
  minAmount: {
    type: Number,
    default: null,
  },
  maxAmount: {
    type: Number,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'disabled'],
    default: 'active',
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  maxPayments: {
    type: Number,
    default: null,
  },
  totalPayments: {
    type: Number,
    default: 0,
  },
  totalAmountReceived: {
    type: Number,
    default: 0,
  },
  redirectUrl: {
    type: String,
    default: null,
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
  customFields: [{
    name: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'email', 'date', 'select'], default: 'text' },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
  }],
  branding: {
    logoUrl: { type: String, default: null },
    primaryColor: { type: String, default: '#2563eb' },
    backgroundColor: { type: String, default: '#ffffff' },
    buttonText: { type: String, default: 'Pay Now' },
  },
  thankYouMessage: {
    type: String,
    default: 'Thank you for your payment!',
    maxlength: [500, 'Message cannot exceed 500 characters'],
  },
  notificationSettings: {
    emailOnPayment: { type: Boolean, default: true },
    smsOnPayment: { type: Boolean, default: false },
    webhookUrl: { type: String, default: null },
  },
  analytics: {
    views: { type: Number, default: 0 },
    uniqueViews: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
  },
}, {
  timestamps: true,
});

// Indexes
paymentLinkSchema.index({ userId: 1, status: 1 });
paymentLinkSchema.index({ slug: 1 });
paymentLinkSchema.index({ createdAt: -1 });

// Pre-save validation
paymentLinkSchema.pre('save', function(next) {
  if (!this.isFixedAmount) {
    if (!this.minAmount || !this.maxAmount) {
      return next(new Error('minAmount and maxAmount are required for variable amount links'));
    }
    if (this.minAmount >= this.maxAmount) {
      return next(new Error('minAmount must be less than maxAmount'));
    }
  }
  next();
});

// Method to check if link is still valid
paymentLinkSchema.methods.isValid = function() {
  if (this.status !== 'active') return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  if (this.maxPayments && this.totalPayments >= this.maxPayments) return false;
  return true;
};

// Method to increment payment stats
paymentLinkSchema.methods.recordPayment = async function(amount) {
  this.totalPayments += 1;
  this.totalAmountReceived += amount;

  if (this.maxPayments && this.totalPayments >= this.maxPayments) {
    this.status = 'expired';
  }

  await this.save();
  return this;
};

module.exports = mongoose.model('PaymentLink', paymentLinkSchema);
