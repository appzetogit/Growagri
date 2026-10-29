// Login stores the device FCM token in fcmTokenMobile. In-memory MongoDB (never touches the real DB).
// Run: node tests/fcmTokenAuth.test.js
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { saveFcmToken } = require('../services/firebaseAdmin');
const userAuth = require('../controllers/userControllers/userAuthController');
const vendorAuth = require('../controllers/vendorControllers/vendorAuthController');

const call = (handler, body) => new Promise((resolve) => {
  const res = { status: (code) => ({ json: (data) => resolve({ code, data }) }) };
  handler({ body }, res);
});

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const phone = '6268455485'; // test number: OTP 123456 is accepted without Redis
  await mongoose.connection.db.collection('users').insertOne({ phone, name: 'Farmer', isActive: true, fcmTokenMobile: ['old'] });
  await mongoose.connection.db.collection('vendors').insertOne({ phone, name: 'Owner', isActive: true, approvalStatus: 'approved' });

  const u = await call(userAuth.verifyLogin, { phone, otp: '123456', fcmToken: 'user-device', platform: 'mobile' });
  assert.strictEqual(u.code, 200);
  assert.ok(u.data.accessToken, 'login still returns JWT');
  assert.deepStrictEqual((await User.findOne({ phone }).lean()).fcmTokenMobile, ['user-device', 'old'], 'newest first');

  const v = await call(vendorAuth.verifyLogin, { phone, otp: '123456', fcmToken: 'vendor-device' });
  assert.strictEqual(v.code, 200);
  assert.deepStrictEqual((await Vendor.findOne({ phone }).lean()).fcmTokenMobile, ['vendor-device'], 'platform defaults to mobile');

  // Re-login with same token doesn't duplicate; web platform goes to fcmTokens; list capped at 10
  const id = (await User.findOne({ phone }))._id;
  await saveFcmToken(User, id, 'user-device', 'mobile');
  await saveFcmToken(User, id, 'browser', 'web');
  for (let i = 0; i < 12; i++) await saveFcmToken(User, id, `t${i}`);
  const doc = await User.findById(id).lean();
  assert.strictEqual(doc.fcmTokenMobile.length, 10);
  assert.strictEqual(doc.fcmTokenMobile[0], 't11');
  assert.deepStrictEqual(doc.fcmTokens, ['browser']);

  // No token in body -> login unaffected
  const none = await call(userAuth.verifyLogin, { phone, otp: '123456' });
  assert.strictEqual(none.code, 200);

  console.log('fcmTokenAuth.test.js: all checks passed');
  await mongoose.disconnect();
  await mongo.stop();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
