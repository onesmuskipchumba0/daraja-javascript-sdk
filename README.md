# Daraja JavaScript SDK

A lightweight and easy-to-use JavaScript SDK for Safaricom's M-Pesa Daraja API. This SDK simplifies the integration of M-Pesa payment services into your JavaScript applications, providing a clean and intuitive interface for all Daraja API endpoints.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
  - [Initialization](#initialization)
  - [STK Push](#stk-push)
  - [B2C Payment](#b2c-payment)
  - [C2B Registration](#c2b-registration)
  - [Transaction Status](#transaction-status)
  - [Account Balance](#account-balance)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🔐 OAuth Token Generation & Management
- 💰 STK Push (Lipa Na M-Pesa Online)
- 💸 B2C Payment (Business to Customer)
- 🏪 C2B Registration and Payment (Customer to Business)
- 📊 Transaction Status Query
- 💼 Account Balance Query
- ⚡ Promise-based API
- 🔄 Automatic token refresh
- 🛡️ Built-in error handling
- 📝 Comprehensive logging

## Prerequisites

Before using this SDK, ensure you have:

1. Node.js v12 or later installed
2. M-Pesa Daraja API credentials from Safaricom
   - Consumer Key
   - Consumer Secret
   - Business Short Code
   - Pass Key (for STK Push)
3. Registered callback URLs for receiving payment notifications

## Installation

```bash
# Using npm
npm install daraja-javascript-sdk

# Using yarn
yarn add daraja-javascript-sdk
```

## Configuration

1. Create a `.env` file in your project root:

```env
# API Credentials
CONSUMER_KEY=your_consumer_key
CONSUMER_SECRET=your_consumer_secret
ENVIRONMENT=sandbox  # or production

# Business Configuration
BUSINESS_SHORT_CODE=174379
PASS_KEY=your_pass_key
INITIATOR_NAME=your_initiator_name
SECURITY_CREDENTIAL=your_security_credential

# Callback URLs
CALLBACK_URL=https://example.com/callback
TIMEOUT_URL=https://example.com/timeout
RESULT_URL=https://example.com/result
```

2. Initialize the SDK:

```javascript
const DarajaSDK = require('daraja-javascript-sdk');

const daraja = new DarajaSDK({
  consumerKey: process.env.CONSUMER_KEY,
  consumerSecret: process.env.CONSUMER_SECRET,
  environment: process.env.ENVIRONMENT
});
```

## Usage Examples

### Initialization

```javascript
// CommonJS
const DarajaSDK = require('daraja-javascript-sdk');

// ES Modules
import DarajaSDK from 'daraja-javascript-sdk';

// Initialize with options
const daraja = new DarajaSDK({
  consumerKey: 'your_consumer_key',
  consumerSecret: 'your_consumer_secret',
  environment: 'sandbox', // or 'production'
  // Optional configurations
  logging: true,
  timeout: 30000 // 30 seconds
});
```
### STK Push

STK Push is a service that allows you to request a user to enter a PIN and authenticate a transaction. It is commonly used for online transactions.

The service is ideal for situations where you want to request a user to make a payment online. For example, you can use it to process a payment for an e-commerce transaction.

The service will send a request to the user's phone, prompting them to enter a PIN and authenticate the transaction. Once the user has successfully entered their PIN, the service will send a response back to your application, confirming that the transaction was successful.

Here is an example of how you can use the SDK to initiate a STK Push:
```javascript
// Basic STK Push
try { 
  const response = await daraja.stkPush({
    phoneNumber: '254712345678',
    amount: 1,
    accountReference: 'TEST001',
    transactionDesc: 'Test Payment'
  });
  console.log('STK Push Response:', response);
} catch (error) {
  console.error('STK Push Error:', error);
}
// Advanced STK Push with all options
const stkOptions = {
  phoneNumber: '254712345678',
  amount: 1,
  accountReference: 'TEST001',
  transactionDesc: 'Test Payment',
  callbackUrl: 'https://example.com/callback', // Override default callback
  transactionType: 'CustomerPayBillOnline', // or CustomerBuyGoodsOnline
  metadata: {
    orderId: '12345',
    customerId: 'CUS001'
  }
};

const stkResponse = await daraja.stkPush(stkOptions);
```

### B2C Payment

Send money from your business to customers.

```javascript
// Basic B2C Payment
try {
  const response = await daraja.b2c({
    amount: 100,
    phoneNumber: '254712345678',
    commandID: 'BusinessPayment',
    remarks: 'Salary Payment'
  });
  console.log('B2C Response:', response);
} catch (error) {
  console.error('B2C Error:', error);
}

// Different B2C Command Types
const salaryPayment = await daraja.b2c({
  amount: 5000,
  phoneNumber: '254712345678',
  commandID: 'SalaryPayment',
  remarks: 'December Salary'
});

const promotionPayment = await daraja.b2c({
  amount: 1000,
  phoneNumber: '254712345678',
  commandID: 'PromotionPayment',
  remarks: 'Competition Winner'
});
```

### Transaction Status

Query the status of a transaction.

```javascript
// Basic Transaction Status Query
try {
  const status = await daraja.transactionStatus({
    transactionID: 'OGR5100KTO'
  });
  console.log('Transaction Status:', status);
} catch (error) {
  console.error('Status Query Error:', error);
}

// With additional parameters
const detailedStatus = await daraja.transactionStatus({
  transactionID: 'OGR5100KTO',
  remarks: 'Status check',
  occasion: 'Payment verification'
});
```

### Account Balance

Query your M-Pesa account balance.

```javascript
// Basic Balance Query
try {
  const balance = await daraja.accountBalance();
  console.log('Account Balance:', balance);
} catch (error) {
  console.error('Balance Query Error:', error);
}

// With specific identifier type
const detailedBalance = await daraja.accountBalance({
  identifierType: '4', // 1: MSISDN, 2: Till Number, 4: Organization Short Code
  remarks: 'Monthly balance check'
});
```

## Error Handling

The SDK uses custom error classes for better error handling:

```javascript
try {
  const response = await daraja.stkPush(options);
} catch (error) {
  if (error instanceof daraja.AuthenticationError) {
    // Handle authentication errors
    console.error('Authentication failed:', error.message);
  } else if (error instanceof daraja.ValidationError) {
    // Handle validation errors
    console.error('Invalid parameters:', error.details);
  } else if (error instanceof daraja.APIError) {
    // Handle API-specific errors
    console.error('API Error:', error.code, error.message);
  } else {
    // Handle other errors
    console.error('Unknown error:', error);
  }
}
```

## Best Practices

1. **Environment Variables**
   - Always use environment variables for sensitive credentials
   - Never commit `.env` files to version control

2. **Error Handling**
   - Always wrap API calls in try-catch blocks
   - Implement proper error logging
   - Handle different types of errors appropriately

3. **Callback URLs**
   - Use HTTPS for callback URLs
   - Implement proper validation in your callbacks
   - Handle timeout scenarios

4. **Testing**
   - Always test in sandbox environment first
   - Implement proper unit tests
   - Test edge cases and error scenarios

## Testing

The SDK includes a comprehensive test suite:

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "STK Push"

# Run tests with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@example.com or open an issue in the GitHub repository.
