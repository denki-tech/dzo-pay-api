const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
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

describe('Wallet Endpoints', () => {
  describe('GET /api/v1/wallets', () => {
    it('should get user wallets', async () => {
      const res = await request(app)
        .get('/api/v1/wallets')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.wallets).toBeDefined();
      expect(res.body.data.wallets.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/wallets/:walletId', () => {
    it('should get wallet details', async () => {
      const res = await request(app)
        .get(`/api/v1/wallets/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.wallet).toBeDefined();
    });

    it('should fail with invalid wallet ID', async () => {
      const res = await request(app)
        .get('/api/v1/wallets/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/wallets', () => {
    it('should fail to create wallet for free plan (limit reached)', async () => {
      const res = await request(app)
        .post('/api/v1/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Second Wallet',
          currency: 'NGN',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
