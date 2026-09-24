const { Worker } = require('bullmq');
const analyticsService = require('../services/analyticsService');
const logger = require('../config/logger');
const { config } = require('../config/env');

const generateDailyReports = new Worker('daily-report', async (job) => {
  logger.info('Starting daily report generation', { jobId: job.id });

  const report = await analyticsService.generateDailyReport();

  // Store report or send via email
  logger.info('Daily report generated', { report });

  return report;
}, {
  connection: { url: config.redis.url },
});

generateDailyReports.on('completed', (job, result) => {
  logger.info('Daily report job completed', { jobId: job.id, date: result.date });
});

generateDailyReports.on('failed', (job, error) => {
  logger.error('Daily report job failed', { jobId: job.id, error: error.message });
});

module.exports = generateDailyReports;
