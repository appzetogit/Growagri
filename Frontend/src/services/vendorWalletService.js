import api from './api';

/**
 * Vendor Wallet/Ledger Service
 * Handles cash collection, settlements, and transaction history
 */
const vendorWalletService = {
  /**
   * Get wallet balance and summary
   */
  getWallet: async () => {
    const response = await api.get('/vendors/wallet');
    return response.data;
  },

  /**
   * Get wallet summary for dashboard
   */
  getWalletSummary: async () => {
    const response = await api.get('/vendors/wallet/summary');
    return response.data;
  },

  /**
   * Get transaction history/ledger
   */
  getTransactions: async (params = {}) => {
    const response = await api.get('/vendors/wallet/transactions', { params });
    return response.data;
  },

  /**
   * Initiate cash collection (OTP)
   */
  initiateCashCollection: async (bookingId, totalAmount, extraItems = []) => {
    const response = await api.post(`/bookings/cash/${bookingId}/initiate`, {
      totalAmount,
      extraItems
    });
    return response.data;
  },

  /**
   * Confirm cash collection
   */
  confirmCashCollection: async (bookingId, amount, otp = '', extraItems = []) => {
    const response = await api.post(`/bookings/cash/${bookingId}/confirm`, {
      amount,
      otp,
      extraItems
    });
    return response.data;
  },

  /**
   * Request settlement (vendor pays admin)
   */
  requestSettlement: async (data) => {
    const response = await api.post('/vendors/wallet/settlement', data);
    return response.data;
  },

  /**
   * Create Razorpay Settlement Order
   */
  createSettlementOrder: async (amount) => {
    const response = await api.post('/vendors/wallet/create-settlement-order', { amount });
    return response.data;
  },

  /**
   * Verify Razorpay Settlement Payment
   */
  verifySettlementPayment: async (data) => {
    const response = await api.post('/vendors/wallet/verify-settlement', data);
    return response.data;
  },

  /**
   * Get settlement history
   */
  getSettlements: async (params = {}) => {
    const response = await api.get('/vendors/wallet/settlements', { params });
    return response.data;
  },

  /**
   * Pay worker for a booking
   */
  payWorker: async (bookingId, amount, notes = '', transactionId = '', screenshot = '', paymentMethod = 'cash') => {
    const response = await api.post('/vendors/wallet/pay-worker', {
      bookingId,
      amount,
      notes,
      transactionId,
      screenshot,
      paymentMethod
    });
    return response.data;
  }
};

export default vendorWalletService;
