// Booking number self-check on an in-memory MongoDB (never touches the real DB).
// Run: node tests/bookingNumber.test.js
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Booking = require('../models/Booking');

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  // The hook runs before field validation, so the number is set even on an otherwise incomplete doc
  const numberFor = async () => {
    const b = new Booking({});
    await b.validate().catch(() => {});
    return b.bookingNumber;
  };

  assert.strictEqual(await numberFor(), 'BKGA001');
  assert.strictEqual(await numberFor(), 'BKGA002');

  const concurrent = await Promise.all(Array.from({ length: 20 }, numberFor));
  assert.strictEqual(new Set(concurrent).size, 20, 'concurrent bookings must get unique numbers');

  assert.strictEqual(Booking.formatBookingNumber(7), 'BKGA007');
  assert.strictEqual(Booking.formatBookingNumber(1000), 'BKGA1000');

  console.log('bookingNumber.test.js: all checks passed');
  await mongoose.disconnect();
  await mongo.stop();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
