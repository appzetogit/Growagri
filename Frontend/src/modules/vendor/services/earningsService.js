/**
 * Earnings Service
 * Handles all earnings-related API calls connected directly to backend endpoints
 */
import api from '../../../services/api';

/**
 * Get earnings overview (today, week, month, total, history)
 * @returns {Promise<Object>} Earnings overview
 */
export const getEarningsOverview = async () => {
  try {
    const response = await api.get('/vendors/dashboard/earnings-summary');
    return response.data.data || {
      today: 0,
      week: 0,
      month: 0,
      total: 0,
      history: []
    };
  } catch (error) {
    console.error('Error fetching earnings overview:', error);
    throw error;
  }
};

/**
 * Get earnings history from backend
 * @returns {Promise<Array>} Earnings history
 */
export const getEarningsHistory = async () => {
  try {
    const response = await api.get('/vendors/dashboard/earnings-summary');
    return response.data.data?.history || [];
  } catch (error) {
    console.error('Error fetching earnings history:', error);
    throw error;
  }
};

/**
 * Get earnings breakdown by service type
 * @returns {Promise<Array>} Service performance
 */
export const getEarningsByServiceType = async () => {
  try {
    const response = await api.get('/vendors/dashboard/services');
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching earnings by service type:', error);
    throw error;
  }
};

/**
 * Get earnings breakdown by worker
 * @returns {Promise<Array>} Worker performance
 */
export const getEarningsByWorker = async () => {
  try {
    const response = await api.get('/vendors/dashboard/workers');
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching earnings by worker:', error);
    throw error;
  }
};

/**
 * Get payout / wallet balance details
 * @returns {Promise<Object>} Wallet breakdown
 */
export const getPayoutBreakdown = async () => {
  try {
    const response = await api.get('/vendors/wallet');
    const wallet = response.data.data || {};
    return {
      totalEarnings: wallet.earnings || 0,
      dues: wallet.dues || 0,
      totalWithdrawn: wallet.totalWithdrawn || 0,
      totalSettled: wallet.totalSettled || 0,
      cashLimit: wallet.cashLimit || 10000
    };
  } catch (error) {
    console.error('Error fetching payout breakdown:', error);
    throw error;
  }
};
