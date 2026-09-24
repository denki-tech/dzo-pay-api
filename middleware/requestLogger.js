const logger = require('../config/logger');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const { config } = require('../config/env');

const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const ip = req.ip || req.connection.remoteAddress;

    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip,
      userAgent: req.headers['user-agent'],
      contentLength: res.get('Content-Length'),
      userId: req.user?._id,
      apiKey: req.apiKey?.prefix,
      requestId: req.headers['x-request-id'],
    };

    // Add geolocation if enabled
    if (config.features.enableIpGeolocation) {
      const geo = geoip.lookup(ip);
      if (geo) {
        logData.location = {
          country: geo.country,
          city: geo.city,
          region: geo.region,
        };
      }
    }

    // Parse user agent
    const ua = UAParser(req.headers['user-agent']);
    logData.device = {
      browser: ua.browser.name,
      os: ua.os.name,
      device: ua.device.type || 'desktop',
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('Server error response', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Client error response', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

module.exports = requestLogger;
