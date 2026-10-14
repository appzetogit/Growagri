// Admin vendor-wallet edit self-check on an in-memory MongoDB (never touches the real DB).
// Run: node tests/vendorWalletEdit.test.js
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { updateVendorWallet } = require('../controllers/adminControllers/settlementController');

const call = (vendorId, body) => new Promise(resolve => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ code: this.code, ...d }); } };
  updateVendorWallet({ params: { vendorId: String(vendorId) }, body, user: { _id: 'admin1' } }, res);
});

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const db = mongoose.connection.db;
  const vendorId = new mongoose.Types.ObjectId();
  await db.collection('vendors').insertOne({ _id: vendorId, name: 'V', wallet: { earnings: 2430, dues: 1000, cashLimit: 10000 } });
  const wallet = async () => (await db.collection('vendors').findOne({ _id: vendorId })).wallet;

  // Guards
  assert.strictEqual((await call(vendorId, { earnings: 1, dues: 1000, cashLimit: 10000, expectedEarnings: 2430, expectedDues: 1000 })).code, 400, 'reason required');
  assert.strictEqual((await call(vendorId, { earnings: -5, dues: 1000, cashLimit: 10000, expectedEarnings: 2430, expectedDues: 1000, reason: 'x' })).code, 400, 'no negatives');
  assert.strictEqual((await call(vendorId, { earnings: 2000, dues: 1000, cashLimit: 10000, expectedEarnings: 2000, expectedDues: 1000, reason: 'x' })).code, 409, 'stale screen refused');
  assert.deepStrictEqual(await wallet(), { earnings: 2430, dues: 1000, cashLimit: 10000 }, 'nothing changed by refused edits');

  // Valid edit: two fields change -> two audit entries
  const ok = await call(vendorId, { earnings: 2000, dues: 1000, cashLimit: 15000, expectedEarnings: 2430, expectedDues: 1000, reason: 'Manual correction' });
  assert.strictEqual(ok.code, 200);
  assert.deepStrictEqual(await wallet(), { earnings: 2000, dues: 1000, cashLimit: 15000 });
  const audit = await db.collection('transactions').find({ vendorId, type: 'wallet_adjustment' }).toArray();
  assert.deepStrictEqual(audit.map(a => [a.metadata.field, a.metadata.before, a.metadata.after, a.amount]).sort(),
    [['cashLimit', 10000, 15000, 5000], ['earnings', 2430, 2000, 430]]);
  assert.ok(audit.every(a => a.description.includes('Reason: Manual correction')));

  console.log('vendorWalletEdit.test.js: all checks passed');
  await mongoose.disconnect();
  await mongo.stop();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
