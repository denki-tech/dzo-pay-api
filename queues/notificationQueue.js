const { Queue } = require('bullmq');
const { config } = require('../config/env');

const notificationQueue = new Queue('notification', {
  connection: {
    url: config.redis.url,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

module.exports = notificationQueue;
