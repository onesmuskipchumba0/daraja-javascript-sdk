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
## Understanding M-Pesa Callbacks

### How Callbacks Work

When a customer makes a payment:
1. The customer receives an STK push on their phone
2. After they enter their PIN, M-Pesa processes the payment
3. M-Pesa sends the result to your callback URL
4. Your server processes this callback and updates your system

### Setting Up Your Callback URL

#### 1. Requirements for Callback URLs
- Must be a public HTTPS URL (M-Pesa doesn't accept HTTP)
- Must be accessible from the internet
- Standard ports (443 for HTTPS)

#### 2. Options for Callback URLs

**Option 1: Using a Domain**
```javascript
const daraja = new Daraja({
  callbackUrl: 'https://your-domain.com/mpesa/callback'
});
```

**Option 2: Using Ngrok for Development**
1. Install ngrok:
```bash
npm install -g ngrok
```

2. Start your Express server:
```bash
node server.js  # Running on port 3000
```

3. Start ngrok:
```bash
ngrok http 3000
```

4. Use the ngrok URL as your callback:
```javascript
const daraja = new Daraja({
  callbackUrl: 'https://your-ngrok-url.ngrok.io/mpesa/callback'
});
```

#### 3. Example with Domain Setup

1. Create your server file (server.js):
```javascript
const express = require('express');
const Daraja = require('daraja-javascript-sdk');
const app = express();

// Parse JSON bodies
app.use(express.json());

// Initialize Daraja with your domain
const daraja = new Daraja({
  callbackUrl: 'https://your-domain.com/mpesa/callback'  // Your domain
});

// Endpoint to start payment
app.post('/start-payment', async (req, res) => {
  try {
    const result = await daraja.stkPush({
      phoneNumber: '254712345678',
      amount: 1,
      accountReference: 'TEST',
      transactionDesc: 'Test Payment'
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Callback endpoint that M-Pesa will call
app.post('/mpesa/callback', (req, res) => {
  const { Body } = req.body;
  
  if (Body.stkCallback) {
    if (Body.stkCallback.ResultCode === 0) {
      // Payment successful
      const items = Body.stkCallback.CallbackMetadata.Item;
      const amount = items.find(item => item.Name === 'Amount').Value;
      const receipt = items.find(item => item.Name === 'MpesaReceiptNumber').Value;
      
      console.log(`Received payment of ${amount} KSH, receipt: ${receipt}`);
      
      // TODO: Update your database
      // TODO: Notify your customer
    }
  }
  
  // Always respond to M-Pesa
  res.json({ ResultCode: 0, ResultDesc: "Success" });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Testing Callbacks

1. **Local Development (using ngrok)**
```bash
# Terminal 1: Start your server
node server.js

# Terminal 2: Start ngrok
ngrok http 3000

# Copy the HTTPS URL from ngrok output
# Example: https://abc123.ngrok.io
```

2. **Production Domain**
- Point your domain to your server
- Set up SSL certificate (required by M-Pesa)
- Update your callback URL in the Daraja configuration

### Common Callback Issues

1. **Callback Not Received**
- Check if URL is publicly accessible
- Verify HTTPS is properly set up
- Ensure correct port is open
- Check ngrok tunnel is running (if using ngrok)

2. **Invalid Response**
- Always respond with:
```javascript
res.json({ ResultCode: 0, ResultDesc: "Success" });
```

3. **HTTPS Issues**
- M-Pesa requires valid SSL certificates
- Self-signed certificates won't work
- Use Let's Encrypt for free SSL certificates

### Best Practices for Callbacks

1. **Log Everything**
```javascript
app.post('/mpesa/callback', (req, res) => {
  // Log incoming callback
  console.log('Received callback:', JSON.stringify(req.body));
  
  // Process callback
  // ...
  
  // Log response
  console.log('Sending response to M-Pesa');
  res.json({ ResultCode: 0, ResultDesc: "Success" });
});
```

2. **Handle Duplicate Callbacks**
```javascript
const processedTransactions = new Set();

app.post('/mpesa/callback', (req, res) => {
  const transactionId = req.body.Body.stkCallback.CheckoutRequestID;
  
  if (processedTransactions.has(transactionId)) {
    console.log('Duplicate transaction:', transactionId);
    return res.json({ ResultCode: 0, ResultDesc: "Success" });
  }
  
  processedTransactions.add(transactionId);
  // Process the payment...
});
```

3. **Add Timeout Handling**
```javascript
// When starting payment
const result = await daraja.stkPush({...});

// Set timeout to check status
setTimeout(async () => {
  const status = await daraja.stkPushQuery({
    checkoutRequestId: result.CheckoutRequestID
  });
  
  if (status.ResultCode !== 0) {
    // Handle timeout
    console.log('Payment timed out');
  }
}, 60000); // Check after 1 minute
```

Remember:
- Always use HTTPS in production
- Keep your callback endpoint simple and fast
- Log all requests and responses
- Handle errors gracefully
- Store transaction details in a database
- Implement proper security measures

## B2C Payment

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

## C2B (Customer to Business)

Register URLs for C2B transactions and simulate payments (simulation only works in sandbox):

```javascript
// Register URLs for C2B
try {
  const response = await daraja.c2bRegisterUrl({
    shortCode: '123456',  // Optional, uses businessShortCode by default
    responseType: 'Completed',  // Optional
    confirmationUrl: 'https://your-domain.com/mpesa/confirmation',
    validationUrl: 'https://your-domain.com/mpesa/validation'
  });
  
  console.log('C2B URLs registered:', response);
} catch (error) {
  console.error('C2B URL registration failed:', error);
}

// Simulate C2B payment (sandbox only)
try {
  const response = await daraja.c2bSimulate({
    amount: 100,
    phoneNumber: '254712345678',
    billRefNumber: 'TEST123'
  });
  
  console.log('C2B Simulation:', response);
} catch (error) {
  console.error('C2B Simulation failed:', error);
}
```

## B2B (Business to Business)

Transfer money between businesses:

```javascript
try {
  const response = await daraja.b2b({
    amount: 1000,
    receiverShortCode: '987654',
    commandID: 'BusinessToBusinessTransfer',  // Optional
    remarks: 'Supplier Payment'  // Optional
  });
  
  console.log('B2B Response:', response);
} catch (error) {
  console.error('B2B Transfer failed:', error);
}
```

## Transaction Reversal

Reverse an M-Pesa transaction:

```javascript
try {
  const response = await daraja.reversal({
    transactionID: 'ABCD1234',
    amount: 100,
    remarks: 'Wrong payment'  // Optional
  });
  
  console.log('Reversal Response:', response);
} catch (error) {
  console.error('Reversal failed:', error);
}
```

## STK Push Status Query

Check the status of an STK push request:

```javascript
try {
  const response = await daraja.stkPushQuery({
    checkoutRequestId: 'ws_CO_123456789'
  });
  
  console.log('STK Query Response:', response);
} catch (error) {
  console.error('STK Query failed:', error);
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
