const walletService = require('../services/walletService');
const { AppError } = require('../middleware/errorHandler');

class WalletController {
  async createWallet(req, res, next) {
    try {
      const result = await walletService.createWallet(req.user._id, req.body);

      res.status(201).json({
        success: true,
        message: 'Wallet created successfully',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async getWallets(req, res, next) {
    try {
      const result = await walletService.getWallets(req.user._id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async getWalletDetails(req, res, next) {
    try {
      const result = await walletService.getWalletDetails(
        req.user._id,
        req.params.walletId
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 404));
    }
  }

  async transfer(req, res, next) {
    try {
      const result = await walletService.transfer({
        ...req.body,
        userId: req.user._id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        success: true,
        message: 'Transfer completed successfully',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async updateWallet(req, res, next) {
    try {
      const result = await walletService.updateWallet(
        req.user._id,
        req.params.walletId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Wallet updated successfully',
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async freezeWallet(req, res, next) {
    try {
      const result = await walletService.freezeWallet(
        req.user._id,
        req.params.walletId,
        req.body.reason
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async unfreezeWallet(req, res, next) {
    try {
      const result = await walletService.unfreezeWallet(
        req.user._id,
        req.params.walletId
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }

  async getTransactionHistory(req, res, next) {
    try {
      const result = await walletService.getTransactionHistory(
        req.params.walletId,
        {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 20,
          type: req.query.type,
          status: req.query.status,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
        }
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  async setDefaultWallet(req, res, next) {
    try {
      const result = await walletService.setDefaultWallet(
        req.user._id,
        req.params.walletId
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(new AppError(error.message, 400));
    }
  }
}

module.exports = new WalletController();
