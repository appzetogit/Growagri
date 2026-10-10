const Booking = require('../../models/Booking');
const { validationResult } = require('express-validator');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../../utils/constants');
const { refundBookingToWallet } = require('../../services/refundService');
const { createNotification } = require('../notificationControllers/notificationController');

// Tell both sides of a booking what the admin did
const notifyParties = async (booking, title, message) => {
  const base = { type: 'general', title, message, relatedId: booking._id, relatedType: 'booking' };
  await createNotification({ ...base, userId: booking.userId }).catch(() => {});
  if (booking.vendorId) await createNotification({ ...base, vendorId: booking.vendorId }).catch(() => {});
};

/**
 * Get all bookings with filters and search
 */
const getAllBookings = async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      userId,
      vendorId,
      workerId,
      rental_type,
      serviceCategory,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {};

    if (status) {
      if (typeof status === 'string' && status.includes(',')) {
        const list = status.split(',').map(s => s.trim());
        const allVariants = new Set();
        list.forEach(s => {
          allVariants.add(s);
          allVariants.add(s.toLowerCase());
          allVariants.add(s.toUpperCase());
        });
        query.status = { $in: Array.from(allVariants) };
      } else if (typeof status === 'string') {
        query.status = { $in: [status, status.toLowerCase(), status.toUpperCase()] };
      } else {
        query.status = status;
      }
    }

    if (paymentStatus) {
      if (typeof paymentStatus === 'string' && paymentStatus.includes(',')) {
        const list = paymentStatus.split(',').map(s => s.trim());
        const allVariants = new Set();
        list.forEach(s => {
          allVariants.add(s);
          allVariants.add(s.toLowerCase());
          allVariants.add(s.toUpperCase());
        });
        query.paymentStatus = { $in: Array.from(allVariants) };
      } else if (typeof paymentStatus === 'string') {
        query.paymentStatus = { $in: [paymentStatus, paymentStatus.toLowerCase(), paymentStatus.toUpperCase()] };
      } else {
        query.paymentStatus = paymentStatus;
      }
    }
    if (userId) query.userId = userId;
    if (vendorId) query.vendorId = vendorId;
    if (workerId) query.workerId = workerId;
    if (rental_type) query.rental_type = rental_type;
    if (serviceCategory) query.serviceCategory = serviceCategory;

    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    // Search by booking number or service name
    if (search) {
      query.$or = [
        { bookingNumber: { $regex: search, $options: 'i' } },
        { serviceName: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get bookings
    const bookings = await Booking.find(query)
      .populate('userId', 'name phone email')
      .populate('vendorId', 'name businessName phone')
      .populate('serviceId', 'title iconUrl')
      .populate('categoryId', 'title slug')
      .populate('workerId', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings. Please try again.'
    });
  }
};

/**
 * Get booking details by ID
 */
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('userId', 'name phone email addresses')
      .populate('vendorId', 'name businessName phone email address')
      .populate('serviceId', 'title description iconUrl images')
      .populate('categoryId', 'title slug')
      .populate('workerId', 'name phone rating totalJobs completedJobs');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking. Please try again.'
    });
  }
};

/**
 * Cancel booking (admin)
 */
const cancelBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { cancellationReason, refund = true } = req.body;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    if (booking.status === BOOKING_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed booking'
      });
    }

    // Update booking
    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancelledAt = new Date();
    booking.cancelledBy = 'admin';
    booking.cancellationReason = cancellationReason || 'Cancelled by admin';

    await booking.save();

    let refundAmount = 0;
    if (refund && [PAYMENT_STATUS.SUCCESS, PAYMENT_STATUS.COLLECTED_BY_VENDOR].includes(booking.paymentStatus)) {
      ({ refundAmount } = await refundBookingToWallet({ bookingId: booking._id, reason: 'Cancelled by admin' }));
    }

    await notifyParties(
      booking,
      'Booking Cancelled',
      `Booking #${booking.bookingNumber} was cancelled by admin.${refundAmount ? ` ₹${refundAmount} refunded to wallet.` : ''}`
    );

    res.status(200).json({
      success: true,
      message: refundAmount ? `Booking cancelled and ₹${refundAmount} refunded` : 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking. Please try again.'
    });
  }
};

/**
 * Get booking analytics
 */
const getBookingAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Total bookings
    const totalBookings = await Booking.countDocuments(dateFilter);

    // Bookings by status
    const bookingsByStatus = await Booking.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Bookings by payment status
    const bookingsByPaymentStatus = await Booking.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' }
        }
      }
    ]);

    // Revenue analytics
    const revenueStats = await Booking.aggregate([
      {
        $match: {
          ...dateFilter,
          paymentStatus: 'success'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
          totalBookings: { $sum: 1 },
          averageBookingValue: { $avg: '$finalAmount' }
        }
      }
    ]);

    // Daily bookings trend (last 30 days)
    const dailyTrend = await Booking.aggregate([
      {
        $match: {
          ...dateFilter,
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$finalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBookings,
        bookingsByStatus: bookingsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        bookingsByPaymentStatus: bookingsByPaymentStatus.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount
          };
          return acc;
        }, {}),
        revenue: revenueStats[0] || {
          totalRevenue: 0,
          totalBookings: 0,
          averageBookingValue: 0
        },
        dailyTrend
      }
    });
  } catch (error) {
    console.error('Get booking analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics. Please try again.'
    });
  }
};

/**
 * Admin override: force a booking into any status (no money moves here)
 */
const overrideBookingStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!Object.values(BOOKING_STATUS).includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const previous = booking.status;
    booking.status = status;
    if (status === BOOKING_STATUS.COMPLETED && !booking.completedAt) booking.completedAt = new Date();
    if (status === BOOKING_STATUS.CANCELLED) {
      booking.cancelledAt = booking.cancelledAt || new Date();
      booking.cancelledBy = 'admin';
      booking.cancellationReason = note || booking.cancellationReason || 'Cancelled by admin';
    }
    await booking.save();

    await notifyParties(booking, 'Booking Updated', `Admin changed booking #${booking.bookingNumber} from ${previous} to ${status}.${note ? ` Note: ${note}` : ''}`);

    res.status(200).json({ success: true, message: `Status changed from ${previous} to ${status}`, data: booking });
  } catch (error) {
    console.error('Override booking status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update booking status' });
  }
};

/**
 * Admin refund (full or partial) of a paid booking to the customer's wallet
 */
const refundBooking = async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const { booking, refundAmount } = await refundBookingToWallet({ bookingId: req.params.id, amount, reason });
    await notifyParties(booking, 'Refund Processed', `₹${refundAmount} for booking #${booking.bookingNumber} has been refunded to the customer's wallet.`);
    res.status(200).json({ success: true, message: `₹${refundAmount} refunded to wallet`, data: { refundAmount } });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Failed to process refund' });
  }
};

module.exports = {
  getAllBookings,
  getBookingById,
  cancelBooking,
  overrideBookingStatus,
  refundBooking,
  getBookingAnalytics
};

