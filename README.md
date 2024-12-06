# Daraja JavaScript SDK

A lightweight and easy-to-use JavaScript SDK for Safaricom's M-Pesa Daraja API.

## Features

- STK Push (Lipa Na M-Pesa Online)
- B2C Payment
- Transaction Status
- Account Balance Query
- Easy configuration via environment variables
- TypeScript support (coming soon)

## Installation

```bash
npm install daraja-javascript-sdk
```

## Configuration

The SDK can be configured either through environment variables or through the constructor. Using environment variables is recommended for better security and ease of use.

### Using Environment Variables (Recommended)

Create a `.env` file in your project root:

```env
# Required configurations
CONSUMER_KEY=your_consumer_key
CONSUMER_SECRET=your_consumer_secret
BUSINESS_SHORT_CODE=174379
PASS_KEY=your_pass_key
CALLBACK_URL=your_callback_url

# Optional configurations
ENVIRONMENT=sandbox  # or 'production'
TIMEOUT_URL=your_timeout_url
RESULT_URL=your_result_url
INITIATOR_NAME=your_initiator_name
SECURITY_CREDENTIAL=your_security_credential
```

Then initialize the SDK:

```javascript
const Daraja = require('daraja-javascript-sdk');
const daraja = new Daraja();  // Will use environment variables
```

### Manual Configuration

You can also provide configuration directly:

```javascript
const Daraja = require('daraja-javascript-sdk');

const daraja = new Daraja({
  consumerKey: 'your_consumer_key',
  consumerSecret: 'your_consumer_secret',
  environment: 'sandbox',  // or 'production'
  businessShortCode: '174379',
  passKey: 'your_pass_key',
  callbackUrl: 'your_callback_url'
});
```

## Usage

### STK Push

STK Push is a service that allows you to initiate a payment prompt on the customer's phone. The service will send a request to the user's phone, prompting them to enter their M-Pesa PIN to authorize the transaction.

```javascript
// Basic STK Push
try {
  const response = await daraja.stkPush({
    phoneNumber: '254712345678',  // Phone number to prompt for payment
    amount: 1,                    // Amount to charge
    accountReference: 'TEST',     // Your reference for the transaction
    transactionDesc: 'Test Payment'
  });
  
  console.log('STK Push Response:', response);
  // Response includes CheckoutRequestID for tracking the transaction
} catch (error) {
  console.error('STK Push Error:', error);
}
```

### Handling Callbacks

Set up an Express server to handle M-Pesa callbacks:

```javascript
const express = require('express');
const app = express();

// Parse JSON bodies
app.use(express.json());

// M-Pesa callback endpoint
app.post('/mpesa/callback', (req, res) => {
  const { Body } = req.body;
  
  if (Body.stkCallback) {
    const { ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;
    
    if (ResultCode === 0) {
      // Payment successful
      const metadata = CallbackMetadata.Item.reduce((acc, item) => {
        acc[item.Name] = item.Value;
        return acc;
      }, {});
      
      console.log('Payment successful:', metadata);
    } else {
      // Payment failed
      console.log('Payment failed:', ResultDesc);
    }
  }
  
  // Always respond to M-Pesa
  res.json({
    ResultCode: 0,
    ResultDesc: "Success"
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### B2C Payment

Send money from your business to customers:

```javascript
try {
  const response = await daraja.b2c({
    amount: 100,
    phoneNumber: '254712345678',
    commandID: 'BusinessPayment',  // or 'SalaryPayment', 'PromotionPayment'
    remarks: 'Refund'
  });
  
  console.log('B2C Response:', response);
} catch (error) {
  console.error('B2C Error:', error);
}
```

### Transaction Status

Check the status of a transaction:

```javascript
try {
  const response = await daraja.transactionStatus({
    transactionID: 'TRANSACTION_ID'
  });
  
  console.log('Status:', response);
} catch (error) {
  console.error('Status Check Error:', error);
}
```

### Account Balance

Query your M-Pesa account balance:

```javascript
try {
  const response = await daraja.accountBalance();
  console.log('Balance:', response);
} catch (error) {
  console.error('Balance Query Error:', error);
}
```

## Testing

For testing purposes, use these sandbox credentials:

- Business Shortcode: 174379
- Pass Key: bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919

## Development

To contribute or modify the SDK:

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your test credentials
4. Run tests: `npm test`

## License

MIT

## Support

For support, please raise an issue in the GitHub repository or contact the maintainers.
