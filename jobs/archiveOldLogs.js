const { Worker } = require('bullmq');
const AuditLog = require('../models/AuditLog');
const WebhookLog = require('../models/WebhookLog');
const logger = require('../config/logger');
const { config } = require('../config/env');

const archiveOldLogs = new Worker('log-archive', async (job) => {
  logger.info('Starting log archive job', { jobId: job.id });

  const archiveDate = new Date(Date.now() - config.jobs.archiveLogsDays * 24 * 60 * 60 * 1000);

  const [auditResult, webhookResult] = await Promise.all([
    AuditLog.deleteMany({ createdAt: { $lt: archiveDate } }),
    WebhookLog.deleteMany({ createdAt: { $lt: archiveDate } }),
  ]);

  logger.info('Log archive completed', {
    auditDeleted: auditResult.deletedCount,
    webhookDeleted: webhookResult.deletedCount,
  });

  return {
    auditDeleted: auditResult.deletedCount,
    webhookDeleted: webhookResult.deletedCount,
  };
}, {
  connection: { url: config.redis.url },
});

archiveOldLogs.on('completed', (job, result) => {
  logger.info('Log archive job completed', { jobId: job.id, result });
});

archiveOldLogs.on('failed', (job, error) => {
  logger.error('Log archive job failed', { jobId: job.id, error: error.message });
});

module.exports = archiveOldLogs;
