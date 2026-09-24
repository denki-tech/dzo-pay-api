const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class OTPGenerator {
  static generateNumeric(length = 6) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return crypto.randomInt(min, max + 1).toString();
  }

  static generateAlphanumeric(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return result;
  }

  static async hashOTP(otp) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(otp, salt);
  }

  static async verifyOTP(otp, hashedOTP) {
    return bcrypt.compare(otp, hashedOTP);
  }

  static generateBackupCodes(count = 5) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generateAlphanumeric(10));
    }
    return codes;
  }
}

module.exports = OTPGenerator;
