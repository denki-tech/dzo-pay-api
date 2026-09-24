const axios = require('axios');
const { config } = require('./env');
const logger = require('./logger');

class PaystackClient {
  constructor() {
    this.client = axios.create({
      baseURL: config.providers.paystack.baseUrl,
      headers: {
        Authorization: `Bearer ${config.providers.paystack.secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (request) => {
        logger.debug('Paystack API Request', {
          method: request.method,
          url: request.url,
        });
        return request;
      },
      (error) => {
        logger.error('Paystack API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Paystack API Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('Paystack API Response Error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  async initializeTransaction(data) {
    try {
      const response = await this.client.post('/transaction/initialize', {
        email: data.email,
        amount: data.amount * 100, // Paystack uses kobo/cents
        reference: data.reference,
        callback_url: data.callbackUrl,
        metadata: data.metadata,
        channels: data.channels || ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      });
      return response.data;
    } catch (error) {
      throw new Error(`Paystack initialization failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async verifyTransaction(reference) {
    try {
      const response = await this.client.get(`/transaction/verify/${reference}`);
      return response.data;
    } catch (error) {
      throw new Error(`Paystack verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async createTransferRecipient(data) {
    try {
      const response = await this.client.post('/transferrecipient', {
        type: data.type || 'nuban',
        name: data.name,
        account_number: data.accountNumber,
        bank_code: data.bankCode,
        currency: data.currency || 'NGN',
      });
      return response.data;
    } catch (error) {
      throw new Error(`Paystack recipient creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async initiateTransfer(data) {
    try {
      const response = await this.client.post('/transfer', {
        source: data.source || 'balance',
        reason: data.reason,
        amount: data.amount * 100,
        recipient: data.recipient,
        reference: data.reference,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Paystack transfer failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async resolveAccount(accountNumber, bankCode) {
    try {
      const response = await this.client.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
      return response.data;
    } catch (error) {
      throw new Error(`Account resolution failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async listBanks(country = 'nigeria') {
    try {
      const response = await this.client.get(`/bank?country=${country}`);
      return response.data;
    } catch (error) {
      throw new Error(`Bank list fetch failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async createVirtualAccount(data) {
    try {
      const response = await this.client.post('/dedicated_account', {
        customer: data.customerCode,
        preferred_bank: data.preferredBank || 'wema-bank',
      });
      return response.data;
    } catch (error) {
      throw new Error(`Virtual account creation failed: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = new PaystackClient();
