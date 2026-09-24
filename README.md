# D-ZO Pay - Production-Grade Fintech Payment API

A comprehensive, production-ready Node.js/Express backend for fintech operations featuring multi-provider payments, virtual wallets, subscription management, fraud detection, and advanced admin analytics.

## Features

### Core Payment Features
- **Multi-Provider Payments**: Paystack, Stripe, Flutterwave with unified abstraction
- **Virtual Wallets**: Unique 10-digit virtual account numbers per wallet
- **Internal Transfers**: P2P transfers between platform wallets
- **Payment Links**: Generate shareable payment links
- **Idempotency**: All payment operations are idempotent

### Security & Authentication
- **JWT Authentication**: Access and refresh tokens
- **API Key Authentication**: Per-user unique API keys
- **Rate Limiting**: Plan-based rate limits
- **MFA/OTP**: Optional multi-factor authentication
- **Fraud Detection**: Real-time transaction scoring
- **Audit Logging**: Complete audit trail for all actions

### Notifications
- **Email**: Nodemailer with HTML templates
- **SMS**: Twilio/Termii integration
- **Push Notifications**: Firebase Cloud Messaging
- **In-App Notifications**: Real-time notification feed

### Admin & Analytics
- **Dashboard Analytics**: Users, transactions, revenue metrics
- **User Management**: Activate/suspend, impersonation
- **Audit Viewer**: Filterable audit logs
- **Webhook Monitoring**: Delivery status and retry queue
- **Feature Flags**: Runtime feature toggles

### Infrastructure
- **Dockerized**: MongoDB + Redis + App containers
- **Queue System**: BullMQ for background jobs
- **Health Checks**: Comprehensive health monitoring
- **Logging**: Winston with rotation
- **Testing**: Jest + Supertest coverage

## Quick Start

### Prerequisites
- Node.js >= 18
- Docker & Docker Compose
- MongoDB
- Redis

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd payment-api

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Start with Docker
docker-compose up -d

# Or start services manually
npm run dev
```

### Environment Variables

Key variables to configure:
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `PAYSTACK_SECRET_KEY` - Paystack secret
- `STRIPE_SECRET_KEY` - Stripe secret
- `FLW_SECRET_KEY` - Flutterwave secret
- `SMTP_USER` / `SMTP_PASS` - Email credentials

## API Documentation

### Authentication
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/mfa/verify
```

### Payments
```
POST /api/v1/payments/initialize
POST /api/v1/payments/verify/:reference
POST /api/v1/payments/links
GET  /api/v1/payments/history
```

### Wallets
```
GET  /api/v1/wallets
POST /api/v1/wallets
POST /api/v1/wallets/transfer
GET  /api/v1/wallets/transactions
```

### Admin
```
GET  /api/v1/admin/users
GET  /api/v1/admin/users/:id
POST /api/v1/admin/users/:id/status
GET  /api/v1/admin/analytics
GET  /api/v1/admin/audit-logs
GET  /api/v1/admin/webhook-logs
```

### Health
```
GET /api/v1/health
GET /api/v1/health/detailed
```

## Architecture

```
payment-api/
├── config/         # Database, Redis, Logger, Provider configs
├── controllers/    # Request handlers
├── services/       # Business logic
├── models/         # Mongoose schemas
├── routes/         # API route definitions
├── middleware/     # Auth, validation, rate limiting
├── validators/     # Input validation schemas
├── utils/          # Helpers and generators
├── queues/         # BullMQ queue definitions
├── jobs/           # Background job processors
├── docs/           # Swagger & Postman docs
└── tests/          # Test suites
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- auth.test.js
```

## Background Jobs

Jobs run via the job runner container:
- **Retry Failed Webhooks**: Every 5 minutes
- **Cleanup Expired OTPs**: Every hour
- **Generate Daily Reports**: Daily at 2 AM
- **Archive Old Logs**: Weekly

## License

MIT License - D-ZO Pay Team

## Support

For issues and feature requests, please open an issue on the repository.
