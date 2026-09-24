const mongoose = require('mongoose');
const { config } = require('./env');
const logger = require('./logger');

class Database {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  async connect(uri = config.database.uri) {
    if (this.isConnected) {
      logger.info('Database already connected');
      return this.connection;
    }

    try {
      mongoose.set('strictQuery', true);

      this.connection = await mongoose.connect(uri, {
        ...config.database.options,
        autoIndex: config.env === 'development',
      });

      this.isConnected = true;

      logger.info('MongoDB connected successfully', {
        host: this.connection.connection.host,
        port: this.connection.connection.port,
        name: this.connection.connection.name,
      });

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

      return this.connection;
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (!this.isConnected) return;

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected');
    } catch (error) {
      logger.error('MongoDB disconnect error:', error);
      throw error;
    }
  }

  getHealth() {
    return {
      status: this.isConnected ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };
  }
}

module.exports = new Database();
