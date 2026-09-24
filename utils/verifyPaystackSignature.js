const crypto = require('crypto');
const { config } = require('../config/env');

class PaystackSignatureVerifier {
  static verify(body, signature) {
    if (!signature) return false;

    const hash = crypto
      .createHmac('sha512', config.providers.paystack.webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(signature)
    );
  }

  static verifyRaw(body, signature) {
    if (!signature) return false;

    const hash = crypto
      .createHmac('sha512', config.providers.paystack.webhookSecret)
      .update(body)
      .digest('hex');

    return hash === signature;
  }
}

class StripeSignatureVerifier {
  static verify(payload, signature, secret) {
    if (!signature || !secret) return false;

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    } catch (error) {
      return false;
    }
  }
}

class FlutterwaveSignatureVerifier {
  static verify(body, signature, secret) {
    if (!signature || !secret) return false;

    const hash = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    return hash === signature;
  }
}

module.exports = {
  PaystackSignatureVerifier,
  StripeSignatureVerifier,
  FlutterwaveSignatureVerifier,
};
