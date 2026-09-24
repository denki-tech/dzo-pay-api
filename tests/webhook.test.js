const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Webhook Endpoints', () => {
  describe('POST /api/v1/webhooks/paystack', () => {
    it('should handle paystack webhook', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/paystack')
        .send({
          event: 'charge.success',
          data: {
            reference: 'PAY_test123',
            status: 'success',
            amount: 500000,
            customer: { email: 'test@example.com' },
          },
        });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('ok');
    });

    it('should return detailed health status', async () => {
      const res = await request(app).get('/api/v1/health/detailed');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.services).toBeDefined();
    });
  });
});
