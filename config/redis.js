const Redis = require('ioredis');
const { config } = require('./env');
const logger = require('./logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.client) return this.client;

    try {
      this.client = new Redis(config.redis.url, {
        password: config.redis.password || undefined,
        retryDelayOnFailover: config.redis.retryDelayOnFailover,
        maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected');
      });

      this.client.on('error', (err) => {
        logger.error('Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (!this.client) return;
    await this.client.quit();
    this.isConnected = false;
    logger.info('Redis disconnected');
  }

  getClient() {
    if (!this.client) {
      throw new Error('Redis not initialized. Call connect() first.');
    }
    return this.client;
  }

  async get(key) {
    return this.client.get(key);
  }

  async set(key, value, ttl) {
    if (ttl) {
      return this.client.setex(key, ttl, value);
    }
    return this.client.set(key, value);
  }

  async del(key) {
    return this.client.del(key);
  }

  async exists(key) {
    return this.client.exists(key);
  }

  async incr(key) {
    return this.client.incr(key);
  }

  async expire(key, seconds) {
    return this.client.expire(key, seconds);
  }

  async ttl(key) {
    return this.client.ttl(key);
  }

  async hset(key, field, value) {
    return this.client.hset(key, field, value);
  }

  async hget(key, field) {
    return this.client.hget(key, field);
  }

  async hgetall(key) {
    return this.client.hgetall(key);
  }

  async hdel(key, field) {
    return this.client.hdel(key, field);
  }

  async lpush(key, value) {
    return this.client.lpush(key, value);
  }

  async rpop(key) {
    return this.client.rpop(key);
  }

  async lrange(key, start, stop) {
    return this.client.lrange(key, start, stop);
  }

  async sadd(key, member) {
    return this.client.sadd(key, member);
  }

  async sismember(key, member) {
    return this.client.sismember(key, member);
  }

  async smembers(key) {
    return this.client.smembers(key);
  }

  async zadd(key, score, member) {
    return this.client.zadd(key, score, member);
  }

  async zrange(key, start, stop) {
    return this.client.zrange(key, start, stop);
  }

  async zrevrange(key, start, stop, withScores) {
    return this.client.zrevrange(key, start, stop, withScores ? 'WITHSCORES' : undefined);
  }

  async zremrangebyscore(key, min, max) {
    return this.client.zremrangebyscore(key, min, max);
  }

  async publish(channel, message) {
    return this.client.publish(channel, message);
  }

  async subscribe(channel, callback) {
    const subscriber = new Redis(config.redis.url, {
      password: config.redis.password || undefined,
    });
    await subscriber.subscribe(channel);
    subscriber.on('message', (ch, message) => {
      if (ch === channel) callback(message);
    });
    return subscriber;
  }

  getHealth() {
    return {
      status: this.isConnected ? 'connected' : 'disconnected',
      host: this.client?.options?.host,
      port: this.client?.options?.port,
    };
  }
}

module.exports = new RedisClient();
