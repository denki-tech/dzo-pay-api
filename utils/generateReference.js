const crypto = require('crypto');
const { nanoid } = require('nanoid');

class ReferenceGenerator {
  static generate(prefix = 'DZP') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = nanoid(8).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }

  static generateTransactionReference() {
    return this.generate('TXN');
  }

  static generatePaymentReference() {
    return this.generate('PAY');
  }

  static generateTransferReference() {
    return this.generate('TRF');
  }

  static generateWalletReference() {
    return this.generate('WLT');
  }

  static generateVirtualAccountNumber() {
    // Generate a 10-digit number starting with 7 (Nigeria virtual account pattern)
    const prefix = '7';
    const random = crypto.randomInt(100000000, 999999999).toString();
    return prefix + random;
  }

  static generateIdempotencyKey() {
    return `idemp_${Date.now()}_${nanoid(12)}`;
  }

  static generateWebhookId() {
    return this.generate('WHK');
  }

  static generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = crypto.randomInt(100000, 999999);
    return `INV-${year}${month}-${random}`;
  }

  static generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  static generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  static generateReferralCode(userId) {
    const hash = crypto.createHash('md5').update(userId.toString()).digest('hex');
    return `DZO${hash.substring(0, 6).toUpperCase()}`;
  }
}

module.exports = ReferenceGenerator;
