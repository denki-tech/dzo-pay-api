const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class HashUtil {
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  static hashSHA256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static hashSHA512(data) {
    return crypto.createHash('sha512').update(data).digest('hex');
  }

  static hmacSHA256(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  static hmacSHA512(data, secret) {
    return crypto.createHmac('sha512', secret).update(data).digest('hex');
  }

  static md5(data) {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  static generateSalt(length = 16) {
    return crypto.randomBytes(length).toString('hex');
  }

  static pbkdf2(password, salt, iterations = 100000, keyLength = 64, digest = 'sha512') {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, keyLength, digest, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });
  }

  static encrypt(text, secretKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedText, secretKey) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = parts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

module.exports = HashUtil;
