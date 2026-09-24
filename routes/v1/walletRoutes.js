const express = require('express');
const router = express.Router();
const walletController = require('../../controllers/walletController');
const validateRequest = require('../../middleware/validateRequest');
const requireLogin = require('../../middleware/requireLogin');
const idempotency = require('../../middleware/idempotency');
const walletValidator = require('../../validators/walletValidator');

router.use(requireLogin);

router.post('/', validateRequest(walletValidator.createWallet), walletController.createWallet);
router.get('/', walletController.getWallets);
router.get('/:walletId', walletController.getWalletDetails);
router.patch('/:walletId', validateRequest(walletValidator.updateWallet), walletController.updateWallet);
router.post('/transfer', idempotency, validateRequest(walletValidator.transfer), walletController.transfer);
router.post('/:walletId/freeze', walletController.freezeWallet);
router.post('/:walletId/unfreeze', walletController.unfreezeWallet);
router.get('/:walletId/transactions', walletController.getTransactionHistory);
router.post('/:walletId/default', walletController.setDefaultWallet);

module.exports = router;
