const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
  },
  hashedCode: {
    type: String,
    required: true,
    select: false,
  },
  type: {
    type: String,
    enum: ['email_verification', 'phone_verification', 'password_reset', 'mfa_login', 'mfa_setup', 'transaction_confirmation', 'account_recovery', 'api_key_rotation'],
    required: true,
  },
  purpose: {
    type: String,
    required: true,
  },
  channel: {
    type: String,
    enum: ['email', 'sms', 'app'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'used', 'expired', 'cancelled'],
    default: 'active',
  },
  attempts: {
    type: Number,
    default: 0,
  },
  maxAttempts: {
    type: Number,
    default: 5,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  ipAddress: {
    type: String,
    default: null,
  },
  userAgent: {
    type: String,
    default: null,
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
}, {
  timestamps: true,
});

// Indexes
otpSchema.index({ userId: 1, type: 1, status: 1 });
otpSchema.index({ code: 1 });

// TTL index for expired OTPs (auto-delete after expiry)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to verify OTP
otpSchema.methods.verify = async function(inputCode) {
  if (this.status !== 'active') {
    return { valid: false, reason: 'OTP is not active' };
  }

  if (this.expiresAt < new Date()) {
    this.status = 'expired';
    await this.save();
    return { valid: false, reason: 'OTP has expired' };
  }

  if (this.attempts >= this.maxAttempts) {
    this.status = 'cancelled';
    await this.save();
    return { valid: false, reason: 'Maximum attempts exceeded' };
  }

  this.attempts += 1;

  const bcrypt = require('bcryptjs');
  const isValid = await bcrypt.compare(inputCode, this.hashedCode);

  if (isValid) {
    this.status = 'used';
    this.usedAt = new Date();
    await this.save();
    return { valid: true };
  }

  await this.save();
  return { valid: false, reason: 'Invalid OTP code' };
};

// Static method to create OTP
otpSchema.statics.createOTP = async function(data) {
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(12);
  const hashedCode = await bcrypt.hash(data.code, salt);

  // Invalidate any existing active OTPs of same type for this user
  await this.updateMany(
    { userId: data.userId, type: data.type, status: 'active' },
    { $set: { status: 'cancelled' } }
  );

  return this.create({
    ...data,
    hashedCode,
  });
};

module.exports = mongoose.model('OTP', otpSchema);
