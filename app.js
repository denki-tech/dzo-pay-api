const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger.json');

const { config, validateEnv } = require('./config/env');
const logger = require('./config/logger');
const db = require('./config/db');
const redis = require('./config/redis');
const { errorHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

// Import routes
const authRoutes = require('./routes/v1/authRoutes');
const paymentRoutes = require('./routes/v1/paymentRoutes');
const walletRoutes = require('./routes/v1/walletRoutes');
const webhookRoutes = require('./routes/v1/webhookRoutes');
const subscriptionRoutes = require('./routes/v1/subscriptionRoutes');
const adminRoutes = require('./routes/v1/adminRoutes');
const analyticsRoutes = require('./routes/v1/analyticsRoutes');

// Validate environment variables
validateEnv();

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Idempotency-Key', 'X-Admin-Key'],
}));

app.use(compression());
app.use(mongoSanitize());
app.use(hpp());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined', { stream: logger.stream }));
app.use(requestLogger);

// Health check endpoints
app.get('/api/v1/health', async (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/v1/health/detailed', async (req, res) => {
  const dbHealth = db.getHealth();
  const redisHealth = redis.getHealth();

  const status = dbHealth.status === 'connected' && redisHealth.status === 'connected' 
    ? 'healthy' 
    : 'degraded';

  res.status(status === 'healthy' ? 200 : 503).json({
    success: true,
    status,
    services: {
      database: dbHealth,
      redis: redisHealth,
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'D-ZO Pay API Documentation',
}));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/wallets', walletRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to D-ZO Pay API',
    version: 'v1',
    documentation: '/api-docs',
    health: '/api/v1/health',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
