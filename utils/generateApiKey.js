const crypto = require('crypto');

class ApiKeyGenerator {
  static generate() {
    const prefix = 'dzp_live';
    const randomPart = crypto.randomBytes(24).toString('hex');
    const checksum = crypto
      .createHmac('sha256', process.env.API_KEY_SECRET || 'default-secret')
      .update(`${prefix}_${randomPart}`)
      .digest('hex')
      .substring(0, 8);

    return {
      fullKey: `${prefix}_${randomPart}_${checksum}`,
      prefix: `${prefix}_${randomPart.substring(0, 8)}`,
      randomPart,
      checksum,
    };
  }

  static generateTestKey() {
    const prefix = 'dzp_test';
    const randomPart = crypto.randomBytes(24).toString('hex');
    const checksum = crypto
      .createHmac('sha256', process.env.API_KEY_SECRET || 'default-secret')
      .update(`${prefix}_${randomPart}`)
      .digest('hex')
      .substring(0, 8);

    return {
      fullKey: `${prefix}_${randomPart}_${checksum}`,
      prefix: `${prefix}_${randomPart.substring(0, 8)}`,
      randomPart,
      checksum,
    };
  }

  static hashKey(key) {
    return crypto
      .createHmac('sha256', process.env.API_KEY_SECRET || 'default-secret')
      .update(key)
      .digest('hex');
  }

  static verifyChecksum(key) {
    const parts = key.split('_');
    if (parts.length !== 3) return false;

    const [prefix, randomPart, checksum] = parts;
    const expectedChecksum = crypto
      .createHmac('sha256', process.env.API_KEY_SECRET || 'default-secret')
      .update(`${prefix}_${randomPart}`)
      .digest('hex')
      .substring(0, 8);

    return checksum === expectedChecksum;
  }

  static extractPrefix(key) {
    const parts = key.split('_');
    if (parts.length < 2) return null;
    return `${parts[0]}_${parts[1].substring(0, 8)}`;
  }
}

module.exports = ApiKeyGenerator;
