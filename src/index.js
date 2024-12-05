const axios = require('axios');
require('dotenv').config();

class DarajaSDK {
  constructor(config) {
    this.consumerKey = config.consumerKey;
    this.consumerSecret = config.consumerSecret;
    this.environment = config.environment || 'sandbox';
    this.baseUrl = this.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
    this.auth = null;
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
      const password = Buffer.from(`${process.env.BUSINESS_SHORT_CODE}${process.env.PASS_KEY}${timestamp}`).toString('base64');

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        headers: {
          Authorization: `Bearer ${this.auth}`,
        },
        data: {
          BusinessShortCode: process.env.BUSINESS_SHORT_CODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phoneNumber,
          PartyB: process.env.BUSINESS_SHORT_CODE,
          PhoneNumber: phoneNumber,
          CallBackURL: process.env.CALLBACK_URL,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc,
        },
      });

      return response.data;
    } catch (error) {
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
          InitiatorName: process.env.INITIATOR_NAME,
          SecurityCredential: process.env.SECURITY_CREDENTIAL,
          CommandID: commandID || 'BusinessPayment',
          Amount: amount,
          PartyA: process.env.BUSINESS_SHORT_CODE,
          PartyB: phoneNumber,
          Remarks: remarks || 'B2C Payment',
          QueueTimeOutURL: process.env.TIMEOUT_URL,
          ResultURL: process.env.RESULT_URL,
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
          Initiator: process.env.INITIATOR_NAME,
          SecurityCredential: process.env.SECURITY_CREDENTIAL,
          CommandID: 'TransactionStatusQuery',
          TransactionID: transactionID,
          PartyA: process.env.BUSINESS_SHORT_CODE,
          IdentifierType: '4',
          ResultURL: process.env.RESULT_URL,
          QueueTimeOutURL: process.env.TIMEOUT_URL,
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
          Initiator: process.env.INITIATOR_NAME,
          SecurityCredential: process.env.SECURITY_CREDENTIAL,
          CommandID: 'AccountBalance',
          PartyA: process.env.BUSINESS_SHORT_CODE,
          IdentifierType: '4',
          Remarks: 'Account Balance Query',
          QueueTimeOutURL: process.env.TIMEOUT_URL,
          ResultURL: process.env.RESULT_URL,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Account balance query failed: ${error.message}`);
    }
  }
}

module.exports = DarajaSDK;
