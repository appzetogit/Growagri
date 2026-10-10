/**
 * Wallet Service
 * Handles all wallet-related API calls
 * 
 * Note: This is a structure file for backend integration.
 * Replace localStorage calls with actual API endpoints.
 */

import api from '../../../services/api';

/**
 * Get wallet balance
 * @returns {Promise<Object>} Wallet balance details
 */
export const getWalletBalance = async () => {
  try {
    const response = await api.get('/vendors/wallet');
    return response.data.data;
  } catch (error) {
    // Silently fail - used by background polling (CashLimitModal), don't spam console
    console.warn('Error fetching wallet balance:', error?.response?.status || error?.message);
    return null;
  }
};

/**
 * Get transaction history
 * @param {Object} filters - Filter options (type, date range, etc.)
 * @returns {Promise<Array>} Transaction history
 */
export const getTransactions = async (filters = {}) => {
  try {
    const response = await api.get('/vendors/transactions', { params: filters });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
};

/**
 * Request withdrawal
 * @param {Object} withdrawalData - Withdrawal details (amount, bankAccountId)
 * @returns {Promise<Object>} Withdrawal request
 */
export const requestWithdrawal = async (withdrawalData) => {
  try {
    const response = await api.post('/vendors/withdraw', withdrawalData);
    return response.data;
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    throw error;
  }
};

/**
 * Get withdrawal history
 * @param {Object} filters - Filter options (status, date range, etc.)
 * @returns {Promise<Array>} Withdrawal history
 */
export const getWithdrawalHistory = async (filters = {}) => {
  try {
    const response = await api.get('/vendors/wallet/withdrawals', { params: filters });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    throw error;
  }
};

/**
 * Get bank account details
 * @returns {Promise<Object>} Bank account details
 */
export const getBankAccount = async () => {
  try {
    const response = await api.get('/vendors/wallet/bank-account');
    return response.data.data || {};
  } catch (error) {
    console.error('Error fetching bank account:', error);
    throw error;
  }
};

/**
 * Save/Update bank account
 * @param {Object} bankAccountData - Bank account details
 * @returns {Promise<Object>} Saved bank account
 */
export const saveBankAccount = async (bankAccountData) => {
  try {
    const response = await api.post('/vendors/wallet/bank-account', bankAccountData);
    return response.data.data || bankAccountData;
  } catch (error) {
    console.error('Error saving bank account:', error);
    throw error;
  }
};

