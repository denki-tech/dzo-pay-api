const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  referredId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  referralCode: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'registered', 'activated', 'rewarded', 'expired'],
    default: 'pending',
  },
  rewardAmount: {
    type: Number,
    default: 500,
  },
  rewardCurrency: {
    type: String,
    default: 'NGN',
  },
  rewardPaid: {
    type: Boolean,
    default: false,
  },
  rewardPaidAt: Date,
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
}, { timestamps: true });

module.exports = mongoose.model('Referral', referralSchema);
