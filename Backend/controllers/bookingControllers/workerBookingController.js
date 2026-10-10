const Booking = require('../../models/Booking');
const { validationResult } = require('express-validator');
const { BOOKING_STATUS, PAYMENT_STATUS, isPaymentSettled } = require('../../utils/constants');

/**
 * Get assigned jobs for worker
 */
const getAssignedJobs = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { workerId };
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get bookings
    const bookings = await Booking.find(query)
      .populate('userId', 'name phone email')
      .populate('vendorId', 'name businessName phone')
      .populate('serviceId', 'title iconUrl')
      .populate('categoryId', 'title slug')
      .sort({ scheduledDate: 1, createdAt: -1 })
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
    console.error('Get assigned jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs. Please try again.'
    });
  }
};

/**
 * Get job details by ID
 */
const getJobById = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;

    const booking = await Booking.findOne({ _id: id, workerId })
      .populate('userId', 'name phone email')
      .populate('vendorId', 'name businessName phone email address')
      .populate('serviceId', 'title description iconUrl images')
      .populate('categoryId', 'title slug');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job. Please try again.'
    });
  }
};

/**
 * Update job status
 */
const updateJobStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const workerId = req.user.id;
    const { id } = req.params;
    // Workers can't set their own payment/settlement fields
    const { status } = req.body;

    const booking = await Booking.findOne({ _id: id, workerId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Validate status transition if status is changing
    if (status && status !== booking.status) {
      const validTransitions = {
        [BOOKING_STATUS.ASSIGNED]: [BOOKING_STATUS.VISITED, BOOKING_STATUS.IN_PROGRESS],
        [BOOKING_STATUS.CONFIRMED]: [BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.IN_PROGRESS],
        [BOOKING_STATUS.VISITED]: [BOOKING_STATUS.WORK_DONE, BOOKING_STATUS.COMPLETED],
        [BOOKING_STATUS.IN_PROGRESS]: [BOOKING_STATUS.WORK_DONE, BOOKING_STATUS.COMPLETED],
        [BOOKING_STATUS.WORK_DONE]: [BOOKING_STATUS.COMPLETED],
        [BOOKING_STATUS.JOURNEY_STARTED]: [BOOKING_STATUS.VISITED, BOOKING_STATUS.IN_PROGRESS]
      };

      if (!validTransitions[booking.status]?.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status transition from ${booking.status} to ${status}`
        });
      }

      // Completion only after payment is settled (online / cash OTP / plan) — otherwise use the billing flow
      if (status === BOOKING_STATUS.COMPLETED && !isPaymentSettled(booking)) {
        return res.status(400).json({
          success: false,
          message: 'Collect payment first (bill + customer OTP) before completing this job'
        });
      }

      // Update booking status
      booking.status = status;

      if (status === BOOKING_STATUS.IN_PROGRESS && !booking.startedAt) {
        booking.startedAt = new Date();
      }

      if (status === BOOKING_STATUS.VISITED && !booking.startedAt) {
        booking.startedAt = new Date();
      }

      if (status === BOOKING_STATUS.COMPLETED) {
        booking.completedAt = new Date();
      }

      // Emit socket event for real-time update to user
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${booking.userId}`).emit('booking_updated', {
          bookingId: booking._id,
          status: booking.status,
          message: `Job status updated to ${booking.status}`
        });
      }

      // Add Push Notification for User
      const { createNotification } = require('../notificationControllers/notificationController');

      if (status === BOOKING_STATUS.IN_PROGRESS) {
        await createNotification({
          userId: booking.userId,
          type: 'work_started',
          title: 'Work In Progress',
          message: 'Professional has started working on your service.',
          relatedId: booking._id,
          relatedType: 'booking',
          priority: 'high',
          pushData: { type: 'in_progress', bookingId: booking._id.toString(), link: `/user/booking/${booking._id}` }
        });
      }

    }

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Job status updated successfully',
      data: booking
    });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job status. Please try again.'
    });
  }
};

/**
 * Mark job as started (Journey Started)
 */
const startJob = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;

    const booking = await Booking.findOne({ _id: id, workerId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (booking.status !== BOOKING_STATUS.ASSIGNED && booking.status !== BOOKING_STATUS.CONFIRMED && booking.status !== BOOKING_STATUS.ACCEPTED) {
      return res.status(400).json({
        success: false,
        message: `Cannot start journey with status: ${booking.status}`
      });
    }

    // Generate Visit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Update booking
    booking.status = BOOKING_STATUS.JOURNEY_STARTED;
    booking.journeyStartedAt = new Date();
    booking.visitOtp = otp; // In production, hash this!

    await booking.save();

    // Notify user with OTP
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      userId: booking.userId,
      type: 'worker_started',
      title: 'Worker Started Journey',
      message: `Worker is on the way! specific OTP for site visit verification is: ${otp}. Please share this with worker upon arrival.`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'journey_started',
        bookingId: booking._id.toString(),
        visitOtp: otp,
        link: `/user/booking/${booking._id}`
      }
    });

    // Notify vendor
    await createNotification({
      vendorId: booking.vendorId,
      type: 'worker_started',
      title: 'Worker Started Journey',
      message: `Your worker has started the journey for booking ${booking.bookingNumber}.`,
      relatedId: booking._id,
      relatedType: 'booking',
      pushData: {
        type: 'journey_started',
        bookingId: booking._id.toString(),
        link: `/vendor/booking/${booking._id}`
      }
    });

    // Explicitly emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: BOOKING_STATUS.JOURNEY_STARTED,
        visitOtp: otp
      });

      // Socket notification removed - createNotification already handles this
    }

    res.status(200).json({
      success: true,
      message: 'Journey started, OTP sent to user',
      data: booking
    });
  } catch (error) {
    console.error('Start job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start job. Please try again.'
    });
  }
};

/**
 * Worker Reached Location
 * Notify user to share OTP
 */
const workerReachedLocation = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;

    // Need visitOtp to resend it
    const booking = await Booking.findOne({ _id: id, workerId }).select('+visitOtp');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (booking.status !== BOOKING_STATUS.JOURNEY_STARTED) {
      return res.status(400).json({ success: false, message: 'Journey not started yet' });
    }

    const otp = booking.visitOtp;

    // Notify user
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      userId: booking.userId,
      type: 'vendor_reached',
      title: 'Professional has Reached!',
      message: `Professional has reached your location. Please share this OTP: ${otp}`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'vendor_reached',
        bookingId: booking._id.toString(),
        visitOtp: otp,
        link: `/user/booking/${booking._id}`
      }
    });

    res.status(200).json({ success: true, message: 'User notified that professional reached' });
  } catch (error) {
    console.error('Worker reached location error:', error);
    res.status(500).json({ success: false, message: 'Failed to notify user' });
  }
};

/**
 * Verify Site Visit with OTP
 */
const verifyVisit = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;
    const { otp, location } = req.body;

    // Use query to select visitOtp which is usually hidden
    const booking = await Booking.findOne({ _id: id, workerId }).select('+visitOtp');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (booking.status !== BOOKING_STATUS.JOURNEY_STARTED) {
      return res.status(400).json({ success: false, message: 'Worker has not started journey yet' });
    }

    if (booking.visitOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Update status
    booking.status = BOOKING_STATUS.VISITED;
    booking.visitedAt = new Date();
    booking.startedAt = new Date(); // Legacy compatibility
    booking.visitOtp = undefined; // Clear OTP
    if (location) {
      booking.visitLocation = {
        ...location,
        verifiedAt: new Date()
      };
    }

    await booking.save();

    // Notify user
    // Notify user
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      userId: booking.userId,
      type: 'visit_verified',
      title: 'Visit Verified',
      message: `The professional has arrived and verified the visit. Service is now in progress.`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high', // Ensure high priority
      pushData: {
        type: 'visit_verified',
        bookingId: booking._id.toString(),
        link: `/user/booking/${booking._id}`
      }
    });

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: booking.status,
        message: 'Visit verified successful'
      });
      // Socket notification removed - createNotification already handles this
    }

    res.status(200).json({
      success: true,
      message: 'Site visit verified successfully',
      data: booking
    });
  } catch (error) {
    console.error('Verify visit error:', error);
    res.status(500).json({ success: false, message: 'Failed to verifying visit' });
  }
};

/**
 * Mark job as completed (Work Done) & Generate Payment OTP
 */
const completeJob = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;
    const { workPhotos, workDoneDetails } = req.body;

    const booking = await Booking.findOne({ _id: id, workerId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (booking.status !== BOOKING_STATUS.VISITED && booking.status !== BOOKING_STATUS.IN_PROGRESS) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete job with status: ${booking.status}`
      });
    }

    // Update booking
    booking.status = BOOKING_STATUS.WORK_DONE;

    // Generate Payment OTP
    const payOtp = Math.floor(1000 + Math.random() * 9000).toString();
    booking.paymentOtp = payOtp;

    if (workPhotos && Array.isArray(workPhotos)) {
      booking.workPhotos = workPhotos;
    }
    if (workDoneDetails) {
      booking.workDoneDetails = workDoneDetails;
    }

    await booking.save();

    // Notify user
    const { createNotification } = require('../notificationControllers/notificationController');

    // 1. Notify user that work is completed and billing is being prepared
    await createNotification({
      userId: booking.userId,
      type: 'work_completed',
      title: 'Work Completed',
      message: `Work finished!  Please wait for the bill expert is preparing !`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'work_completed',
        bookingId: booking._id.toString(),
        link: `/user/booking/${booking._id}`
      }
    });

    // 2. Notify user with Final Bill and OTP
    await createNotification({
      userId: booking.userId,
      type: 'work_done',
      title: 'Billing Ready',
      message: `Bill Generated: ₹${booking.finalAmount}. Your verification OTP is ${payOtp}. Please verify and share OTP to complete.`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'work_done',
        bookingId: booking._id.toString(),
        paymentOtp: payOtp,
        link: `/user/booking/${booking._id}`
      }
    });

    // Notify vendor
    await createNotification({
      vendorId: booking.vendorId,
      type: 'worker_completed',
      title: 'Work Done',
      message: `Your worker has marked work as done for booking ${booking.bookingNumber}.`,
      relatedId: booking._id,
      relatedType: 'booking',
      pushData: {
        type: 'worker_completed',
        bookingId: booking._id.toString(),
        link: `/vendor/booking/${booking._id}`
      }
    });

    // Explicitly emit socket event to ensure user gets real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${booking.userId}`).emit('booking_updated', {
        bookingId: booking._id,
        status: BOOKING_STATUS.WORK_DONE
      });

      // Socket notification removed - createNotification already handles this
    }

    res.status(200).json({
      success: true,
      message: 'Work done marked, OTP sent to user',
      data: booking
    });
  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete job. Please try again.'
    });
  }
};


/**
 * Add worker notes to booking
 */
const addWorkerNotes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const workerId = req.user.id;
    const { id } = req.params;
    const { notes } = req.body;

    const booking = await Booking.findOne({ _id: id, workerId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Update booking
    booking.workerNotes = notes;

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Notes added successfully',
      data: booking
    });
  } catch (error) {
    console.error('Add worker notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add notes. Please try again.'
    });
  }
};

/**
 * Respond to job (Accept/Reject)
 */
const respondToJob = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;
    const { status } = req.body; // 'ACCEPTED' or 'REJECTED'

    const booking = await Booking.findOne({ _id: id, workerId });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Idempotency check: If already in desired state, return success without re-notifying
    if (status === 'ACCEPTED' && booking.workerResponse === 'ACCEPTED') {
      return res.status(200).json({ success: true, message: 'Job already accepted', data: booking });
    }

    if (status === 'REJECTED' && booking.workerResponse === 'REJECTED') {
      return res.status(200).json({ success: true, message: 'Job already rejected', data: booking });
    }

    if (status === 'ACCEPTED') {
      booking.status = BOOKING_STATUS.ASSIGNED;
      booking.workerAcceptedAt = new Date();
      booking.workerResponse = 'ACCEPTED';

      const { createNotification } = require('../notificationControllers/notificationController');

      // Notify Vendor
      await createNotification({
        vendorId: booking.vendorId,
        type: 'job_accepted',
        title: 'Worker Accepted Job',
        message: `Worker has accepted job ${booking.bookingNumber}`,
        relatedId: booking._id,
        relatedType: 'booking'
      });

      // Notify User
      await createNotification({
        userId: booking.userId,
        type: 'worker_accepted',
        title: 'Worker Confirmed',
        message: 'The assigned professional has accepted your booking.',
        relatedId: booking._id,
        relatedType: 'booking',
        priority: 'high',
        pushData: { type: 'worker_accepted', bookingId: booking._id.toString(), link: `/user/booking/${booking._id}` }
      });

    } else if (status === 'REJECTED') {
      booking.workerId = null;
      booking.status = BOOKING_STATUS.CONFIRMED; // Revert to unassigned state

      const { createNotification } = require('../notificationControllers/notificationController');
      await createNotification({
        vendorId: booking.vendorId,
        type: 'job_rejected',
        title: 'Worker Declined Job',
        message: `Worker declined job ${booking.bookingNumber}`,
        relatedId: booking._id,
        relatedType: 'booking'
      });
    }

    await booking.save();
    res.status(200).json({ success: true, message: `Job ${status.toLowerCase()}`, data: booking });

  } catch (error) {
    console.error('Respond job error:', error);
    res.status(500).json({ success: false, message: 'Failed to respond to job' });
  }
};

/**
 * Start Machinery Work (For Drivers)
 * Requires Start OTP from Farmer + KM/Meter Photo
 */
const startMachineryWork = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;
    const { otp, startKmPhoto } = req.body;

    const booking = await Booking.findOne({ _id: id, workerId }).select('+driver_start_otp');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!otp || booking.driver_start_otp !== String(otp)) {
      return res.status(400).json({ success: false, message: 'Invalid Start OTP. Please ask farmer for correct OTP.' });
    }
    if ([BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.WORK_DONE, BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED].includes(booking.status)) {
      return res.status(400).json({ success: false, message: `Cannot start work on a ${booking.status} booking` });
    }

    booking.status = BOOKING_STATUS.IN_PROGRESS;
    booking.startedAt = new Date();
    booking.start_kilometer_photo = startKmPhoto || null;
    booking.driver_start_otp = undefined; // Clear OTP after use

    await booking.save();

    // Notify Farmer
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      userId: booking.userId,
      type: 'work_started',
      title: 'Machinery Work Started',
      message: `The driver has started the work for ${booking.serviceId?.title}. Track progress in your dashboard.`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high'
    });

    res.status(200).json({ success: true, message: 'Work started successfully', data: booking });
  } catch (error) {
    console.error('Start machinery work error:', error);
    res.status(500).json({ success: false, message: 'Failed to start machinery work' });
  }
};

/**
 * Complete Machinery Work (For Drivers)
 * Requires Finish KM/Meter Photo - Generates End OTP for Farmer
 */
const completeMachineryWork = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { id } = req.params;
    const { endKmPhoto } = req.body;

    const booking = await Booking.findOne({ _id: id, workerId });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.status !== BOOKING_STATUS.IN_PROGRESS) {
      return res.status(400).json({ success: false, message: 'Work has not started or is already completed' });
    }

    // Generate End-Work OTP for Farmer to confirm completion
    const endOtp = Math.floor(1000 + Math.random() * 9000).toString();

    booking.status = BOOKING_STATUS.WORK_DONE;
    booking.end_kilometer_photo = endKmPhoto || null;
    booking.driver_end_otp = endOtp;

    await booking.save();

    // Notify Farmer with End OTP
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      userId: booking.userId,
      type: 'work_completed',
      title: 'Machinery Work Finished',
      message: `Machinery work is done. Please verify and share the Finish OTP: ${endOtp} with the driver only if satisfied.`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high'
    });

    res.status(200).json({ success: true, message: 'Work marked as finished. Finish OTP sent to farmer.', data: booking });
  } catch (error) {
    console.error('Complete machinery work error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete machinery work' });
  }
};

module.exports = {
  getAssignedJobs,
  getJobById,
  updateJobStatus,
  startJob,
  workerReachedLocation,
  verifyVisit,
  completeJob,
  addWorkerNotes,
  respondToJob,
  startMachineryWork,
  completeMachineryWork
};
