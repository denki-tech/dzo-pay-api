const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const FeeCalculator = require('../utils/calculateFees');
const ReferenceGenerator = require('../utils/generateReference');
const CurrencyFormatter = require('../utils/formatCurrency');
const redis = require('../config/redis');
const logger = require('../config/logger');

class WalletService {
  async createWallet(userId, data) {
    const { name, currency, type, dailyLimit, monthlyLimit, singleTransactionLimit } = data;

    // Check wallet limit based on plan
    const existingWallets = await Wallet.countDocuments({ userId });
    const user = await User.findById(userId);
    const planLimits = {
      free: 1,
      basic: 3,
      pro: 10,
      enterprise: 50,
    };

    if (existingWallets >= (planLimits[user.plan] || 1)) {
      throw new Error(`Wallet limit reached for ${user.plan} plan`);
    }

    const wallet = await Wallet.create({
      userId,
      name,
      walletReference: ReferenceGenerator.generateWalletReference(),
      virtualAccountNumber: ReferenceGenerator.generateVirtualAccountNumber(),
      currency: currency || 'NGN',
      type: type || 'primary',
      dailyLimit: dailyLimit || 1000000,
      monthlyLimit: monthlyLimit || 20000000,
      singleTransactionLimit: singleTransactionLimit || 500000,
      isDefault: existingWallets === 0,
    });

    // Log audit
    await AuditLog.createLog({
      userId,
      action: 'wallet.create',
      category: 'wallet',
      description: `Wallet created: ${name}`,
      details: { walletId: wallet._id, currency, type },
    });

    return {
      wallet: {
        id: wallet._id,
        name: wallet.name,
        walletReference: wallet.walletReference,
        virtualAccountNumber: wallet.virtualAccountNumber,
        currency: wallet.currency,
        balance: wallet.balance,
        status: wallet.status,
        type: wallet.type,
      },
    };
  }

  async getWallets(userId) {
    const wallets = await Wallet.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
    return {
      wallets: wallets.map(w => ({
        id: w._id,
        name: w.name,
        walletReference: w.walletReference,
        virtualAccountNumber: w.virtualAccountNumber,
        currency: w.currency,
        balance: w.balance,
        availableBalance: w.availableBalance,
        status: w.status,
        type: w.type,
        isDefault: w.isDefault,
        dailyLimit: w.dailyLimit,
        monthlyLimit: w.monthlyLimit,
        totalTransactions: w.totalTransactions,
        lastTransactionAt: w.lastTransactionAt,
      })),
    };
  }

  async getWalletDetails(userId, walletId) {
    const wallet = await Wallet.findOne({ _id: walletId, userId });
    if (!wallet) throw new Error('Wallet not found');

    // Get recent transactions
    const recentTransactions = await Transaction.find({ walletId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get transaction summary
    const summary = await Transaction.getSummary(walletId);

    return {
      wallet: {
        id: wallet._id,
        name: wallet.name,
        walletReference: wallet.walletReference,
        virtualAccountNumber: wallet.virtualAccountNumber,
        bankName: wallet.bankName,
        bankCode: wallet.bankCode,
        currency: wallet.currency,
        balance: wallet.balance,
        availableBalance: wallet.availableBalance,
        holdAmount: wallet.holdAmount,
        status: wallet.status,
        type: wallet.type,
        isDefault: wallet.isDefault,
        limits: {
          daily: wallet.dailyLimit,
          monthly: wallet.monthlyLimit,
          single: wallet.singleTransactionLimit,
        },
        stats: {
          totalDeposited: wallet.totalDeposited,
          totalWithdrawn: wallet.totalWithdrawn,
          totalTransactions: wallet.totalTransactions,
        },
      },
      recentTransactions,
      summary,
    };
  }

  async transfer(data) {
    const { userId, sourceWalletId, destinationWalletId, destinationAccountNumber, amount, description, idempotencyKey } = data;

    // Check idempotency
    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey, type: { $in: ['transfer_out', 'transfer_in'] } });
      if (existing) {
        return {
          transaction: {
            id: existing._id,
            reference: existing.reference,
            status: existing.status,
          },
          idempotent: true,
        };
      }
    }

    const sourceWallet = await Wallet.findOne({ _id: sourceWalletId, userId });
    if (!sourceWallet) throw new Error('Source wallet not found');

    let destinationWallet;
    if (destinationWalletId) {
      destinationWallet = await Wallet.findById(destinationWalletId);
    } else if (destinationAccountNumber) {
      destinationWallet = await Wallet.findOne({ virtualAccountNumber: destinationAccountNumber });
    }

    if (!destinationWallet) throw new Error('Destination wallet not found');
    if (sourceWallet._id.toString() === destinationWallet._id.toString()) {
      throw new Error('Cannot transfer to the same wallet');
    }
    if (sourceWallet.currency !== destinationWallet.currency) {
      throw new Error('Cross-currency transfers are not supported');
    }

    // Calculate transfer fee
    const isInternal = sourceWallet.userId.toString() === destinationWallet.userId.toString();
    const feeBreakdown = FeeCalculator.calculateTransferFee(amount, sourceWallet.currency, isInternal);

    // Check source wallet balance
    const canTransact = sourceWallet.canTransact(amount + feeBreakdown.fee);
    if (!canTransact.allowed) {
      throw new Error(canTransact.reason);
    }

    const session = await require('mongoose').startSession();
    session.startTransaction();

    try {
      // Debit source wallet
      await sourceWallet.debit(amount + feeBreakdown.fee, session);

      // Credit destination wallet
      await destinationWallet.credit(amount, session);

      // Create transfer out transaction
      const transferOut = await Transaction.create([{
        reference: ReferenceGenerator.generateTransferReference(),
        walletId: sourceWallet._id,
        userId,
        type: 'transfer_out',
        status: 'completed',
        amount,
        currency: sourceWallet.currency,
        fee: feeBreakdown.fee,
        vat: feeBreakdown.vat,
        netAmount: feeBreakdown.netAmount,
        description,
        provider: 'internal',
        destinationWalletId: destinationWallet._id,
        idempotencyKey,
      }], { session });

      // Create transfer in transaction
      const transferIn = await Transaction.create([{
        reference: ReferenceGenerator.generateTransferReference(),
        walletId: destinationWallet._id,
        userId: destinationWallet.userId,
        type: 'transfer_in',
        status: 'completed',
        amount,
        currency: destinationWallet.currency,
        fee: 0,
        netAmount: amount,
        description: `Received from ${sourceWallet.virtualAccountNumber}: ${description}`,
        provider: 'internal',
        sourceWalletId: sourceWallet._id,
        parentTransactionId: transferOut[0]._id,
      }], { session });

      await session.commitTransaction();

      // Notify both parties
      await this.notifyTransfer(transferOut[0], transferIn[0], sourceWallet, destinationWallet);

      // Log audit
      await AuditLog.createLog({
        userId,
        action: 'transfer.initiate',
        category: 'wallet',
        description: `Transfer: ${amount} ${sourceWallet.currency}`,
        details: {
          from: sourceWallet.virtualAccountNumber,
          to: destinationWallet.virtualAccountNumber,
          reference: transferOut[0].reference,
        },
      });

      return {
        transaction: {
          id: transferOut[0]._id,
          reference: transferOut[0].reference,
          amount: transferOut[0].amount,
          currency: transferOut[0].currency,
          fee: transferOut[0].fee,
          status: transferOut[0].status,
        },
        sourceWallet: {
          id: sourceWallet._id,
          balance: sourceWallet.balance,
        },
        destinationWallet: {
          id: destinationWallet._id,
          balance: destinationWallet.balance,
          owner: destinationWallet.userId,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async notifyTransfer(transferOut, transferIn, sourceWallet, destinationWallet) {
    // Queue notifications for both sender and receiver
    logger.info('Transfer notifications queued', {
      transferOutId: transferOut._id,
      transferInId: transferIn._id,
    });
  }

  async updateWallet(userId, walletId, updates) {
    const wallet = await Wallet.findOne({ _id: walletId, userId });
    if (!wallet) throw new Error('Wallet not found');

    const allowedUpdates = ['name', 'dailyLimit', 'monthlyLimit', 'singleTransactionLimit', 'status'];
    const updateData = {};

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) updateData[field] = updates[field];
    });

    Object.assign(wallet, updateData);
    await wallet.save();

    // Log audit
    await AuditLog.createLog({
      userId,
      action: 'wallet.update',
      category: 'wallet',
      description: `Wallet updated: ${wallet.name}`,
      details: updateData,
    });

    return {
      wallet: {
        id: wallet._id,
        name: wallet.name,
        status: wallet.status,
        limits: {
          daily: wallet.dailyLimit,
          monthly: wallet.monthlyLimit,
          single: wallet.singleTransactionLimit,
        },
      },
    };
  }

  async freezeWallet(userId, walletId, reason) {
    const wallet = await Wallet.findOne({ _id: walletId, userId });
    if (!wallet) throw new Error('Wallet not found');

    wallet.status = 'frozen';
    await wallet.save();

    // Log audit
    await AuditLog.createLog({
      userId,
      action: 'wallet.freeze',
      category: 'wallet',
      description: `Wallet frozen: ${wallet.name}`,
      details: { reason },
    });

    return { message: 'Wallet frozen successfully', walletId: wallet._id };
  }

  async unfreezeWallet(userId, walletId) {
    const wallet = await Wallet.findOne({ _id: walletId, userId });
    if (!wallet) throw new Error('Wallet not found');

    wallet.status = 'active';
    await wallet.save();

    // Log audit
    await AuditLog.createLog({
      userId,
      action: 'wallet.unfreeze',
      category: 'wallet',
      description: `Wallet unfrozen: ${wallet.name}`,
    });

    return { message: 'Wallet unfrozen successfully', walletId: wallet._id };
  }

  async getTransactionHistory(walletId, options = {}) {
    const { page = 1, limit = 20, type, status, startDate, endDate } = options;

    const query = { walletId };
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
        .sort({ createdAt: -1 })
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
      },
    };
  }

  async setDefaultWallet(userId, walletId) {
    // Unset current default
    await Wallet.updateMany(
      { userId, isDefault: true },
      { $set: { isDefault: false } }
    );

    // Set new default
    const wallet = await Wallet.findOneAndUpdate(
      { _id: walletId, userId },
      { $set: { isDefault: true } },
      { new: true }
    );

    if (!wallet) throw new Error('Wallet not found');

    return { message: 'Default wallet updated', walletId: wallet._id };
  }
}

module.exports = new WalletService();
