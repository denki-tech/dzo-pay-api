const Transaction = require('../models/Transaction');
const ReceiptGenerator = require('../utils/receiptGenerator');
const logger = require('../config/logger');

class ReceiptService {
  async generateReceipt(transactionId, userId) {
    const transaction = await Transaction.findOne({ _id: transactionId, userId });
    if (!transaction) throw new Error('Transaction not found');

    if (transaction.receiptUrl && !transaction.receiptSent) {
      return {
        receiptUrl: transaction.receiptUrl,
        alreadyGenerated: true,
      };
    }

    const receipt = await ReceiptGenerator.generatePDF(transaction);

    transaction.receiptUrl = receipt.downloadUrl;
    transaction.receiptSent = true;
    await transaction.save();

    logger.info('Receipt generated', {
      transactionId,
      userId,
      receiptPath: receipt.filePath,
    });

    return {
      receiptUrl: receipt.downloadUrl,
      receiptData: receipt.data,
      html: ReceiptGenerator.generateHTML(transaction),
    };
  }

  async getReceipt(transactionId, userId) {
    const transaction = await Transaction.findOne({ _id: transactionId, userId });
    if (!transaction) throw new Error('Transaction not found');

    if (!transaction.receiptUrl) {
      return await this.generateReceipt(transactionId, userId);
    }

    return {
      receiptUrl: transaction.receiptUrl,
      transaction: {
        reference: transaction.reference,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt,
      },
    };
  }

  async sendReceipt(transactionId, userId, channel = 'email') {
    const receipt = await this.getReceipt(transactionId, userId);
    const transaction = await Transaction.findOne({ _id: transactionId, userId });

    // In production, integrate with notification service
    logger.info('Receipt sending queued', {
      transactionId,
      userId,
      channel,
    });

    return {
      sent: true,
      channel,
      receiptUrl: receipt.receiptUrl,
    };
  }

  async getReceiptHTML(transactionId, userId) {
    const transaction = await Transaction.findOne({ _id: transactionId, userId });
    if (!transaction) throw new Error('Transaction not found');

    return {
      html: ReceiptGenerator.generateHTML(transaction),
    };
  }
}

module.exports = new ReceiptService();
