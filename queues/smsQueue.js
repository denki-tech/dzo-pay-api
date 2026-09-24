const { Queue } = require('bullmq');
const { config } = require('../config/env');

const smsQueue = new Queue('sms', {
  connection: {
    url: config.redis.url,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

module.exports = smsQueue;
