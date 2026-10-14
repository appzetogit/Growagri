// Soil test money flow self-check on an in-memory MongoDB (never touches the real DB).
// Run: node tests/soilTest.test.js
process.env.JWT_SECRET ||= 'test';
process.env.JWT_REFRESH_SECRET ||= 'test';
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const mockRes = () => ({ code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const oid = () => new mongoose.Types.ObjectId();

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const db = mongoose.connection.db;

  const userId = oid(), vendorId = oid();
  await db.collection('users').insertOne({ _id: userId, name: 'U', phone: '1', isActive: true, wallet: { balance: 1000 } });
  await db.collection('vendors').insertOne({ _id: vendorId, name: 'V', phone: '2', isActive: true, wallet: { earnings: 0, dues: 0 } });

  const userCtl = require('../controllers/userControllers/soilTestController');
  const adminCtl = require('../controllers/adminControllers/soilTestController');
  const vendorCtl = require('../controllers/vendorControllers/vendorSoilTestController');
  const SoilTestRequest = require('../models/SoilTestRequest');

  // 1. Admin sets prices + commission
  let res = mockRes();
  await adminCtl.updateSoilTestSettings({ body: { basicPrice: 400, advancedPrice: 900, commissionPercentage: 10 } }, res);
  assert.strictEqual(res.code, 200, JSON.stringify(res.body));

  const form = { landSize: '5 Acre', location: 'Indore', testType: 'Basic', phoneNumber: '1' };
  const user = { id: userId.toString(), name: 'U' };

  // 2. Wallet pay & submit charges the admin price, not anything the client sends
  res = mockRes();
  await userCtl.createSoilTestRequest({ user, body: { ...form, totalAmount: 1, paymentMethod: 'wallet' } }, res);
  assert.strictEqual(res.code, 201, JSON.stringify(res.body));
  const reqId = res.body.data._id;
  let doc = await SoilTestRequest.findById(reqId);
  assert.strictEqual(doc.totalAmount, 400);
  assert.strictEqual(doc.vendorEarning, 360);
  assert.strictEqual(doc.paymentStatus, 'paid');
  assert.strictEqual((await db.collection('users').findOne({ _id: userId })).wallet.balance, 600);

  // 3. Not enough balance for Advanced (900 > 600): nothing is debited or created
  res = mockRes();
  await userCtl.createSoilTestRequest({ user, body: { ...form, testType: 'Advanced', paymentMethod: 'wallet' } }, res);
  assert.strictEqual(res.code, 400);
  assert.strictEqual((await db.collection('users').findOne({ _id: userId })).wallet.balance, 600);
  assert.strictEqual(await SoilTestRequest.countDocuments(), 1);

  // 4. Assign → vendor uploads → admin rejects → vendor re-uploads
  res = mockRes();
  await adminCtl.assignVendor({ params: { id: reqId }, body: { vendorId } }, res);
  assert.strictEqual(res.code, 200, JSON.stringify(res.body));
  const vendorReq = (url) => ({ params: { id: reqId }, body: { reportUrl: url }, user: { _id: vendorId, name: 'V' } });
  res = mockRes(); await vendorCtl.uploadReport(vendorReq('http://r1'), res);
  assert.strictEqual(res.code, 200, JSON.stringify(res.body));
  res = mockRes(); await vendorCtl.uploadReport(vendorReq('http://r1b'), res);
  assert.strictEqual(res.code, 400, 'cannot re-upload while under review');
  res = mockRes(); await adminCtl.rejectReport({ params: { id: reqId }, body: { reason: 'blurry' } }, res);
  assert.strictEqual(res.code, 200, JSON.stringify(res.body));
  res = mockRes(); await vendorCtl.uploadReport(vendorReq('http://r2'), res);
  assert.strictEqual(res.code, 200, 'can re-upload after rejection');

  // 5. Approve fired twice in parallel credits the vendor exactly once
  const r1 = mockRes(), r2 = mockRes();
  await Promise.all([
    adminCtl.approveReport({ params: { id: reqId }, body: {} }, r1),
    adminCtl.approveReport({ params: { id: reqId }, body: {} }, r2)
  ]);
  assert.deepStrictEqual([r1.code, r2.code].sort(), [200, 400]);
  assert.strictEqual((await db.collection('vendors').findOne({ _id: vendorId })).wallet.earnings, 360);
  doc = await SoilTestRequest.findById(reqId);
  assert.strictEqual(doc.reportStatus, 'approved');
  assert.strictEqual(doc.reportUrl, 'http://r2');

  // 6. Paid requests can't be deleted by admin
  res = mockRes(); await adminCtl.deleteSoilTestRequest({ params: { id: reqId } }, res);
  assert.strictEqual(res.code, 400);

  console.log('soil test checks passed');
  await new Promise(r => setTimeout(r, 500)); // let fire-and-forget notifications finish
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
