const User = require('../../models/User');
const { generateTokenPair, verifyRefreshToken, generateVerificationToken, verifyVerificationToken } = require('../../utils/tokenService');
const { generateOTP, hashOTP, storeOTP, verifyOTP, checkRateLimit } = require('../../utils/redisOtp.util');
const { sendOTP: sendSMSOTP } = require('../../services/smsService');
const { sendOTPEmail, sendWelcomeEmail } = require('../../services/emailService');
const { USER_ROLES } = require('../../utils/constants');
const { saveFcmToken } = require('../../services/firebaseAdmin');
const { validationResult } = require('express-validator');

/**
 * Send OTP for user registration/login
 */
const sendOTP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { phone, email, isLogin } = req.body;

    // If this is a login attempt, verify user exists first
    if (isLogin) {
      const userExists = await User.findOne({ phone });
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: 'User not found with this number'
        });
      }
    }

    // 1. Rate limit check
    const allowed = await checkRateLimit(phone);
    if (!allowed) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP requests. Please try again after 10 minutes.'
      });
    }

    // 2. Generate OTP
    const otp = generateOTP(phone);
    const otpHash = hashOTP(otp);

    // 3. Store OTP (Redis primary, MongoDB fallback)
    await storeOTP(phone, otpHash);

    // 4. Send OTP via SMS
    const smsResult = await sendSMSOTP(phone, otp);

    // Log OTP in development mode only (NEVER in production)
    if (process.env.NODE_ENV === 'development' || process.env.USE_DEFAULT_OTP === 'true') {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
    }

    // 5. Optional: Send email notification if email provided
    if (email) {
      await sendOTPEmail(email, otp, 'verification');
    }

    // Check if SMS failed
    if (!smsResult.success) {
      console.warn(`[OTP] SMS failed for ${phone}, but OTP stored for manual entry`);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      token: 'verification-pending' // Required by frontend to allow login
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
};

/**
 * Verify OTP and Check User Status (Unified Login/Signup Entry)
 */
const verifyLogin = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // 1. Verify OTP
    const verification = await verifyOTP(phone, otp);
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // 2. Check if user exists
    const user = await User.findOne({ phone });

    if (user) {
      // EXISTING USER -> LOGIN
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated.'
        });
      }

      await saveFcmToken(User, user._id, req.body.fcmToken, req.body.platform);

      const tokens = generateTokenPair({
        userId: user._id,
        role: USER_ROLES.USER
      });

      return res.status(200).json({
        success: true,
        isNewUser: false,
        message: 'Login successful',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isPhoneVerified: user.isPhoneVerified,
          isEmailVerified: user.isEmailVerified
        },
        ...tokens
      });

    } else {
      // NEW USER -> RETURN VERIFICATION TOKEN
      const verificationToken = generateVerificationToken(phone);

      return res.status(200).json({
        success: true,
        isNewUser: true,
        message: 'OTP verified. Please complete registration.',
        verificationToken
      });
    }

  } catch (error) {
    console.error('Verify Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.'
    });
  }
};

/**
 * Register user with Verification Token (No OTP required again)
 */
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, verificationToken } = req.body;
    const referralCode = (req.body.referralCode || '').toUpperCase().trim();
    let phone = req.body.phone;

    // Verify token if provided (New Flow)
    if (verificationToken) {
      const verifiedPhone = verifyVerificationToken(verificationToken);
      if (!verifiedPhone) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification session. Please verify phone again.'
        });
      }
      phone = verifiedPhone; // Trust the token's phone number
    } else {
      // Fallback to legacy OTP flow (if needed, but discouraged)
      if (!req.body.otp) {
        return res.status(400).json({ success: false, message: 'Verification token or OTP required.' });
      }
      const verification = await verifyOTP(phone, req.body.otp);
      if (!verification.success) {
        return res.status(400).json({ success: false, message: verification.message });
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists. Please login.'
      });
    }

    // Look up referrer (if code provided)
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode });
    }

    // Create user
    const user = await User.create({
      name,
      email: email || null,
      phone,
      isPhoneVerified: true,
      isEmailVerified: email ? false : true,
      referredBy: referrer ? referrer._id : null
    });

    // Credit ₹100 referral reward to referrer immediately on signup
    if (referrer) {
      const Transaction = require('../../models/Transaction');
      const prevBalance = referrer.wallet ? (referrer.wallet.balance || 0) : 0;
      const newBalance = prevBalance + 100;

      await User.findByIdAndUpdate(referrer._id, {
        $inc: { 'wallet.balance': 100, totalReferrals: 1 }
      });

      await Transaction.create({
        userId: referrer._id,
        type: 'referral_reward',
        amount: 100,
        status: 'completed',
        paymentMethod: 'system',
        description: `Referral reward — ${name} joined using your referral code`,
        balanceBefore: prevBalance,
        balanceAfter: newBalance,
        metadata: { referredUserId: user._id, referredUserName: name }
      });

      console.log(`[REFERRAL] ✅ ₹100 credited to referrer ${referrer._id} for referring ${user._id}`);
    }

    // Send Welcome Email
    if (email) {
      sendWelcomeEmail(email, name).catch(err => console.error(err));
    }

    await saveFcmToken(User, user._id, req.body.fcmToken, req.body.platform);

    // Generate JWT tokens
    const tokens = generateTokenPair({
      userId: user._id,
      role: USER_ROLES.USER
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified
      },
      ...tokens
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

/**
 * Login user with OTP
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { phone, otp } = req.body;

    // Verify OTP (checks Redis first, falls back to MongoDB)
    const verification = await verifyOTP(phone, otp);
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please sign up first.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    await saveFcmToken(User, user._id, req.body.fcmToken, req.body.platform);

    // Generate JWT tokens
    const tokens = generateTokenPair({
      userId: user._id,
      role: USER_ROLES.USER
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isPhoneVerified: user.isPhoneVerified,
        isEmailVerified: user.isEmailVerified
      },
      ...tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  try {
    // FCM tokens are kept; the client removes only this device's token before calling logout

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

/**
 * Refresh Access Token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Check if user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check status
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Generate new token pair
    const tokens = generateTokenPair({
      userId: user._id,
      role: USER_ROLES.USER
    });

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      ...tokens
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token'
    });
  }
};

/**
 * Delete user account permanently
 * After deletion, the phone number will be treated as a new user on next login attempt
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find the user first
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Permanently delete the user document from MongoDB
    const deleted = await User.findByIdAndDelete(userId);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete account. Please try again.'
      });
    }

    console.log(`[AUTH] ✅ User account permanently deleted: ${userId} (phone: ${user.phone})`);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully. You will need to register again to use the app.'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account. Please try again.'
    });
  }
};

module.exports = {
  sendOTP,
  verifyLogin,
  register,
  login,
  logout,
  refreshToken,
  deleteAccount
};
