const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true,
  },
  type: {
    type: String,
    enum: ['unauthorized', 'duplicate', 'not_received', 'wrong_amount', 'fraud', 'other'],
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'rejected', 'escalated'],
    default: 'open',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  description: {
    type: String,
    required: true,
  },
  evidence: [{
    type: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],
  resolution: {
    type: String,
    enum: ['refunded', 'rejected', 'partial_refund', 'no_action', 'escalated'],
    default: null,
  },
  resolutionNotes: String,
  resolvedAt: Date,
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  messages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    createdAt: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: false },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Dispute', disputeSchema);
