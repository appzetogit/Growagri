// Server-side booking price, slot conflicts, cancel/refund races, ecommerce quantity, notification
// ownership and OTP test-number matching. In-memory MongoDB (never touches the real DB).
// Run: node tests/bookingSecurity.test.js
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.TEST_PHONE_NUMBERS = '6268455485';

const User = require('../models/User');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const userBooking = require('../controllers/bookingControllers/userBookingController');
const payment = require('../controllers/paymentControllers/paymentController');
const ecommerce = require('../controllers/userControllers/productController');
const notifications = require('../controllers/notificationControllers/notificationController');
const userAuth = require('../controllers/userControllers/userAuthController');
const slots = require('../services/bookingSlotService');
const { isTestNumber } = require('../utils/redisOtp.util');

const call = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    status: (code) => ({ json: (data) => resolve({ code, data }) }),
    json: (data) => resolve({ code: 200, data })
  };
  Promise.resolve(handler({ params: {}, query: {}, body: {}, app: { get: () => null }, ...req }, res)).catch(reject);
});

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const db = mongoose.connection.db;
  const oid = () => new mongoose.Types.ObjectId();

  // ── Slot helpers (IST) ──
  assert.strictEqual(slots.istDayKey('2026-10-30T20:00:00Z'), '2026-10-31', '01:30 IST is the next day');
  assert.strictEqual(slots.istDayKey('2026-10-30'), '2026-10-30');
  assert.strictEqual(slots.slotStartInstant('2026-10-30', '07:00').toISOString(), '2026-10-30T01:30:00.000Z');
  assert.ok(slots.slotsOverlap({ start: '07:00', end: '08:00' }, { start: '07:30', end: '08:30' }));
  assert.ok(!slots.slotsOverlap({ start: '07:00', end: '08:00' }, { start: '08:00', end: '09:00' }), 'back-to-back slots are fine');
  assert.ok(slots.slotsOverlap({ start: '00:00', end: '23:59' }, { start: '14:00', end: '15:00' }), 'full day blocks the day');
  assert.deepStrictEqual(slots.effectiveSlot({ start: 'Forenoon (10AM-2PM)', end: 'x' }), { start: '10:00', end: '14:00' });

  // ── Fixtures ──
  await db.collection('settings').insertOne({ type: 'global', visitedCharges: 50, serviceGstPercentage: 18, rentalGstPercentage: 5 });
  const categoryId = oid();
  await db.collection('categories').insertOne({ _id: categoryId, title: 'Tractor', status: 'active' });
  const ownerId = oid();
  await db.collection('vendors').insertOne({ _id: ownerId, name: 'Owner', phone: '9000000001', approvalStatus: 'approved', isActive: true, wallet: { isBlocked: false } });
  const machineId = oid();
  await db.collection('vendorequipments').insertOne({
    _id: machineId, vendorId: ownerId, categoryId, name: 'Mahindra 575', isAvailable: true,
    pricing: { hourly: { price: 1000, isEnabled: true }, daily: { price: 5000, isEnabled: true } }
  });
  const userId = oid();
  const otherUserId = oid();
  await db.collection('users').insertMany([
    { _id: userId, name: 'Farmer', phone: '9111111111', isActive: true, wallet: { balance: 0, penalty: 0 } },
    { _id: otherUserId, name: 'Other', phone: '9222222222', isActive: true, wallet: { balance: 0, penalty: 0 } }
  ]);
  const user = await User.findById(userId);
  const asUser = { user, userRole: 'USER' };
  user.id = String(userId);

  const tomorrow = slots.istDayKey(new Date(Date.now() + 86400000));
  const baseBooking = (slot, extra = {}) => ({
    serviceId: String(machineId),
    rental_type: 'hourly',
    estimatedDuration: 2,
    bookingType: 'scheduled',
    paymentMethod: 'cash',
    scheduledDate: new Date(Date.parse(`${tomorrow}T10:00:00+05:30`)).toISOString(),
    scheduledTime: slot.start,
    timeSlot: slot,
    address: { addressLine1: 'Farm', city: 'Indore', state: 'MP', pincode: '452001', lat: 22.7, lng: 75.8 },
    ...extra
  });

  // ── 1. Client prices, discounts, GST and free membership are ignored ──
  const tampered = await call(userBooking.createBooking, {
    ...asUser,
    body: baseBooking({ start: '07:00', end: '08:00' }, {
      amount: 1, basePrice: 1, discount: 99999, tax: -5, visitingCharges: -1000, isPlusAdded: true,
      bookedItems: [{ serviceId: String(machineId), title: 'Mahindra 575', price: 1, quantity: 1 }]
    })
  });
  assert.strictEqual(tampered.code, 201, JSON.stringify(tampered.data));
  const created = tampered.data.data;
  assert.strictEqual(created.finalAmount, 2050, '2h x 1000 + 50 visit fee, no GST');
  assert.strictEqual(created.tax, 0, 'GST is not charged');
  assert.strictEqual(created.discount, 0);
  assert.strictEqual(String(created.vendorId), String(ownerId), 'machine booking goes to its owner');
  assert.strictEqual(String(created.equipmentId), String(machineId));
  assert.strictEqual((await User.findById(userId)).plans?.isActive, false, 'isPlusAdded no longer grants a plan');

  // ── 2. Same machine, overlapping slot → 409; free slot → 201 ──
  const clash = await call(userBooking.createBooking, { ...asUser, body: baseBooking({ start: '07:30', end: '08:30' }) });
  assert.strictEqual(clash.code, 409);
  assert.ok(clash.data.slotUnavailable);
  const free = await call(userBooking.createBooking, { ...asUser, body: baseBooking({ start: '09:00', end: '10:00' }) });
  assert.strictEqual(free.code, 201, JSON.stringify(free.data));

  // Availability endpoint agrees and suggests another day
  const avail = await call(userBooking.checkEquipmentAvailability, { ...asUser, query: { equipmentId: String(machineId), requestedDate: tomorrow, requestedTime: '07:00', requestedEndTime: '08:00' } });
  assert.strictEqual(avail.data.available, false);
  assert.ok(avail.data.nextAvailableSlot && !avail.data.nextAvailableSlot.startsWith(tomorrow));
  const availFree = await call(userBooking.checkEquipmentAvailability, { ...asUser, query: { equipmentId: String(machineId), requestedDate: tomorrow, requestedTime: '12:00', requestedEndTime: '13:00' } });
  assert.strictEqual(availFree.data.available, true);

  // ── 3. Past dates and absurd quantities are rejected ──
  const yesterday = slots.istDayKey(new Date(Date.now() - 86400000));
  const past = await call(userBooking.createBooking, { ...asUser, body: { ...baseBooking({ start: '12:00', end: '13:00' }), scheduledDate: `${yesterday}T05:00:00.000Z` } });
  assert.strictEqual(past.code, 400);
  const tiny = await call(userBooking.createBooking, { ...asUser, body: baseBooking({ start: '15:00', end: '16:00' }, { estimatedDuration: 0.01 }) });
  assert.strictEqual(tiny.code, 400);

  // ── 4. Parallel cancels refund once; /payments/refund can't pay out again ──
  const paid = await Booking.create({
    userId, serviceId: machineId, serviceName: 'Tractor', serviceCategory: 'Tractor', status: 'confirmed',
    paymentStatus: 'success', paymentMethod: 'wallet', finalAmount: 500, basePrice: 500,
    scheduledDate: new Date(Date.now() + 2 * 86400000), scheduledTime: '10:00', timeSlot: { start: '10:00', end: '11:00' },
    address: { addressLine1: 'Farm', city: 'Indore', state: 'MP', pincode: '452001' }
  });
  const cancels = await Promise.all([1, 2, 3].map(() => call(userBooking.cancelBooking, { ...asUser, params: { id: String(paid._id) } })));
  assert.strictEqual(cancels.filter(c => c.code === 200).length, 1, 'only one cancel wins');
  assert.strictEqual((await User.findById(userId)).wallet.balance, 500, 'refunded exactly once');
  const refundAgain = await call(payment.processRefund, { ...asUser, body: { bookingId: String(paid._id) } });
  assert.strictEqual(refundAgain.code, 404, 'cancellation already settled the payment');

  // Work in progress can't be cancelled
  const working = await Booking.create({
    userId, serviceId: machineId, serviceName: 'Tractor', serviceCategory: 'Tractor', status: 'in_progress',
    paymentStatus: 'success', paymentMethod: 'wallet', finalAmount: 700, basePrice: 700,
    scheduledDate: new Date(), scheduledTime: '10:00', timeSlot: { start: '10:00', end: '11:00' },
    address: { addressLine1: 'Farm', city: 'Indore', state: 'MP', pincode: '452001' }
  });
  const cancelWorking = await call(userBooking.cancelBooking, { ...asUser, params: { id: String(working._id) } });
  assert.strictEqual(cancelWorking.code, 400);
  assert.strictEqual((await User.findById(userId)).wallet.balance, 500);

  // ── 5. Negative ecommerce quantity can't credit the wallet ──
  const productId = oid();
  await db.collection('products').insertOne({ _id: productId, vendorId: ownerId, title: 'Urea', price: 500, stock: 100, approvalStatus: 'approved', status: 'active' });
  const negative = await call(ecommerce.placeOrder, { ...asUser, body: { productId: String(productId), quantity: -100, paymentType: 'wallet' } });
  assert.strictEqual(negative.code, 400);
  assert.strictEqual((await User.findById(userId)).wallet.balance, 500, 'wallet unchanged');

  // ── 6. Notifications are scoped to their owner ──
  const othersNote = await Notification.create({ userId: otherUserId, type: 'booking_cancelled', title: 'x', message: 'y' });
  const readOthers = await call(notifications.markAsRead, { ...asUser, params: { id: String(othersNote._id) } });
  assert.strictEqual(readOthers.code, 404);
  await call(notifications.markAllAsRead, asUser);
  assert.strictEqual((await Notification.findById(othersNote._id)).isRead, false, "read-all doesn't touch other users");
  const delOthers = await call(notifications.deleteNotification, { ...asUser, params: { id: String(othersNote._id) } });
  assert.strictEqual(delOthers.code, 404);

  // ── 7. Vendor accepting a catalog booking: needs a machine free for that slot ──
  const vendorBooking = require('../controllers/bookingControllers/vendorBookingController');
  const Vendor = require('../models/Vendor');
  const catalogBooking = (start, end) => Booking.create({
    userId, serviceId: categoryId, categoryId, serviceName: 'Tractor', serviceCategory: 'Tractor', status: 'searching',
    paymentStatus: 'pending', paymentMethod: 'cash', finalAmount: 1000, basePrice: 1000,
    scheduledDate: new Date(Date.parse(`${tomorrow}T10:00:00+05:30`)), scheduledTime: start, timeSlot: { start, end },
    address: { addressLine1: 'Farm', city: 'Indore', state: 'MP', pincode: '452001' }
  });
  const owner = await Vendor.findById(ownerId);
  owner.id = String(ownerId);
  const asVendor = { user: owner, userRole: 'VENDOR' };
  const busySlot = await catalogBooking('07:00', '08:00'); // the owner's only machine is booked 07-08 (test 1)
  const acceptBusy = await call(vendorBooking.acceptBooking, { ...asVendor, params: { id: String(busySlot._id) } });
  assert.strictEqual(acceptBusy.code, 409, 'no free machine for that slot');
  const freeSlot = await catalogBooking('13:00', '14:00');
  const acceptFree = await call(vendorBooking.acceptBooking, { ...asVendor, params: { id: String(freeSlot._id) } });
  assert.strictEqual(acceptFree.code, 200, JSON.stringify(acceptFree.data));
  assert.strictEqual(String((await Booking.findById(freeSlot._id)).equipmentId), String(machineId), 'free machine linked');
  assert.notStrictEqual((await Vendor.findById(ownerId)).availability, 'ON_JOB', 'vendor stays available for other slots');

  // ── 8. Test numbers match exactly (no "x6268455485" bypass) ──
  assert.ok(isTestNumber('6268455485'));
  assert.ok(!isTestNumber('16268455485') && !isTestNumber('x6268455485') && !isTestNumber({ $ne: null }));
  const bypass = await call(userAuth.verifyLogin, { body: { phone: '16268455485', otp: '123456' } });
  assert.strictEqual(bypass.code, 400);

  console.log('bookingSecurity.test.js: all checks passed');
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
