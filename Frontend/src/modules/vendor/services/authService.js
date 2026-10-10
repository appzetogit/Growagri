import api from '../../../services/api';
import { registerFCMToken } from '../../../services/pushNotificationService';

/**
 * Notify Flutter WebView about successful login
 * This directly calls Flutter's captureLoginResponse handler
 * @param {object} responseData - The login response data containing accessToken and vendor info
 */
function notifyFlutterLogin(responseData) {
  try {
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
      console.log('[VENDOR AUTH] Notifying Flutter about login with verify-login response');
      window.flutter_inappwebview.callHandler('captureLoginResponse', JSON.stringify({
        url: '/auth/verify-login',
        body: responseData
      }));
    }
  } catch (e) {
    console.error('[VENDOR AUTH] Error notifying Flutter:', e);
  }
}

/**
 * Send OTP for vendor authentication
 * @param {string} phone - Phone number
 * @returns {Promise<Object>} OTP response with token
 */
export const sendOTP = async (phone) => {
  try {
    const response = await api.post('/vendors/auth/send-otp', { phone });
    return response.data;
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
};

/**
 * Verify Login (Unified Flow)
 */
export const verifyLogin = async (data) => {
  try {
    const response = await api.post('/vendors/auth/verify-login', data);

    // Check if vendor is pending approval
    const isPending = response.data.vendor?.adminApproval?.toLowerCase() === 'pending';

    if (response.data.success && !response.data.isNewUser && response.data.accessToken && !isPending) {
      localStorage.setItem('vendorAccessToken', response.data.accessToken);
      localStorage.setItem('vendorRefreshToken', response.data.refreshToken);
      localStorage.setItem('vendorData', JSON.stringify(response.data.vendor));

      // Notify Flutter about the login for mobile app FCM token handling
      notifyFlutterLogin(response.data);

      // Register FCM token after successful login
      console.log('[VENDOR AUTH] Vendor login successful via verify-login, registering FCM token...');
      registerFCMToken('vendor', true).catch(err => {
        console.error('[VENDOR AUTH] FCM token registration failed:', err);
      });
    }
    return response.data;
  } catch (error) {
    console.error('Error verifying login:', error);
    throw error;
  }
};

/**
 * Login vendor with OTP
 * @param {Object} credentials - Login credentials (phone, otp, token)
 * @returns {Promise<Object>} Auth response with token and vendor data
 */
export const login = async (credentials) => {
  try {
    const response = await api.post('/vendors/auth/login', credentials);

    // Store tokens in localStorage
    if (response.data.success && response.data.accessToken) {
      localStorage.setItem('vendorAccessToken', response.data.accessToken);
      localStorage.setItem('vendorRefreshToken', response.data.refreshToken);
      localStorage.setItem('vendorData', JSON.stringify(response.data.vendor));
    }

    return response.data;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

/**
 * Logout vendor
 * @returns {Promise<boolean>} Success status
 */
export const logout = async () => {
  try {
    const response = await api.post('/vendors/auth/logout');

    // Clear tokens
    localStorage.removeItem('vendorAccessToken');
    localStorage.removeItem('vendorRefreshToken');
    localStorage.removeItem('vendorData');

    return response.data;
  } catch (error) {
    console.error('Error logging out:', error);
    // Clear tokens anyway
    localStorage.removeItem('vendorAccessToken');
    localStorage.removeItem('vendorRefreshToken');
    localStorage.removeItem('vendorData');
    throw error;
  }
};

/**
 * Register new vendor
 * @param {Object} vendorData - Vendor registration data
 * @returns {Promise<Object>} Auth response with token and user data
 */
export const register = async (vendorData) => {
  try {
    console.log('Calling vendor register API with data:', vendorData);
    const response = await api.post('/vendors/auth/register', vendorData);
    console.log('Vendor register API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error registering vendor:', error);
    throw error;
  }
};

/**
 * Get current vendor profile
 * @returns {Promise<Object>} Vendor profile
 */
export const getCurrentVendor = async () => {
  try {
    const response = await api.get('/vendors/profile');
    return response.data?.data || response.data?.vendor || response.data;
  } catch (error) {
    console.error('Error fetching current vendor:', error);
    throw error;
  }
};

/**
 * Update vendor profile
 * @param {Object} profileData - Updated profile data
 * @returns {Promise<Object>} Updated vendor profile
 */
export const updateProfile = async (profileData) => {
  try {
    const response = await api.put('/vendors/profile', profileData);
    return response.data?.data || response.data?.vendor || response.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};


/**
 * Verify token validity
 * @returns {Promise<boolean>} Token validity
 */
export const verifyToken = async () => {
  try {
    const token = localStorage.getItem('vendorAccessToken') || sessionStorage.getItem('vendorAccessToken');
    if (!token) return false;
    const response = await api.get('/vendors/profile');
    return !!response.data?.success;
  } catch (error) {
    console.error('Error verifying token:', error);
    return false;
  }
};

