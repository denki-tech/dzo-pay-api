const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let authToken;
let userId;
let walletId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Wallet.deleteMany({});
  await Transaction.deleteMany({});

  // Register and login user
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: 'test@example.com',
      password: 'Test@123456',
      firstName: 'John',
      lastName: 'Doe',
      plan: 'free',
    });

  authToken = registerRes.body.data.tokens.accessToken;
  userId = registerRes.body.data.user.id;
  walletId = registerRes.body.data.wallet.id;
});

describe('Payment Endpoints', () => {
  describe('POST /api/v1/payments/initialize', () => {
    it('should initialize a payment', async () => {
      const res = await request(app)
        .post('/api/v1/payments/initialize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'NGN',
          description: 'Test payment',
          provider: 'paystack',
          walletId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction).toBeDefined();
      expect(res.body.data.checkoutUrl).toBeDefined();
    });

    it('should fail with invalid amount', async () => {
      const res = await request(app)
        .post('/api/v1/payments/initialize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50,
          currency: 'NGN',
          description: 'Test payment',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/payments/links', () => {
    it('should create a payment link', async () => {
      const res = await request(app)
        .post('/api/v1/payments/links')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Link',
          amount: 1000,
          currency: 'NGN',
          description: 'Test payment link',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentLink).toBeDefined();
      expect(res.body.data.paymentLink.url).toBeDefined();
    });
  });

  describe('GET /api/v1/payments/history', () => {
    it('should get transaction history', async () => {
      const res = await request(app)
        .get('/api/v1/payments/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transactions).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
    });
  });
});
