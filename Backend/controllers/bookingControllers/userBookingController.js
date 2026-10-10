const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
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
      vendorId,
      address,
      scheduledDate,
      scheduledTime,
      timeSlot,
      userNotes,
      paymentMethod,
      amount,
      isPlusAdded,
      bookedItems, // Array of specific items from cart
      visitingCharges: reqVisitingCharges,
      visitationFee: reqVisitationFee, // Backward compatibility
      basePrice: reqBasePrice,
      discount: reqDiscount,
      tax: reqTax,
      // Metadata from frontend
      serviceCategory: reqServiceCategory,
      categoryIcon: reqCategoryIcon,
      brandName: reqBrandName,
      brandIcon: reqBrandIcon,
      bookingType, // Extract bookingType
      rental_type,  // Agriculture: extract rental_type
      cropType,     // Agriculture: extract cropType
      chemicalUsed, // Agriculture: chemical to spray
      landSize,      // Agriculture: extract landSize
      endDate,      // Agriculture: extract range end
      estimatedDuration, // Agriculture: extract hours
      selectedImplements // MACHINERY: attachments chosen by user
    } = req.body;

    let visitingCharges = reqVisitingCharges !== undefined ? reqVisitingCharges : (reqVisitationFee || 0);

    // Calculate total value from booked items or fallback to base (Move to top)
    let totalServiceValue = 0;
    if (bookedItems && bookedItems.length > 0) {
      totalServiceValue = bookedItems.reduce((sum, item) => {
        const itemPrice = item.card?.price || item.price || 0;
        return sum + (itemPrice * (item.quantity || 1));
      }, 0);
    }
    // Note: Fallback to service.basePrice is done later if totalServiceValue is 0 AND service is loaded.
    // But we need 'service' to define fallback.
    // 'service' is loaded at line 46.
    // So we must calculate it AFTER loading service but BEFORE usage.
    // Usage is at line 98. Service loaded at 46.
    // So distinct placement: AFTER line 52.

    // Handle serviceId if it's an object (from populated cart data)
    if (typeof serviceId === 'object' && serviceId._id) {
      serviceId = serviceId._id;
    }

    // Verify service exists (Service collection, or VendorEquipment / Product machinery fallback)
    let service = await Service.findById(serviceId);
    let isVendorEquipmentBooking = false;
    let vendorEquipmentDoc = null;

    if (!service) {
      const VendorEquipment = require('../../models/VendorEquipment');
      vendorEquipmentDoc = await VendorEquipment.findById(serviceId).populate('vendorId').populate('categoryId');
      if (vendorEquipmentDoc) {
        isVendorEquipmentBooking = true;
        const getRate = (p) => {
          if (!p || p.isEnabled === false) return 0;
          return Number(p.price) || 0;
        };
        const hRate = getRate(vendorEquipmentDoc.pricing?.hourly);
        const lRate = getRate(vendorEquipmentDoc.pricing?.land_based);
        const dRate = getRate(vendorEquipmentDoc.pricing?.daily);
        const bRate = hRate || lRate || dRate || 500;

        service = {
          _id: vendorEquipmentDoc._id,
          title: vendorEquipmentDoc.name,
          category: vendorEquipmentDoc.categoryId?.title || vendorEquipmentDoc.requestedCategoryName || 'Agriculture',
          categoryId: vendorEquipmentDoc.categoryId?._id || vendorEquipmentDoc.categoryId,
          basePrice: bRate,
          hourly_price: hRate,
          land_price: lRate,
          land_unit: 'bigha',
          daily_price: dRate,
          iconUrl: (vendorEquipmentDoc.images && vendorEquipmentDoc.images.length > 0) ? vendorEquipmentDoc.images[0] : '',
          images: vendorEquipmentDoc.images || [],
          rental_type: rental_type || 'hourly',
          vendorId: vendorEquipmentDoc.vendorId?._id || vendorEquipmentDoc.vendorId,
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
            basePrice: prodDoc.price || 500,
            hourly_price: prodDoc.unit === 'hour' ? prodDoc.price : 0,
            land_price: (prodDoc.unit === 'acre' || prodDoc.unit === 'bigha') ? prodDoc.price : 0,
            land_unit: prodDoc.unit === 'bigha' ? 'bigha' : 'acre',
            daily_price: prodDoc.unit === 'day' ? prodDoc.price : 0,
            iconUrl: prodDoc.imageUrl || (prodDoc.images && prodDoc.images[0]) || '',
            images: prodDoc.images || (prodDoc.imageUrl ? [prodDoc.imageUrl] : []),
            rental_type: rental_type || 'hourly',
            isProductMachinery: true
          };
        }
      }
    }

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Get category for the service FIRST (needed for Agri check)
    const categoryId = service.categoryId || service.categoryIds?.[0];
    const category = categoryId ? await Category.findById(categoryId) : null;

    // Calculate total value from booked items or fallback to service base price immediately after service load
    const isAgriService = service.category === 'Agriculture' || (category && category.title === 'Agriculture') || reqServiceCategory === 'Agriculture' || isVendorEquipmentBooking;

    if (isAgriService) {
      // ── Agriculture Dynamic Multiplier Logic ──
      let multiplier = 1;
      if (rental_type === 'hourly') {
        multiplier = parseFloat(estimatedDuration) || 1;
      } else if (rental_type === 'land_based') {
        multiplier = parseFloat(String(landSize).replace(/[^\d.]/g, '')) || 1;
      } else if (rental_type === 'daily' || rental_type === 'monthly') {
        multiplier = parseFloat(estimatedDuration) || 1;
      }

      // Determine correct unit rate from service model
      let unitRate = service.basePrice || 500;
      if (rental_type === 'hourly' && service.hourly_price) unitRate = service.hourly_price;
      else if (rental_type === 'land_based' && service.land_price) unitRate = service.land_price;
      else if ((rental_type === 'daily' || rental_type === 'monthly') && service.daily_price) unitRate = service.daily_price;
      else if (service.basePrice) unitRate = service.basePrice;

      let finalMultiplier = multiplier;
      if (rental_type === 'monthly') finalMultiplier = multiplier * 30;

      const mainAgriPrice = Math.round(unitRate * finalMultiplier);
      
      // Update the price of the main service in bookedItems to reflect the calculated Agri price
      // This ensures the items list and basePrice are consistent.
      if (Array.isArray(bookedItems) && bookedItems.length > 0) {
        let mainItemHandled = false;
        bookedItems.forEach(item => {
          const itemTitle = item.card?.title || item.title;
          if (itemTitle === service.title && !mainItemHandled) {
            // Update this item's price with the calculated agri price
            if (item.card) item.card.price = mainAgriPrice;
            else item.price = mainAgriPrice;
            item.quantity = 1; // mainAgriPrice already includes the hours/acres/days multiplier
            mainItemHandled = true;
          }
        });

        // Recalculate totalServiceValue from the updated items
        totalServiceValue = bookedItems.reduce((sum, item) => {
          const itemPrice = item.card?.price || item.price || 0;
          return sum + (itemPrice * (item.quantity || 1));
        }, 0);
      } else {
        totalServiceValue = mainAgriPrice;
      }
      
      // --- ADD IMPLEMENT PRICING ---
      if (Array.isArray(selectedImplements) && selectedImplements.length > 0) {
        selectedImplements.forEach(impl => {
          const implPriceObj = impl.pricing?.[rental_type];
          if (implPriceObj && implPriceObj.isEnabled) {
            const implRate = implPriceObj.price || 0;
            totalServiceValue += Math.round(implRate * finalMultiplier);
          }
        });
      }
      
      console.log(`[AgriPricing] unitRate=${unitRate}, multiplier=${multiplier}, totalServiceValue=${totalServiceValue}`);
    } else if (totalServiceValue === 0) { 
      // Standard services
      totalServiceValue = service.basePrice || 500;
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check for Pending Penalty
    const pendingPenalty = user.wallet?.penalty || 0;

    // Don't assign vendor initially - send to nearby vendors instead
    // Vendor will be assigned when a vendor accepts the booking

    // --- MOVE VENDOR SEARCH UP HERE ---
    // Find nearby vendors using location service
    const { findNearbyVendors, geocodeAddress } = require('../../services/locationService');

    // ... (Vendor Search Logic Omitted/Unchanged - keeping context)
    // Determine booking location (prioritize frontend coordinates)
    let bookingLocation;
    if (address.lat && address.lng) {
      bookingLocation = { lat: address.lat, lng: address.lng };
      console.log('Using provided coordinates for vendor search:', bookingLocation);
    } else {
      bookingLocation = await geocodeAddress(
        `${address.addressLine1}, ${address.city}, ${address.state} ${address.pincode}`
      );
      console.log('Geocoded address for vendor search:', bookingLocation);
    }

    // Find vendors within dynamic radius (2km -> 5km -> 8km -> 10km -> 15km -> 20km -> 30km)
    // CUSTOM - Check Cash Limit only if payment method is CASH
    const vendorFilters = {
      ...(category ? { service: category.title } : {}),
      checkCashLimit: ['cash', 'pay_at_home'].includes(paymentMethod)
    };

    let nearbyVendors = [];
    let usedRadius = 2;
    const searchRadii = [2, 5, 8, 10, 15, 20, 30];

    for (const radius of searchRadii) {
      usedRadius = radius;
      nearbyVendors = await findNearbyVendors(bookingLocation, radius, vendorFilters);
      
      // We allow isOnline to be false so that we can send FCM background pushes to wake them up.
      nearbyVendors = nearbyVendors.filter(v => v.availability === 'AVAILABLE' || v.availability === 'OFFLINE');

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

    console.log(`[CreateBooking] Found ${nearbyVendors.length} ONLINE nearby vendors for booking within ${usedRadius}km`);
    // --- END VENDOR SEARCH BLOCK ---

    // Calculate pricing - use amount from frontend if provided, otherwise calculate
    let basePrice, discount, tax, finalAmount;
    let bookingStatus = BOOKING_STATUS.SEARCHING;
    let bookingPaymentStatus = PAYMENT_STATUS.PENDING;

    // -------------------------------------------------------------------------
    // PRICING CALCULATION LOGIC
    // -------------------------------------------------------------------------

    // 1. Determine if we can use Plan Benefits
    let usePlanBenefits = false;
    if (paymentMethod === 'plan_benefit') {
      if (user.plans && user.plans.isActive) {
        if (user.plans.expiry && new Date() > new Date(user.plans.expiry)) {
          // Plan expired - update status and FALLBACK to normal
          console.log(`[CreateBooking] Plan expired for user ${userId}. Falling back to normal booking.`);
          user.plans.isActive = false;
          await user.save();
          paymentMethod = 'pay_at_home'; // Fallback to Pay at Home
        } else {
          usePlanBenefits = true;
        }
      } else {
        // No active plan or invalid status - Fallback
        paymentMethod = 'pay_at_home';
      }
    }

    // 2. Logic Branch: Plan Benefit vs Standard
    if (usePlanBenefits) {
      // Prioritize planId if available
      let userPlan = null;
      if (user.plans.planId) {
          userPlan = await Plan.findById(user.plans.planId);
      }
      if (!userPlan && user.plans.name) {
          userPlan = await Plan.findOne({ name: user.plans.name });
      }

      if (!userPlan) {
        // Fallback if data missing
        usePlanBenefits = false;
        paymentMethod = 'pay_at_home';
      } else {
        // --- IMPROVED PLAN LOGIC: PERCENTAGE DISCOUNTS & FREE DELIVERY & FREE SERVICES ---

        // Helper to normalize ObjectIds for comparison
        const normalizeId = (id) => {
            if (!id) return null;
            if (typeof id === 'string') return id;
            if (id.toString) return id.toString();
            return String(id);
        };

        const serviceIdStr = normalizeId(service._id);
        const categoryIdStr = normalizeId(category?._id || categoryId);
        
        let isFreeBrand = false;
        if (service.brandId) {
            isFreeBrand = userPlan.freeBrands?.some(id => normalizeId(id) === normalizeId(service.brandId));
        }

        const isFreeService = userPlan.freeServices?.some(id => normalizeId(id) === serviceIdStr);
        const isFreeCategory = userPlan.freeCategories?.some(id => normalizeId(id) === categoryIdStr);

        // 1. Check if the core service itself is 100% Free
        if (isFreeService || isFreeCategory || isFreeBrand) {
            totalServiceValue = 0;
            basePrice = 0;
        }        
        // 2. Equipment Rental Discount
        const isRental = !!(rental_type || service.rental_type);
        const rentalDiscount = isRental ? (userPlan.rentalDiscountPercentage || 0) : 0;

        // 3. Marketplace Product Discount
        let totalProductDiscount = 0;
        if (bookedItems && bookedItems.length > 0 && userPlan.marketplaceDiscountPercentage > 0) {
          bookedItems.forEach(item => {
            if (item.type === 'product' || item.category === 'Marketplace') {
              const itemPrice = item.card?.price || item.price || 0;
              const itemTotal = itemPrice * (item.quantity || 1);
              totalProductDiscount += (itemTotal * (userPlan.marketplaceDiscountPercentage / 100));
            }
          });
        }

        // 4. Apply calculated discounts
        if (basePrice !== 0) {
             basePrice = totalServiceValue > 0 ? totalServiceValue : (service.basePrice || 500);
        }

        const rentalDiscountAmount = (basePrice * (rentalDiscount / 100));
        discount = Math.round(rentalDiscountAmount + totalProductDiscount);

        // 5. Free Transport/Delivery Check
        visitingCharges = (reqVisitingCharges !== undefined) ? reqVisitingCharges : (visitingCharges !== undefined ? visitingCharges : 49);
        if (userPlan.freeTransport) {
            visitingCharges = 0; // Waive transport fee
        }

        tax = Math.round((basePrice - discount) * 0.18);
        finalAmount = (basePrice - discount + tax + visitingCharges) + pendingPenalty;

        bookingStatus = BOOKING_STATUS.SEARCHING;
        bookingPaymentStatus = PAYMENT_STATUS.PENDING;

        console.log(`[PlanBenefit] Applied ${rentalDiscount}% Rental Disc and ₹${totalProductDiscount} Product Disc, Free Transport: ${userPlan.freeTransport}`);
      }
    }

    // 3. Standard Pricing (Fallback) if NOT using Plan Benefits
    if (!usePlanBenefits) {
      if (amount && amount > 0) {
        // Use amount from frontend logic
        if (reqBasePrice !== undefined && reqTax !== undefined) {
          // Use breakdown provided by frontend
          visitingCharges = (reqVisitingCharges !== undefined) ? reqVisitingCharges : (visitingCharges !== undefined ? visitingCharges : 49);
          discount = reqDiscount || 0;
          tax = reqTax || 0;
          
          if (isAgriService) {
             // For Agri, trust the server-side recalculated totalServiceValue but allow 
             // frontend to pass the breakdown if it matches our logic.
             // If frontend total is very different, we prioritize server logic for security.
             basePrice = totalServiceValue;
          } else {
             basePrice = reqBasePrice;
          }

          finalAmount = (basePrice - discount + tax + visitingCharges) + pendingPenalty;
        } else {
          // Backward compatibility: Reverse calculate
          if (visitingCharges === undefined || visitingCharges === null) visitingCharges = 49;
          
          if (isAgriService) {
            basePrice = totalServiceValue;
            tax = Math.round(basePrice * 0.18);
            finalAmount = basePrice + tax + visitingCharges + pendingPenalty;
          } else {
            basePrice = Math.round((amount - visitingCharges) / 1.18);
            tax = amount - basePrice - visitingCharges;
            finalAmount = amount + pendingPenalty;
          }
          discount = 0;
        }
      } else {
        // Fallback to service pricing (if no amount sent)
        if (visitingCharges === undefined || visitingCharges === null) visitingCharges = 49;
        basePrice = service.basePrice || 500;
        discount = service.discountPrice ? (basePrice - service.discountPrice) : 0;
        tax = Math.round(basePrice * 0.18);
        finalAmount = (basePrice - discount + tax + visitingCharges) + pendingPenalty;
      }
    }

    // NOTE: vendor earnings are NOT calculated at booking creation.
    // They are computed ONLY at bill generation (completeSelfJob) and stored in VendorBill.
    // This prevents inconsistency between Booking and VendorBill.
    console.log(`[CreateBooking] Payment=${paymentMethod}, FinalAmount=${finalAmount}, Penalty=${pendingPenalty}`);

    // Clear penalty from user wallet if we charged it
    if (pendingPenalty > 0) {
      user.wallet.penalty = 0;
      await user.save();
    }

    // Ensure minimum amount for Razorpay (₹1) for paid bookings
    if (isNaN(finalAmount) || finalAmount < 1) {
      if (paymentMethod !== 'plan_benefit') {
        finalAmount = 1;
      } else {
        finalAmount = 0;
      }
    }
    
    // Ensure numeric fields are valid
    basePrice = Number(basePrice) || 0;
    discount = Number(discount) || 0;
    tax = Number(tax) || 0;
    visitingCharges = Number(visitingCharges) || 0;
    finalAmount = Number(finalAmount) || 0;

    // Create booking
    const bookingNumber = `BK${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Improve Category Fetching if ID is missing (Fallback to title match)
    let finalCategory = category;
    if (!finalCategory && service.category) {
      // Try finding by name if ID lookup failed
      finalCategory = await Category.findOne({ title: service.category });
    }

    // Map booked items to new schema (sectionTitle -> brandName)
    const formattedBookedItems = (Array.isArray(bookedItems) && bookedItems.length > 0) ? bookedItems.map(item => ({
      brandName: item.brandName || item.sectionTitle || item.brand || '', // Robust fallback
      brandIcon: item.brandIcon || item.sectionIcon || item.icon || null,
      card: item.card || item,
      quantity: item.quantity || 1
    })) : [];

    console.log('[CreateBooking] About to save with formatted items:', JSON.stringify(formattedBookedItems, null, 2));

    // Extract Visual Identity Details
    const categoryIcon = finalCategory?.icon || finalCategory?.image || service.iconUrl || 'https://cdn-icons-png.flaticon.com/512/3500/3500833.png';
    let brandName = null;
    let brandIcon = null;

    if (formattedBookedItems.length > 0) {
      // Try to find a distinct brand name
      const distinctBrands = [...new Set(formattedBookedItems.map(item => item.brandName).filter(Boolean))];
      if (distinctBrands.length > 0) {
        brandName = distinctBrands.join(', ');
      }

      // Try to find brand icon
      brandIcon = formattedBookedItems[0].brandIcon || null;
    }

    // Online bookings are held until the payment is verified; vendors are alerted after that
    if (paymentMethod === 'online' && finalAmount > 0) {
      bookingStatus = BOOKING_STATUS.AWAITING_PAYMENT;
    }

    const booking = await Booking.create({
      bookingNumber,
      userId,
      vendorId: (isVendorEquipmentBooking && vendorEquipmentDoc?.vendorId) 
        ? (vendorEquipmentDoc.vendorId._id || vendorEquipmentDoc.vendorId) 
        : null,
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
      endDate: (endDate && !isNaN(new Date(endDate).getTime())) ? new Date(endDate) : null,
      estimatedDuration: (estimatedDuration !== undefined && estimatedDuration !== null && !isNaN(Number(estimatedDuration))) ? Number(estimatedDuration) : null,

      description: service.description,
      serviceImages: service.images || [],
      bookedItems: formattedBookedItems,
      basePrice,
      discount,
      tax,
      visitingCharges,
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
        end: timeSlot.end
      },
      // userNotes: userNotes || null, // Removed
      // isPlusAdded: isPlusAdded || false, // Removed
      paymentMethod: paymentMethod || null,
      status: bookingStatus,
      paymentStatus: bookingPaymentStatus,
      selectedImplements: selectedImplements || []
      // notifiedVendors will be set after wave sorting
    });

    // If Plus membership was added, update user status
    if (isPlusAdded) {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year membership
      user.plans = {
        isActive: true,
        name: 'Plus Membership',
        expiry: expiryDate,
        price: 999 // Or fetch based on constants if needed, hardcoding placeholder or 0
      };
      await user.save();
      console.log(`User ${userId} upgraded to Plus Membership until ${expiryDate}`);
    }

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

    // Populate booking details
    const populatedBooking = await Booking.findById(booking._id)
      .populate('userId', 'name phone email')
      .populate('serviceId', 'title iconUrl')
      .populate('categoryId', 'title slug requiresDriver');

    // NOTIFY USER: Send actionable notification so they can track status

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
      if (vendorId) {
        await createNotification({
          vendorId,
          type: 'booking_created',
          title: 'New Booking Received',
          message: `You have received a new booking ${booking.bookingNumber} for ${service.title}.`,
          relatedId: booking._id,
          relatedType: 'booking'
        });
        const Vendor = require('../../models/Vendor');
        vendorObj = await Vendor.findById(vendorId);
      }

      // SEND EMAILS (Confirmation)
      const { sendBookingEmails } = require('../../services/emailService');
      sendBookingEmails(populatedBooking, user, vendorObj, service).catch(err => console.error(err));

      // Clear booked items from user's cart
      try {
        if (bookedItems && bookedItems.length > 0) {
          const userCart = await Cart.findOne({ userId });
          if (userCart && userCart.items.length > 0) {
            console.log(`[CreateBooking] Clearing ${bookedItems.length} booked items from cart...`);

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
              console.log(`[CreateBooking] Removed ${originalCount - userCart.items.length} items from cart. Remaining: ${userCart.items.length}`);
            }
          }
        } else if (serviceId) {
          const userCart = await Cart.findOne({ userId });
          if (userCart) {
            const originalCount = userCart.items.length;
            userCart.items = userCart.items.filter(item => {
              if (item.serviceId && item.serviceId.toString() === serviceId.toString()) return false;
              return true;
            });

            if (userCart.items.length < originalCount) {
              await userCart.save();
              console.log(`[CreateBooking] Removed service ${serviceId} from cart.`);
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
      data: populatedBooking
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

    const booking = await Booking.findOne({ _id: id, userId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking can be cancelled
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

    // Update User Wallet
    if (refundAmount > 0 || (cancellationFee > 0 && !isPaid)) {
      const User = require('../../models/User');
      const Transaction = require('../../models/Transaction');

      const user = await User.findById(userId);

      // 1. Process Refund
      if (refundAmount > 0) {
        user.wallet.balance = (user.wallet.balance || 0) + refundAmount;

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

        booking.paymentStatus = PAYMENT_STATUS.REFUNDED;
      }

      // 2. Process Cancellation Fee and Restore Previous Unpaid Penalty
      if (!isPaid) {
        // If this booking had a previous unpaid penalty baked in, we must restore it to the user's bucket
        const previousPenalty = booking.penalty || 0;
        const totalNewPenalty = cancellationFee + previousPenalty;
        
        if (totalNewPenalty > 0) {
          user.wallet.penalty = (user.wallet.penalty || 0) + totalNewPenalty;
          console.log(`[CancelBooking] Restored previous penalty ₹${previousPenalty} and added new penalty ₹${cancellationFee} for user ${userId}. Total Penalty: ${user.wallet.penalty}`);
        }
      }

      await user.save();
    }

    // Update booking status
    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancelledAt = new Date();
    booking.cancelledBy = 'user';
    booking.cancellationReason = cancellationReason || 'Cancelled by user';

    await booking.save();

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

    // Check if booking can be rescheduled
    if (booking.status === BOOKING_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule completed booking'
      });
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule cancelled booking'
      });
    }

    // Update booking
    booking.scheduledDate = new Date(scheduledDate);
    booking.scheduledTime = scheduledTime;
    booking.timeSlot = {
      start: timeSlot.start,
      end: timeSlot.end
    };

    // Reset status to pending if it was confirmed
    if (booking.status === BOOKING_STATUS.CONFIRMED) {
      booking.status = BOOKING_STATUS.PENDING;
    }

    await booking.save();

    // Send notification to vendor
    await createNotification({
      vendorId: booking.vendorId,
      type: 'booking_created', // Keeping type as is for now
      title: 'Booking Rescheduled',
      message: `Booking ${booking.bookingNumber} has been rescheduled.`,
      relatedId: booking._id,
      relatedType: 'booking',
      pushData: {
        type: 'booking_rescheduled',
        bookingId: booking._id.toString(),
        link: `/vendor/booking/${booking._id}`
      }
    });

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
    const { equipmentId, requestedDate, requestedTime } = req.query;

    if (!equipmentId || !requestedDate) {
      return res.status(400).json({
        success: false,
        message: 'Equipment ID and requested date are required'
      });
    }

    const { BOOKING_STATUS } = require('../../utils/constants');

    // Set up date boundaries for the requested date
    const reqDate = new Date(requestedDate);
    const startOfDay = new Date(reqDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(reqDate.setHours(23, 59, 59, 999));

    // 1. CHECK MAINTENANCE OVERLAP (New Agriculture Feature)
    const Maintenance = require('../../models/Maintenance');
    const maintenanceRecord = await Maintenance.findOne({
      equipmentId,
      status: 'active',
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay }
    });

    if (maintenanceRecord) {
      return res.status(200).json({
        success: true,
        available: false,
        message: `Equipment is currently under maintenance (${maintenanceRecord.reason}). It will be available after ${new Date(maintenanceRecord.endDate).toLocaleDateString()}.`
      });
    }

    // 2. CHECK EXISTING BOOKINGS (Conflict Check)
    const activeBookings = await Booking.find({
      serviceId: equipmentId,
      status: { $nin: [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED, BOOKING_STATUS.REJECTED] },
      scheduledDate: { $gte: startOfDay }
    }).sort({ scheduledDate: 1, 'timeSlot.start': 1 }); // Sort chronologically

    let isAvailable = true;

    // A simple check: if any active booking exists on the requested date with the exact same time slot
    for (let booking of activeBookings) {
      // Compare on same date 
      const bDate = new Date(booking.scheduledDate);
      if (
        bDate.getFullYear() === reqDate.getFullYear() &&
        bDate.getMonth() === reqDate.getMonth() &&
        bDate.getDate() === reqDate.getDate()
      ) {
        if (!requestedTime || booking.scheduledTime === requestedTime || (booking.timeSlot && booking.timeSlot.start === requestedTime)) {
          isAvailable = false;
          break;
        }
      }
    }

    if (isAvailable) {
      return res.status(200).json({
        success: true,
        available: true,
        message: 'Equipment is available for this slot.'
      });
    } else {
      // Find the next available day/time
      // For a robust system, this involves scanning forward. Here is a simple fallback: Next day morning.
      const nextDate = new Date(reqDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const nextAvailableSlotDate = nextDate.toISOString().split('T')[0];
      const nextAvailableSlotTime = "09:00";

      return res.status(200).json({
        success: true,
        available: false,
        nextAvailableSlot: `${nextAvailableSlotDate} ${nextAvailableSlotTime}`,
        message: 'Equipment is already booked for the requested time. Please check the next available slot.'
      });
    }
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

