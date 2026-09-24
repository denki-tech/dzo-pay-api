const { config } = require('../config/env');
const logger = require('../config/logger');

class SMSService {
  constructor() {
    this.provider = config.sms.twilio.accountSid ? 'twilio' : 'termii';
  }

  async send({ to, message, from }) {
    try {
      // In production, integrate with Twilio or Termii
      // This is a stub that logs and simulates success

      logger.info('SMS sent', {
        to,
        provider: this.provider,
        messageLength: message.length,
      });

      // Simulate Twilio integration
      if (this.provider === 'twilio') {
        // const twilio = require('twilio');
        // const client = twilio(config.sms.twilio.accountSid, config.sms.twilio.authToken);
        // await client.messages.create({
        //   body: message,
        //   from: config.sms.twilio.phoneNumber,
        //   to,
        // });
      }

      // Simulate Termii integration
      if (this.provider === 'termii') {
        // const response = await axios.post('https://api.ng.termii.com/api/sms/send', {
        //   to,
        //   from: config.sms.termii.senderId,
        //   sms: message,
        //   type: 'plain',
        //   channel: 'generic',
        //   api_key: config.sms.termii.apiKey,
        // });
      }

      return {
        success: true,
        messageId: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        provider: this.provider,
      };
    } catch (error) {
      logger.error('SMS sending failed:', {
        error: error.message,
        to,
      });
      throw error;
    }
  }

  async sendOTP({ to, otp, expiryMinutes = 10 }) {
    const message = `Your D-ZO Pay verification code is: ${otp}. Valid for ${expiryMinutes} minutes. Do not share this code with anyone.`;
    return this.send({ to, message });
  }

  async sendTransactionAlert({ to, type, amount, currency, balance, reference }) {
    const message = type === 'credit'
      ? `D-ZO Pay: You received ${currency} ${amount}. Bal: ${currency} ${balance}. Ref: ${reference}`
      : `D-ZO Pay: You sent ${currency} ${amount}. Bal: ${currency} ${balance}. Ref: ${reference}`;
    return this.send({ to, message });
  }

  async sendSecurityAlert({ to, event, time, ipAddress }) {
    const message = `D-ZO Pay Security Alert: ${event} detected at ${time} from IP ${ipAddress}. If this wasn't you, contact support immediately.`;
    return this.send({ to, message });
  }

  async sendPasswordReset({ to, resetUrl }) {
    const message = `D-ZO Pay: Reset your password at ${resetUrl}. Link expires in 1 hour.`;
    return this.send({ to, message });
  }
}

module.exports = new SMSService();
