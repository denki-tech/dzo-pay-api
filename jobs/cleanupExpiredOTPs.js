const { Worker } = require('bullmq');
const OTP = require('../models/OTP');
const logger = require('../config/logger');
const { config } = require('../config/env');

const cleanupExpiredOTPs = new Worker('otp-cleanup', async (job) => {
  logger.info('Starting OTP cleanup job', { jobId: job.id });

  const result = await OTP.deleteMany({
    status: { $in: ['used', 'expired', 'cancelled'] },
    updatedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  logger.info('OTP cleanup completed', { deleted: result.deletedCount });

  return { deleted: result.deletedCount };
}, {
  connection: { url: config.redis.url },
});

cleanupExpiredOTPs.on('completed', (job, result) => {
  logger.info('OTP cleanup job completed', { jobId: job.id, result });
});

cleanupExpiredOTPs.on('failed', (job, error) => {
  logger.error('OTP cleanup job failed', { jobId: job.id, error: error.message });
});

module.exports = cleanupExpiredOTPs;
