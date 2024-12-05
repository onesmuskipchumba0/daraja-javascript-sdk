require('dotenv').config();
const DarajaSDK = require('../src/index');

// Initialize the SDK
const daraja = new DarajaSDK({
    consumerKey: process.env.CONSUMER_KEY,
    consumerSecret: process.env.CONSUMER_SECRET,
    environment: 'sandbox', // Use 'production' for live environment
});

// Example 1: STK Push (Lipa Na M-Pesa Online)
async function initiateSTKPush() {
    try {
        const stkPushResponse = await daraja.stkPush({
            phoneNumber: '254712345678', // Replace with customer's phone number
            amount: 1,
            accountReference: 'TEST001',
            transactionDesc: 'Test Payment'
        });
        
        console.log('STK Push Response:', stkPushResponse);
        return stkPushResponse.CheckoutRequestID; // Save this for checking transaction status
    } catch (error) {
        console.error('STK Push Error:', error.message);
    }
}

// Example 2: B2C Payment (Business to Customer)
async function sendMoneyToCustomer() {
    try {
        const b2cResponse = await daraja.b2c({
            amount: 100,
            phoneNumber: '254712345678', // Replace with recipient's phone number
            commandID: 'BusinessPayment', // Or 'SalaryPayment', 'PromotionPayment'
            remarks: 'Refund Payment'
        });
        
        console.log('B2C Response:', b2cResponse);
        return b2cResponse.ConversationID;
    } catch (error) {
        console.error('B2C Error:', error.message);
    }
}

// Example 3: Check Transaction Status
async function checkTransactionStatus(transactionId) {
    try {
        const statusResponse = await daraja.transactionStatus({
            transactionID: transactionId
        });
        
        console.log('Transaction Status:', statusResponse);
    } catch (error) {
        console.error('Status Check Error:', error.message);
    }
}

// Example 4: Check Account Balance
async function checkAccountBalance() {
    try {
        const balanceResponse = await daraja.accountBalance();
        console.log('Account Balance Response:', balanceResponse);
    } catch (error) {
        console.error('Balance Check Error:', error.message);
    }
}

// Example of running all operations in sequence
async function runExamples() {
    console.log('Starting M-Pesa Operations...\n');

    // 1. STK Push
    console.log('Initiating STK Push...');
    const checkoutRequestId = await initiateSTKPush();
    console.log('STK Push completed.\n');

    // Wait for 10 seconds before checking status
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 2. Check Transaction Status
    if (checkoutRequestId) {
        console.log('Checking transaction status...');
        await checkTransactionStatus(checkoutRequestId);
        console.log('Status check completed.\n');
    }

    // 3. B2C Payment
    console.log('Initiating B2C Payment...');
    const conversationId = await sendMoneyToCustomer();
    console.log('B2C Payment completed.\n');

    // 4. Account Balance
    console.log('Checking account balance...');
    await checkAccountBalance();
    console.log('Balance check completed.\n');

    console.log('All operations completed!');
}

// Run the examples
runExamples().catch(console.error);

// Error Handling Example
async function demonstrateErrorHandling() {
    try {
        // Attempt STK push with invalid phone number
        await daraja.stkPush({
            phoneNumber: 'invalid',
            amount: 1,
            accountReference: 'TEST001',
            transactionDesc: 'Test Payment'
        });
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('API Error Response:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            });
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error setting up request:', error.message);
        }
    }
}

// Webhook handling example (if you're using Express)
/*
const express = require('express');
const app = express();
app.use(express.json());

app.post('/mpesa/callback', (req, res) => {
    const { Body: { stkCallback } } = req.body;
    
    if (stkCallback.ResultCode === 0) {
        // Payment successful
        const amount = stkCallback.CallbackMetadata.Item.find(
            item => item.Name === 'Amount'
        ).Value;
        const mpesaReceiptNumber = stkCallback.CallbackMetadata.Item.find(
            item => item.Name === 'MpesaReceiptNumber'
        ).Value;
        
        console.log('Payment received:', {
            amount,
            mpesaReceiptNumber
        });
    } else {
        console.log('Payment failed:', stkCallback.ResultDesc);
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
*/
