const nock = require('nock');
const DarajaSDK = require('../src/index');

describe('DarajaSDK', () => {
  let daraja;

  beforeEach(() => {
    daraja = new DarajaSDK({
      consumerKey: process.env.CONSUMER_KEY,
      consumerSecret: process.env.CONSUMER_SECRET,
      environment: 'sandbox'
    });

    // Clear all HTTP mocks
    nock.cleanAll();
  });

  describe('generateToken', () => {
    it('should generate an access token successfully', async () => {
      const mockToken = 'test_access_token';
      
      nock('https://sandbox.safaricom.co.ke')
        .get('/oauth/v1/generate')
        .query({ grant_type: 'client_credentials' })
        .reply(200, {
          access_token: mockToken,
          expires_in: '3599'
        });

      const token = await daraja.generateToken();
      expect(token).toBe(mockToken);
    });

    it('should throw error when token generation fails', async () => {
      nock('https://sandbox.safaricom.co.ke')
        .get('/oauth/v1/generate')
        .query({ grant_type: 'client_credentials' })
        .reply(401, {
          errorMessage: 'Invalid credentials'
        });

      await expect(daraja.generateToken()).rejects.toThrow('Token generation failed');
    });
  });

  describe('stkPush', () => {
    beforeEach(() => {
      // Mock token generation
      nock('https://sandbox.safaricom.co.ke')
        .get('/oauth/v1/generate')
        .query({ grant_type: 'client_credentials' })
        .reply(200, {
          access_token: 'test_access_token',
          expires_in: '3599'
        });
    });

    it('should initiate STK push successfully', async () => {
      const mockResponse = {
        MerchantRequestID: '29115-34620561-1',
        CheckoutRequestID: 'ws_CO_191220191020363925',
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        CustomerMessage: 'Success. Request accepted for processing'
      };

      nock('https://sandbox.safaricom.co.ke')
        .post('/mpesa/stkpush/v1/processrequest')
        .reply(200, mockResponse);

      const response = await daraja.stkPush({
        phoneNumber: '254712345678',
        amount: 1,
        accountReference: 'TEST001',
        transactionDesc: 'Test Payment'
      });

      expect(response).toEqual(mockResponse);
    });

    it('should throw error when STK push fails', async () => {
      nock('https://sandbox.safaricom.co.ke')
        .post('/mpesa/stkpush/v1/processrequest')
        .reply(400, {
          errorMessage: 'Invalid phone number'
        });

      await expect(daraja.stkPush({
        phoneNumber: 'invalid',
        amount: 1,
        accountReference: 'TEST001',
        transactionDesc: 'Test Payment'
      })).rejects.toThrow('STK push failed');
    });
  });

  describe('b2c', () => {
    beforeEach(() => {
      // Mock token generation
      nock('https://sandbox.safaricom.co.ke')
        .get('/oauth/v1/generate')
        .query({ grant_type: 'client_credentials' })
        .reply(200, {
          access_token: 'test_access_token',
          expires_in: '3599'
        });
    });

    it('should process B2C payment successfully', async () => {
      const mockResponse = {
        ConversationID: 'AG_20191219_00004492b3bd98323285',
        OriginatorConversationID: '10571-7910404-1',
        ResponseCode: '0',
        ResponseDescription: 'Accept the service request successfully.'
      };

      nock('https://sandbox.safaricom.co.ke')
        .post('/mpesa/b2c/v1/paymentrequest')
        .reply(200, mockResponse);

      const response = await daraja.b2c({
        amount: 100,
        phoneNumber: '254712345678',
        commandID: 'BusinessPayment',
        remarks: 'Test Payment'
      });

      expect(response).toEqual(mockResponse);
    });
  });

  describe('transactionStatus', () => {
    beforeEach(() => {
      // Mock token generation
      nock('https://sandbox.safaricom.co.ke')
        .get('/oauth/v1/generate')
        .query({ grant_type: 'client_credentials' })
        .reply(200, {
          access_token: 'test_access_token',
          expires_in: '3599'
        });
    });

    it('should check transaction status successfully', async () => {
      const mockResponse = {
        ResponseCode: '0',
        ResponseDescription: 'Success',
        OriginatorConversationID: '10571-7910404-1',
        ConversationID: 'AG_20191219_00004492b3bd98323285',
        TransactionStatus: 'Completed'
      };

      nock('https://sandbox.safaricom.co.ke')
        .post('/mpesa/transactionstatus/v1/query')
        .reply(200, mockResponse);

      const response = await daraja.transactionStatus({
        transactionID: 'OGR5100KTO'
      });

      expect(response).toEqual(mockResponse);
    });
  });

  describe('accountBalance', () => {
    beforeEach(() => {
      // Mock token generation
      nock('https://sandbox.safaricom.co.ke')
        .get('/oauth/v1/generate')
        .query({ grant_type: 'client_credentials' })
        .reply(200, {
          access_token: 'test_access_token',
          expires_in: '3599'
        });
    });

    it('should check account balance successfully', async () => {
      const mockResponse = {
        ResponseCode: '0',
        ResponseDescription: 'Success',
        OriginatorConversationID: '10571-7910404-1',
        ConversationID: 'AG_20191219_00004492b3bd98323285'
      };

      nock('https://sandbox.safaricom.co.ke')
        .post('/mpesa/accountbalance/v1/query')
        .reply(200, mockResponse);

      const response = await daraja.accountBalance();
      expect(response).toEqual(mockResponse);
    });
  });
});
