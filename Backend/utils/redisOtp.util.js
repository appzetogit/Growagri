const crypto = require('crypto');
const { getRedis, isRedisConnected } = require('../services/redisService');
const Token = require('../models/Token'); // Fallback model
const { TOKEN_TYPES } = require('./constants'); // Need to ensure constants file is reachable or define types here
// Note: imports might need adjustment based on directory structure. 
// constants is in ../utils/constants.js usually, but this file is in utils/ so ./constants

// Constants if not imported
const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_SECONDS) || 300;
const MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;
const RATE_LIMIT_COUNT = parseInt(process.env.OTP_RATE_LIMIT) || 3;
const RATE_LIMIT_WINDOW = parseInt(process.env.OTP_RATE_WINDOW) || 600;
// Test / Demo numbers (e.g. store-review accounts) that always get default OTP (123456).
// Comma-separated 10-digit numbers in TEST_PHONE_NUMBERS; none unless configured.
const TEST_NUMBERS = (process.env.TEST_PHONE_NUMBERS || '').split(',').map(n => n.trim()).filter(n => /^\d{10}$/.test(n));

/**
 * Check if phone is a designated test number (exact match only, so "x6268455485" is not a test number)
 */
const isTestNumber = (phone) => typeof phone === 'string' && TEST_NUMBERS.includes(phone.trim());

/**
 * Generate 6-digit OTP
 */
const generateOTP = (phone) => {
  // Test Numbers - Always return fixed OTP (123456)
  if (isTestNumber(phone)) {
    return '123456';
  }
  if (process.env.USE_DEFAULT_OTP === 'true') {
    return '123456';
  }
  return crypto.randomInt(100000, 1000000).toString();
};

// Used when Redis is down so OTP sending is still rate limited (per process)
// ponytail: in-memory fallback, per-instance only; fine until several API instances run without Redis
const memoryRateLimit = new Map();


/**
 * Hash OTP using SHA-256
 */
const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

/**
 * Check rate limit for phone number
 * Returns true if allowed, false if limit exceeded
 * Uses Redis; if Redis is down, falls back to an in-memory counter instead of allowing unlimited sends.
 */
const checkMemoryRateLimit = (phone) => {
  const now = Date.now();
  const entry = memoryRateLimit.get(phone);
  if (!entry || entry.resetAt <= now) {
    memoryRateLimit.set(phone, { count: 1, resetAt: now + RATE_LIMIT_WINDOW * 1000 });
    if (memoryRateLimit.size > 10000) {
      for (const [key, value] of memoryRateLimit) if (value.resetAt <= now) memoryRateLimit.delete(key);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_COUNT;
};

const checkRateLimit = async (phone) => {
  // Test Numbers - Always allow, never rate limit
  if (isTestNumber(phone)) {
    return true;
  }

  const redis = getRedis();
  if (!isRedisConnected() || !redis) {
    return checkMemoryRateLimit(phone);
  }

  const key = `rate:otp:${phone}`;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW);
    }
    return current <= RATE_LIMIT_COUNT;
  } catch (err) {
    console.error('[OTP] Rate limit error:', err);
    return checkMemoryRateLimit(phone);
  }
};

/**
 * Store OTP (Redis Primary -> MongoDB Fallback)
 */
const storeOTP = async (phone, otpHash) => {
  const redis = getRedis();

  // 1. Try Redis
  if (isRedisConnected() && redis) {
    try {
      const key = `otp:${phone}`;
      const data = JSON.stringify({ hash: otpHash });
      await redis.set(key, data, 'EX', OTP_EXPIRY);
      await redis.del(`otp_attempts:${phone}`);
      console.log(`[OTP] Stored in Redis for ${phone}`);
      return true;
    } catch (err) {
      console.error('[OTP] Redis store failed, falling back to MongoDB:', err);
    }
  }

  // 2. Fallback to MongoDB
  try {
    // Delete existing tokens for this phone & type
    await Token.deleteMany({ phone, type: 'PHONE_VERIFICATION' });

    // Create new token
    await Token.create({
      phone,
      type: 'PHONE_VERIFICATION',
      token: otpHash, // Storing hash in token field for compatibility
      otp: otpHash,   // Also storing in otp field (hashed)
      expiresAt: new Date(Date.now() + OTP_EXPIRY * 1000),
      attempts: 0
    });
    console.log(`[OTP] Stored in MongoDB (Fallback) for ${phone}`);
    return true;
  } catch (err) {
    console.error('[OTP] MongoDB fallback failed:', err);
    throw new Error('Failed to generate OTP');
  }
};

/**
 * Verify OTP (Redis Primary -> MongoDB Fallback)
 * Returns: { success: true/false, message: string }
 */
const verifyOTP = async (phone, plainOtp) => {
  // Strings only: an object here would become a MongoDB operator in the fallback query
  if (typeof phone !== 'string' || typeof plainOtp !== 'string' || !plainOtp) {
    return { success: false, message: 'Invalid or expired OTP. Please request a new one.' };
  }

  // Test Numbers - Bypass OTP verification with default OTP 123456
  if (isTestNumber(phone) && plainOtp === '123456') {
    console.log(`[OTP] ✅ Test number bypass for ${phone}`);
    return { success: true };
  }

  const redis = getRedis();
  const inputHash = hashOTP(plainOtp);

  // 1. Try Redis
  if (isRedisConnected() && redis) {
    try {
      const key = `otp:${phone}`;
      const attemptsKey = `otp_attempts:${phone}`;
      const data = await redis.get(key);

      if (data) {
        const otpData = JSON.parse(data);

        // Atomic counter: parallel guesses can't all see "0 attempts"
        const attempts = await redis.incr(attemptsKey);
        if (attempts === 1) await redis.expire(attemptsKey, OTP_EXPIRY);
        if (attempts > MAX_ATTEMPTS) {
          await redis.del(key, attemptsKey);
          console.log(`[OTP] Max attempts exceeded for ${phone}`);
          return { success: false, message: 'Too many attempts. Please request new OTP.' };
        }

        if (otpData.hash !== inputHash) {
          console.log(`[OTP] Invalid OTP for ${phone}, attempts: ${attempts}`);
          return { success: false, message: 'Invalid OTP' };
        }

        // Success
        await redis.del(key, attemptsKey);
        console.log(`[OTP] ✅ Verification successful for ${phone}`);
        return { success: true };
      } else {
        console.log(`[OTP] Not found in Redis for ${phone}, checking MongoDB...`);
      }
    } catch (err) {
      console.error('[OTP] Redis verify failed, trying MongoDB:', err);
    }
  }

  // 2. Check MongoDB (Fallback)
  try {
    // Count the attempt atomically before comparing, so parallel guesses share one budget
    const tokenDoc = await Token.findOneAndUpdate(
      {
        phone,
        type: 'PHONE_VERIFICATION',
        isUsed: false,
        expiresAt: { $gt: new Date() },
        attempts: { $lt: MAX_ATTEMPTS }
      },
      { $inc: { attempts: 1 } },
      { new: true }
    );

    if (!tokenDoc) {
      await Token.deleteMany({ phone, type: 'PHONE_VERIFICATION', $or: [{ expiresAt: { $lte: new Date() } }, { attempts: { $gte: MAX_ATTEMPTS } }] });
      console.log(`[OTP] ❌ Not found, expired or out of attempts in MongoDB for ${phone}`);
      return { success: false, message: 'Invalid or expired OTP. Please request a new one.' };
    }

    if (tokenDoc.otp !== inputHash) {
      console.log(`[OTP] Invalid OTP in MongoDB for ${phone}, attempts: ${tokenDoc.attempts}`);
      return { success: false, message: 'Invalid OTP' };
    }

    // Success
    await Token.deleteOne({ _id: tokenDoc._id }); // Or mark used
    console.log(`[OTP] ✅ Verification successful (MongoDB) for ${phone}`);
    return { success: true };

  } catch (err) {
    console.error('[OTP] MongoDB verify error:', err);
    return { success: false, message: 'Verification failed. Please try again.' };
  }
};

module.exports = {
  TEST_NUMBERS,
  isTestNumber,
  generateOTP,
  hashOTP,
  checkRateLimit,
  storeOTP,
  verifyOTP
};
