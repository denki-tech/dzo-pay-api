const { Worker } = require('bullmq');
const webhookService = require('../services/webhookService');
const logger = require('../config/logger');
const { config } = require('../config/env');

const retryFailedWebhooks = new Worker('webhook-retry', async (job) => {
  logger.info('Starting webhook retry job', { jobId: job.id });

  const results = await webhookService.retryFailedWebhooks();

  return {
    processed: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  };
}, {
  connection: { url: config.redis.url },
  concurrency: 5,
});

retryFailedWebhooks.on('completed', (job, result) => {
  logger.info('Webhook retry job completed', { jobId: job.id, result });
});

retryFailedWebhooks.on('failed', (job, error) => {
  logger.error('Webhook retry job failed', { jobId: job.id, error: error.message });
});

module.exports = retryFailedWebhooks;
