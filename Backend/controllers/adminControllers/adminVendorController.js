const Vendor = require('../../models/Vendor');
const Booking = require('../../models/Booking');
const VendorBill = require('../../models/VendorBill');
const Product = require('../../models/Product');
const { validationResult } = require('express-validator');
const { VENDOR_STATUS, BOOKING_STATUS, PAYMENT_STATUS } = require('../../utils/constants');
const { createNotification } = require('../notificationControllers/notificationController');

/**
 * Get all vendors with filters and pagination
 */
const getAllVendors = async (req, res) => {
  try {
    const {
      search,
      approvalStatus,
      isActive,
      page = 1,
      limit = 200  // Higher default for admin use (soil lab listing needs all vendors)
    } = req.query;

    // Build query
    const query = {};

    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Search by name, email, phone, or business name
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get vendors
    const vendors = await Vendor.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Vendor.countDocuments(query);

    res.status(200).json({
      success: true,
      data: vendors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all vendors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendors. Please try again.'
    });
  }
};

/**
 * Get vendor details
 */
const getVendorDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await Vendor.findById(id).select('-password');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Get vendor stats from VendorBill (single source of truth)
    const totalBookings = await Booking.countDocuments({ vendorId: vendor._id });
    const completedBookings = await Booking.countDocuments({ vendorId: vendor._id, status: BOOKING_STATUS.COMPLETED });

    const earningsResult = await VendorBill.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          status: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$vendorTotalEarning' },
          totalRevenue: { $sum: '$grandTotal' }
        }
      }
    ]);

    const bookingStats = [{
      totalBookings,
      completedBookings,
      totalEarnings: earningsResult[0]?.totalEarnings || 0,
      totalRevenue: earningsResult[0]?.totalRevenue || 0
    }];

    res.status(200).json({
      success: true,
      data: {
        vendor,
        stats: bookingStats[0] || {
          totalBookings: 0,
          completedBookings: 0,
          totalEarnings: 0
        }
      }
    });
  } catch (error) {
    console.error('Get vendor details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor details. Please try again.'
    });
  }
};

/**
 * Approve vendor registration
 */
const approveVendor = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    vendor.approvalStatus = VENDOR_STATUS.APPROVED;
    vendor.approvalDate = new Date();
    await vendor.save();

    // Send notification to vendor
    await createNotification({
      vendorId: vendor._id,
      type: 'vendor_approved',
      title: 'Vendor Registration Approved',
      message: 'Your vendor registration has been approved. You can now start accepting bookings.',
      relatedId: vendor._id,
      relatedType: 'vendor'
    });

    res.status(200).json({
      success: true,
      message: 'Vendor approved successfully',
      data: vendor
    });
  } catch (error) {
    console.error('Approve vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve vendor. Please try again.'
    });
  }
};

/**
 * Reject vendor registration
 */
const rejectVendor = async (req, res) => {
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
    const { reason } = req.body;

    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    vendor.approvalStatus = VENDOR_STATUS.REJECTED;
    vendor.rejectedReason = reason || 'Registration rejected by admin';
    await vendor.save();

    // Send notification to vendor
    await createNotification({
      vendorId: vendor._id,
      type: 'vendor_rejected',
      title: 'Vendor Registration Rejected',
      message: `Your vendor registration has been rejected. Reason: ${vendor.rejectedReason}`,
      relatedId: vendor._id,
      relatedType: 'vendor'
    });

    res.status(200).json({
      success: true,
      message: 'Vendor rejected successfully',
      data: vendor
    });
  } catch (error) {
    console.error('Reject vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject vendor. Please try again.'
    });
  }
};

/**
 * Suspend vendor
 */
const suspendVendor = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    vendor.approvalStatus = VENDOR_STATUS.SUSPENDED;
    vendor.isActive = false;
    await vendor.save();

    res.status(200).json({
      success: true,
      message: 'Vendor suspended successfully',
      data: vendor
    });
  } catch (error) {
    console.error('Suspend vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suspend vendor. Please try again.'
    });
  }
};

/**
 * View vendor bookings
 */
const getVendorBookings = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    // Build query
    const query = { vendorId: id };
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get bookings
    const bookings = await Booking.find(query)
      .populate('userId', 'name phone')
      .populate('serviceId', 'title iconUrl')
      .populate('workerId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

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
    console.error('Get vendor bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor bookings. Please try again.'
    });
  }
};

/**
 * View vendor earnings
 */
const getVendorEarnings = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Get earnings from VendorBill (single source of truth)
    const billQuery = {
      vendorId: new (require('mongoose').Types.ObjectId)(id),
      status: 'paid'
    };

    if (startDate || endDate) {
      billQuery.paidAt = {};
      if (startDate) billQuery.paidAt.$gte = new Date(startDate);
      if (endDate) billQuery.paidAt.$lte = new Date(endDate);
    }

    const earnings = await VendorBill.aggregate([
      { $match: billQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$grandTotal' },
          vendorEarnings: { $sum: '$vendorTotalEarning' },
          platformCommission: { $sum: '$companyRevenue' },
          totalBookings: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: earnings[0] || {
        totalRevenue: 0,
        vendorEarnings: 0,
        platformCommission: 0,
        totalBookings: 0
      }
    });
  } catch (error) {
    console.error('Get vendor earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor earnings. Please try again.'
    });
  }
};

/**
 * Get all vendor bookings (global)
 */
const getAllVendorBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const query = { vendorId: { $exists: true, $ne: null } };
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // If search is provided, we need to find vendors by business name or name first
    if (search) {
      const vendors = await Vendor.find({
        $or: [
          { businessName: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const vendorIds = vendors.map(v => v._id);
      query.vendorId = { $in: vendorIds };
    }

    const bookings = await Booking.find(query)
      .populate('vendorId', 'name businessName phone profileImage')
      .populate('userId', 'name phone')
      .populate('serviceId', 'title iconUrl')
      .populate('workerId', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

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
    console.error('Get all vendor bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all vendor bookings.'
    });
  }
};

/**
 * Get vendor payments summary
 */
const getVendorPaymentsSummary = async (req, res) => {
  try {
    // Return vendors with their wallet balances and earnings
    const vendors = await Vendor.find({
      'wallet.balance': { $exists: true }
    })
      .select('name businessName phone wallet email approvalStatus')
      .sort({ 'wallet.balance': -1 });

    res.status(200).json({
      success: true,
      data: vendors
    });
  } catch (error) {
    console.error('Get vendor payments summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor payments summary.'
    });
  }
};

/**
 * Toggle vendor active status (approve/disable login)
 */
const toggleVendorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body; // Expecting { isActive: true/false }

    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    vendor.isActive = isActive;
    await vendor.save();

    // Log the action (optional but recommended)
    // console.log(`Vendor ${vendor._id} status changed to ${isActive}`);

    res.status(200).json({
      success: true,
      message: `Vendor ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: vendor
    });
  } catch (error) {
    console.error('Toggle vendor status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vendor status'
    });
  }
};

/**
 * Delete vendor
 */
const deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;

    const vendor = await Vendor.findByIdAndDelete(id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vendor'
    });
  }
};

/**
 * Update vendor services
 */
const updateVendorServices = async (req, res) => {
  try {
    const { id } = req.params;
    const { services } = req.body;

    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    if (services !== undefined) {
      vendor.service = Array.isArray(services) ? services : [];
      vendor.categories = vendor.service; // Sync
    }

    await vendor.save();

    res.status(200).json({
      success: true,
      message: 'Vendor services updated successfully',
      data: vendor
    });
  } catch (error) {
    console.error('Update vendor services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vendor services'
    });
  }
};

module.exports = {
  getAllVendors,
  getVendorDetails,
  approveVendor,
  rejectVendor,
  suspendVendor,
  getVendorBookings,
  getVendorEarnings,
  getAllVendorBookings,
  getVendorPaymentsSummary,
  toggleVendorStatus,
  updateVendorServices,
  deleteVendor,
  // Agri-Marketplace Shop Management
  getPendingShopApprovals: async (req, res) => {
    try {
      const vendors = await Vendor.find({
        'shopDetails.storeApprovalStatus': 'pending'
      }).select('name businessName phone shopDetails email');
      res.status(200).json({ success: true, data: vendors });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  updateShopStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      const updateData = {
        'shopDetails.storeApprovalStatus': status,
        'shopDetails.isStoreApproved': status === 'approved'
      };
      const vendor = await Vendor.findByIdAndUpdate(id, { $set: updateData }, { new: true });
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
      
      // Notification
      await createNotification({
        vendorId: vendor._id,
        type: status === 'approved' ? 'shop_approved' : 'shop_rejected',
        title: status === 'approved' ? 'Shop Registration Approved' : 'Shop Registration Rejected',
        message: status === 'approved' ? 'Your Agri-Store is now live. You can add products.' : `Your shop registration was rejected. ${remarks || ''}`,
        relatedId: vendor._id,
        relatedType: 'vendor'
      });

      res.status(200).json({ success: true, message: `Shop registration ${status}`, data: vendor.shopDetails });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  getApprovedShops: async (req, res) => {
    try {
      const vendors = await Vendor.find({
        'shopDetails.storeApprovalStatus': 'approved'
      }).select('name businessName phone shopDetails email profilePhoto');

      // For each shop, get their product count and total stock
      const vendorIds = vendors.map(v => v._id);
      const productStats = await Product.aggregate([
        {
          $match: {
            vendorId: { $in: vendorIds },
            type: 'physical_good'
          }
        },
        {
          $group: {
            _id: '$vendorId',
            totalProducts: { $sum: 1 },
            approvedProducts: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'approved'] }, 1, 0] } },
            pendingProducts: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'pending'] }, 1, 0] } },
            totalStock: { $sum: '$stock' }
          }
        }
      ]);

      // Map stats to each vendor
      const statsMap = {};
      productStats.forEach(stat => {
        statsMap[stat._id.toString()] = stat;
      });

      const vendorsWithStats = vendors.map(v => ({
        ...v.toObject(),
        productStats: statsMap[v._id.toString()] || {
          totalProducts: 0,
          approvedProducts: 0,
          pendingProducts: 0,
          totalStock: 0
        }
      }));

      res.status(200).json({ success: true, data: vendorsWithStats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  addVendorShop: async (req, res) => {
    try {
      const { id } = req.params;
      const { shopName, shopAddress, shopLicense, shopLocation } = req.body;
      let licenseDocument = req.body.licenseDocument || null;

      const vendor = await Vendor.findById(id);
      if (!vendor) {
        return res.status(404).json({ success: false, message: 'Vendor not found' });
      }

      // Upload to cloudinary if base64
      if (licenseDocument && licenseDocument.startsWith('data:')) {
        const cloudinaryService = require('../../services/cloudinaryService');
        const uploadRes = await cloudinaryService.uploadFile(licenseDocument, { folder: 'vendors/documents/shop' });
        if (uploadRes.success) licenseDocument = uploadRes.url;
      }

      const shopDetails = {
        shopName,
        shopAddress,
        shopLocation: shopLocation || { lat: 0, lng: 0 },
        shopLicense,
        licenseDocument,
        isStoreApproved: true,
        storeApprovalStatus: 'approved'
      };

      const updatedVendor = await Vendor.findByIdAndUpdate(
        id,
        { $set: { shopDetails } },
        { new: true }
      );

      res.status(200).json({
        success: true,
        message: 'Shop successfully created and approved for this vendor.',
        data: updatedVendor.shopDetails
      });
    } catch (error) {
      console.error('Admin add vendor shop error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  addVendor: async (req, res) => {
    try {
      const { name, email, phone, businessName, service, aadhar, pan, labDetails, shopDetails } = req.body;
      let aadharUrl = req.body.aadharDocument || null;
      let aadharBackUrl = req.body.aadharBackDocument || null;
      let panUrl = req.body.panDocument || null;
      let otherUrls = req.body.otherDocuments || [];

      let parsedLabDetails = labDetails ? (typeof labDetails === 'string' ? JSON.parse(labDetails) : labDetails) : null;
      let parsedShopDetails = shopDetails ? (typeof shopDetails === 'string' ? JSON.parse(shopDetails) : shopDetails) : null;

      // Check if vendor already exists
      const existingVendor = await Vendor.findOne({ $or: [{ phone }, { email }] });
      if (existingVendor) {
        return res.status(400).json({
          success: false,
          message: 'Vendor with this phone number or email already exists.'
        });
      }

      // Upload documents to Cloudinary if they are base64 (data:)
      const cloudinaryService = require('../../services/cloudinaryService');
      if (aadharUrl && aadharUrl.startsWith('data:')) {
        const uploadRes = await cloudinaryService.uploadFile(aadharUrl, { folder: 'vendors/documents' });
        if (uploadRes.success) aadharUrl = uploadRes.url;
      }
      if (aadharBackUrl && aadharBackUrl.startsWith('data:')) {
        const uploadRes = await cloudinaryService.uploadFile(aadharBackUrl, { folder: 'vendors/documents' });
        if (uploadRes.success) aadharBackUrl = uploadRes.url;
      }
      if (panUrl && panUrl.startsWith('data:')) {
        const uploadRes = await cloudinaryService.uploadFile(panUrl, { folder: 'vendors/documents' });
        if (uploadRes.success) panUrl = uploadRes.url;
      }
      if (otherUrls && otherUrls.length > 0) {
        const uploadedOthers = [];
        for (const doc of otherUrls) {
          if (doc && doc.startsWith('data:')) {
            const up = await cloudinaryService.uploadFile(doc, { folder: 'vendors/documents/others' });
            if (up.success) uploadedOthers.push(up.url);
          } else {
            uploadedOthers.push(doc);
          }
        }
        otherUrls = uploadedOthers;
      }

      // Upload lab certificate if base64
      if (parsedLabDetails && parsedLabDetails.certificationDocument && parsedLabDetails.certificationDocument.startsWith('data:')) {
        const uploadRes = await cloudinaryService.uploadFile(parsedLabDetails.certificationDocument, { folder: 'vendors/documents/lab' });
        if (uploadRes.success) parsedLabDetails.certificationDocument = uploadRes.url;
      }

      // Upload shop license if base64
      if (parsedShopDetails && parsedShopDetails.licenseDocument && parsedShopDetails.licenseDocument.startsWith('data:')) {
        const uploadRes = await cloudinaryService.uploadFile(parsedShopDetails.licenseDocument, { folder: 'vendors/documents/shop' });
        if (uploadRes.success) parsedShopDetails.licenseDocument = uploadRes.url;
      }

      // Automatically add soil_testing to service if registering as a lab
      const serviceArray = Array.isArray(service) ? service : (service ? [service] : []);
      if (parsedLabDetails && !serviceArray.includes('soil_testing')) {
        serviceArray.push('soil_testing');
      }

      // Create the vendor document.
      // Admin created vendors bypass the review process, so approvalStatus is APPROVED and isActive is true.
      const vendorData = {
        name,
        email,
        phone,
        businessName,
        service: serviceArray,
        categories: serviceArray,
        aadhar: {
          number: aadhar,
          document: aadharUrl,
          backDocument: aadharBackUrl
        },
        pan: {
          number: pan,
          document: panUrl
        },
        otherDocuments: otherUrls,
        approvalStatus: VENDOR_STATUS.APPROVED,
        approvalDate: new Date(),
        isActive: true,
        isPhoneVerified: true
      };

      if (parsedLabDetails) {
        vendorData.labDetails = parsedLabDetails;
      }
      if (parsedShopDetails) {
        parsedShopDetails.isStoreApproved = true;
        parsedShopDetails.storeApprovalStatus = 'approved';
        vendorData.shopDetails = parsedShopDetails;
      }

      const vendor = await Vendor.create(vendorData);

      res.status(201).json({
        success: true,
        message: 'Equipment Owner registered successfully!',
        data: vendor
      });
    } catch (error) {
      console.error('Admin add vendor error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register equipment owner: ' + error.message
      });
    }
  }
};

