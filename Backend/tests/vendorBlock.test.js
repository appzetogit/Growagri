// Blocked vendors get no booking alerts. In-memory MongoDB (never touches the real DB).
// Run: node tests/vendorBlock.test.js
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { withoutBlockedVendors } = require('../services/bookingDispatchService');

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const oid = () => new mongoose.Types.ObjectId();

  const open = oid(), blocked = oid(), noWallet = oid();
  await mongoose.connection.db.collection('vendors').insertMany([
    { _id: open, wallet: { isBlocked: false } },
    { _id: blocked, wallet: { isBlocked: true } },
    { _id: noWallet }
  ]);

  const candidates = [{ vendorId: blocked, distance: 1 }, { vendorId: open, distance: 2 }, { vendorId: noWallet, distance: 3 }];
  const result = await withoutBlockedVendors(candidates);
  assert.deepStrictEqual(result.map(v => String(v.vendorId)), [String(open), String(noWallet)], 'blocked vendor dropped, order kept');
  assert.deepStrictEqual(await withoutBlockedVendors([]), []);

  console.log('vendorBlock.test.js: all checks passed');
  await mongoose.disconnect();
  await mongo.stop();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
