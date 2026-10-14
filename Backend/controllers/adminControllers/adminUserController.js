const User = require('../../models/User');
const Booking = require('../../models/Booking');
const mongoose = require('mongoose');
const { BOOKING_STATUS } = require('../../utils/constants');
const { validationResult } = require('express-validator');

/**
 * Get all users with filters and pagination
 */
const getAllUsers = async (req, res) => {
  try {
    const {
      search,
      isActive,
      isPhoneVerified,
      isEmailVerified,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    if (isPhoneVerified !== undefined) {
      query.isPhoneVerified = isPhoneVerified === 'true';
    }
    if (isEmailVerified !== undefined) {
      query.isEmailVerified = isEmailVerified === 'true';
    }

    // Search by name, phone, or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get users
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users. Please try again.'
    });
  }
};

/**
 * Get user details
 */
const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user booking stats
    const bookingStats = await Booking.aggregate([
      {
        $match: { userId: user._id }
      },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          totalSpent: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'success'] },
                '$finalAmount',
                0
              ]
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        user,
        stats: bookingStats[0] || {
          totalBookings: 0,
          completedBookings: 0,
          totalSpent: 0
        }
      }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details. Please try again.'
    });
  }
};

/**
 * Block/unblock user
 */
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = isActive !== undefined ? isActive : !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'blocked'} successfully`,
      data: user
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status. Please try again.'
    });
  }
};

/**
 * Delete user (soft delete)
 */
// Bookings in these states are finished; anything else still has a vendor/payment attached to it
const CLOSED_BOOKING_STATUSES = [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.REJECTED];
const MAX_BULK_DELETE = 100;

/**
 * Permanently delete users from the database, with their personal data
 * (carts, tokens, notifications). Bookings, orders, transactions and reviews are
 * kept: they are the vendors' and platform's financial history.
 * Users with a booking still in progress are skipped, not deleted.
 * @returns {{ deleted: string[], skipped: { id: string, name: string, reason: string }[] }}
 */
const hardDeleteUsers = async (ids) => {
  const users = await User.find({ _id: { $in: ids } }).select('name').lean();
  const busyIds = (await Booking.distinct('userId', {
    userId: { $in: users.map(u => u._id) },
    status: { $nin: CLOSED_BOOKING_STATUSES }
  })).map(String);

  const skipped = users
    .filter(u => busyIds.includes(String(u._id)))
    .map(u => ({ id: String(u._id), name: u.name, reason: 'Has a booking in progress' }));
  const deletable = users.filter(u => !busyIds.includes(String(u._id))).map(u => u._id);

  if (deletable.length > 0) {
    const owned = { userId: { $in: deletable } };
    await Promise.all([
      require('../../models/Cart').deleteMany(owned),
      require('../../models/EcommerceCart').deleteMany(owned),
      require('../../models/Token').deleteMany(owned),
      require('../../models/Notification').deleteMany(owned)
    ]);
    await User.deleteMany({ _id: { $in: deletable } });
  }

  return { deleted: deletable.map(String), skipped };
};

/**
 * Delete user permanently
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const { deleted, skipped } = await hardDeleteUsers([id]);

    if (skipped.length > 0) {
      return res.status(409).json({
        success: false,
        message: `${skipped[0].name || 'This user'} has a booking in progress and cannot be deleted yet.`
      });
    }
    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`[ADMIN] User permanently deleted: ${id} by admin ${req.user?._id}`);
    res.status(200).json({
      success: true,
      message: 'User deleted permanently'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user. Please try again.'
    });
  }
};

/**
 * Delete several users permanently
 */
const bulkDeleteUsers = async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.map(String))] : [];
    if (ids.length === 0 || ids.length > MAX_BULK_DELETE || !ids.every(id => mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({
        success: false,
        message: `Send between 1 and ${MAX_BULK_DELETE} valid user ids`
      });
    }

    const { deleted, skipped } = await hardDeleteUsers(ids);

    console.log(`[ADMIN] ${deleted.length} users permanently deleted by admin ${req.user?._id}: ${deleted.join(', ')}`);
    res.status(200).json({
      success: true,
      message: `${deleted.length} deleted` + (skipped.length ? `, ${skipped.length} skipped (booking in progress)` : ''),
      deleted,
      skipped
    });
  } catch (error) {
    console.error('Bulk delete users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete users. Please try again.'
    });
  }
};

/**
 * View user bookings
 */
const getUserBookings = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    // Build query
    const query = { userId: id };
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get bookings
    const bookings = await Booking.find(query)
      .populate('vendorId', 'name businessName')
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
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user bookings. Please try again.'
    });
  }
};

/**
 * View user wallet transactions
 */
const getUserWalletTransactions = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('wallet');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get wallet transactions from bookings
    const transactions = await Booking.find({
      userId: id,
      paymentMethod: 'wallet',
      paymentStatus: 'success'
    })
      .select('bookingNumber finalAmount createdAt')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: {
        balance: user.wallet.balance || 0,
        transactions
      }
    });
  } catch (error) {
    console.error('Get user wallet transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet transactions. Please try again.'
    });
  }
};

/**
 * Add a new user directly (Admin)
 */
const addUser = async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name and phone are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone number already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      phone,
      email: email || null,
      isPhoneVerified: true, // Auto verify since admin is adding
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Farmer added successfully',
      data: user
    });
  } catch (error) {
    console.error('Add user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add farmer'
    });
  }
};

module.exports = {
  getAllUsers,
  getUserDetails,
  toggleUserStatus,
  deleteUser,
  bulkDeleteUsers,
  getUserBookings,
  getUserWalletTransactions,
  addUser
};
