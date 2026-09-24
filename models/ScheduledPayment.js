const mongoose = require('mongoose');

const scheduledPaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sourceWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
  },
  destinationWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    default: null,
  },
  destinationAccountNumber: {
    type: String,
    default: null,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'NGN',
  },
  description: {
    type: String,
    required: true,
  },
  frequency: {
    type: String,
    enum: ['once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    default: null,
  },
  nextExecutionDate: {
    type: Date,
    required: true,
  },
  lastExecutionDate: {
    type: Date,
    default: null,
  },
  executionCount: {
    type: Number,
    default: 0,
  },
  maxExecutions: {
    type: Number,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled', 'failed'],
    default: 'active',
  },
  failureCount: {
    type: Number,
    default: 0,
  },
  lastFailureReason: {
    type: String,
    default: null,
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
}, { timestamps: true });

// Index for efficient querying of upcoming payments
scheduledPaymentSchema.index({ nextExecutionDate: 1, status: 1 });
scheduledPaymentSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('ScheduledPayment', scheduledPaymentSchema);
