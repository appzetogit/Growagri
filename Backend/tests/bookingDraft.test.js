// Pay Now drafts self-check on an in-memory MongoDB (never touches the real DB).
// Run: node tests/bookingDraft.test.js
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Booking = require('../models/Booking');
const BookingDraft = require('../models/BookingDraft');

const oid = () => new mongoose.Types.ObjectId();
const draftData = (userId, orderId) => ({
  userId, serviceId: oid(), serviceName: 'Tractor', serviceCategory: 'Agri',
  basePrice: 900, finalAmount: 900, scheduledDate: new Date(), scheduledTime: 'ASAP',
  timeSlot: { start: 'Now', end: '45 mins' },
  address: { addressLine1: 'x', city: 'x', state: 'x', pincode: '000000' },
  status: 'awaiting_payment', paymentStatus: 'pending', paymentMethod: 'online', paymentMode: 'online',
  razorpayOrderId: orderId
});

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const userId = oid();
  const draft = await BookingDraft.create(draftData(userId, 'order_1'));

  // Unpaid: not a booking anywhere, no BKGA number used
  assert.ok(draft.bookingNumber.startsWith('DRAFT'), 'draft gets a placeholder number');
  assert.strictEqual(await Booking.countDocuments(), 0, 'unpaid booking is invisible to booking queries');
  assert.strictEqual(String((await BookingDraft.findPayable({ _id: draft._id, userId }))._id), String(draft._id));

  // Paid: promoted twice at once (client verify + retry) -> exactly one real booking, same id, first BKGA number
  const filter = { razorpayOrderId: 'order_1', userId, paymentStatus: { $ne: 'success' } };
  const [a, b] = await Promise.all([BookingDraft.promote(filter), BookingDraft.promote(filter)]);
  assert.strictEqual(String(a._id), String(draft._id), 'keeps the draft id');
  assert.strictEqual(String(b._id), String(draft._id));
  assert.strictEqual(a.bookingNumber, 'BKGA001', 'BKGA number assigned only after payment');
  assert.strictEqual(await Booking.countDocuments(), 1, 'exactly one booking');
  assert.strictEqual(await BookingDraft.countDocuments(), 0, 'draft removed');

  // Unknown order -> nothing created
  assert.strictEqual(await BookingDraft.promote({ razorpayOrderId: 'nope', userId }), null);

  // An abandoned draft never consumes a number
  await BookingDraft.create(draftData(userId, 'order_2'));
  const next = await BookingDraft.promote({ razorpayOrderId: 'order_2', userId });
  assert.strictEqual(next.bookingNumber, 'BKGA002', 'numbers stay gap-free');

  console.log('bookingDraft.test.js: all checks passed');
  await mongoose.disconnect();
  await mongo.stop();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
