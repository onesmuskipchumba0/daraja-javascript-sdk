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

### Handling M-Pesa Callbacks

### Basic Callback Setup

Here's a simple Express.js server to handle M-Pesa payment notifications:

```javascript
const express = require('express');
const app = express();

// Allow JSON requests
app.use(express.json());

// Handle M-Pesa payments
app.post('/mpesa/callback', (req, res) => {
  // Get the payment details
  const { Body } = req.body;
  
  if (Body.stkCallback) {
    // Check if payment was successful
    if (Body.stkCallback.ResultCode === 0) {
      // Get payment details
      const items = Body.stkCallback.CallbackMetadata.Item;
      const amount = items.find(item => item.Name === 'Amount').Value;
      const mpesaReceipt = items.find(item => item.Name === 'MpesaReceiptNumber').Value;
      const phoneNumber = items.find(item => item.Name === 'PhoneNumber').Value;
      
      console.log('Payment Received!');
      console.log('Amount:', amount);
      console.log('Receipt Number:', mpesaReceipt);
      console.log('Phone Number:', phoneNumber);
      
      // TODO: Update your database
      // TODO: Send confirmation to customer
      
    } else {
      // Payment failed
      console.log('Payment failed:', Body.stkCallback.ResultDesc);
    }
  }
  
  // Always respond to M-Pesa
  res.json({ ResultCode: 0, ResultDesc: "Success" });
});

// Start server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
```

### Checking Payment Status

Simple way to check if a payment was successful:

```javascript
const Daraja = require('daraja-javascript-sdk');
const daraja = new Daraja();

// Check payment status
async function checkPayment(checkoutRequestId) {
  try {
    const result = await daraja.stkPushQuery({
      checkoutRequestId: checkoutRequestId
    });
    
    if (result.ResultCode === 0) {
      console.log('Payment was successful!');
    } else {
      console.log('Payment failed or pending');
    }
  } catch (error) {
    console.log('Error checking payment:', error.message);
  }
}
```

### Complete Example

Here's a complete example showing how to:
1. Start a payment
2. Save payment details
3. Handle the callback

```javascript
const express = require('express');
const Daraja = require('daraja-javascript-sdk');

const app = express();
app.use(express.json());

// Store payments in memory (use a database in production)
const payments = [];

// Initialize Daraja
const daraja = new Daraja();

// Start payment
app.post('/pay', async (req, res) => {
  try {
    const { phone, amount } = req.body;
    
    // Start STK Push
    const result = await daraja.stkPush({
      phoneNumber: phone,
      amount: amount,
      accountReference: 'Test',
      transactionDesc: 'Test Payment'
    });
    
    // Save payment details
    payments.push({
      checkoutRequestId: result.CheckoutRequestID,
      amount: amount,
      phone: phone,
      status: 'pending'
    });
    
    res.json({ 
      message: 'Payment started',
      checkoutRequestId: result.CheckoutRequestID
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Handle M-Pesa callback
app.post('/mpesa/callback', (req, res) => {
  const { Body } = req.body;
  
  if (Body.stkCallback) {
    const { ResultCode, ResultDesc, CheckoutRequestID } = Body.stkCallback;
    
    // Find the payment
    const payment = payments.find(p => p.checkoutRequestId === CheckoutRequestID);
    if (payment) {
      if (ResultCode === 0) {
        // Payment successful
        const items = Body.stkCallback.CallbackMetadata.Item;
        payment.status = 'completed';
        payment.mpesaReceipt = items.find(item => item.Name === 'MpesaReceiptNumber').Value;
        
        console.log('Payment completed:', payment);
      } else {
        // Payment failed
        payment.status = 'failed';
        payment.error = ResultDesc;
        
        console.log('Payment failed:', ResultDesc);
      }
    }
  }
  
  res.json({ ResultCode: 0, ResultDesc: "Success" });
});

// Check payment status
app.get('/status/:checkoutRequestId', async (req, res) => {
  const { checkoutRequestId } = req.params;
  
  // Find payment in our records
  const payment = payments.find(p => p.checkoutRequestId === checkoutRequestId);
  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  
  res.json({ payment });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Usage

1. Start a payment:
```bash
curl -X POST http://localhost:3000/pay \
  -H "Content-Type: application/json" \
  -d '{"phone": "254712345678", "amount": 1}'
```

2. Check payment status:
```bash
curl http://localhost:3000/status/ws_CO_123456789
```

Remember:
- Use HTTPS in production
- Store payments in a real database
- Add proper error handling
- Keep your API keys secure

### Best Practices

1. **Store Payment Details**: Always save payment information in your database:
```javascript
// Example with MongoDB
const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  transactionId: String,
  amount: Number,
  phoneNumber: String,
  status: String,
  mpesaReceiptNumber: String,
  transactionDate: Date
});

const Payment = mongoose.model('Payment', PaymentSchema);

// In your callback handler
app.post('/mpesa/callback', async (req, res) => {
  const { Body: { stkCallback } } = req.body;
  
  if (stkCallback.ResultCode === 0) {
    const paymentData = stkCallback.CallbackMetadata.Item.reduce((acc, item) => {
      acc[item.Name] = item.Value;
      return acc;
    }, {});
    
    try {
      await Payment.create({
        transactionId: stkCallback.CheckoutRequestID,
        amount: paymentData.Amount,
        phoneNumber: paymentData.PhoneNumber,
        status: 'SUCCESS',
        mpesaReceiptNumber: paymentData.MpesaReceiptNumber,
        transactionDate: new Date()
      });
    } catch (error) {
      console.error('Error saving payment:', error);
    }
  }
  
  res.json({ ResultCode: 0, ResultDesc: "Success" });
});
```

2. **Handle Timeouts**: Implement timeout checks for pending payments:
```javascript
// When initiating STK Push
const response = await daraja.stkPush({
  phoneNumber: '254712345678',
  amount: 1,
  accountReference: 'TEST',
  transactionDesc: 'Test Payment'
});

// Check status after 1 minute
setTimeout(async () => {
  const status = await daraja.stkPushQuery({
    checkoutRequestId: response.CheckoutRequestID
  });
  
  if (status.ResultCode !== 0) {
    console.log('Payment timed out or failed');
    // Handle timeout - update database, notify user, etc.
  }
}, 60000); // 1 minute timeout
```

3. **Secure Your Endpoints**: Always validate M-Pesa requests and use HTTPS in production.

Remember to:
- Use environment variables for sensitive data
- Implement proper error handling
- Log important events
- Use HTTPS in production
- Handle duplicate callbacks
- Implement proper request validation

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
