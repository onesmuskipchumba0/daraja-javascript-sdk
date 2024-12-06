const axios = require('axios');
require('dotenv').config();

class DarajaSDK {
  constructor(config = {}) {
    // Use environment variables by default, but allow override through config
    this.consumerKey = config.consumerKey || process.env.CONSUMER_KEY;
    this.consumerSecret = config.consumerSecret || process.env.CONSUMER_SECRET;
    this.environment = config.environment || process.env.ENVIRONMENT || 'sandbox';
    this.businessShortCode = config.businessShortCode || process.env.BUSINESS_SHORT_CODE;
    this.passKey = config.passKey || process.env.PASS_KEY;
    this.callbackUrl = config.callbackUrl || process.env.CALLBACK_URL;
    this.timeoutUrl = config.timeoutUrl || process.env.TIMEOUT_URL;
    this.resultUrl = config.resultUrl || process.env.RESULT_URL;
    this.initiatorName = config.initiatorName || process.env.INITIATOR_NAME;
    this.securityCredential = config.securityCredential || process.env.SECURITY_CREDENTIAL;

    // Validate required configurations
    this.validateConfig();

    this.baseUrl = this.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
    this.auth = null;
  }

  validateConfig() {
    const required = {
      'Consumer Key': this.consumerKey,
      'Consumer Secret': this.consumerSecret,
      'Business Short Code': this.businessShortCode,
      'Pass Key': this.passKey,
      'Callback URL': this.callbackUrl,
      'Initiator Name': this.initiatorName,
      'Security Credential': this.securityCredential
    };

    const missing = Object.entries(required)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}. Please provide them in .env file or in the constructor.`);
    }
  }

  async generateToken() {
    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await axios({
        method: 'get',
        url: `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });
      this.auth = response.data.access_token;
      return this.auth;
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  async stkPush({ phoneNumber, amount, accountReference, transactionDesc }) {
    try {
      if (!this.auth) await this.generateToken();

      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = Buffer.from(`${this.businessShortCode}${this.passKey}${timestamp}`).toString('base64');

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        headers: {
          Authorization: `Bearer ${this.auth}`,
        },
        data: {
          BusinessShortCode: this.businessShortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phoneNumber,
          PartyB: this.businessShortCode,
          PhoneNumber: phoneNumber,
          CallBackURL: this.callbackUrl,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc,
        },
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`STK push failed: ${error.response.data.errorMessage || error.message}`);
      }
      throw new Error(`STK push failed: ${error.message}`);
    }
  }

  async b2c({ amount, phoneNumber, commandID, remarks }) {
    try {
      if (!this.auth) await this.generateToken();

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/mpesa/b2c/v1/paymentrequest`,
        headers: {
          Authorization: `Bearer ${this.auth}`,
        },
        data: {
          InitiatorName: this.initiatorName,
          SecurityCredential: this.securityCredential,
          CommandID: commandID || 'BusinessPayment',
          Amount: amount,
          PartyA: this.businessShortCode,
          PartyB: phoneNumber,
          Remarks: remarks || 'B2C Payment',
          QueueTimeOutURL: this.timeoutUrl,
          ResultURL: this.resultUrl,
          Occasion: '',
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`B2C payment failed: ${error.message}`);
    }
  }

  async transactionStatus({ transactionID }) {
    try {
      if (!this.auth) await this.generateToken();

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/mpesa/transactionstatus/v1/query`,
        headers: {
          Authorization: `Bearer ${this.auth}`,
        },
        data: {
          Initiator: this.initiatorName,
          SecurityCredential: this.securityCredential,
          CommandID: 'TransactionStatusQuery',
          TransactionID: transactionID,
          PartyA: this.businessShortCode,
          IdentifierType: '4',
          ResultURL: this.resultUrl,
          QueueTimeOutURL: this.timeoutUrl,
          Remarks: 'Transaction Status Query',
          Occasion: '',
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Transaction status query failed: ${error.message}`);
    }
  }

  async accountBalance() {
    try {
      if (!this.auth) await this.generateToken();

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/mpesa/accountbalance/v1/query`,
        headers: {
          Authorization: `Bearer ${this.auth}`,
        },
        data: {
          Initiator: this.initiatorName,
          SecurityCredential: this.securityCredential,
          CommandID: 'AccountBalance',
          PartyA: this.businessShortCode,
          IdentifierType: '4',
          Remarks: 'Account Balance Query',
          QueueTimeOutURL: this.timeoutUrl,
          ResultURL: this.resultUrl,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Account balance query failed: ${error.message}`);
    }
  }
}

module.exports = DarajaSDK;
