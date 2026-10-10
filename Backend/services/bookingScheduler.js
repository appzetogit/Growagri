/**
 * Booking Scheduler Service
 * Handles Wave-Based Vendor Alerting
 * 
 * Wave Logic:
 * - Wave 1: First 3 closest vendors (alert immediately on booking creation)
 * - Wave 2: Next 3 vendors (after 15 seconds if no accept)
 * - Wave 3: Next 4 vendors (after another 15 seconds)
 * - Wave 4+: Remaining vendors
 */

const Booking = require('../models/Booking');
const Vendor = require('../models/Vendor');
const { BOOKING_STATUS } = require('../utils/constants');
const { createNotification } = require('../controllers/notificationControllers/notificationController');

// Wave configuration
const WAVE_CONFIG = {
  1: { count: 3, duration: 120000 }, // Wave 1: 3 vendors, 2 mins (120000ms)
  2: { count: 3, duration: 120000 }, // Wave 2: 3 vendors, 2 mins
  3: { count: 4, duration: 120000 }, // Wave 3: 4 vendors, 2 mins
  4: { count: Infinity, duration: 0 } // Wave 4: All remaining
};

// Calculate vendor index range for a wave
const getVendorRange = (wave) => {
  let start = 0;
  for (let i = 1; i < wave; i++) {
    start += WAVE_CONFIG[i]?.count || 0;
  }
  const config = WAVE_CONFIG[wave] || WAVE_CONFIG[4];
  const end = config.count === Infinity ? Infinity : start + config.count;
  return { start, end };
};

class BookingScheduler {
  constructor(io) {
    this.io = io;
    this.intervalId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('[BookingScheduler] Already running.');
      return;
    }

    this.isRunning = true;
    console.log('[BookingScheduler] Started - checking every 5 seconds');

    // Run immediately on start
    this.processWaves();

    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      this.processWaves();
    }, 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('[BookingScheduler] Stopped.');
    }
  }

  async processWaves() {
    try {
      const BookingRequest = require('../models/BookingRequest');

      // Find bookings that are searching and have wave data
      const bookings = await Booking.find({
        status: BOOKING_STATUS.SEARCHING,
        waveStartedAt: { $ne: null },
        potentialVendors: { $exists: true, $not: { $size: 0 } }
      });

      if (bookings.length === 0) return;

      const now = Date.now();

      for (const booking of bookings) {
        const currentWave = booking.currentWave || 1;
        const waveConfig = WAVE_CONFIG[currentWave] || WAVE_CONFIG[4];
        const waveStartTime = new Date(booking.waveStartedAt).getTime();
        const elapsed = now - waveStartTime;

        // Check if wave duration has passed
        if (elapsed >= waveConfig.duration && waveConfig.duration > 0) {
          // Move to next wave
          const nextWave = currentWave + 1;
          const { start, end } = getVendorRange(nextWave);

          // Get vendors for this wave
          let vendorsToNotify = booking.potentialVendors.slice(start, end === Infinity ? undefined : end);

          if (vendorsToNotify.length === 0) {
            // No more vendors to notify - keep searching or mark as no vendors
            console.log(`[BookingScheduler] Booking ${booking.bookingNumber}: No more vendors in Wave ${nextWave}`);
            continue;
          }

          // Filter to available, busy and offline vendors (include OFFLINE so they can receive push notifications)
          const vendorIds = vendorsToNotify.map(v => v.vendorId);
          const onlineVendors = await Vendor.find({
            _id: { $in: vendorIds },
            availability: { $in: ['AVAILABLE', 'BUSY', 'OFFLINE'] }
          }).select('_id');

          const onlineVendorIds = new Set(onlineVendors.map(v => v._id.toString()));
          vendorsToNotify = vendorsToNotify.filter(v => onlineVendorIds.has(v.vendorId.toString()));

          if (vendorsToNotify.length === 0) {
            console.log(`[BookingScheduler] Booking ${booking.bookingNumber}: Wave ${nextWave} - all vendors offline, skipping`);
            // Still advance wave to try next batch
            booking.currentWave = nextWave;
            booking.waveStartedAt = new Date();
            await booking.save();
            continue;
          }

          console.log(`[BookingScheduler] Booking ${booking.bookingNumber}: Advancing to Wave ${nextWave}, notifying ${vendorsToNotify.length} online vendors`);

          // Update booking wave status
          booking.currentWave = nextWave;
          booking.waveStartedAt = new Date();

          // Add to notifiedVendors
          const notifyIds = vendorsToNotify.map(v => v.vendorId);
          booking.notifiedVendors = [...booking.notifiedVendors, ...notifyIds];

          await booking.save();

          // Create BookingRequest entries for this wave
          const bookingRequests = vendorsToNotify.map(v => ({
            bookingId: booking._id,
            vendorId: v.vendorId,
            status: 'PENDING',
            wave: nextWave,
            distance: v.distance || null,
            sentAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000)
          }));

          try {
            await BookingRequest.insertMany(bookingRequests, { ordered: false });
          } catch (err) {
            if (err.code !== 11000) console.error('[BookingScheduler] BookingRequest insert error:', err);
          }

          // Send notifications to new wave vendors
          await this.notifyVendors(booking, vendorsToNotify);
        }
      }
    } catch (error) {
      console.error('[BookingScheduler] Error processing waves:', error);
    }
  }

  async notifyVendors(booking, vendors) {
    try {
      // Fetch booking details for notification
      const populatedBooking = await Booking.findById(booking._id)
        .populate('serviceId', 'title')
        .populate('userId', 'name phone');

      if (!populatedBooking) return;

      const notifications = vendors.map(async (v) => {
        // Create in-app notification
        await createNotification({
          vendorId: v.vendorId,
          type: 'booking_request',
          title: 'New Booking Request',
          message: `New service request for ${populatedBooking.serviceId?.title || populatedBooking.serviceName} from ${populatedBooking.userId?.name || 'Customer'}`,
          relatedId: booking._id,
          relatedType: 'booking',
          data: {
            bookingId: booking._id,
            serviceName: populatedBooking.serviceId?.title || populatedBooking.serviceName,
            customerName: populatedBooking.userId?.name,
            scheduledDate: populatedBooking.scheduledDate,
            scheduledTime: populatedBooking.scheduledTime,
            location: populatedBooking.address,
            price: populatedBooking.finalAmount,
            distance: v.distance
          },
          pushData: {
            type: 'new_booking',
            dataOnly: false,
            link: `/vendor/booking/${booking._id}`
          }
        });

        // Emit Socket.IO event
        if (this.io) {
          this.io.to(`vendor_${v.vendorId}`).emit('new_booking_request', {
            bookingId: booking._id,
            serviceName: populatedBooking.serviceId?.title || populatedBooking.serviceName,
            customerName: populatedBooking.userId?.name,
            scheduledDate: populatedBooking.scheduledDate,
            scheduledTime: populatedBooking.scheduledTime,
            price: populatedBooking.finalAmount,
            distance: v.distance,
            playSound: true,
            message: `New booking request within ${v.distance?.toFixed(1) || '?'}km!`
          });
        }
      });

      await Promise.all(notifications);
      console.log(`[BookingScheduler] Notified ${vendors.length} vendors for booking ${booking.bookingNumber}`);
    } catch (error) {
      console.error('[BookingScheduler] Error notifying vendors:', error);
    }
  }
}

// Singleton instance
let schedulerInstance = null;

const initializeScheduler = (io) => {
  if (!schedulerInstance) {
    schedulerInstance = new BookingScheduler(io);
    schedulerInstance.start();
  }
  return schedulerInstance;
};

const getScheduler = () => schedulerInstance;

module.exports = { BookingScheduler, initializeScheduler, getScheduler };
