const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const { config } = require('./env');

const { combine, timestamp, json, errors, printf, colorize } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

const transports = [];

// Console transport for all environments
transports.push(
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      config.env === 'development' ? devFormat : json()
    ),
  })
);

// File transports for production/staging
if (config.env !== 'test') {
  // Combined log
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: combine(timestamp(), json()),
    })
  );

  // Error log
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      level: 'error',
      format: combine(timestamp(), json()),
    })
  );

  // Webhook log
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'webhook-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: combine(timestamp(), json()),
    })
  );

  // Transaction log
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'transaction-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: combine(timestamp(), json()),
    })
  );
}

const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: {
    service: 'dzo-pay',
    environment: config.env,
  },
  transports,
  exitOnError: false,
});

// Stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim(), { type: 'http' });
  },
};

module.exports = logger;
