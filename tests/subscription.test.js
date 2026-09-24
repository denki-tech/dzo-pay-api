const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let authToken;

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
});

describe('Subscription Endpoints', () => {
  describe('GET /api/v1/subscriptions/plans', () => {
    it('should get all plans', async () => {
      const res = await request(app).get('/api/v1/subscriptions/plans');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plans).toBeDefined();
      expect(res.body.data.plans.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/subscriptions', () => {
    it('should get current subscription', async () => {
      const res = await request(app)
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
