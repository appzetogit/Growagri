const Booking = require('../models/Booking');
const BookingRequest = require('../models/BookingRequest');
const { createNotification } = require('../controllers/notificationControllers/notificationController');

const WAVE_1_COUNT = 3;

/**
 * Alert the closest vendors (wave 1) about a booking: BookingRequest rows, instant socket popup,
 * then DB/push notifications. Later waves are handled by bookingScheduler (status 'searching').
 * Uses booking.potentialVendors (sorted by distance) saved at booking creation.
 * Returns the number of vendors alerted.
 */
const dispatchWave1 = async (bookingId, io) => {
  const booking = await Booking.findById(bookingId).populate('userId', 'name phone');
  if (!booking) return 0;

  const wave1 = (booking.potentialVendors || []).slice(0, WAVE_1_COUNT);
  booking.currentWave = 1;
  booking.waveStartedAt = new Date();
  booking.notifiedVendors = wave1.map(v => v.vendorId);
  await booking.save();

  if (wave1.length === 0) {
    console.warn(`[Dispatch] No vendors found nearby for booking ${booking._id}`);
    return 0;
  }

  try {
    await BookingRequest.insertMany(wave1.map(v => ({
      bookingId: booking._id,
      vendorId: v.vendorId,
      status: 'PENDING',
      wave: 1,
      distance: v.distance || null,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    })), { ordered: false });
  } catch (err) {
    if (err.code !== 11000) console.error('[Dispatch] BookingRequest insert error:', err);
  }

  const user = booking.userId || {};
  // Socket first so vendors get the popup instantly
  if (io) {
    wave1.forEach(v => {
      io.to(`vendor_${v.vendorId}`).emit('new_booking_request', {
        bookingId: booking._id,
        serviceName: booking.serviceName,
        serviceCategory: booking.serviceCategory,
        customerName: user.name,
        customerPhone: user.phone,
        scheduledDate: booking.scheduledDate,
        scheduledTime: booking.scheduledTime,
        price: booking.finalAmount,
        basePrice: booking.basePrice,
        address: booking.address,
        distance: v.distance,
        brandName: booking.brandName || '',
        brandIcon: booking.brandIcon || '',
        rental_type: booking.rental_type || '',
        estimatedDuration: booking.estimatedDuration || '',
        landSize: booking.landSize || '',
        paymentStatus: booking.paymentStatus,
        playSound: true,
        message: `New booking request within ${v.distance?.toFixed?.(1) || '?'}km!`
      });
    });
  } else {
    console.error('[Dispatch] Socket.IO instance not available');
  }

  // DB + push notifications in background
  Promise.all(wave1.map(v => createNotification({
    vendorId: v.vendorId,
    type: 'booking_request',
    title: 'New Booking Request',
    message: `New service request for ${booking.serviceName} from ${user.name || 'a farmer'}`,
    relatedId: booking._id,
    relatedType: 'booking',
    data: {
      bookingId: booking._id,
      serviceName: booking.serviceName,
      customerName: user.name,
      customerPhone: user.phone,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      location: booking.address,
      price: booking.finalAmount,
      distance: v.distance
    },
    pushData: { type: 'new_booking', dataOnly: false, link: `/vendor/booking/${booking._id}` }
  }))).catch(err => console.error('[Dispatch] notification error:', err));

  console.log(`[Dispatch] Wave 1: alerted ${wave1.length} vendors for booking ${booking._id}`);
  return wave1.length;
};

module.exports = { dispatchWave1 };
