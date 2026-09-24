const paymentService = require('../services/paymentService');
const receiptService = require('../services/receiptService');
const { AppError } = require('../middleware/errorHandler');

class PaymentController {
  async initializePayment(req, res, next) {
    try {
      const result = await paymentService.initializePayment({
        ...req.body,
        userId: req.user._id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        success: true,
        message: 'Payment initialized',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async verifyPayment(req, res, next) {
    try {
      const result = await paymentService.verifyPayment(
        req.params.reference,
        req.body.provider || req.query.provider
      );

      res.status(200).json({
        success: true,
        message: 'Payment verified',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async createPaymentLink(req, res, next) {
    try {
      const result = await paymentService.createPaymentLink({
        ...req.body,
        userId: req.user._id,
        walletId: req.body.walletId,
      });

      res.status(201).json({
        success: true,
        message: 'Payment link created',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async getPaymentLinks(req, res, next) {
    try {
      const links = await require('../models/PaymentLink').find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({
        success: true,
        data: { paymentLinks: links },
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async getPaymentLink(req, res, next) {
    try {
      const link = await require('../models/PaymentLink').findOne({
        slug: req.params.slug,
      }).lean();

      if (!link) {
        return next(new AppError('Payment link not found', 404));
      }

      res.status(200).json({
        success: true,
        data: { paymentLink: link },
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async processPaymentLink(req, res, next) {
    try {
      const result = await paymentService.processPaymentLink(req.params.slug, req.body);

      res.status(200).json({
        success: true,
        message: 'Payment initialized via link',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async refundPayment(req, res, next) {
    try {
      const result = await paymentService.refundPayment(
        req.body.transactionId,
        req.body.amount,
        req.body.reason
      );

      res.status(200).json({
        success: true,
        message: 'Refund processed',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async getTransactionHistory(req, res, next) {
    try {
      const result = await paymentService.getTransactionHistory(req.user._id, {
        walletId: req.query.walletId,
        type: req.query.type,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async getTransactionDetails(req, res, next) {
    try {
      const result = await paymentService.getTransactionDetails(
        req.user._id,
        req.params.transactionId
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 404));
    }
  }

  async getPaymentStats(req, res, next) {
    try {
      const result = await paymentService.getPaymentStats(
        req.user._id,
        req.query.period || '30d'
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async getReceipt(req, res, next) {
    try {
      const result = await receiptService.getReceipt(
        req.params.transactionId,
        req.user._id
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 404));
    }
  }

  async downloadReceipt(req, res, next) {
    try {
      const result = await receiptService.getReceiptHTML(
        req.params.transactionId,
        req.user._id
      );

      res.setHeader('Content-Type', 'text/html');
      res.send(result.html);
    } catch (error) {
      next(new AppError(error.message, 404));
    }
  }
}

module.exports = new PaymentController();
