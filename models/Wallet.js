const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Wallet name is required'],
    trim: true,
    maxlength: [100, 'Wallet name cannot exceed 100 characters'],
  },
  walletReference: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  virtualAccountNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: [/^\d{10}$/, 'Virtual account number must be exactly 10 digits'],
  },
  bankCode: {
    type: String,
    default: '035', // Wema Bank
  },
  bankName: {
    type: String,
    default: 'Wema Bank',
  },
  currency: {
    type: String,
    enum: ['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'EUR', 'GBP'],
    default: 'NGN',
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative'],
  },
  ledgerBalance: {
    type: Number,
    default: 0,
  },
  holdAmount: {
    type: Number,
    default: 0,
  },
  availableBalance: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['active', 'frozen', 'suspended', 'closed'],
    default: 'active',
  },
  type: {
    type: String,
    enum: ['primary', 'savings', 'business', 'escrow'],
    default: 'primary',
  },
  dailyLimit: {
    type: Number,
    default: 1000000, // 1M NGN
  },
  monthlyLimit: {
    type: Number,
    default: 20000000, // 20M NGN
  },
  singleTransactionLimit: {
    type: Number,
    default: 500000, // 500K NGN
  },
  totalDeposited: {
    type: Number,
    default: 0,
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
  },
  totalTransactions: {
    type: Number,
    default: 0,
  },
  lastTransactionAt: {
    type: Date,
    default: null,
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes
walletSchema.index({ userId: 1, status: 1 });
walletSchema.index({ virtualAccountNumber: 1 });
walletSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate available balance
walletSchema.pre('save', function(next) {
  this.availableBalance = this.balance - this.holdAmount;
  next();
});

// Method to check if transaction is within limits
walletSchema.methods.canTransact = function(amount) {
  if (this.status !== 'active') return { allowed: false, reason: 'Wallet is not active' };
  if (amount > this.availableBalance) return { allowed: false, reason: 'Insufficient balance' };
  if (amount > this.singleTransactionLimit) return { allowed: false, reason: 'Exceeds single transaction limit' };
  return { allowed: true };
};

// Method to debit wallet
walletSchema.methods.debit = async function(amount, session = null) {
  const canTransact = this.canTransact(amount);
  if (!canTransact.allowed) {
    throw new Error(canTransact.reason);
  }

  this.balance -= amount;
  this.totalWithdrawn += amount;
  this.totalTransactions += 1;
  this.lastTransactionAt = new Date();

  if (session) {
    await this.save({ session });
  } else {
    await this.save();
  }

  return this;
};

// Method to credit wallet
walletSchema.methods.credit = async function(amount, session = null) {
  this.balance += amount;
  this.totalDeposited += amount;
  this.totalTransactions += 1;
  this.lastTransactionAt = new Date();

  if (session) {
    await this.save({ session });
  } else {
    await this.save();
  }

  return this;
};

// Method to place hold
walletSchema.methods.placeHold = async function(amount, session = null) {
  if (amount > this.availableBalance) {
    throw new Error('Insufficient available balance for hold');
  }

  this.holdAmount += amount;

  if (session) {
    await this.save({ session });
  } else {
    await this.save();
  }

  return this;
};

// Method to release hold
walletSchema.methods.releaseHold = async function(amount, session = null) {
  this.holdAmount = Math.max(0, this.holdAmount - amount);

  if (session) {
    await this.save({ session });
  } else {
    await this.save();
  }

  return this;
};

module.exports = mongoose.model('Wallet', walletSchema);
