const Booking = require('../models/Booking');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Transaction = require('../models/Transaction');
const { PAYMENT_STATUS } = require('../utils/constants');

/**
 * Refund a paid booking to the customer's wallet — once.
 * The booking is atomically flipped to REFUNDED first, so a double click / two admins can't refund twice.
 * ponytail: one refund per booking (partial allowed); add a refunds[] ledger on Booking if multiple partial refunds are needed.
 */
const refundBookingToWallet = async ({ bookingId, amount, reason }) => {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, paymentStatus: { $in: [PAYMENT_STATUS.SUCCESS, PAYMENT_STATUS.COLLECTED_BY_VENDOR] } },
    { $set: { paymentStatus: PAYMENT_STATUS.REFUNDED } },
    { new: false }
  );
  if (!booking) throw Object.assign(new Error('Booking is not paid or was already refunded'), { status: 400 });

  const refundAmount = Math.min(Number(amount) || booking.finalAmount, booking.finalAmount);
  if (!(refundAmount > 0)) {
    await Booking.updateOne({ _id: bookingId }, { $set: { paymentStatus: booking.paymentStatus } });
    throw Object.assign(new Error('Refund amount must be greater than 0'), { status: 400 });
  }

  const user = await User.findByIdAndUpdate(booking.userId, { $inc: { 'wallet.balance': refundAmount } }, { new: true });
  await Transaction.create({
    userId: booking.userId,
    bookingId: booking._id,
    type: 'refund',
    amount: refundAmount,
    status: 'completed',
    paymentMethod: 'wallet',
    description: `Refund for booking #${booking.bookingNumber}${reason ? ` — ${reason}` : ''}`,
    balanceAfter: user?.wallet?.balance || 0
  });

  return { booking, refundAmount };
};

/**
 * Take money back from a vendor's earnings (e.g. dispute decided against the vendor).
 */
const deductVendorEarnings = async ({ vendorId, bookingId, amount, reason }) => {
  const value = Number(amount) || 0;
  if (!vendorId || value <= 0) return 0;
  await Vendor.updateOne({ _id: vendorId }, { $inc: { 'wallet.earnings': -value } });
  await Transaction.create({
    vendorId,
    bookingId,
    type: 'penalty',
    amount: value,
    status: 'completed',
    paymentMethod: 'system',
    description: reason || 'Adjustment by admin'
  });
  return value;
};

module.exports = { refundBookingToWallet, deductVendorEarnings };
