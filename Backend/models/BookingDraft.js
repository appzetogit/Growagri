const mongoose = require('mongoose');
const Booking = require('./Booking');

// Prepay ("Pay Now") bookings live here until the payment succeeds, so an unpaid booking never
// shows up for admin, vendors or the farmer's booking list, and never takes a BKGA number.
// Same shape as Booking; unpaid drafts are removed automatically after 24h.
const draftSchema = Booking.schema.clone();
draftSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

/**
 * Find the real booking matching `filter`; if only a draft matches, turn it into a real booking
 * (keeping its _id, assigning the BKGA number) and return that. Safe to call twice concurrently.
 */
draftSchema.statics.promote = async function (filter) {
  const existing = await Booking.findOne(filter);
  if (existing) return existing;

  // Atomically claim the draft so only one request creates the booking (and takes a BKGA number)
  const draft = await this.findOneAndDelete(filter).lean();
  if (!draft) {
    // No draft, or a concurrent request claimed it and is still inserting: give it a moment
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const booking = await Booking.findOne(filter);
      if (booking) return booking;
    }
    return null;
  }

  const { bookingNumber, __v, ...data } = draft;
  try {
    await Booking.create(data);
  } catch (err) {
    await this.collection.insertOne(draft).catch(() => {}); // put the draft back so the payment can be retried
    throw err;
  }
  return Booking.findOne(filter);
};

/** Real booking or still-unpaid draft (for steps that don't need the booking to exist yet) */
draftSchema.statics.findPayable = async function (filter) {
  return (await Booking.findOne(filter)) || this.findOne(filter);
};

module.exports = mongoose.model('BookingDraft', draftSchema, 'bookingdrafts');
