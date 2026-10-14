// One-time: bookings deleted before delete started reversing money still count in vendor wallets.
// Finds vendor earnings/cash transactions whose booking no longer exists and reverses them.
// Dry run (default): node scripts/reverseDeletedBookingMoney.js
// Apply:             node scripts/reverseDeletedBookingMoney.js --apply
require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const Vendor = require('../models/Vendor');
const { reverseBookingVendorMoney } = require('../services/bookingMoneyReversal');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI);

  const bookingIds = await Transaction.distinct('bookingId', {
    vendorId: { $ne: null },
    bookingId: { $ne: null },
    status: 'completed',
    type: { $in: ['earnings_credit', 'cash_collected'] }
  });
  const existing = new Set((await Booking.find({ _id: { $in: bookingIds } }).select('_id').lean()).map(b => String(b._id)));
  const orphans = bookingIds.filter(id => !existing.has(String(id)));

  for (const bookingId of orphans) {
    const txs = await Transaction.find({ bookingId, vendorId: { $ne: null }, status: 'completed', type: { $in: ['earnings_credit', 'cash_collected'] } }).lean();
    const vendor = await Vendor.findById(txs[0].vendorId).select('name businessName wallet').lean();
    console.log(`Deleted booking ${bookingId} -> vendor ${vendor?.name} (${vendor?.businessName}):`,
      txs.map(t => `${t.type} ₹${t.amount} "${t.description}"`).join('; '));
    if (apply) {
      const reason = await reverseBookingVendorMoney(bookingId);
      console.log(reason ? `  NOT reversed: ${reason}` : '  reversed');
    }
  }

  console.log(orphans.length === 0 ? 'Nothing to fix.' : apply ? 'Done.' : 'Dry run only. Re-run with --apply to save.');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
