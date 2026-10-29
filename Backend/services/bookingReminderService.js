const Booking = require('../models/Booking');
const { createNotification } = require('../controllers/notificationControllers/notificationController');

/**
 * Booking Reminder Service
 * Scans active and upcoming bookings to send real-time reminders when slot times are near.
 */

// Check upcoming bookings starting in the next 30 minutes
async function checkUpcomingSlotBookings() {
  try {
    const now = Date.now();
    // Query bookings that are scheduled/accepted and haven't had a start reminder sent
    const bookings = await Booking.find({
      status: { $in: ['scheduled', 'accepted'] },
      startReminderSent: { $ne: true }
    });

    for (const booking of bookings) {
      if (!booking.scheduledDate) continue;

      // Construct start Date object by merging scheduledDate and scheduledTime/timeSlot.start
      const startDateTime = new Date(booking.scheduledDate);
      const startStr = booking.timeSlot?.start || booking.scheduledTime || '';
      const match = startStr.match(/(\d{1,2}):(\d{2})/);
      
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        startDateTime.setHours(hours, minutes, 0, 0);
      } else {
        // Fallback to start of day if time cannot be parsed
        startDateTime.setHours(9, 0, 0, 0); // Default to 9:00 AM
      }

      const timeDiff = startDateTime.getTime() - now;
      
      // If start time is within 30 minutes (and in the future or very recent past e.g. -5 mins)
      if (timeDiff > -5 * 60 * 1000 && timeDiff <= 30 * 60 * 1000) {
        console.log(`[BookingReminder] Sending start reminder for booking ${booking.bookingNumber}`);
        
        // 1. Notify User
        await createNotification({
          userId: booking.userId,
          type: 'booking_approaching',
          title: '⏰ Booking Starting Soon!',
          message: `Your booking for ${booking.serviceName} is starting soon at ${startStr || 'scheduled time'}.`,
          relatedId: booking._id,
          relatedType: 'Booking',
          priority: 'high'
        });

        // 2. Notify Vendor (if assigned)
        if (booking.vendorId) {
          await createNotification({
            vendorId: booking.vendorId,
            type: 'booking_approaching',
            title: '⏰ Job Starting Soon!',
            message: `Your job for ${booking.serviceName} is scheduled to start soon at ${startStr || 'scheduled time'}.`,
            relatedId: booking._id,
            relatedType: 'Booking',
            priority: 'high'
          });
        }

        // Mark as sent
        booking.startReminderSent = true;
        await booking.save();
      }
    }
  } catch (error) {
    console.error('[BookingReminder] Error checking upcoming bookings:', error);
  }
}

// Check in-progress hourly/daily rentals ending in the next 15 minutes
async function checkEndingSlotBookings() {
  try {
    const now = Date.now();
    // Query in-progress bookings that haven't had an end reminder sent
    const bookings = await Booking.find({
      status: 'in_progress',
      endReminderSent: { $ne: true }
    });

    for (const booking of bookings) {
      if (!booking.startedAt) continue;

      const startedTime = new Date(booking.startedAt).getTime();
      const duration = booking.estimatedDuration || 1;
      
      // Calculate duration in milliseconds
      const durationMs = booking.rental_type === 'minute'
        ? duration * 60 * 1000
        : booking.rental_type === 'daily'
          ? duration * 24 * 60 * 60 * 1000
          : duration * 60 * 60 * 1000;

      const endDateTime = startedTime + durationMs;
      const timeDiff = endDateTime - now;

      // If slot is ending in the next 15 minutes (and hasn't ended more than 5 minutes ago)
      if (timeDiff > -5 * 60 * 1000 && timeDiff <= 15 * 60 * 1000) {
        console.log(`[BookingReminder] Sending end reminder for booking ${booking.bookingNumber}`);

        // 1. Notify User
        await createNotification({
          userId: booking.userId,
          type: 'booking_ending',
          title: '⏳ Rental Slot Ending Soon',
          message: `Your rental for ${booking.serviceName} is ending in 15 minutes.`,
          relatedId: booking._id,
          relatedType: 'Booking',
          priority: 'high'
        });

        // 2. Notify Vendor
        if (booking.vendorId) {
          await createNotification({
            vendorId: booking.vendorId,
            type: 'booking_ending',
            title: '⏳ Rental Slot Ending Soon',
            message: `Your rental slot for ${booking.serviceName} is ending in 15 minutes. Please prepare for collection.`,
            relatedId: booking._id,
            relatedType: 'Booking',
            priority: 'high'
          });
        }

        // Mark as sent
        booking.endReminderSent = true;
        await booking.save();
      }
    }
  } catch (error) {
    console.error('[BookingReminder] Error checking ending bookings:', error);
  }
}

/**
 * Start the Scheduler
 */
function startBookingReminderScheduler() {
  // Check every 5 minutes
  setInterval(async () => {
    try {
      await checkUpcomingSlotBookings();
      await checkEndingSlotBookings();
    } catch (err) {
      console.error('[BookingReminderScheduler] Error in run loop:', err);
    }
  }, 5 * 60 * 1000);

  // Run immediate initial checks on startup (delayed slightly to allow DB/Socket connections to stabilize)
  setTimeout(() => {
    checkUpcomingSlotBookings();
    checkEndingSlotBookings();
  }, 10000);

  console.log('✅ Booking Reminder Scheduler Initialized');
}

module.exports = {
  startBookingReminderScheduler
};
