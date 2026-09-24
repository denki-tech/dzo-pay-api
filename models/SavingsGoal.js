const mongoose = require('mongoose');

const savingsGoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  targetAmount: {
    type: Number,
    required: true,
  },
  currentAmount: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    default: 'NGN',
  },
  deadline: {
    type: Date,
    default: null,
  },
  category: {
    type: String,
    enum: ['emergency', 'vacation', 'education', 'business', 'home', 'vehicle', 'other'],
    default: 'other',
  },
  autoSave: {
    enabled: { type: Boolean, default: false },
    amount: { type: Number, default: 0 },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'monthly' },
    sourceWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'paused'],
    default: 'active',
  },
  milestones: [{
    amount: Number,
    reached: { type: Boolean, default: false },
    reachedAt: Date,
    reward: String,
  }],
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
}, { timestamps: true });

// Virtual for progress percentage
savingsGoalSchema.virtual('progressPercentage').get(function() {
  if (this.targetAmount === 0) return 0;
  return Math.min(100, (this.currentAmount / this.targetAmount) * 100);
});

// Virtual for remaining amount
savingsGoalSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, this.targetAmount - this.currentAmount);
});

// Check if goal is completed
savingsGoalSchema.methods.checkCompletion = async function() {
  if (this.currentAmount >= this.targetAmount && this.status === 'active') {
    this.status = 'completed';
    await this.save();
    return true;
  }
  return false;
};

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);
