const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const PaymentLink = require('../models/PaymentLink');
const Subscription = require('../models/Subscription');
const AuditLog = require('../models/AuditLog');
const WebhookLog = require('../models/WebhookLog');
const paystack = require('../config/paystack');
const FeeCalculator = require('../utils/calculateFees');
const ReferenceGenerator = require('../utils/generateReference');
const ReceiptGenerator = require('../utils/receiptGenerator');
const redis = require('../config/redis');
const logger = require('../config/logger');
const { config } = require('../config/env');

class PaymentService {
  async initializePayment(data) {
    const { userId, amount, currency, description, provider, walletId, metadata, callbackUrl, channels, customer, split } = data;

    // Get user and wallet
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    let wallet;
    if (walletId) {
      wallet = await Wallet.findOne({ _id: walletId, userId });
    } else {
      wallet = await Wallet.findOne({ userId, isDefault: true });
    }
    if (!wallet) throw new Error('Wallet not found');

    // Calculate fees
    const feeBreakdown = FeeCalculator.calculate(amount, currency);

    // Generate reference
    const reference = ReferenceGenerator.generatePaymentReference();

    // Create pending transaction
    const transaction = await Transaction.create({
      reference,
      walletId: wallet._id,
      userId,
      type: 'credit',
      status: 'pending',
      amount,
      currency,
      fee: feeBreakdown.fee,
      vat: feeBreakdown.vat,
      netAmount: feeBreakdown.netAmount,
      description,
      provider,
      metadata: new Map(Object.entries(metadata || {})),
      idempotencyKey: data.idempotencyKey,
    });

    // Initialize with provider
    let providerResponse;
    try {
      switch (provider) {
        case 'paystack':
          providerResponse = await paystack.initializeTransaction({
            email: customer?.email || user.email,
            amount,
            reference,
            callbackUrl: callbackUrl || `${config.baseUrl}/api/v1/webhooks/paystack`,
            metadata: {
              ...metadata,
              userId: userId.toString(),
              walletId: wallet._id.toString(),
              transactionId: transaction._id.toString(),
            },
            channels,
          });
          break;
        case 'stripe':
          // Stripe integration stub
          providerResponse = {
            status: true,
            data: {
              authorization_url: `${config.baseUrl}/stripe-checkout?ref=${reference}`,
              access_code: reference,
              reference,
            },
          };
          break;
        case 'flutterwave':
          // Flutterwave integration stub
          providerResponse = {
            status: true,
            data: {
              link: `${config.baseUrl}/flutterwave-checkout?ref=${reference}`,
              reference,
            },
          };
          break;
        default:
          throw new Error('Invalid payment provider');
      }
    } catch (error) {
      transaction.status = 'failed';
      transaction.metadata.set('error', error.message);
      await transaction.save();
      throw error;
    }

    // Update transaction with provider reference
    transaction.providerReference = providerResponse.data?.reference || reference;
    await transaction.save();

    // Log audit
    await AuditLog.createLog({
      userId,
      action: 'payment.initialize',
      category: 'payment',
      description: `Payment initialized: ${currency} ${amount}`,
      details: { reference, provider, walletId: wallet._id },
    });

    return {
      transaction: {
        id: transaction._id,
        reference: transaction.reference,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        fee: transaction.fee,
        netAmount: transaction.netAmount,
      },
      checkoutUrl: providerResponse.data?.authorization_url || providerResponse.data?.link,
      providerResponse: providerResponse.data,
    };
  }

  async verifyPayment(reference, provider) {
    const transaction = await Transaction.findOne({ reference });
    if (!transaction) throw new Error('Transaction not found');

    if (transaction.status === 'completed') {
      return {
        transaction: {
          id: transaction._id,
          reference: transaction.reference,
          status: transaction.status,
          amount: transaction.amount,
        },
        alreadyVerified: true,
      };
    }

    let providerResponse;
    try {
      switch (provider) {
        case 'paystack':
          providerResponse = await paystack.verifyTransaction(reference);
          break;
        case 'stripe':
          // Stripe verification stub
          providerResponse = { status: true, data: { status: 'success' } };
          break;
        case 'flutterwave':
          // Flutterwave verification stub
          providerResponse = { status: true, data: { status: 'successful' } };
          break;
        default:
          throw new Error('Invalid payment provider');
      }
    } catch (error) {
      logger.error('Payment verification failed:', error);
      throw new Error(`Payment verification failed: ${error.message}`);
    }

    const isSuccessful = providerResponse.data?.status === 'success' || 
                         providerResponse.data?.status === 'successful' ||
                         providerResponse.data?.status === 'completed';

    if (isSuccessful) {
      // Credit wallet
      const wallet = await Wallet.findById(transaction.walletId);
      if (wallet) {
        await wallet.credit(transaction.netAmount);
      }

      transaction.status = 'completed';
      transaction.settledAt = new Date();
      transaction.metadata.set('providerResponse', JSON.stringify(providerResponse.data));
      await transaction.save();

      // Generate receipt
      try {
        const receipt = await ReceiptGenerator.generatePDF(transaction);
        transaction.receiptUrl = receipt.downloadUrl;
        await transaction.save();
      } catch (error) {
        logger.error('Receipt generation failed:', error);
      }

      // Send notifications
      await this.notifyPaymentSuccess(transaction);

      // Log audit
      await AuditLog.createLog({
        userId: transaction.userId,
        action: 'payment.verify',
        category: 'payment',
        description: `Payment verified: ${transaction.currency} ${transaction.amount}`,
        details: { reference, provider },
      });
    } else {
      transaction.status = 'failed';
      transaction.metadata.set('failureReason', providerResponse.data?.gateway_response || 'Payment failed');
      await transaction.save();
    }

    return {
      transaction: {
        id: transaction._id,
        reference: transaction.reference,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
      },
      providerResponse: providerResponse.data,
    };
  }

  async createPaymentLink(data) {
    const { userId, name, description, amount, currency, isFixedAmount, minAmount, maxAmount, expiresAt, maxPayments, redirectUrl, customFields, branding, thankYouMessage } = data;

    // Generate unique slug
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let slug = baseSlug;
    let counter = 1;

    while (await PaymentLink.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const paymentLink = await PaymentLink.create({
      userId,
      walletId: data.walletId,
      name,
      slug,
      description,
      amount,
      currency,
      isFixedAmount,
      minAmount,
      maxAmount,
      expiresAt,
      maxPayments,
      redirectUrl,
      customFields,
      branding,
      thankYouMessage,
    });

    // Log audit
    await AuditLog.createLog({
      userId,
      action: 'payment_link.create',
      category: 'payment',
      description: `Payment link created: ${name}`,
      details: { slug, amount, currency },
    });

    return {
      paymentLink: {
        id: paymentLink._id,
        name: paymentLink.name,
        slug: paymentLink.slug,
        url: `${config.baseUrl}/pay/${paymentLink.slug}`,
        amount: paymentLink.amount,
        currency: paymentLink.currency,
        status: paymentLink.status,
      },
    };
  }

  async processPaymentLink(slug, data) {
    const paymentLink = await PaymentLink.findOne({ slug });
    if (!paymentLink) throw new Error('Payment link not found');
    if (!paymentLink.isValid()) throw new Error('Payment link is no longer valid');

    const amount = paymentLink.isFixedAmount ? paymentLink.amount : data.amount;
    if (!paymentLink.isFixedAmount) {
      if (amount < paymentLink.minAmount || amount > paymentLink.maxAmount) {
        throw new Error(`Amount must be between ${paymentLink.minAmount} and ${paymentLink.maxAmount}`);
      }
    }

    // Initialize payment
    const result = await this.initializePayment({
      userId: paymentLink.userId,
      amount,
      currency: paymentLink.currency,
      description: `Payment for: ${paymentLink.name}`,
      provider: data.provider || 'paystack',
      walletId: paymentLink.walletId,
      metadata: {
        paymentLinkId: paymentLink._id.toString(),
        customFields: data.customFields,
      },
      callbackUrl: paymentLink.redirectUrl,
    });

    // Increment view count
    paymentLink.analytics.views += 1;
    await paymentLink.save();

    return result;
  }

  async refundPayment(transactionId, amount, reason) {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status !== 'completed') throw new Error('Only completed transactions can be refunded');

    const refundAmount = amount || transaction.amount;
    if (refundAmount > transaction.amount) throw new Error('Refund amount cannot exceed transaction amount');

    // Create refund transaction
    const refundTransaction = await Transaction.create({
      reference: ReferenceGenerator.generateTransactionReference(),
      walletId: transaction.walletId,
      userId: transaction.userId,
      type: 'refund',
      status: 'processing',
      amount: refundAmount,
      currency: transaction.currency,
      description: `Refund: ${reason || transaction.description}`,
      provider: transaction.provider,
      parentTransactionId: transaction._id,
    });

    // Debit wallet
    const wallet = await Wallet.findById(transaction.walletId);
    if (wallet.balance < refundAmount) {
      refundTransaction.status = 'failed';
      refundTransaction.reversalReason = 'Insufficient wallet balance for refund';
      await refundTransaction.save();
      throw new Error('Insufficient wallet balance for refund');
    }

    await wallet.debit(refundAmount);
    refundTransaction.status = 'completed';
    await refundTransaction.save();

    // Update original transaction
    transaction.status = 'reversed';
    transaction.reversalReason = reason || 'Customer refund';
    transaction.reversedAt = new Date();
    await transaction.save();

    // Log audit
    await AuditLog.createLog({
      userId: transaction.userId,
      action: 'transaction.refund',
      category: 'payment',
      description: `Refund processed: ${transaction.currency} ${refundAmount}`,
      details: { originalTransaction: transaction._id, reason },
    });

    return {
      refund: {
        id: refundTransaction._id,
        reference: refundTransaction.reference,
        amount: refundTransaction.amount,
        status: refundTransaction.status,
      },
      originalTransaction: {
        id: transaction._id,
        reference: transaction.reference,
        status: transaction.status,
      },
    };
  }

  async getTransactionHistory(userId, options = {}) {
    const { walletId, type, status, startDate, endDate, page = 1, limit = 20, sort = '-createdAt' } = options;

    const query = { userId };
    if (walletId) query.walletId = walletId;
    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getTransactionDetails(userId, transactionId) {
    const transaction = await Transaction.findOne({ _id: transactionId, userId });
    if (!transaction) throw new Error('Transaction not found');

    return { transaction };
  }

  async notifyPaymentSuccess(transaction) {
    // This would integrate with notification service/queue
    logger.info('Payment success notification queued', {
      transactionId: transaction._id,
      userId: transaction.userId,
    });
  }

  async getPaymentStats(userId, period = '30d') {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: new require('mongoose').Types.ObjectId(userId),
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
          totalFees: { $sum: '$fee' },
        },
      },
    ]);

    return { stats, period };
  }
}

module.exports = new PaymentService();
