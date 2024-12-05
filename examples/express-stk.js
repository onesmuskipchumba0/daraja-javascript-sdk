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
    environment: 'sandbox', // Use 'production' for live environment
});

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
                    max-width: 600px;
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
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    display: none;
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
            <div id="result" class="result"></div>

            <script>
                document.getElementById('paymentForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const resultDiv = document.getElementById('result');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = 'Processing payment...';

                    const formData = {
                        phoneNumber: document.getElementById('phoneNumber').value,
                        amount: document.getElementById('amount').value
                    };

                    try {
                        const response = await fetch('/initiate-payment', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(formData)
                        });
                        const data = await response.json();
                        
                        if (data.success) {
                            resultDiv.innerHTML = 'Payment initiated successfully! Check your phone.';
                            // Start polling for status
                            pollPaymentStatus(data.CheckoutRequestID);
                        } else {
                            resultDiv.innerHTML = 'Error: ' + data.message;
                        }
                    } catch (error) {
                        resultDiv.innerHTML = 'Error processing payment: ' + error.message;
                    }
                });

                async function pollPaymentStatus(checkoutRequestId) {
                    const resultDiv = document.getElementById('result');
                    let attempts = 0;
                    const maxAttempts = 10;

                    const pollInterval = setInterval(async () => {
                        attempts++;
                        try {
                            const response = await fetch('/payment-status/' + checkoutRequestId);
                            const data = await response.json();

                            if (data.status === 'COMPLETE') {
                                clearInterval(pollInterval);
                                resultDiv.innerHTML = 'Payment completed successfully!';
                            } else if (data.status === 'FAILED') {
                                clearInterval(pollInterval);
                                resultDiv.innerHTML = 'Payment failed: ' + data.message;
                            } else if (attempts >= maxAttempts) {
                                clearInterval(pollInterval);
                                resultDiv.innerHTML = 'Payment status check timed out. Please check your phone.';
                            }
                        } catch (error) {
                            console.error('Error checking status:', error);
                        }
                    }, 5000); // Check every 5 seconds
                }
            </script>
        </body>
        </html>
    `);
});

// Store transaction status
const transactions = new Map();

// Initiate STK Push
app.post('/initiate-payment', async (req, res) => {
    try {
        const { phoneNumber, amount } = req.body;

        // Validate phone number
        if (!phoneNumber.match(/^254[0-9]{9}$/)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number format. Use 254XXXXXXXXX'
            });
        }

        // Validate amount
        if (amount < 1) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be at least 1 KES'
            });
        }

        const response = await daraja.stkPush({
            phoneNumber,
            amount: parseInt(amount),
            accountReference: 'TEST' + Date.now(),
            transactionDesc: 'Payment for services'
        });

        // Store initial transaction status
        transactions.set(response.CheckoutRequestID, {
            status: 'PENDING',
            timestamp: Date.now()
        });

        res.json({
            success: true,
            message: 'Payment initiated',
            CheckoutRequestID: response.CheckoutRequestID
        });

    } catch (error) {
        console.error('STK Push Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to initiate payment'
        });
    }
});

// Check payment status
app.get('/payment-status/:checkoutRequestId', (req, res) => {
    const { checkoutRequestId } = req.params;
    const transaction = transactions.get(checkoutRequestId);

    if (!transaction) {
        return res.json({
            status: 'UNKNOWN',
            message: 'Transaction not found'
        });
    }

    res.json({
        status: transaction.status,
        message: transaction.message || ''
    });
});

// M-Pesa callback URL
app.post('/mpesa/callback', (req, res) => {
    try {
        const { Body: { stkCallback } } = req.body;
        const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

        // Update transaction status
        transactions.set(CheckoutRequestID, {
            status: ResultCode === 0 ? 'COMPLETE' : 'FAILED',
            message: ResultDesc,
            timestamp: Date.now()
        });

        // Log the callback
        console.log('M-Pesa Callback:', {
            CheckoutRequestID,
            ResultCode,
            ResultDesc
        });

        // Always respond to M-Pesa
        res.json({
            ResultCode: 0,
            ResultDesc: "Success"
        });
    } catch (error) {
        console.error('Callback Error:', error);
        res.status(500).json({
            ResultCode: 1,
            ResultDesc: "Error processing callback"
        });
    }
});

// Clean up old transactions periodically
setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [key, transaction] of transactions.entries()) {
        if (transaction.timestamp < oneHourAgo) {
            transactions.delete(key);
        }
    }
}, 60 * 60 * 1000); // Run every hour

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
