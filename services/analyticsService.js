const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const Subscription = require('../models/Subscription');
const AuditLog = require('../models/AuditLog');
const WebhookLog = require('../models/WebhookLog');
const redis = require('../config/redis');
const logger = require('../config/logger');

class AnalyticsService {
  async getDashboardStats(period = '30d') {
    const startDate = this.getStartDate(period);

    const [
      totalUsers,
      newUsers,
      activeUsers,
      totalTransactions,
      totalVolume,
      totalWallets,
      activeSubscriptions,
      revenue,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      User.countDocuments({ lastLogin: { $gte: startDate } }),
      Transaction.countDocuments({ createdAt: { $gte: startDate } }),
      this.getTotalVolume(startDate),
      Wallet.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      this.getRevenue(startDate),
    ]);

    return {
      users: {
        total: totalUsers,
        new: newUsers,
        active: activeUsers,
        growth: this.calculateGrowth(totalUsers, newUsers),
      },
      transactions: {
        total: totalTransactions,
        volume: totalVolume,
        averageValue: totalTransactions > 0 ? totalVolume / totalTransactions : 0,
      },
      wallets: {
        total: totalWallets,
        active: await Wallet.countDocuments({ lastTransactionAt: { $gte: startDate } }),
      },
      subscriptions: {
        active: activeSubscriptions,
        revenue,
      },
      period,
    };
  }

  async getTransactionAnalytics(period = '30d', groupBy = 'day') {
    const startDate = this.getStartDate(period);

    const groupFormat = {
      day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      week: { $week: '$createdAt' },
      month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
    };

    const stats = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: groupFormat[groupBy] || groupFormat.day,
            type: '$type',
          },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
          fees: { $sum: '$fee' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    return this.formatTimeSeriesData(stats, groupBy);
  }

  async getUserAnalytics(period = '30d') {
    const startDate = this.getStartDate(period);

    const [userGrowth, planDistribution, kycStats] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        {
          $group: {
            _id: '$plan',
            count: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        {
          $group: {
            _id: '$kycStatus',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      userGrowth,
      planDistribution: planDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      kycStats: kycStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };
  }

  async getRevenueAnalytics(period = '30d') {
    const startDate = this.getStartDate(period);

    const [subscriptionRevenue, transactionFees, totalRevenue] = await Promise.all([
      Subscription.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: 'active' } },
        {
          $group: {
            _id: '$plan',
            revenue: { $sum: '$price' },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
        {
          $group: {
            _id: null,
            totalFees: { $sum: '$fee' },
            totalVat: { $sum: '$vat' },
          },
        },
      ]),
      this.getRevenue(startDate),
    ]);

    return {
      subscriptionRevenue: subscriptionRevenue.reduce((acc, item) => {
        acc[item._id] = { revenue: item.revenue, count: item.count };
        return acc;
      }, {}),
      transactionFees: transactionFees[0] || { totalFees: 0, totalVat: 0 },
      totalRevenue,
      period,
    };
  }

  async getWebhookAnalytics(period = '30d') {
    const startDate = this.getStartDate(period);

    const stats = await WebhookLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgAttempts: { $avg: '$attempts' },
        },
      },
    ]);

    return {
      deliveryStats: stats.reduce((acc, item) => {
        acc[item._id] = { count: item.count, avgAttempts: item.avgAttempts };
        return acc;
      }, {}),
      period,
    };
  }

  async getSystemHealth() {
    const db = require('../config/db');
    const redisClient = require('../config/redis');

    const [dbHealth, redisHealth] = await Promise.all([
      db.getHealth(),
      redisClient.getHealth(),
    ]);

    return {
      database: dbHealth,
      redis: redisHealth,
      status: dbHealth.status === 'connected' && redisHealth.status === 'connected' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
    };
  }

  async getRealtimeStats() {
    // Get stats from Redis for real-time data
    const [activeUsers, transactionsToday, volumeToday] = await Promise.all([
      redis.get('stats:active_users') || 0,
      redis.get('stats:transactions_today') || 0,
      redis.get('stats:volume_today') || 0,
    ]);

    return {
      activeUsers: parseInt(activeUsers),
      transactionsToday: parseInt(transactionsToday),
      volumeToday: parseFloat(volumeToday),
      timestamp: new Date().toISOString(),
    };
  }

  getStartDate(period) {
    const now = new Date();
    const match = period.match(/(\d+)([dwm])/);
    if (!match) return new Date(now.setDate(now.getDate() - 30));

    const [, value, unit] = match;
    const num = parseInt(value);

    switch (unit) {
      case 'd': return new Date(now.setDate(now.getDate() - num));
      case 'w': return new Date(now.setDate(now.getDate() - num * 7));
      case 'm': return new Date(now.setMonth(now.getMonth() - num));
      default: return new Date(now.setDate(now.getDate() - 30));
    }
  }

  async getTotalVolume(startDate) {
    const result = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total || 0;
  }

  async getRevenue(startDate) {
    const [subscriptionRevenue, feeRevenue] = await Promise.all([
      Subscription.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: '$price' } } },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$fee' } } },
      ]),
    ]);

    return (subscriptionRevenue[0]?.total || 0) + (feeRevenue[0]?.total || 0);
  }

  calculateGrowth(total, new_) {
    if (total === 0) return 0;
    return ((new_ / total) * 100).toFixed(2);
  }

  formatTimeSeriesData(data, groupBy) {
    const formatted = {};

    data.forEach(item => {
      const date = item._id.date;
      const type = item._id.type;

      if (!formatted[date]) {
        formatted[date] = { date, types: {} };
      }

      formatted[date].types[type] = {
        count: item.count,
        amount: item.amount,
        fees: item.fees,
      };
    });

    return Object.values(formatted);
  }

  async getAuditLogStats(period = '30d') {
    const startDate = this.getStartDate(period);

    const stats = await AuditLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            category: '$category',
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      categoryStats: stats.reduce((acc, item) => {
        const { category, status } = item._id;
        if (!acc[category]) acc[category] = {};
        acc[category][status] = item.count;
        return acc;
      }, {}),
      period,
    };
  }

  async generateDailyReport() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date(yesterday);
    today.setDate(today.getDate() + 1);

    const [transactions, newUsers, revenue] = await Promise.all([
      Transaction.countDocuments({ createdAt: { $gte: yesterday, $lt: today } }),
      User.countDocuments({ createdAt: { $gte: yesterday, $lt: today } }),
      this.getRevenue(yesterday),
    ]);

    const report = {
      date: yesterday.toISOString().split('T')[0],
      transactions,
      newUsers,
      revenue,
      generatedAt: new Date().toISOString(),
    };

    logger.info('Daily report generated', report);
    return report;
  }
}

module.exports = new AnalyticsService();
