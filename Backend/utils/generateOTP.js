/**
 * Generate OTP and Token utilities
 */
const crypto = require('crypto');
const { isTestNumber } = require('./redisOtp.util');

/**
 * Generate a random OTP of specified length or default for test phone
 * @param {number|string} lengthOrPhone - Length of OTP or phone number
 * @returns {string} - Generated OTP
 */
const generateOTP = (lengthOrPhone = 6) => {
  if (typeof lengthOrPhone === 'string' && isTestNumber(lengthOrPhone)) {
    return '123456';
  }

  // In development mode, return default OTP for testing
  if (process.env.NODE_ENV === 'development' || process.env.USE_DEFAULT_OTP === 'true') {
    return '123456';
  }

  const length = typeof lengthOrPhone === 'number' ? lengthOrPhone : 6;
  let OTP = '';
  for (let i = 0; i < length; i++) {
    OTP += crypto.randomInt(10);
  }
  return OTP;
};

/**
 * Generate a random token of specified length
 * @param {number} length - Length of token (default: 32)
 * @returns {string} - Generated token
 */
const generateToken = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(crypto.randomInt(chars.length));
  }
  return token;
};

module.exports = {
  generateOTP,
  generateToken
};
