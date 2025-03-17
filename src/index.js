const axios = require('axios');
require('dotenv').config();

/**
 * DarajaSDK - A class for interacting with the Safaricom M-Pesa Daraja API
 * @class
 */
class DarajaSDK {
  /**
   * Create a new DarajaSDK instance
   * @param {Object} config - Configuration options
   * @param {string} [config.consumerKey] - The consumer key from the Daraja API
   * @param {string} [config.consumerSecret] - The consumer secret from the Daraja API
   * @param {string} [config.environment='sandbox'] - The API environment ('sandbox' or 'production')
   * @param {string} [config.businessShortCode] - The business short code (till/paybill number)
   * @param {string} [config.passKey] - The pass key for generating security credentials
   * @param {string} [config.callbackUrl] - The URL where M-Pesa will send payment notifications
   * @param {string} [config.timeoutUrl] - The URL where M-Pesa will send timeout notifications
   * @param {string} [config.resultUrl] - The URL where M-Pesa will send results
   * @param {string} [config.initiatorName] - The name of the initiator for B2B/B2C transactions
   * @param {string} [config.securityCredential] - The security credential for B2B/B2C transactions
   */
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

  /**
   * Validates required configuration parameters
   * @private
   * @throws {Error} If required configuration is missing
   */
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

  /**
   * Generates an OAuth access token for API authentication
   * @async
   * @returns {Promise<string>} The generated access token
   * @throws {Error} If token generation fails
   */
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

  /**
   * Initiates an STK push request to customer's phone
   * @async
   * @param {Object} params - STK push parameters
   * @param {string} params.phoneNumber - Customer's phone number (254XXXXXXXXX)
   * @param {number} params.amount - Amount to charge
   * @param {string} params.accountReference - Reference for the transaction
   * @param {string} params.transactionDesc - Description of the transaction
   * @returns {Promise<Object>} STK push response
   * @throws {Error} If STK push fails
   */
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

  /**
   * Sends money from business to customer (B2C)
   * @async
   * @param {Object} params - B2C parameters
   * @param {number} params.amount - Amount to send
   * @param {string} params.phoneNumber - Recipient's phone number
   * @param {string} [params.commandID='BusinessPayment'] - Type of B2C payment
   * @param {string} [params.remarks] - Additional remarks
   * @returns {Promise<Object>} B2C response
   * @throws {Error} If B2C payment fails
   */
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

  /**
   * Checks the status of an M-Pesa transaction
   * @async
   * @param {Object} params - Transaction status parameters
   * @param {string} params.transactionID - M-Pesa transaction ID
   * @returns {Promise<Object>} Transaction status response
   * @throws {Error} If status check fails
   */
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

  /**
   * Queries the account balance
   * @async
   * @returns {Promise<Object>} Account balance response
   * @throws {Error} If balance query fails
   */
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

  /**
   * Registers URLs for C2B payment notifications
   * @async
   * @param {Object} params - URL registration parameters
   * @param {string} [params.shortCode] - Business short code
   * @param {string} [params.responseType='Completed'] - Response type
   * @param {string} [params.confirmationUrl] - Confirmation URL
   * @param {string} [params.validationUrl] - Validation URL
   * @returns {Promise<Object>} URL registration response
   * @throws {Error} If URL registration fails
   */
  async c2bRegisterUrl({ shortCode, responseType, confirmationUrl, validationUrl }) {
    try {
      if (!this.auth) await this.generateToken();

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/mpesa/c2b/v1/registerurl`,
        headers: {
          Authorization: `Bearer ${this.auth}`,
        },
        data: {
          ShortCode: shortCode || this.businessShortCode,
          ResponseType: responseType || 'Completed',
          ConfirmationURL: confirmationUrl || this.callbackUrl,
          ValidationURL: validationUrl || this.callbackUrl
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`C2B URL registration failed: ${error.message}`);
    }
  }

  /**
   * Simulates a C2B payment (only works in sandbox)
   * @async
   * @param {Object} params - C2B simulation parameters
   * @param {number} params.amount - Amount to simulate
   * @param {string} params.phoneNumber - Phone number making payment
   * @param {string} params.billRefNumber - Bill reference number
   * @returns {Promise<Object>} C2B simulation response
   * @throws {Error} If simulation fails
   */
  async c2bSimulate({ amount, phoneNumber, billRefNumber }) {
    try {
      if (!this.auth) await this.generateToken();

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/mpesa/c2b/v1/simulate`,
        headers: {
          Authorization: `Bearer ${this.auth}`,
        },
        data: {
          ShortCode: this.businessShortCode,
          CommandID: 'CustomerPayBillOnline',
          Amount: amount,
          Msisdn: phoneNumber,
          BillRefNumber: billRefNumber
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`C2B simulation failed: ${error.message}`);
    }
  }

  /**
   * Initiates a Business to Business payment
   * @async
   * @param {Object} params - B2B parameters
   * @param {number} params.amount - Amount to transfer
   * @param {string} params.receiverShortCode - Recipient's short code
   * @param {string} [params.commandID='BusinessToBusinessTransfer'] - Type of B2B payment
   * @param {string} [params.remarks] - Additional remarks
   * @returns {Promise<Object>} B2B response
   * @throws {Error} If B2B payment fails
   */
  async b2b({ amount, receiverShortCode, commandID = 'BusinessToBusinessTransfer', remarks }) {
    try {
      if (!this.auth) await this.generateToken();

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/mpesa/b2b/v1/paymentrequest`,
        headers: {
          Authorization: `Bearer ${this.auth}`,
        },
        data: {
          Initiator: this.initiatorName,
          SecurityCredential: this.securityCredential,
          CommandID: commandID,
          SenderIdentifierType: '4',
          RecieverIdentifierType: '4',
          Amount: amount,
          PartyA: this.businessShortCode,
          PartyB: receiverShortCode,
          AccountReference: 'B2B Payment',
          Remarks: remarks || 'B2B Transfer',
          QueueTimeOutURL: this.timeoutUrl,
          ResultURL: this.resultUrl
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`B2B payment failed: ${error.message}`);
    }
  }

  /**
   * Reverses an M-Pesa transaction
   * @async
   * @param {Object} params - Reversal parameters
   * @param {string} params.transactionID - Transaction to reverse
   * @param {number} params.amount - Amount to reverse
   * @param {string} [params.remarks] - Reversal remarks
   * @returns {Promise<Object>} Reversal response
   * @throws {Error} If reversal fails
   */
  async reversal({ transactionID, amount, remarks }) {
    try {
      if (!this.auth) await this.generateToken();

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/mpesa/reversal/v1/request`,
        headers: {
          Authorization: `Bearer ${this.auth}`,
        },
        data: {
          Initiator: this.initiatorName,
          SecurityCredential: this.securityCredential,
          CommandID: 'TransactionReversal',
          TransactionID: transactionID,
          Amount: amount,
          ReceiverParty: this.businessShortCode,
          RecieverIdentifierType: '11',
          ResultURL: this.resultUrl,
          QueueTimeOutURL: this.timeoutUrl,
          Remarks: remarks || 'Transaction Reversal',
          Occasion: ''
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Transaction reversal failed: ${error.message}`);
    }
  }

  /**
   * Checks the status of an STK push request
   * @async
   * @param {Object} params - Query parameters
   * @param {string} params.checkoutRequestId - Checkout request ID
   * @returns {Promise<Object>} STK query response
   * @throws {Error} If query fails
   */
  async stkPushQuery({ checkoutRequestId }) {
    try {
      if (!this.auth) await this.generateToken();

      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = Buffer.from(`${this.businessShortCode}${this.passKey}${timestamp}`).toString('base64');

      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        headers: {
          Authorization: `Bearer ${this.auth}`,
        },
        data: {
          BusinessShortCode: this.businessShortCode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`STK push query failed: ${error.message}`);
    }
  }
}

module.exports = DarajaSDK;
