const User = require('../../models/User');
const Vendor = require('../../models/Vendor');
const Worker = require('../../models/Worker');
const Booking = require('../../models/Booking');
const Withdrawal = require('../../models/Withdrawal');
const Settlement = require('../../models/Settlement');
const SoilTestRequest = require('../../models/SoilTestRequest');
const EcommerceOrder = require('../../models/EcommerceOrder');

const { BOOKING_STATUS, PAYMENT_STATUS, VENDOR_STATUS } = require('../../utils/constants');

// Platform commission rate from settings (same formula as vendor bills)
// ponytail: applies the current rate to past bookings; sum VendorBill.companyRevenue instead if historic rate changes must be exact
const getCommissionRate = async () => {
  const settings = await require('../../models/Settings').findOne({ type: 'global' });
  return (100 - require('../../utils/constants').serviceSplitPct(settings)) / 100;
};

/**
 * Get overall dashboard stats
 */
const getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Special match for booking completions (using completedAt for revenue)
    const bookingMatch = {
      status: BOOKING_STATUS.COMPLETED,
      paymentStatus: { $in: [PAYMENT_STATUS.SUCCESS, PAYMENT_STATUS.COLLECTED_BY_VENDOR, 'success', 'collected_by_vendor', 'collected_by_worker', 'paid'] }
    };
    if (startDate || endDate) {
      bookingMatch.completedAt = {};
      if (startDate) bookingMatch.completedAt.$gte = new Date(startDate);
      if (endDate) bookingMatch.completedAt.$lte = new Date(endDate);
    }

    // Total counts (Users and Vendors now follow the date filter)
    const totalUsers = await User.countDocuments({ isActive: true, ...dateFilter });
    const totalVendors = await Vendor.countDocuments({ isActive: true, ...dateFilter });
    const totalWorkers = await Worker.countDocuments({ isActive: true, ...dateFilter });
    const totalBookings = await Booking.countDocuments(dateFilter);

    // Booking stats
    const pendingBookings = await Booking.countDocuments({
      ...dateFilter,
      status: { $nin: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED] }
    });
    const completedBookings = await Booking.countDocuments({ 
      ...dateFilter,
      status: BOOKING_STATUS.COMPLETED 
    });
    const cancelledBookings = await Booking.countDocuments({ 
      ...dateFilter,
      status: BOOKING_STATUS.CANCELLED 
    });

    // Booking Revenue stats (using bookingMatch based on completion date)
    const revenueResult = await Booking.aggregate([
      { $match: bookingMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
          totalBookings: { $sum: 1 }
        }
      }
    ]);

    const bookingRevData = revenueResult[0] || { totalRevenue: 0, totalBookings: 0 };
    const bookingRevenue = bookingRevData.totalRevenue;
    const bookingCommission = bookingRevenue * (await getCommissionRate());

    // Soil Test Revenue
    const soilTestRevenueResult = await SoilTestRequest.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          ...(startDate || endDate ? { 
            updatedAt: { 
              ...(startDate ? { $gte: new Date(startDate) } : {}), 
              ...(endDate ? { $lte: new Date(endDate) } : {}) 
            } 
          } : {})
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          totalCommission: { $sum: '$adminCommission' },
          count: { $sum: 1 }
        }
      }
    ]);

    const soilTestRevData = soilTestRevenueResult[0] || { totalAmount: 0, totalCommission: 0, count: 0 };
    const soilTestCommission = soilTestRevData.totalCommission;

    // Ecommerce Revenue
    const ecommerceRevenueResult = await EcommerceOrder.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          deliveryStatus: { $ne: 'cancelled' },
          ...(startDate || endDate ? { 
            createdAt: { 
              ...(startDate ? { $gte: new Date(startDate) } : {}), 
              ...(endDate ? { $lte: new Date(endDate) } : {}) 
            } 
          } : {})
        }
      },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: '$pricing.platformFee' },
          count: { $sum: 1 }
        }
      }
    ]);

    const ecommerceRevData = ecommerceRevenueResult[0] || { totalCommission: 0, count: 0 };
    const ecommerceCommission = ecommerceRevData.totalCommission;

    const totalRevenue = bookingCommission + soilTestCommission + ecommerceCommission;

    // Vendor approval stats
    const pendingVendors = await Vendor.countDocuments({ approvalStatus: VENDOR_STATUS.PENDING });
    const approvedVendors = await Vendor.countDocuments({ approvalStatus: VENDOR_STATUS.APPROVED });

    // Withdrawal & Settlement stats
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
    const pendingSettlementsCount = await Settlement.countDocuments({ status: 'pending' });

    // Recent activities (last 10 bookings)
    const recentActivityDocs = await Booking.find()
      .populate('userId', 'name phone')
      .populate('vendorId', 'name businessName')
      .populate('serviceId', 'title')
      .sort({ createdAt: -1 })
      .limit(10);

    const recentBookings = recentActivityDocs.map(b => ({
      id: b.bookingNumber || b._id,
      _id: b._id,
      status: b.status,
      user: { name: b.userId?.name || 'Customer' },
      serviceType: b.serviceId?.title || b.serviceName,
      price: b.finalAmount || b.basePrice || 0,
      createdAt: b.createdAt,
      acceptedAt: b.acceptedAt,
      assignedAt: b.assignedAt,
      visitedAt: b.visitedAt,
      completedAt: b.completedAt,
      workerPaymentStatus: b.workerPaymentStatus
    }));

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalVendors,
          totalWorkers,
          totalBookings,
          pendingBookings,
          completedBookings,
          cancelledBookings,
          totalRevenue: totalRevenue,
          bookingRevenue: bookingCommission,
          soilTestRevenue: soilTestCommission,
          ecommerceRevenue: ecommerceCommission,
          platformCommission: totalRevenue,
          bookingCommission: bookingCommission,
          soilTestCommission: soilTestCommission,
          ecommerceCommission: ecommerceCommission,
          pendingVendors,
          approvedVendors,
          pendingWithdrawals,
          pendingSettlements: pendingSettlementsCount
        },
        recentBookings
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats. Please try again.'
    });
  }
};

/**
 * Get revenue analytics
 */
const getRevenueAnalytics = async (req, res) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;

    let groupFormat = '%Y-%m';
    if (period === 'daily') {
      groupFormat = '%Y-%m-%d';
    } else if (period === 'weekly') {
      groupFormat = '%Y-%W';
    }

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.completedAt = {};
      if (startDate) dateFilter.completedAt.$gte = new Date(startDate);
      if (endDate) dateFilter.completedAt.$lte = new Date(endDate);
    }

    // Revenue analytics
    // Booking Revenue Analytics
    const revenueData = await Booking.aggregate([
      {
        $match: {
          status: BOOKING_STATUS.COMPLETED,
          paymentStatus: { $in: [PAYMENT_STATUS.SUCCESS, PAYMENT_STATUS.COLLECTED_BY_VENDOR, 'success', 'collected_by_vendor', 'collected_by_worker', 'paid'] },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: '$completedAt'
            }
          },
          revenue: { $sum: '$finalAmount' },
          bookings: { $sum: 1 },
          platformCommission: { $sum: { $multiply: ['$finalAmount', await getCommissionRate()] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Combined revenue analytics
    const mergedData = {};

    revenueData.forEach(item => {
      const commission = item.platformCommission || 0;
      mergedData[item._id] = {
        date: item._id,
        bookings: item.bookings || 0,
        bookingRevenue: commission,
        bookingCommission: commission,
        soilTestRevenue: 0,
        soilTestCommission: 0,
        totalRevenue: commission,
        totalCommission: commission
      };
    });

    // Soil Test Analytics
    const soilTestDateFilter = {};
    if (startDate || endDate) {
      soilTestDateFilter.updatedAt = {};
      if (startDate) soilTestDateFilter.updatedAt.$gte = new Date(startDate);
      if (endDate) soilTestDateFilter.updatedAt.$lte = new Date(endDate);
    }

    const soilTestData = await SoilTestRequest.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          ...soilTestDateFilter
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: '$updatedAt'
            }
          },
          revenue: { $sum: '$totalAmount' },
          commission: { $sum: '$adminCommission' }
        }
      }
    ]);

    soilTestData.forEach(item => {
      const commission = item.commission || 0;
      if (!mergedData[item._id]) {
        mergedData[item._id] = {
          date: item._id,
          bookingRevenue: 0,
          bookingCommission: 0,
          soilTestRevenue: commission,
          soilTestCommission: commission,
          ecommerceRevenue: 0,
          totalRevenue: commission,
          totalCommission: commission
        };
      } else {
        mergedData[item._id].soilTestRevenue = commission;
        mergedData[item._id].soilTestCommission = commission;
        mergedData[item._id].totalRevenue += commission;
        mergedData[item._id].totalCommission += commission;
      }
    });

    // 4. Ecommerce Order Revenue Analytics
    const ecommerceDateFilter = {};
    if (startDate || endDate) {
      ecommerceDateFilter.createdAt = {};
      if (startDate) ecommerceDateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) ecommerceDateFilter.createdAt.$lte = new Date(endDate);
    }

    const ecommerceData = await EcommerceOrder.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          deliveryStatus: { $ne: 'cancelled' },
          ...ecommerceDateFilter
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: '$createdAt'
            }
          },
          revenue: { $sum: '$pricing.platformFee' }
        }
      }
    ]);

    ecommerceData.forEach(item => {
      const revenue = item.revenue || 0;
      if (!mergedData[item._id]) {
        mergedData[item._id] = {
          date: item._id,
          bookingRevenue: 0,
          bookingCommission: 0,
          soilTestRevenue: 0,
          soilTestCommission: 0,
          ecommerceRevenue: revenue,
          totalRevenue: revenue,
          totalCommission: revenue
        };
      } else {
        mergedData[item._id].ecommerceRevenue = revenue;
        mergedData[item._id].totalRevenue += revenue;
        mergedData[item._id].totalCommission += revenue;
      }
    });

    const finalRevenueData = Object.values(mergedData).sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json({
      success: true,
      data: {
        period,
        revenueData: finalRevenueData
      }
    });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics. Please try again.'
    });
  }
};

/**
 * Get booking trends
 */
const getBookingTrends = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Daily booking trends
    const trends = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', BOOKING_STATUS.COMPLETED] }, 1, 0]
            }
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ['$status', BOOKING_STATUS.CANCELLED] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        days: parseInt(days),
        trends
      }
    });
  } catch (error) {
    console.error('Get booking trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking trends. Please try again.'
    });
  }
};

/**
 * Get user growth metrics
 */
const getUserGrowthMetrics = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // User growth
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Vendor growth
    const vendorGrowth = await Vendor.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        days: parseInt(days),
        userGrowth,
        vendorGrowth
      }
    });
  } catch (error) {
    console.error('Get user growth metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user growth metrics. Please try again.'
    });
  }
};

module.exports = {
  getDashboardStats,
  getRevenueAnalytics,
  getBookingTrends,
  getUserGrowthMetrics
};

