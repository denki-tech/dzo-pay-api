const { Queue } = require('bullmq');
const { config } = require('../config/env');

const webhookQueue = new Queue('webhook', {
  connection: {
    url: config.redis.url,
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 60000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

module.exports = webhookQueue;
