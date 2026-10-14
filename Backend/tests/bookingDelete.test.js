// Admin booking delete self-check on an in-memory MongoDB (never touches the real DB).
// Run: node tests/bookingDelete.test.js
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { hardDeleteBookings } = require('../controllers/bookingControllers/adminBookingController');

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const db = mongoose.connection.db;
  const oid = () => new mongoose.Types.ObjectId();

  const vendorId = oid(), poorVendorId = oid();
  const online = oid(), cash = oid(), running = oid(), disputed = oid(), withdrawn = oid();
  await db.collection('vendors').insertMany([
    // 2 bookings × ₹810 earned + ₹1062 cash collected for the cash one
    { _id: vendorId, wallet: { earnings: 1620, dues: 1062, totalCashCollected: 1062 } },
    // earned ₹810 but already withdrew it
    { _id: poorVendorId, wallet: { earnings: 0, dues: 0, totalCashCollected: 0 } }
  ]);
  await db.collection('bookings').insertMany([
    { _id: online, bookingNumber: 'BKGA001', status: 'completed', vendorId },
    { _id: cash, bookingNumber: 'BKGA002', status: 'completed', vendorId },
    { _id: running, bookingNumber: 'BKGA003', status: 'in_progress', vendorId },
    { _id: disputed, bookingNumber: 'BKGA004', status: 'completed', vendorId },
    { _id: withdrawn, bookingNumber: 'BKGA005', status: 'completed', vendorId: poorVendorId }
  ]);
  await db.collection('disputes').insertOne({ bookingId: disputed, status: 'pending' });
  await db.collection('bookingrequests').insertOne({ bookingId: online, vendorId: oid() });
  await db.collection('transactions').insertMany([
    { bookingId: online, vendorId, type: 'earnings_credit', amount: 810, status: 'completed', description: 'Earnings' },
    { bookingId: cash, vendorId, type: 'cash_collected', amount: 1062, status: 'completed', description: 'Cash' },
    { bookingId: cash, vendorId, type: 'earnings_credit', amount: 810, status: 'completed', description: 'Earnings' },
    { bookingId: online, userId: oid(), type: 'debit', amount: 900, status: 'completed', description: 'Farmer paid' },
    { bookingId: withdrawn, vendorId: poorVendorId, type: 'earnings_credit', amount: 810, status: 'completed', description: 'Earnings' }
  ]);
  await db.collection('vendorbills').insertMany([
    { bookingId: online, status: 'paid', grandTotal: 900 },
    { bookingId: withdrawn, status: 'paid', grandTotal: 1062 }
  ]);

  const { deleted, skipped } = await hardDeleteBookings([online, cash, running, disputed, withdrawn].map(String));

  assert.deepStrictEqual(deleted.sort(), [String(online), String(cash)].sort(), 'only finished, undisputed, reversible bookings are deleted');
  assert.deepStrictEqual(skipped.map(s => s.bookingNumber).sort(), ['BKGA003', 'BKGA004', 'BKGA005']);

  // Vendor wallet no longer counts the deleted bookings
  const v = await db.collection('vendors').findOne({ _id: vendorId });
  assert.deepStrictEqual(v.wallet, { earnings: 0, dues: 0, totalCashCollected: 0 }, 'earnings and cash dues reversed');

  // Vendor transactions kept for audit but cancelled; farmer's record untouched
  const vtx = await db.collection('transactions').find({ vendorId }).toArray();
  assert.ok(vtx.every(t => t.status === 'cancelled' && t.description.endsWith('(reversed: booking deleted by admin)')));
  assert.strictEqual((await db.collection('transactions').findOne({ type: 'debit' })).status, 'completed');
  assert.strictEqual((await db.collection('vendorbills').findOne({ bookingId: online })).status, 'cancelled', 'bill voided');

  // Withdrawn money: nothing changed for that booking
  assert.strictEqual((await db.collection('transactions').findOne({ bookingId: withdrawn })).status, 'completed');
  assert.strictEqual((await db.collection('transactions').findOne({ bookingId: withdrawn })).description, 'Earnings');
  assert.strictEqual((await db.collection('vendorbills').findOne({ bookingId: withdrawn })).status, 'paid');
  assert.strictEqual(await db.collection('bookings').countDocuments(), 3, 'skipped bookings remain');
  assert.strictEqual(await db.collection('bookingrequests').countDocuments({ bookingId: online }), 0, 'vendor requests removed');

  console.log('bookingDelete.test.js: all checks passed');
  await mongoose.disconnect();
  await mongo.stop();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
