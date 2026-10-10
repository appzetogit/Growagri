// Money/permission guards self-check on an in-memory MongoDB (never touches the real DB).
// Run: node tests/moneyGuards.test.js
process.env.JWT_SECRET ||= 'test';
process.env.JWT_REFRESH_SECRET ||= 'test';
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const mockRes = () => ({ code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const oid = () => new mongoose.Types.ObjectId();
// A booking that passes schema validation
const bookingDoc = (extra) => ({
  serviceId: oid(), serviceName: 'Tractor', serviceCategory: 'Agriculture', basePrice: 300,
  scheduledDate: new Date(), scheduledTime: '10:00', timeSlot: { start: '10:00', end: '12:00' },
  address: { addressLine1: 'Farm', city: 'Indore', state: 'MP', pincode: '452001' }, ...extra
});

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const db = mongoose.connection.db;
  const app = { get: () => null }; // no socket.io in tests

  const userId = oid(), vendorId = oid(), workerId = oid();
  await db.collection('users').insertOne({ _id: userId, name: 'U', phone: '1', isActive: true, wallet: { balance: 0 } });
  await db.collection('vendors').insertOne({ _id: vendorId, name: 'V', phone: '2', isActive: true, approvalStatus: 'approved', wallet: { earnings: 1000, dues: 0, cashLimit: 10000 } });

  // 1. Refund runs once, even when fired twice in parallel
  const { refundBookingToWallet } = require('../services/refundService');
  const paidId = oid();
  await db.collection('bookings').insertOne(bookingDoc({ _id: paidId, userId, vendorId, bookingNumber: 'BK1', status: 'cancelled', paymentStatus: 'success', finalAmount: 500 }));
  const refunds = await Promise.allSettled([1, 2].map(() => refundBookingToWallet({ bookingId: paidId })));
  assert.strictEqual(refunds.filter(r => r.status === 'fulfilled').length, 1, 'exactly one refund');
  assert.strictEqual((await db.collection('users').findOne({ _id: userId })).wallet.balance, 500, 'wallet credited once');

  // 2. Cash confirm: wrong/missing OTP rejected, double confirm counted once, other vendor can't touch it
  const cash = require('../controllers/bookingControllers/cashCollectionController');
  const cashId = oid();
  await db.collection('bookings').insertOne(bookingDoc({ _id: cashId, userId, vendorId, workerId, bookingNumber: 'BK2', status: 'work_done', paymentStatus: 'pending', paymentMethod: 'pay_at_home', finalAmount: 300, customerConfirmationOTP: '4321' }));
  const vendorReq = (body) => ({ params: { id: String(cashId) }, body, user: { _id: vendorId }, userRole: 'VENDOR', app });

  let res = mockRes(); await cash.confirmCashCollection(vendorReq({ otp: '' }), res);
  assert.strictEqual(res.code, 400, 'empty OTP rejected');
  res = mockRes(); await cash.confirmCashCollection({ ...vendorReq({ otp: '4321' }), user: { _id: oid() } }, res);
  assert.strictEqual(res.code, 404, 'other vendor cannot confirm');
  const cashRes = [mockRes(), mockRes()];
  await Promise.all(cashRes.map(r => cash.confirmCashCollection(vendorReq({ otp: '4321', amount: 999999 }), r)));
  const v = await db.collection('vendors').findOne({ _id: vendorId });
  assert.strictEqual(v.wallet.dues, 300, 'dues added once, client amount ignored');

  // 3. Withdrawal approve: two parallel approvals debit once; approved one can't be rejected
  const settlement = require('../controllers/adminControllers/settlementController');
  const wId = oid();
  await db.collection('withdrawals').insertOne({ _id: wId, vendorId, amount: 400, status: 'pending' });
  const adminReq = (body = {}) => ({ params: { withdrawalId: String(wId) }, body, user: { id: oid() }, app });
  await Promise.all([1, 2].map(() => settlement.approveWithdrawal(adminReq({ transactionReference: 'T1' }), mockRes())));
  assert.strictEqual((await db.collection('vendors').findOne({ _id: vendorId })).wallet.earnings, 600, 'earnings debited once');
  res = mockRes(); await settlement.rejectWithdrawal(adminReq({ rejectionReason: 'x' }), res);
  assert.strictEqual(res.code, 400, 'approved withdrawal cannot be rejected');

  // 4. Super-admin gate
  const { isSuperAdmin } = require('../middleware/roleMiddleware');
  let passed = false;
  res = mockRes(); await isSuperAdmin({ userRole: 'ADMIN', user: { role: 'admin' } }, res, () => { passed = true; });
  assert.ok(!passed && res.code === 403, 'plain admin blocked');
  await isSuperAdmin({ userRole: 'ADMIN', user: { role: 'super_admin' } }, mockRes(), () => { passed = true; });
  assert.ok(passed, 'super admin allowed');

  // 5. Bad Razorpay signature never reaches the gateway
  const { verifyAndClaimPayment } = require('../services/razorpayService');
  const bad = await verifyAndClaimPayment('order_x', 'pay_x', 'not-a-signature');
  assert.strictEqual(bad.status, 400, 'bad signature rejected');

  console.log('moneyGuards: all checks passed');
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
})().catch(async (err) => {
  console.error('moneyGuards FAILED:', err.message);
  process.exit(1);
});
