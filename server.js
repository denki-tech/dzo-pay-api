const app = require('./app');
const db = require('./config/db');
const redis = require('./config/redis');
const logger = require('./config/logger');
const { config } = require('./config/env');

const PORT = config.port;

const startServer = async () => {
  try {
    // Connect to database
    await db.connect();

    // Connect to Redis
    await redis.connect();

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`D-ZO Pay server running on port ${PORT}`, {
        environment: config.env,
        port: PORT,
        apiVersion: config.apiVersion,
      });
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await db.disconnect();
          await redis.disconnect();
          logger.info('Database and Redis connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
