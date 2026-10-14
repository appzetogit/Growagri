const Transaction = require('../models/Transaction');
const Vendor = require('../models/Vendor');
const VendorBill = require('../models/VendorBill');

const REVERSIBLE_TYPES = ['earnings_credit', 'cash_collected'];

/**
 * Undo a booking's effect on the vendor wallet (used when admin deletes a booking):
 * the earnings credited for it and the cash dues it created are taken back, its vendor
 * transactions are marked cancelled (kept for audit) and its bill is voided.
 * Order matters: transactions are cancelled first, so a crash midway can under-reverse
 * but never reverse twice.
 * @returns {Promise<string|null>} reason it can't be reversed, or null when done
 */
const reverseBookingVendorMoney = async (bookingId) => {
  const txs = await Transaction.find({
    bookingId,
    vendorId: { $ne: null },
    status: 'completed',
    type: { $in: REVERSIBLE_TYPES }
  }).select('_id vendorId type amount').lean();

  if (txs.length > 0) {
    // ponytail: assumes one vendor per booking (true today); per-vendor loop if that changes
    const vendorId = txs[0].vendorId;
    const earning = txs.filter(t => t.type === 'earnings_credit').reduce((s, t) => s + t.amount, 0);
    const cash = txs.filter(t => t.type === 'cash_collected').reduce((s, t) => s + t.amount, 0);
    const txIds = txs.map(t => t._id);

    await Transaction.updateMany({ _id: { $in: txIds }, status: 'completed' }, [
      { $set: { status: 'cancelled', description: { $concat: [{ $ifNull: ['$description', ''] }, ' (reversed: booking deleted by admin)'] } } }
    ]);

    const updated = await Vendor.updateOne(
      { _id: vendorId, 'wallet.earnings': { $gte: earning }, 'wallet.dues': { $gte: cash } },
      { $inc: { 'wallet.earnings': -earning, 'wallet.dues': -cash, 'wallet.totalCashCollected': -cash } }
    );
    if (updated.modifiedCount === 0) {
      // Vendor already withdrew the earning or settled the cash: undo and refuse
      await Transaction.updateMany({ _id: { $in: txIds } }, [
        { $set: { status: 'completed', description: { $replaceAll: { input: '$description', find: ' (reversed: booking deleted by admin)', replacement: '' } } } }
      ]);
      return "Vendor already withdrew or settled this booking's money";
    }
  }

  await VendorBill.updateMany({ bookingId }, { $set: { status: 'cancelled' } });
  return null;
};

module.exports = { reverseBookingVendorMoney };
