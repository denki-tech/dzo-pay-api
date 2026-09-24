const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const requiredEnvVars = [
  'JWT_SECRET',
  'MONGODB_URI',
  'REDIS_URL'
];

// Validate required environment variables
const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiVersion: process.env.API_VERSION || 'v1',
  baseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,

  database: {
    uri: process.env.MONGODB_URI,
    testUri: process.env.MONGODB_TEST_URI,
    options: {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },

  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    adminExpiresIn: process.env.JWT_ADMIN_EXPIRES_IN || '1h',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY,
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  },

  providers: {
    paystack: {
      secretKey: process.env.PAYSTACK_SECRET_KEY,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
      webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
      baseUrl: 'https://api.paystack.co',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    flutterwave: {
      secretKey: process.env.FLW_SECRET_KEY,
      publicKey: process.env.FLW_PUBLIC_KEY,
      encryptionKey: process.env.FLW_ENCRYPTION_KEY,
      webhookSecret: process.env.FLW_WEBHOOK_SECRET,
      baseUrl: 'https://api.flutterwave.com/v3',
    }
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@dzo-pay.com',
    secure: process.env.SMTP_SECURE === 'true',
  },

  sms: {
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    },
    termii: {
      apiKey: process.env.TERMII_API_KEY,
      senderId: process.env.TERMII_SENDER_ID || 'DZOPay',
    }
  },

  push: {
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  security: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION_MINUTES, 10) || 30,
  },

  webhook: {
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES, 10) || 5,
    retryDelayMs: parseInt(process.env.WEBHOOK_RETRY_DELAY_MS, 10) || 60000,
    timeoutMs: parseInt(process.env.WEBHOOK_TIMEOUT_MS, 10) || 30000,
  },

  features: {
    enableMFA: process.env.ENABLE_MFA === 'true',
    enableWebhookRetry: process.env.ENABLE_WEBHOOK_RETRY !== 'false',
    enableFraudDetection: process.env.ENABLE_FRAUD_DETECTION !== 'false',
    enableRealtimeNotifications: process.env.ENABLE_REALTIME_NOTIFICATIONS !== 'false',
    enableIpGeolocation: process.env.ENABLE_IP_GEOLOCATION !== 'false',
  },

  admin: {
    secretKey: process.env.ADMIN_SECRET_KEY,
    defaultEmail: process.env.ADMIN_DEFAULT_EMAIL,
    defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: process.env.LOG_MAX_FILES || '30',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
  },

  currency: {
    default: process.env.DEFAULT_CURRENCY || 'NGN',
    supported: (process.env.SUPPORTED_CURRENCIES || 'NGN,USD').split(','),
  },

  jobs: {
    otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10,
    archiveLogsDays: parseInt(process.env.ARCHIVE_LOGS_DAYS, 10) || 90,
    dailyReportHour: parseInt(process.env.DAILY_REPORT_HOUR, 10) || 2,
  }
};

module.exports = { config, validateEnv };
