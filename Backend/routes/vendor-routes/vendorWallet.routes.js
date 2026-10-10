const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../../middleware/authMiddleware');
const { isVendor } = require('../../middleware/roleMiddleware');
const {
  getWallet,
  getTransactions,
  requestSettlement,
  getSettlements,
  getWalletSummary,
  payWorker,
  requestWithdrawal,
  getWithdrawals,
  createSettlementOrder,
  verifySettlementPayment,
  getBankAccount,
  saveBankAccount
} = require('../../controllers/vendorControllers/vendorWalletController');

// Validation rules
const payWorkerValidation = [
  body('bookingId').notEmpty().withMessage('Booking ID is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('notes').optional().trim()
];

// Validation rules
const settlementValidation = [
  body('amount').isFloat({ min: 1 }).withMessage('Valid amount is required'),
  body('paymentMethod').optional().isIn(['upi', 'bank_transfer', 'cash', 'other'])
];

// Routes
// Get wallet with ledger balance
router.get('/wallet', authenticate, isVendor, getWallet);

// Get wallet summary for dashboard
router.get('/wallet/summary', authenticate, isVendor, getWalletSummary);

// Get transaction history/ledger
router.get('/wallet/transactions', authenticate, isVendor, getTransactions);

// Record cash collection (creates negative entry - vendor owes admin)

// Request settlement (manual flow - kept for legacy/fallback if needed)
router.post('/wallet/settlement', authenticate, isVendor, settlementValidation, requestSettlement);

// Create Razorpay settlement order
router.post('/wallet/create-settlement-order', authenticate, isVendor, [
  body('amount').isFloat({ min: 1 }).withMessage('Valid amount is required')
], createSettlementOrder);

// Verify Razorpay settlement
router.post('/wallet/verify-settlement', authenticate, isVendor, verifySettlementPayment);

// Pay worker for a booking
router.post('/wallet/pay-worker', authenticate, isVendor, payWorkerValidation, payWorker);

// Get settlement history
router.get('/wallet/settlements', authenticate, isVendor, getSettlements);

// Request withdrawal (vendor withdraws earnings)
router.post('/withdraw', authenticate, isVendor, [
  body('amount').isFloat({ min: 1 }).withMessage('Valid amount is required'),
  body('bankDetails').optional().isObject()
], requestWithdrawal);

// Get withdrawal history
router.get('/wallet/withdrawals', authenticate, isVendor, getWithdrawals);

// Get bank account details
router.get('/wallet/bank-account', authenticate, isVendor, getBankAccount);

// Save or update bank account details
router.post('/wallet/bank-account', authenticate, isVendor, saveBankAccount);

module.exports = router;
