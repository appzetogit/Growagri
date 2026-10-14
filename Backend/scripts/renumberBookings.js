// One-time: give old bookings the short BKGA### number, oldest first, and move the
// counter past them so new bookings continue the sequence.
// Dry run (default): node scripts/renumberBookings.js
// Apply:             node scripts/renumberBookings.js --apply
require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Counter = require('../models/Counter');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI);

  const isNew = /^BKGA\d+$/;
  const all = await Booking.find({}).select('bookingNumber createdAt').sort({ createdAt: 1 }).lean();
  let seq = Math.max(0, ...all.filter(b => isNew.test(b.bookingNumber)).map(b => Number(b.bookingNumber.slice(4))));

  for (const b of all.filter(b => !isNew.test(b.bookingNumber))) {
    const next = Booking.formatBookingNumber(++seq);
    console.log(`${b.bookingNumber} -> ${next}`);
    if (apply) await Booking.updateOne({ _id: b._id }, { $set: { bookingNumber: next } });
  }

  const counter = await Counter.findById('bookingNumber');
  if (apply && (!counter || counter.seq < seq)) {
    await Counter.updateOne({ _id: 'bookingNumber' }, { $set: { seq } }, { upsert: true });
  }
  console.log(apply ? `Done. Next booking will be ${Booking.formatBookingNumber(seq + 1)}` : 'Dry run only. Re-run with --apply to save.');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
