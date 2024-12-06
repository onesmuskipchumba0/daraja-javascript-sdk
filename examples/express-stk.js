require('dotenv').config();
const express = require('express');
const DarajaSDK = require('../src/index');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the SDK
const daraja = new DarajaSDK({
    consumerKey: process.env.CONSUMER_KEY,
    consumerSecret: process.env.CONSUMER_SECRET,
    environment: process.env.ENVIRONMENT
});

// Store successful transactions
const transactions = new Map();

// Serve a simple HTML form
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>M-Pesa STK Push</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .form-group {
                    margin-bottom: 15px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                }
                input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                button {
                    background-color: #4CAF50;
                    color: white;
                    padding: 10px 15px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #45a049;
                }
                .result {
                    margin-top: 20px;
                    padding: 15px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    display: none;
                }
                .status-pending {
                    color: #ff9800;
                }
                .status-complete {
                    color: #4CAF50;
                }
                .status-failed {
                    color: #f44336;
                }
            </style>
        </head>
        <body>
            <h1>M-Pesa Payment</h1>
            <form id="paymentForm">
                <div class="form-group">
                    <label for="phoneNumber">Phone Number (254XXXXXXXXX):</label>
                    <input type="text" id="phoneNumber" name="phoneNumber" required 
                           pattern="254[0-9]{9}" placeholder="254712345678">
                </div>
                <div class="form-group">
                    <label for="amount">Amount (KES):</label>
                    <input type="number" id="amount" name="amount" required min="1" value="1">
                </div>
                <button type="submit">Pay Now</button>
            </form>
            <div id="result" class="result">
                <h3>Transaction Status: <span id="statusText"></span></h3>
                <div id="transactionDetails" class="transaction-details"></div>
            </div>

            <script>
                document.getElementById('paymentForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const resultDiv = document.getElementById('result');
                    const statusText = document.getElementById('statusText');
                    const transactionDetails = document.getElementById('transactionDetails');
                    
                    resultDiv.style.display = 'block';
                    statusText.className = 'status-pending';
                    statusText.textContent = 'PENDING';
                    
                    const formData = {
                        phoneNumber: document.getElementById('phoneNumber').value,
                        amount: document.getElementById('amount').value
                    };

                    try {
                        const response = await fetch('/stkPush', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(formData)
                        });
                        
                        const data = await response.json();
                        
                        if (data.CheckoutRequestID) {
                            transactionDetails.innerHTML = 
                                '<p><strong>Checkout Request ID:</strong> ' + data.CheckoutRequestID + '</p>' +
                                '<p>Check your phone for the STK push prompt...</p>';
                        } else {
                            statusText.className = 'status-failed';
                            statusText.textContent = 'FAILED';
                            transactionDetails.innerHTML = '<p>Error: ' + (data.error || 'Unknown error') + '</p>';
                        }
                    } catch (error) {
                        statusText.className = 'status-failed';
                        statusText.textContent = 'ERROR';
                        transactionDetails.innerHTML = '<p>Error: ' + error.message + '</p>';
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// Test endpoint to verify server is running
app.get('/test', (req, res) => {
    console.log('Test endpoint hit');
    res.json({ status: 'Server is running!' });
});

// STK Push endpoint
app.post('/stkPush', async (req, res) => {
    try {
        const { phoneNumber, amount } = req.body;
        
        console.log('\n=== STK Push Initiated ===');
        console.log('Phone Number:', phoneNumber);
        console.log('Amount:', amount);
        console.log('Callback URL:', process.env.CALLBACK_URL);
        
        // Initiate STK Push
        const stkPushResponse = await daraja.stkPush({
            phoneNumber,
            amount,
            callbackUrl: process.env.CALLBACK_URL,
            accountReference: 'Test Payment',
            transactionDesc: 'Payment for test'
        });

        console.log('Checkout Request ID:', stkPushResponse.CheckoutRequestID);
        console.log('============================\n');

        res.json(stkPushResponse);
    } catch (error) {
        console.error('STK Push Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// M-Pesa callback URL
app.all('/mpesa/callback', express.json({ type: '*/*' }), (req, res) => {
    try {
        // Handle browser testing (GET requests)
        if (req.method === 'GET') {
            console.log('\n🔍 Test Access Detected');
            console.log('------------------------');
            console.log('This is just a test access via browser.');
            console.log('The actual M-Pesa callback will be a POST request.');
            console.log('------------------------\n');
            
            return res.json({
                message: "This is the M-Pesa callback URL",
                note: "The actual callback will be a POST request from M-Pesa",
                status: "Active and waiting for callbacks"
            });
        }

        // Handle actual M-Pesa callback (POST requests)
        console.log('\n📱 M-Pesa Callback Received');
        console.log('============================');
        
        // Log the complete raw callback data
        console.log('\n📄 Complete Callback JSON:');
        console.log('------------------------');
        console.log(JSON.stringify(req.body, null, 2));
        console.log('------------------------\n');

        if (req.body && req.body.Body && req.body.Body.stkCallback) {
            const { Body: { stkCallback } } = req.body;
            const { ResultCode, ResultDesc, CallbackMetadata, CheckoutRequestID } = stkCallback;

            console.log('💰 Parsed Transaction Details:');
            console.log('------------------------');
            console.log('Status:', ResultCode === 0 ? '✅ SUCCESS' : '❌ FAILED');
            console.log('Message:', ResultDesc);
            console.log('Checkout ID:', CheckoutRequestID);

            if (ResultCode === 0 && CallbackMetadata && CallbackMetadata.Item) {
                const getMetadataValue = (name) => {
                    const item = CallbackMetadata.Item.find(item => item.Name === name);
                    return item ? item.Value : null;
                };

                const transactionData = {
                    amount: getMetadataValue('Amount'),
                    receiptNumber: getMetadataValue('MpesaReceiptNumber'),
                    transactionDate: getMetadataValue('TransactionDate'),
                    phoneNumber: getMetadataValue('PhoneNumber')
                };

                // Store transaction data
                transactions.set(CheckoutRequestID, {
                    ...transactionData,
                    rawCallback: req.body,  // Store the complete callback data
                    status: 'SUCCESS',
                    timestamp: new Date().toISOString()
                });

                console.log('\n📝 Payment Details:');
                console.log('------------------------');
                console.log('Amount: KES', transactionData.amount);
                console.log('Receipt Number:', transactionData.receiptNumber);
                console.log('Phone Number:', transactionData.phoneNumber);
                console.log('Transaction Date:', transactionData.transactionDate);
            }
        } else {
            console.log('❌ Invalid or empty callback data received');
        }
        
        console.log('============================\n');

        res.json({
            ResultCode: 0,
            ResultDesc: "Success"
        });
    } catch (error) {
        console.error('❌ Error processing callback:', error.message);
        console.log('Raw request body:', req.body);
        res.json({
            ResultCode: 0,
            ResultDesc: "Success"
        });
    }
});

// Add an endpoint to check transaction status
app.get('/transaction/:checkoutRequestId', (req, res) => {
    const { checkoutRequestId } = req.params;
    const transaction = transactions.get(checkoutRequestId);
    
    if (transaction) {
        res.json({
            status: 'success',
            data: transaction
        });
    } else {
        res.json({
            status: 'not_found',
            message: 'Transaction not found'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        ResultCode: 1,
        ResultDesc: "Internal server error"
    });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log('\n=== Server Started ===');
    console.log(`Server running on port ${PORT}`);
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log(`Callback endpoint: ${process.env.CALLBACK_URL}`);
    console.log('Make sure your ngrok tunnel is running on port 3000');
    console.log('========================\n');
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please close other applications using this port or choose a different port.`);
    } else {
        console.error('Server error:', error);
    }
    process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Server terminated');
    });
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    server.close(() => {
        process.exit(1);
    });
});
