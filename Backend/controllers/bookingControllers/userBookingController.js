const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const BookingDraft = require('../../models/BookingDraft');
const { createOrder: createRazorpayOrder } = require('../../services/razorpayService');
const Service = require('../../models/Service');
const Category = require('../../models/Category');
const Plan = require('../../models/Plan');
const Cart = require('../../models/Cart');
const User = require('../../models/User');
const Vendor = require('../../models/Vendor');
const Worker = require('../../models/Worker');
const Review = require('../../models/Review');
const { validationResult } = require('express-validator');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../../utils/constants');
const { dispatchWave1 } = require('../../services/bookingDispatchService');
const { createNotification } = require('../notificationControllers/notificationController');
const { sendNotificationToUser, sendNotificationToVendor, sendNotificationToWorker } = require('../../services/firebaseAdmin');
const { priceBooking } = require('../../services/bookingPricing');
const { istDayKey, toMinutes, slotStartInstant, findEquipmentConflict } = require('../../services/bookingSlotService');

const RENTAL_TYPES = ['hourly', 'minute', 'acre', 'bigha', 'land_based', 'monthly', 'daily'];
const BOOKING_PAYMENT_METHODS = ['online', 'pay_at_home', 'cash', 'plan_benefit'];
const MAX_ADVANCE_DAYS = 90;
const SLOT_GRACE_MS = 15 * 60 * 1000; // a slot can still be booked up to 15 min after it starts
// Once work has started the booking can't be cancelled (or refunded) by the user
const NON_CANCELLABLE = [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.WORK_DONE];

/**
 * Create a new booking
 */
const createBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    let {
      serviceId,
      address,
      scheduledDate,
      scheduledTime,
      timeSlot,
      paymentMethod,
      bookedItems, // Array of specific items from cart
      // Metadata from frontend
      serviceCategory: reqServiceCategory,
      categoryIcon: reqCategoryIcon,
      brandName: reqBrandName,
      brandIcon: reqBrandIcon,
      bookingType,
      rental_type,  // Agriculture: extract rental_type
      cropType,     // Agriculture: extract cropType
      chemicalUsed, // Agriculture: chemical to spray
      landSize,      // Agriculture: extract landSize
      endDate,      // Agriculture: extract range end
      estimatedDuration, // Agriculture: extract hours
      selectedImplements // MACHINERY: attachments chosen by user
    } = req.body;
    // NOTE: amount / basePrice / discount / tax / visitingCharges sent by the app are ignored;
    // the price is always computed on the server (services/bookingPricing.js).

    if (rental_type && !RENTAL_TYPES.includes(rental_type)) {
      return res.status(400).json({ success: false, message: 'Invalid rental type' });
    }
    if (bookedItems !== undefined && !Array.isArray(bookedItems)) {
      return res.status(400).json({ success: false, message: 'Invalid booked items' });
    }

    // Handle serviceId if it's an object (from populated cart data)
    if (serviceId && typeof serviceId === 'object' && serviceId._id) {
      serviceId = serviceId._id;
    }

    // ── Slot validation (dates/times are farm-local IST) ──
    const isInstant = bookingType === 'instant';
    const todayKey = istDayKey(new Date());
    const dayKey = istDayKey(scheduledDate);
    if (!dayKey || dayKey < todayKey) {
      return res.status(400).json({ success: false, message: 'Please choose today or a future date for your booking.' });
    }
    if (dayKey > istDayKey(new Date(Date.now() + MAX_ADVANCE_DAYS * 86400000))) {
      return res.status(400).json({ success: false, message: `Bookings can be made up to ${MAX_ADVANCE_DAYS} days in advance.` });
    }
    if (!isInstant && toMinutes(timeSlot?.start) !== null) {
      const slotStart = slotStartInstant(scheduledDate, timeSlot.start);
      if (slotStart.getTime() < Date.now() - SLOT_GRACE_MS) {
        return res.status(400).json({ success: false, message: 'This time slot has already passed. Please pick a later slot.' });
      }
    }
    if (endDate && (isNaN(new Date(endDate).getTime()) || istDayKey(endDate) < dayKey)) {
      return res.status(400).json({ success: false, message: 'End date must be on or after the start date.' });
    }

    // Verify service exists (Service collection, or VendorEquipment / Product machinery fallback)
    let service = mongoose.isValidObjectId(serviceId) ? await Service.findById(serviceId) : null;
    let isVendorEquipmentBooking = false;
    let vendorEquipmentDoc = null;

    if (!service && mongoose.isValidObjectId(serviceId)) {
      const VendorEquipment = require('../../models/VendorEquipment');
      vendorEquipmentDoc = await VendorEquipment.findById(serviceId).populate('vendorId').populate('categoryId');
      if (vendorEquipmentDoc) {
        // Vendor has switched this machine off
        if (vendorEquipmentDoc.isAvailable === false) {
          return res.status(400).json({
            success: false,
            message: 'This equipment is currently not available for booking.'
          });
        }
        // A specific machine is booked with its owner, so the owner must be able to take jobs
        const owner = vendorEquipmentDoc.vendorId;
        if (!owner || owner.approvalStatus !== 'approved' || owner.isActive === false || owner.wallet?.isBlocked) {
          return res.status(400).json({
            success: false,
            message: 'This owner is not taking bookings right now. Please choose another equipment.'
          });
        }
        isVendorEquipmentBooking = true;

        service = {
          _id: vendorEquipmentDoc._id,
          title: vendorEquipmentDoc.name,
          category: vendorEquipmentDoc.categoryId?.title || vendorEquipmentDoc.requestedCategoryName || 'Agriculture',
          categoryId: vendorEquipmentDoc.categoryId?._id || vendorEquipmentDoc.categoryId,
          iconUrl: (vendorEquipmentDoc.images && vendorEquipmentDoc.images.length > 0) ? vendorEquipmentDoc.images[0] : '',
          images: vendorEquipmentDoc.images || [],
          rental_type: rental_type || 'hourly',
          vendorId: owner._id,
          isVendorEquipment: true
        };
      } else {
        const Product = require('../../models/Product');
        const prodDoc = await Product.findById(serviceId).populate('categoryId');
        if (prodDoc && prodDoc.type === 'machinery') {
          service = {
            _id: prodDoc._id,
            title: prodDoc.title,
            category: prodDoc.categoryId?.title || 'Agriculture',
            categoryId: prodDoc.categoryId?._id || prodDoc.categoryId,
            iconUrl: prodDoc.imageUrl || (prodDoc.images && prodDoc.images[0]) || '',
            images: prodDoc.images || (prodDoc.imageUrl ? [prodDoc.imageUrl] : []),
            rental_type: rental_type || 'hourly',
            isProductMachinery: true
          };
        } else {
          // Fallback to Category collection (when services/equipment are listed under categories)
          const catDoc = await Category.findById(serviceId);
          if (catDoc) {
            service = {
              _id: catDoc._id,
              title: catDoc.title,
              category: catDoc.title,
              categoryId: catDoc._id,
              iconUrl: catDoc.homeIconUrl || catDoc.imageUrl || '',
              images: catDoc.imageUrl ? [catDoc.imageUrl] : [],
              rental_type: rental_type || 'hourly',
              isCategoryService: true
            };
          }
        }
      }
    }

    // Booking several cart items whose main id isn't a catalog entry: describe it from the first item
    // (each item is still priced from its own catalog entry below)
    if (!service && Array.isArray(bookedItems) && bookedItems.length > 0) {
      const fallbackItem = bookedItems[0];
      service = {
        _id: serviceId,
        title: fallbackItem?.card?.title || fallbackItem?.title || reqServiceCategory || 'Agricultural Service',
        category: reqServiceCategory || fallbackItem?.category || 'Agriculture',
        categoryId: mongoose.isValidObjectId(serviceId) ? serviceId : null,
        iconUrl: reqCategoryIcon || fallbackItem?.icon || '',
        images: [],
        rental_type: rental_type || 'hourly',
        isVirtualService: true
      };
    }

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Get category for the service
    const categoryId = service.categoryId || service.categoryIds?.[0];
    const category = categoryId && mongoose.isValidObjectId(categoryId) ? await Category.findById(categoryId) : null;

    // A specific machine can only be in one place per slot
    if (isVendorEquipmentBooking) {
      const conflict = await findEquipmentConflict({
        equipmentId: vendorEquipmentDoc._id,
        scheduledDate,
        endDate,
        timeSlot
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          slotUnavailable: true,
          message: conflict.maintenance
            ? `This equipment is under maintenance (${conflict.maintenance.reason || 'scheduled service'}) on the selected date. Please pick another date.`
            : 'This equipment is already booked for the selected slot. Please pick another slot.'
        });
      }
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Expired plan: mark it inactive (pricing below already ignores it)
    if (user.plans?.isActive && user.plans.expiry && new Date() > new Date(user.plans.expiry)) {
      user.plans.isActive = false;
      await user.save();
    }

    // ── Price (server is the only source of truth) ──
    let price;
    try {
      price = await priceBooking({
        serviceId,
        bookedItems,
        selectedImplements,
        rentalType: rental_type,
        estimatedDuration,
        landSize,
        user
      });
    } catch (priceError) {
      if (priceError.status) {
        return res.status(priceError.status).json({ success: false, message: priceError.message });
      }
      throw priceError;
    }

    // Check for Pending Penalty
    const pendingPenalty = user.wallet?.penalty || 0;
    const finalAmount = price.finalAmount + pendingPenalty;

    // Payment method: a fully plan-covered booking is 'plan_benefit'; nothing else can claim it
    if (!BOOKING_PAYMENT_METHODS.includes(paymentMethod)) paymentMethod = 'pay_at_home';
    if (finalAmount === 0) paymentMethod = 'plan_benefit';
    else if (paymentMethod === 'plan_benefit') paymentMethod = 'pay_at_home';

    console.log(`[CreateBooking] Payment=${paymentMethod}, FinalAmount=${finalAmount}, Penalty=${pendingPenalty}`);

    // ── Who gets the request ──
    let nearbyVendors = [];
    let usedRadius = 0;
    const { findNearbyVendors, geocodeAddress } = require('../../services/locationService');
    const bookingLocation = (address.lat && address.lng)
      ? { lat: address.lat, lng: address.lng }
      : await geocodeAddress(`${address.addressLine1}, ${address.city}, ${address.state} ${address.pincode}`);

    if (isVendorEquipmentBooking) {
      // Direct machine booking: only the machine's owner is asked
      nearbyVendors = [{ _id: vendorEquipmentDoc.vendorId._id, distance: 0 }];
    } else {
      // Find vendors within dynamic radius (2km -> 5km -> 8km -> 10km -> 15km -> 20km -> 30km)
      // CUSTOM - Check Cash Limit only if payment method is CASH
      const vendorFilters = {
        ...(category ? { service: category.title, categoryId: category._id } : (service?.category ? { service: service.category } : {})),
        ...(service?.categoryId && !category ? { categoryId: service.categoryId } : {}),
        checkCashLimit: ['cash', 'pay_at_home'].includes(paymentMethod)
      };

      const searchRadii = [2, 5, 8, 10, 15, 20, 30];
      for (const radius of searchRadii) {
        usedRadius = radius;
        nearbyVendors = await findNearbyVendors(bookingLocation, radius, vendorFilters);

        // Offline vendors still get FCM pushes to wake them up. ON_JOB vendors can take other slots
        // (machine clashes are checked when they accept); only vendors who set themselves BUSY are skipped.
        nearbyVendors = nearbyVendors.filter(v => v.availability !== 'BUSY');

        if (nearbyVendors && nearbyVendors.length > 0) {
          break; // Stop expanding radius if we found available vendors
        }
      }

      // Deduplicate nearbyVendors by _id to prevent duplicate notifications
      const uniqueVendorIds = new Set();
      nearbyVendors = nearbyVendors.filter(vendor => {
        const idStr = vendor._id.toString();
        if (uniqueVendorIds.has(idStr)) return false;
        uniqueVendorIds.add(idStr);
        return true;
      });
      console.log(`[CreateBooking] Found ${nearbyVendors.length} nearby vendors for booking within ${usedRadius}km`);
    }

    // Clear penalty from user wallet if we charged it
    if (pendingPenalty > 0) {
      user.wallet.penalty = 0;
      await user.save();
    }

    // Improve Category Fetching if ID is missing (Fallback to title match)
    let finalCategory = category;
    if (!finalCategory && service.category) {
      finalCategory = await Category.findOne({ title: service.category });
    }

    // Booked items carry the server price (unit rate) the booking was charged at
    const formattedBookedItems = (Array.isArray(bookedItems) && bookedItems.length > 0)
      ? price.pricedItems.map(({ request: item, unitPrice, quantity }) => ({
        brandName: item.brandName || item.sectionTitle || item.brand || '', // Robust fallback
        brandIcon: item.brandIcon || item.sectionIcon || item.icon || null,
        card: { ...(item.card || item), price: unitPrice },
        quantity
      }))
      : [];

    // Extract Visual Identity Details
    const categoryIcon = finalCategory?.icon || finalCategory?.image || service.iconUrl || 'https://cdn-icons-png.flaticon.com/512/3500/3500833.png';
    let brandName = null;
    let brandIcon = null;

    if (formattedBookedItems.length > 0) {
      const distinctBrands = [...new Set(formattedBookedItems.map(item => item.brandName).filter(Boolean))];
      if (distinctBrands.length > 0) {
        brandName = distinctBrands.join(', ');
      }
      brandIcon = formattedBookedItems[0].brandIcon || null;
    }

    // Online bookings are held until the payment is verified; vendors are alerted after that
    let bookingStatus = BOOKING_STATUS.SEARCHING;
    if (paymentMethod === 'online' && finalAmount > 0) {
      bookingStatus = BOOKING_STATUS.AWAITING_PAYMENT;
    }

    // Prepay bookings are stored as drafts until paid (see models/BookingDraft.js)
    const isPrepayDraft = bookingStatus === BOOKING_STATUS.AWAITING_PAYMENT;
    const BookingModel = isPrepayDraft ? BookingDraft : Booking;

    const booking = await BookingModel.create({
      userId,
      vendorId: isVendorEquipmentBooking ? vendorEquipmentDoc.vendorId._id : null,
      equipmentId: isVendorEquipmentBooking ? vendorEquipmentDoc._id : null,
      serviceId,
      categoryId: finalCategory?._id || categoryId,
      serviceName: service.title,
      serviceCategory: reqServiceCategory || finalCategory?.title || service.category || 'General',
      // Visual Identity Fields
      categoryIcon: reqCategoryIcon || categoryIcon,
      brandName: reqBrandName || brandName,
      brandIcon: reqBrandIcon || brandIcon,
      bookingType: bookingType || 'scheduled',
      rental_type: rental_type || null,
      cropType: cropType || null,
      chemicalUsed: chemicalUsed || null,
      landSize: landSize || null,
      endDate: endDate ? new Date(endDate) : null,
      estimatedDuration: (estimatedDuration !== undefined && estimatedDuration !== null && !isNaN(Number(estimatedDuration))) ? Number(estimatedDuration) : null,

      description: service.description,
      serviceImages: service.images || [],
      bookedItems: formattedBookedItems,
      basePrice: price.basePrice,
      discount: price.discount,
      tax: price.tax,
      visitingCharges: price.visitingCharges,
      penalty: pendingPenalty || 0,
      finalAmount,
      userPayableAmount: finalAmount,
      address: {
        type: address.type || 'home',
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || '',
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        landmark: address.landmark || '',
        lat: address.lat || null,
        lng: address.lng || null
      },
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      timeSlot: {
        start: timeSlot.start,
        end: timeSlot.end,
        ...(typeof timeSlot.date === 'string' ? { date: timeSlot.date } : {}),
        ...(typeof timeSlot.time === 'string' ? { time: timeSlot.time } : {})
      },
      paymentMethod,
      paymentMode: paymentMethod === 'plan_benefit' ? 'plan'
        : ['pay_at_home', 'cash'].includes(paymentMethod) ? 'pay_at_home'
        : 'online',
      status: bookingStatus,
      paymentStatus: PAYMENT_STATUS.PENDING,
      selectedImplements: Array.isArray(selectedImplements) ? selectedImplements : []
      // notifiedVendors will be set after wave sorting
    });

    // Save distance-sorted candidates; wave 1 is alerted now (or after online payment), later waves by bookingScheduler
    const sortedVendors = nearbyVendors.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    booking.potentialVendors = sortedVendors.map(v => ({
      vendorId: v._id,
      distance: v.distance || 0
    }));
    await booking.save();

    // Online payment: vendors are alerted only after the payment is verified (paymentController.verifyPaymentWebhook)
    if (booking.status !== BOOKING_STATUS.AWAITING_PAYMENT) {
      await dispatchWave1(booking._id, req.app.get('io'));
    }

    // Prepay: create the Razorpay order now so the app can open checkout without a second request
    let razorpayOrder = null;
    if (isPrepayDraft) {
      const orderResult = await createRazorpayOrder(booking.finalAmount, 'INR', booking.bookingNumber, {
        bookingId: booking._id.toString(),
        userId: userId.toString()
      });
      if (orderResult.success) {
        booking.razorpayOrderId = orderResult.orderId;
        await booking.save();
        razorpayOrder = {
          orderId: orderResult.orderId,
          amount: orderResult.amount / 100,
          currency: orderResult.currency,
          key: process.env.RAZORPAY_KEY_ID
        };
      } // on failure the app falls back to POST /payments/create-order
    }

    // Populate booking details
    const populatedBooking = await BookingModel.findById(booking._id)
      .populate('userId', 'name phone email')
      .populate('serviceId', 'title iconUrl')
      .populate('categoryId', 'title slug requiresDriver');

    // Online bookings held for payment: notify user, emails, and cart clearing happen after payment is verified
    if (booking.status !== BOOKING_STATUS.AWAITING_PAYMENT) {
      // Send notification to user
      await createNotification({
        userId,
        type: 'booking_requested',
        title: 'Booking Created',
        message: `Your booking ${booking.bookingNumber} has been created successfully.`,
        relatedId: booking._id,
        relatedType: 'booking',
        pushData: {
          type: 'booking_requested',
          bookingId: booking._id.toString(),
          link: `/user/booking/${booking._id}`
        }
      });

      // Send notification to vendor only if assigned (Direct Booking)
      let vendorObj = null;
      if (booking.vendorId) {
        await createNotification({
          vendorId: booking.vendorId,
          type: 'booking_created',
          title: 'New Booking Received',
          message: `You have received a new booking ${booking.bookingNumber} for ${service.title}.`,
          relatedId: booking._id,
          relatedType: 'booking'
        });
        vendorObj = await Vendor.findById(booking.vendorId);
      }

      // SEND EMAILS (Confirmation)
      const { sendBookingEmails } = require('../../services/emailService');
      sendBookingEmails(populatedBooking, user, vendorObj, service).catch(err => console.error(err));

      // Clear booked items from user's cart
      try {
        if (bookedItems && bookedItems.length > 0) {
          const userCart = await Cart.findOne({ userId });
          if (userCart && userCart.items.length > 0) {
            const bookedTitles = new Set(bookedItems.map(item => item.card?.title || item.title));
            const originalCount = userCart.items.length;
            userCart.items = userCart.items.filter(item => {
              const itemTitle = item.title;
              const itemCardTitle = item.card?.title;
              const shouldRemove = bookedTitles.has(itemTitle) || (itemCardTitle && bookedTitles.has(itemCardTitle));
              return !shouldRemove;
            });

            if (userCart.items.length < originalCount) {
              await userCart.save();
            }
          }
        } else if (serviceId) {
          const userCart = await Cart.findOne({ userId });
          if (userCart) {
            const originalCount = userCart.items.length;
            userCart.items = userCart.items.filter(item => !(item.serviceId && item.serviceId.toString() === serviceId.toString()));

            if (userCart.items.length < originalCount) {
              await userCart.save();
            }
          }
        }
      } catch (cartError) {
        console.error('[CreateBooking] Failed to clear cart items:', cartError);
      }
    }

    res.status(201).json({
      success: true,
      message: sortedVendors.length > 0 ? 'Booking created successfully' : 'No vendors found nearby',
      noVendorsFound: sortedVendors.length === 0,
      data: populatedBooking,
      razorpayOrder
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking. Please try again.'
    });
  }
};

/**
 * Get user bookings with filters
 */
const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { userId };
    if (status) {
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    } else {
      // Default: Fetch all, including SEARCHING. Frontend will filter for active.
    }
    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get bookings
    const bookings = await Booking.find(query)
      .populate('vendorId', 'name businessName phone profilePhoto')
      .populate('serviceId', 'title iconUrl')
      .populate('categoryId', 'title slug requiresDriver')
      .populate('workerId', 'name phone profilePhoto')
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
    console.error('Get user bookings error:', error);
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
    const userId = req.user.id;
    const { id } = req.params;

    const booking = await Booking.findOne({ _id: id, userId })
      .select('+visitOtp +paymentOtp +driver_start_otp +driver_end_otp +start_kilometer_photo +end_kilometer_photo') // Include secure OTPs and trip photos
      .populate('userId', 'name phone email')
      .populate('vendorId', 'name businessName phone email address profilePhoto')
      .populate('serviceId', 'title description iconUrl images')
      .populate('categoryId', 'title slug requiresDriver')
      .populate('workerId', 'name phone rating totalJobs location profilePhoto');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Fetch Vendor Bill if exists
    const VendorBill = require('../../models/VendorBill');
    const bill = await VendorBill.findOne({ bookingId: booking._id });

    // Convert to object to attach bill
    const bookingData = booking.toObject();
    if (bill) {
      bookingData.bill = bill;
    }

    res.status(200).json({
      success: true,
      data: bookingData
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
 * Cancel booking
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

    const userId = req.user.id;
    const { id } = req.params;
    const { cancellationReason } = req.body;

    // Atomically move the booking to CANCELLED so two parallel cancels can't both refund.
    // The returned document is the state BEFORE cancelling (used for the refund decision).
    const booking = await Booking.findOneAndUpdate(
      { _id: id, userId, status: { $nin: NON_CANCELLABLE } },
      {
        $set: {
          status: BOOKING_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: 'user',
          cancellationReason: (typeof cancellationReason === 'string' && cancellationReason.trim()) ? cancellationReason.trim().slice(0, 500) : 'Cancelled by user'
        }
      }
    );

    if (!booking) {
      const existing = await Booking.findOne({ _id: id, userId }).select('status');
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      return res.status(400).json({
        success: false,
        message: existing.status === BOOKING_STATUS.CANCELLED
          ? 'Booking is already cancelled'
          : `A booking that is ${existing.status.replace('_', ' ')} can't be cancelled. Please contact support if there is a problem.`
      });
    }

    // --- REFUND & CANCELLATION FEE LOGIC ---
    let refundAmount = 0;
    let cancellationFee = 0;
    let refundMessage = '';

    // Fetch dynamic cancellation penalty from Settings
    const Settings = require('../../models/Settings');
    let settingsPenalty = 49; // Default
    try {
      const globalSettings = await Settings.findOne({ type: 'global' });
      if (globalSettings && globalSettings.cancellationPenalty !== undefined) {
        settingsPenalty = globalSettings.cancellationPenalty;
      }
    } catch (err) {
      console.error('Error fetching settings for cancellation penalty:', err);
    }

    const hasStartedJourney = !!booking.journeyStartedAt;
    const isPaid = booking.paymentStatus === PAYMENT_STATUS.SUCCESS;
    const isWalletOrOnline = ['wallet', 'razorpay', 'upi', 'card'].includes(booking.paymentMethod);
    const isCash = booking.paymentMethod === 'cash';

    if (hasStartedJourney) {
      // SCENARIO: Worker/Vendor already started journey

      const hasReached = !!booking.visitedAt || booking.status === 'visited';

      if (hasReached) {
        // Professional Reached -> Full Visiting Charges
        cancellationFee = booking.visitingCharges || 49;
      } else {
        // Before Arrival (Journey Started) -> Dynamic Penalty
        cancellationFee = settingsPenalty;
      }

      if (isPaid && isWalletOrOnline) {
        // User paid upfront -> Refund (Total - Fee)
        refundAmount = Math.max(0, booking.finalAmount - cancellationFee);
        refundMessage = `Booking cancelled after ${hasReached ? 'professional arrival' : 'journey start'}. Refund of ₹${refundAmount} initiated (Cancellation Fee: ₹${cancellationFee} deducted).`;
      } else {
        // User hasn't paid (e.g. COD or pending) -> Add Penalty to Wallet for Next Booking
        refundAmount = 0;
        refundMessage = `Booking cancelled after ${hasReached ? 'professional arrival' : 'journey start'}. A cancellation fee of ₹${cancellationFee} has been added to your account and will be charged on your next booking.`;

        // We will add this to user.wallet.penalty below
      }
    } else {
      // SCENARIO: Cancelled before journey start
      // Policy: Full Refund
      cancellationFee = 0;

      if (isPaid && isWalletOrOnline) {
        refundAmount = booking.finalAmount;
        refundMessage = `Booking cancelled successfully. Full refund of ₹${refundAmount} initiated to your wallet.`;
      } else {
        refundAmount = 0;
        refundMessage = 'Booking cancelled successfully.';
      }
    }

    // Update User Wallet (atomic $inc: no lost or doubled updates)
    const Transaction = require('../../models/Transaction');
    const walletInc = {};

    // 1. Process Refund
    if (refundAmount > 0) walletInc['wallet.balance'] = refundAmount;

    // 2. Process Cancellation Fee and Restore Previous Unpaid Penalty
    if (!isPaid) {
      // If this booking had a previous unpaid penalty baked in, we must restore it to the user's bucket
      const totalNewPenalty = cancellationFee + (booking.penalty || 0);
      if (totalNewPenalty > 0) walletInc['wallet.penalty'] = totalNewPenalty;
    }

    if (Object.keys(walletInc).length > 0) {
      const user = await User.findByIdAndUpdate(userId, { $inc: walletInc }, { new: true });
      if (refundAmount > 0 && user) {
        await Transaction.create({
          userId: user._id,
          type: 'refund',
          amount: refundAmount,
          status: 'completed',
          paymentMethod: 'wallet',
          description: `Refund for booking #${booking.bookingNumber}`,
          bookingId: booking._id,
          balanceAfter: user.wallet.balance
        });
      }
    }

    // Record the outcome; a paid booking is settled here, so /payments/refund can't pay it out again
    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancellationFee = cancellationFee;
    booking.cancellationSettled = isPaid;
    if (refundAmount > 0) booking.paymentStatus = PAYMENT_STATUS.REFUNDED;
    await Booking.updateOne(
      { _id: booking._id },
      { $set: { cancellationFee, cancellationSettled: isPaid, ...(refundAmount > 0 ? { paymentStatus: PAYMENT_STATUS.REFUNDED } : {}) } }
    );

    // Send notification to user
    await createNotification({
      userId,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: refundMessage || `Your booking ${booking.bookingNumber} has been cancelled.`,
      relatedId: booking._id,
      relatedType: 'booking',
      pushData: {
        type: 'booking_cancelled',
        bookingId: booking._id.toString(),
        link: `/user/booking/${booking._id}`
      }
    });

    // Manual FCM push removed (handled by createNotification)

    // Send notification to vendor
    if (booking.vendorId) {
      await createNotification({
        vendorId: booking.vendorId,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `Booking ${booking.bookingNumber} has been cancelled by the customer.`,
        relatedId: booking._id,
        relatedType: 'booking',
        pushData: {
          type: 'booking_cancelled',
          bookingId: booking._id.toString(),
          link: `/vendor/booking/${booking._id}`
        }
      });
      // Manual FCM push removed
    }

    // Notify worker if assigned
    if (booking.workerId) {
      await createNotification({
        workerId: booking.workerId,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: `Job ${booking.bookingNumber} has been cancelled by the customer.`,
        relatedId: booking._id,
        relatedType: 'booking',
        pushData: {
          type: 'job_cancelled',
          bookingId: booking._id.toString(),
          link: `/worker/job/${booking._id}`
        }
      });
      // Manual FCM push removed
    }

    res.status(200).json({
      success: true,
      message: refundMessage || 'Booking cancelled successfully',
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
 * Reschedule booking
 */
const rescheduleBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { id } = req.params;
    const { scheduledDate, scheduledTime, timeSlot } = req.body;

    const booking = await Booking.findOne({ _id: id, userId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Only before the professional is on the way
    const NOT_RESCHEDULABLE = [...NON_CANCELLABLE, BOOKING_STATUS.JOURNEY_STARTED, BOOKING_STATUS.VISITED];
    if (NOT_RESCHEDULABLE.includes(booking.status) || booking.journeyStartedAt) {
      return res.status(400).json({
        success: false,
        message: `A booking that is ${booking.status.replace('_', ' ')} can't be rescheduled.`
      });
    }

    const dayKey = istDayKey(scheduledDate);
    if (!dayKey || dayKey < istDayKey(new Date()) || dayKey > istDayKey(new Date(Date.now() + MAX_ADVANCE_DAYS * 86400000))) {
      return res.status(400).json({ success: false, message: 'Please choose a valid upcoming date.' });
    }
    if (toMinutes(timeSlot?.start) !== null && slotStartInstant(scheduledDate, timeSlot.start).getTime() < Date.now() - SLOT_GRACE_MS) {
      return res.status(400).json({ success: false, message: 'This time slot has already passed. Please pick a later slot.' });
    }

    // Moving a multi-day rental keeps its length
    let endDate = booking.endDate;
    if (endDate && booking.scheduledDate) {
      endDate = new Date(new Date(scheduledDate).getTime() + (booking.endDate - booking.scheduledDate));
    }

    // The booked machine must be free at the new slot
    const machineId = booking.equipmentId;
    if (machineId) {
      const conflict = await findEquipmentConflict({ equipmentId: machineId, scheduledDate, endDate, timeSlot, excludeBookingId: booking._id });
      if (conflict) {
        return res.status(409).json({
          success: false,
          slotUnavailable: true,
          message: conflict.maintenance
            ? 'This equipment is under maintenance on the selected date. Please pick another date.'
            : 'This equipment is already booked for the selected slot. Please pick another slot.'
        });
      }
    }

    // Update booking (status is kept: the assigned vendor stays assigned and is notified of the new time)
    booking.scheduledDate = new Date(scheduledDate);
    booking.scheduledTime = scheduledTime;
    booking.timeSlot = {
      start: timeSlot.start,
      end: timeSlot.end
    };
    if (endDate) booking.endDate = endDate;
    booking.startReminderSent = false;

    await booking.save();

    // Send notification to vendor
    if (booking.vendorId) {
      await createNotification({
        vendorId: booking.vendorId,
        type: 'booking_created', // Keeping type as is for now
        title: 'Booking Rescheduled',
        message: `Booking ${booking.bookingNumber} has been rescheduled to ${dayKey} (${scheduledTime}).`,
        relatedId: booking._id,
        relatedType: 'booking',
        pushData: {
          type: 'booking_rescheduled',
          bookingId: booking._id.toString(),
          link: `/vendor/booking/${booking._id}`
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Booking rescheduled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Reschedule booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule booking. Please try again.'
    });
  }
};

/**
 * Add review and rating after completion
 */
const addReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { id } = req.params;
    const { rating, review, reviewImages } = req.body;

    const booking = await Booking.findOne({ _id: id, userId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking is completed or work is done (work_done is for machinery after driver completes)
    if (booking.status !== BOOKING_STATUS.COMPLETED && booking.status !== BOOKING_STATUS.WORK_DONE) {
      return res.status(400).json({
        success: false,
        message: 'You can only review a booking after the work has been completed by the service provider'
      });
    }

    // Check if already reviewed
    if (booking.rating) {
      return res.status(400).json({
        success: false,
        message: 'Booking already reviewed'
      });
    }

    // Update booking
    booking.rating = rating;
    booking.review = review || null;
    booking.reviewImages = reviewImages || [];
    booking.reviewedAt = new Date();

    await booking.save();

    // Create a new Review document for the Review model (used by Admin)
    try {
      await Review.create({
        bookingId: booking._id,
        userId: booking.userId,
        serviceId: booking.serviceId,
        vendorId: booking.vendorId,
        workerId: booking.workerId,
        rating: rating,
        review: review || '',
        images: reviewImages || [],
        status: 'active'
      });
    } catch (reviewErr) {
      console.error('Error creating separate review document:', reviewErr);
      // We don't fail the request if the separate review creation fails
    }

    // Helper to update cumulative rating on Model
    const updateCumulativeRating = async (Model, docId, newRating) => {
      try {
        const doc = await Model.findById(docId);
        if (!doc) return;

        const oldTotal = doc.totalReviews || 0;
        const oldRating = doc.rating || 0;

        const newTotal = oldTotal + 1;
        const updatedRating = ((oldRating * oldTotal) + newRating) / newTotal;

        doc.rating = Number(updatedRating.toFixed(2));
        doc.totalReviews = newTotal;
        await doc.save();
      } catch (err) {
        console.error(`Error updating rating for ${Model.modelName}:`, err);
      }
    };

    // Update Vendor Rating (Always)
    if (booking.vendorId) {
      await updateCumulativeRating(Vendor, booking.vendorId, rating);
    }

    // Update Worker Rating (Only if worker was assigned)
    if (booking.workerId) {
      await updateCumulativeRating(Worker, booking.workerId, rating);
    }

    // Send notification to vendor
    await createNotification({
      vendorId: booking.vendorId,
      type: 'review_submitted',
      title: 'New Review Received',
      message: `You have received a ${rating}-star review for booking ${booking.bookingNumber}.`,
      relatedId: booking._id,
      relatedType: 'booking'
    });

    res.status(200).json({
      success: true,
      message: 'Review added successfully',
      data: booking
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add review. Please try again.'
    });
  }
};

/**
 * Get user ratings and reviews (given by the user)
 */
const getUserRatings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch bookings where rating is not null
    const bookings = await Booking.find({ userId, rating: { $ne: null } })
      .populate('vendorId', 'name businessName profilePhoto')
      .populate('serviceId', 'title iconUrl')
      .populate('workerId', 'name profilePhoto')
      .sort({ reviewedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments({ userId, rating: { $ne: null } });

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
    console.error('Get user ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your ratings'
    });
  }
};

/**
 * Check equipment availability and return next available slot if booked
 */
const checkEquipmentAvailability = async (req, res) => {
  try {
    const { equipmentId, requestedDate, requestedTime, requestedEndTime, endDate } = req.query;

    if (typeof equipmentId !== 'string' || typeof requestedDate !== 'string' || !istDayKey(requestedDate)) {
      return res.status(400).json({
        success: false,
        message: 'Equipment ID and requested date are required'
      });
    }

    // Only a specific vendor's machine can be "already booked". Catalog services/categories
    // are fulfilled by whichever nearby vendor accepts, so they are always bookable.
    const VendorEquipment = require('../../models/VendorEquipment');
    const isSpecificMachine = mongoose.isValidObjectId(equipmentId) && await VendorEquipment.exists({ _id: equipmentId });
    if (!isSpecificMachine) {
      return res.status(200).json({
        success: true,
        available: true,
        message: 'Available. Nearby vendors will be searched for your booking.'
      });
    }

    // No time chosen yet = only maintenance (whole day) can block it
    const slot = typeof requestedTime === 'string' && requestedTime
      ? { start: requestedTime, end: typeof requestedEndTime === 'string' ? requestedEndTime : undefined }
      : { start: '00:00', end: '00:01' };
    const conflict = await findEquipmentConflict({
      equipmentId,
      scheduledDate: requestedDate,
      endDate: typeof endDate === 'string' && istDayKey(endDate) ? endDate : undefined,
      timeSlot: slot
    });

    if (conflict?.maintenance) {
      return res.status(200).json({
        success: true,
        available: false,
        message: `Equipment is currently under maintenance (${conflict.maintenance.reason}). It will be available after ${new Date(conflict.maintenance.endDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}.`
      });
    }

    if (!conflict || !requestedTime) {
      return res.status(200).json({
        success: true,
        available: true,
        message: 'Equipment is available for this slot.'
      });
    }

    // Suggest the next free day for the same slot (scan up to 2 weeks ahead)
    let nextAvailableSlot = null;
    const startKey = istDayKey(requestedDate);
    for (let i = 1; i <= 14 && !nextAvailableSlot; i++) {
      const dayKey = new Date(Date.parse(`${startKey}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
      const clash = await findEquipmentConflict({ equipmentId, scheduledDate: dayKey, timeSlot: slot });
      if (!clash) nextAvailableSlot = `${dayKey} ${requestedTime}`;
    }

    return res.status(200).json({
      success: true,
      available: false,
      nextAvailableSlot,
      message: 'Equipment is already booked for the requested time. Please choose another slot.'
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check equipment availability'
    });
  }
};

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  rescheduleBooking,
  addReview,
  getUserRatings,
  checkEquipmentAvailability
};

