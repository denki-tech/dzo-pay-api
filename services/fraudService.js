const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const redis = require('../config/redis');
const logger = require('../config/logger');

class FraudService {
  async analyzeTransaction(transactionData) {
    const { userId, walletId, amount, currency, type, ipAddress, deviceInfo, destinationWalletId } = transactionData;

    const riskScore = 0;
    const flags = [];

    // 1. Velocity check - too many transactions in short time
    const velocityRisk = await this.checkVelocity(userId, walletId);
    if (velocityRisk.score > 0) {
      riskScore += velocityRisk.score;
      flags.push('velocity');
    }

    // 2. Amount check - unusually large amount
    const amountRisk = await this.checkAmount(userId, walletId, amount, currency);
    if (amountRisk.score > 0) {
      riskScore += amountRisk.score;
      flags.push('amount');
    }

    // 3. Location check - new or unusual location
    const locationRisk = await this.checkLocation(userId, ipAddress);
    if (locationRisk.score > 0) {
      riskScore += locationRisk.score;
      flags.push('location');
    }

    // 4. Device check - new device
    const deviceRisk = await this.checkDevice(userId, deviceInfo);
    if (deviceRisk.score > 0) {
      riskScore += deviceRisk.score;
      flags.push('device');
    }

    // 5. Time check - unusual transaction time
    const timeRisk = this.checkTimePattern();
    if (timeRisk.score > 0) {
      riskScore += timeRisk.score;
      flags.push('time');
    }

    // 6. Pattern check - suspicious patterns
    const patternRisk = await this.checkPattern(userId, destinationWalletId, type);
    if (patternRisk.score > 0) {
      riskScore += patternRisk.score;
      flags.push('pattern');
    }

    const finalScore = Math.min(100, Math.max(0, riskScore));

    // Update user risk score
    if (finalScore > 50) {
      await User.findByIdAndUpdate(userId, { $set: { riskScore: finalScore } });
    }

    return {
      score: finalScore,
      flags,
      riskLevel: this.getRiskLevel(finalScore),
      shouldBlock: finalScore >= 80,
      shouldReview: finalScore >= 50,
      details: {
        velocity: velocityRisk,
        amount: amountRisk,
        location: locationRisk,
        device: deviceRisk,
        time: timeRisk,
        pattern: patternRisk,
      },
    };
  }

  async checkVelocity(userId, walletId) {
    const key = `velocity:${userId}:${walletId}`;
    const window = 300; // 5 minutes
    const maxTransactions = 5;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, window);
    }

    const score = count > maxTransactions ? Math.min(30, (count - maxTransactions) * 5) : 0;

    return { score, count, maxTransactions, window };
  }

  async checkAmount(userId, walletId, amount, currency) {
    // Get user's average transaction amount
    const avgAmount = await this.getAverageTransactionAmount(userId, walletId, currency);

    if (!avgAmount || avgAmount === 0) return { score: 0 };

    const ratio = amount / avgAmount;
    let score = 0;

    if (ratio > 10) score = 25;
    else if (ratio > 5) score = 15;
    else if (ratio > 3) score = 5;

    return { score, averageAmount: avgAmount, currentAmount: amount, ratio };
  }

  async checkLocation(userId, ipAddress) {
    if (!ipAddress) return { score: 0 };

    const lastIp = await redis.get(`last_ip:${userId}`);
    if (!lastIp) {
      await redis.setex(`last_ip:${userId}`, 86400, ipAddress);
      return { score: 0, isNew: true };
    }

    if (lastIp !== ipAddress) {
      // Check if IP is from different country
      const geoip = require('geoip-lite');
      const lastGeo = geoip.lookup(lastIp);
      const currentGeo = geoip.lookup(ipAddress);

      if (lastGeo && currentGeo && lastGeo.country !== currentGeo.country) {
        return { score: 20, isNewCountry: true, fromCountry: lastGeo.country, toCountry: currentGeo.country };
      }

      return { score: 5, isNewIp: true };
    }

    return { score: 0, isNew: false };
  }

  async checkDevice(userId, deviceInfo) {
    if (!deviceInfo) return { score: 0 };

    const knownDevices = await redis.smembers(`devices:${userId}`);

    if (knownDevices.length === 0) {
      await redis.sadd(`devices:${userId}`, deviceInfo);
      await redis.expire(`devices:${userId}`, 2592000); // 30 days
      return { score: 0, isNewDevice: true };
    }

    if (!knownDevices.includes(deviceInfo)) {
      await redis.sadd(`devices:${userId}`, deviceInfo);
      return { score: 10, isNewDevice: true };
    }

    return { score: 0, isNewDevice: false };
  }

  checkTimePattern() {
    const hour = new Date().getHours();

    // Higher risk for transactions between 12 AM and 5 AM
    if (hour >= 0 && hour < 5) {
      return { score: 5, isUnusualHour: true, hour };
    }

    return { score: 0, isUnusualHour: false, hour };
  }

  async checkPattern(userId, destinationWalletId, type) {
    let score = 0;

    // Check if destination is new
    if (destinationWalletId) {
      const recentDestinations = await redis.lrange(`destinations:${userId}`, 0, 9);

      if (!recentDestinations.includes(destinationWalletId.toString())) {
        score += 5;
      }

      // Add to recent destinations
      await redis.lpush(`destinations:${userId}`, destinationWalletId.toString());
      await redis.ltrim(`destinations:${userId}`, 0, 9);
      await redis.expire(`destinations:${userId}`, 86400);
    }

    // Check for round-trip transactions (quick deposit then withdrawal)
    const recentTransactions = await Transaction.find({
      userId,
      createdAt: { $gte: new Date(Date.now() - 3600000) },
    }).sort({ createdAt: -1 }).limit(5);

    if (recentTransactions.length >= 3) {
      const types = recentTransactions.map(t => t.type);
      const hasRoundTrip = types.includes('credit') && types.includes('debit');
      if (hasRoundTrip) {
        score += 10;
      }
    }

    return { score, recentTransactionCount: recentTransactions.length };
  }

  async getAverageTransactionAmount(userId, walletId, currency) {
    const result = await Transaction.aggregate([
      {
        $match: {
          userId: new require('mongoose').Types.ObjectId(userId),
          walletId: new require('mongoose').Types.ObjectId(walletId),
          currency,
          status: 'completed',
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: null,
          avgAmount: { $avg: '$amount' },
        },
      },
    ]);

    return result[0]?.avgAmount || 0;
  }

  getRiskLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  async blockTransaction(transactionId, reason) {
    const transaction = await Transaction.findByIdAndUpdate(
      transactionId,
      { 
        $set: { 
          status: 'failed',
          metadata: { blockReason: reason },
        },
      },
      { new: true }
    );

    logger.warn('Transaction blocked by fraud detection', {
      transactionId,
      reason,
      userId: transaction.userId,
    });

    return transaction;
  }

  async flagForReview(transactionId) {
    const transaction = await Transaction.findByIdAndUpdate(
      transactionId,
      { $set: { status: 'processing' } },
      { new: true }
    );

    logger.info('Transaction flagged for manual review', {
      transactionId,
      userId: transaction.userId,
    });

    return transaction;
  }

  async getUserRiskProfile(userId) {
    const user = await User.findById(userId);
    const recentTransactions = await Transaction.find({
      userId,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    const flaggedTransactions = recentTransactions.filter(t => t.riskScore > 50);

    return {
      userId,
      currentRiskScore: user.riskScore,
      totalTransactions: recentTransactions.length,
      flaggedTransactions: flaggedTransactions.length,
      riskLevel: this.getRiskLevel(user.riskScore),
      lastFlaggedAt: flaggedTransactions[0]?.createdAt || null,
    };
  }
}

module.exports = new FraudService();
