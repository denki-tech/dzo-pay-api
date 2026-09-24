const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  reference: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  externalReference: {
    type: String,
    default: null,
    index: true,
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['credit', 'debit', 'transfer_in', 'transfer_out', 'refund', 'fee', 'hold', 'release', 'withdrawal', 'deposit'],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'reversed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative'],
  },
  currency: {
    type: String,
    enum: ['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'EUR', 'GBP'],
    default: 'NGN',
  },
  fee: {
    type: Number,
    default: 0,
  },
  vat: {
    type: Number,
    default: 0,
  },
  netAmount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  provider: {
    type: String,
    enum: ['paystack', 'stripe', 'flutterwave', 'internal', 'manual', 'none'],
    default: 'none',
  },
  providerReference: {
    type: String,
    default: null,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map(),
  },
  sourceWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    default: null,
  },
  destinationWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    default: null,
  },
  destinationAccount: {
    accountNumber: String,
    bankCode: String,
    bankName: String,
    accountName: String,
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
  riskScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  fraudFlags: [{
    type: String,
    enum: ['velocity', 'amount', 'location', 'device', 'time', 'pattern'],
  }],
  receiptUrl: {
    type: String,
    default: null,
  },
  receiptSent: {
    type: Boolean,
    default: false,
  },
  reversalReason: {
    type: String,
    default: null,
  },
  reversedAt: {
    type: Date,
    default: null,
  },
  settledAt: {
    type: Date,
    default: null,
  },
  idempotencyKey: {
    type: String,
    default: null,
    index: true,
  },
  parentTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null,
  },
  tags: [{
    type: String,
    trim: true,
  }],
}, {
  timestamps: true,
});

// Compound indexes for performance
transactionSchema.index({ walletId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ provider: 1, createdAt: -1 });
transactionSchema.index({ idempotencyKey: 1 });
transactionSchema.index({ 'metadata.paymentLinkId': 1 });

// Static method to get transaction summary
transactionSchema.statics.getSummary = async function(walletId, startDate, endDate) {
  const match = { walletId: new mongoose.Types.ObjectId(walletId) };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        totalCount: { $sum: 1 },
        totalFees: { $sum: '$fee' },
      },
    },
  ]);
};

module.exports = mongoose.model('Transaction', transactionSchema);
