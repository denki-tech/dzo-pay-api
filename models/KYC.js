const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  level: {
    type: String,
    enum: ['none', 'basic', 'intermediate', 'advanced'],
    default: 'none',
  },
  status: {
    type: String,
    enum: ['unverified', 'pending', 'verified', 'rejected', 'expired'],
    default: 'unverified',
  },
  documents: [{
    type: { type: String, enum: ['passport', 'drivers_license', 'national_id', 'utility_bill', 'bank_statement', 'selfie'] },
    url: String,
    verified: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now },
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
  }],
  personalInfo: {
    dateOfBirth: Date,
    nationality: String,
    countryOfResidence: String,
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    occupation: String,
    employer: String,
    annualIncome: String,
  },
  verificationAttempts: {
    type: Number,
    default: 0,
  },
  lastVerifiedAt: Date,
  expiresAt: Date,
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
}, { timestamps: true });

module.exports = mongoose.model('KYC', kycSchema);
