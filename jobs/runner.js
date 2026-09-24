const { QueueScheduler } = require('bullmq');
const cron = require('node-cron');
const { config } = require('../config/env');
const logger = require('../config/logger');

// Import job workers
require('./retryFailedWebhooks');
require('./cleanupExpiredOTPs');
require('./generateDailyReports');
require('./archiveOldLogs');

logger.info('Job runner started');

// Schedule cron jobs
if (config.features.enableWebhookRetry) {
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Scheduled webhook retry triggered');
    // Trigger webhook retry job
  });
}

cron.schedule('0 * * * *', async () => {
  logger.info('Scheduled OTP cleanup triggered');
  // Trigger OTP cleanup job
});

cron.schedule(`0 ${config.jobs.dailyReportHour} * * *`, async () => {
  logger.info('Scheduled daily report triggered');
  // Trigger daily report job
});

cron.schedule('0 0 * * 0', async () => {
  logger.info('Scheduled log archive triggered');
  // Trigger log archive job
});

// Keep process alive
process.on('SIGTERM', () => {
  logger.info('Job runner shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Job runner shutting down');
  process.exit(0);
});
