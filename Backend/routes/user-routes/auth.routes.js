const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  sendOTP,
  register,
  login,
  logout,
  verifyLogin,
  deleteAccount
} = require('../../controllers/userControllers/userAuthController');
// ...

const { authenticate } = require('../../middleware/authMiddleware');
const { isUser } = require('../../middleware/roleMiddleware');

const phoneRule = () => body('phone').trim().matches(/^\d{10}$/).withMessage('Phone number must be 10 digits');
const otpRule = () => body('otp').trim().matches(/^\d{6}$/).withMessage('OTP must be 6 digits');

const sendOTPValidation = [phoneRule()];

const verifyLoginValidation = [phoneRule(), otpRule()];

const loginValidation = [
  phoneRule(),
  otpRule(),
  body('token').trim().notEmpty().withMessage('Verification Session ID is required')
];

// Relaxed register validation to support either OTP or verificationToken
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Please provide a valid email'),
  // Phone/OTP are only used on the legacy (no verificationToken) path, but must be well-formed when sent
  body('phone').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\d{10}$/).withMessage('Phone number must be 10 digits'),
  body('otp').optional({ nullable: true, checkFalsy: true }).trim().matches(/^\d{6}$/).withMessage('OTP must be 6 digits')
];

// Routes
router.post('/send-otp', sendOTPValidation, sendOTP);
router.post('/verify-login', verifyLoginValidation, verifyLogin); // New Unified Entry
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh-token', require('../../controllers/userControllers/userAuthController').refreshToken);
router.post('/logout', authenticate, isUser, logout);
router.delete('/delete-account', authenticate, isUser, deleteAccount);

module.exports = router;



