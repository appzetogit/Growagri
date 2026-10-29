const Vendor = require('../../models/Vendor');
const Transaction = require('../../models/Transaction');
const Settlement = require('../../models/Settlement');
const Withdrawal = require('../../models/Withdrawal');
const mongoose = require('mongoose');
const { recordSettlement, recordWithdrawal } = require('../../services/earningTrackerService');

/**
 * Get all vendors with their wallet balances
 */
const getVendorBalances = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, filterDue } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let matchQuery = { approvalStatus: 'approved' };
    if (search) {
      matchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // If filtering by vendors who owe money
    if (filterDue === 'true') {
      matchQuery['wallet.dues'] = { $gt: 0 };
    }

    const vendors = await Vendor.find(matchQuery)
      .select('name businessName phone email wallet profilePhoto bankAccount isActive createdAt')
      .sort({ 'wallet.dues': -1 }) // Highest dues first
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Vendor.countDocuments(matchQuery);

    // Calculate total amount due to admin
    const totalDueResult = await Vendor.aggregate([
      { $match: { 'wallet.dues': { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$wallet.dues' } } }
    ]);

    const totalDueToAdmin = Math.abs(totalDueResult[0]?.total || 0);

    // Platform-wide totals for the wallet screen (independent of the current page)
    const [walletTotals] = await Vendor.aggregate([
      { $match: { approvalStatus: 'approved' } },
      {
        $group: {
          _id: null,
          totalPayableToVendors: { $sum: { $ifNull: ['$wallet.earnings', 0] } },
          blockedVendors: { $sum: { $cond: [{ $eq: ['$wallet.isBlocked', true] }, 1, 0] } },
          totalVendors: { $sum: 1 }
        }
      }
    ]);

    // Format vendor data
    const vendorData = vendors.map(v => ({
      _id: v._id,
      name: v.name,
      businessName: v.businessName,
      phone: v.phone,
      email: v.email,
      profilePhoto: v.profilePhoto,
      dues: v.wallet?.dues || 0,
      earnings: v.wallet?.earnings || 0,
      amountDue: v.wallet?.dues || 0,
      balance: (v.wallet?.earnings || 0) - (v.wallet?.dues || 0), // Net for reference
      totalCashCollected: v.wallet?.totalCashCollected || 0,
      totalWithdrawn: v.wallet?.totalWithdrawn || 0,
      totalSettled: v.wallet?.totalSettled || 0,
      cashLimit: v.wallet?.cashLimit || 10000,
      isBlocked: v.wallet?.isBlocked || false,
      blockReason: v.wallet?.blockReason || null,
      isActive: v.isActive !== false,
      joinedAt: v.createdAt,
      // Payout account (number masked)
      bank: v.bankAccount?.bankName ? {
        holder: v.bankAccount.accountHolderName,
        bankName: v.bankAccount.bankName,
        ifsc: v.bankAccount.ifscCode,
        accountLast4: v.bankAccount.accountNumber ? String(v.bankAccount.accountNumber).slice(-4) : null
      } : null
    }));

    res.status(200).json({
      success: true,
      data: vendorData,
      summary: {
        totalDueToAdmin,
        vendorsWithDue: await Vendor.countDocuments({ 'wallet.dues': { $gt: 0 } }),
        totalPayableToVendors: walletTotals?.totalPayableToVendors || 0,
        blockedVendors: walletTotals?.blockedVendors || 0,
        totalVendors: walletTotals?.totalVendors || 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get vendor balances error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor balances'
    });
  }
};

/**
 * Get specific vendor's ledger/transactions
 */
const getVendorLedger = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 50, type } = req.query;

    const vendor = await Vendor.findById(vendorId)
      .select('name businessName phone wallet');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const query = { vendorId: new mongoose.Types.ObjectId(vendorId) };
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate({
        path: 'bookingId',
        select: 'bookingNumber serviceName basePrice tax finalAmount status paymentMethod paymentMode paymentStatus cashCollected cashCollectedAt cashCollectedBy scheduledDate scheduledTime rental_type estimatedDuration landSize landUnit address bookedItems createdAt completedAt userId equipmentId vendorBillId',
        populate: [
          { path: 'userId', select: 'name phone' },
          { path: 'equipmentId', select: 'name' },
          { path: 'vendorBillId', select: 'grandTotal totalServiceBase totalGST vendorTotalEarning companyRevenue status' }
        ]
      });

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      success: true,
      vendor: {
        _id: vendor._id,
        name: vendor.name,
        businessName: vendor.businessName,
        phone: vendor.phone,
        phone: vendor.phone,
        dues: vendor.wallet?.dues || 0,
        earnings: vendor.wallet?.earnings || 0,
        amountDue: vendor.wallet?.dues || 0
      },
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get vendor ledger error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor ledger'
    });
  }
};

/**
 * Get all pending settlement requests
 */
const getPendingSettlements = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const settlements = await Settlement.find({ status: 'pending' })
      .populate('vendorId', 'name businessName phone profilePhoto wallet.balance')
      .sort({ createdAt: 1 }) // Oldest first
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Settlement.countDocuments({ status: 'pending' });

    // Calculate total pending settlement amount
    const totalPending = await Settlement.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: settlements,
      summary: {
        totalPendingAmount: totalPending[0]?.total || 0,
        pendingCount: total
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get pending settlements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending settlements'
    });
  }
};

/**
 * Approve settlement request
 */
const approveSettlement = async (req, res) => {
  try {
    const { settlementId } = req.params;
    const { adminNotes } = req.body;
    const adminId = req.user.id;

    const settlement = await Settlement.findById(settlementId);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    if (settlement.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Settlement is not in pending status'
      });
    }

    const vendor = await Vendor.findById(settlement.vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const currentDues = vendor.wallet?.dues || 0;

    // Settlement reduces DUES
    // Ensure we don't go below zero (though validation handles request)
    vendor.wallet.dues = Math.max(0, currentDues - settlement.amount);

    // Auto-unblock if dues drop below limit
    if (vendor.wallet.isBlocked && vendor.wallet.dues <= (vendor.wallet.cashLimit || 10000)) {
      vendor.wallet.isBlocked = false;
      vendor.wallet.blockedAt = null;
      vendor.wallet.blockReason = null;
    }

    await vendor.save();

    // Update settlement
    settlement.status = 'approved';
    settlement.processedBy = adminId;
    settlement.processedAt = new Date();
    settlement.adminNotes = adminNotes;
    settlement.balanceAfter = vendor.wallet.dues;
    // Send Dues Payment (Settlement) Email
    const { sendDuesPaymentApprovedEmail } = require('../../services/emailService');
    sendDuesPaymentApprovedEmail(vendor, settlement.amount, vendor.wallet.dues).catch(e => console.error(e));

    await settlement.save();

    // Record this settlement in the earning tracker
    recordSettlement(new Date(), settlement.amount);

    res.status(200).json({
      success: true,
      message: 'Settlement approved successfully',
      data: {
        settlement,
        newDues: vendor.wallet.dues
      }
    });
  } catch (error) {
    console.error('Approve settlement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve settlement'
    });
  }
};

/**
 * Reject settlement request
 */
const rejectSettlement = async (req, res) => {
  try {
    const { settlementId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user.id;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const settlement = await Settlement.findById(settlementId);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    if (settlement.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Settlement is not in pending status'
      });
    }

    settlement.status = 'rejected';
    settlement.processedBy = adminId;
    settlement.processedAt = new Date();
    settlement.rejectionReason = rejectionReason;
    await settlement.save();

    res.status(200).json({
      success: true,
      message: 'Settlement rejected',
      data: settlement
    });
  } catch (error) {
    console.error('Reject settlement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject settlement'
    });
  }
};

/**
 * Get settlement history (all statuses)
 */
const getSettlementHistory = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, vendorId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status) query.status = status;
    if (vendorId) query.vendorId = vendorId;

    const settlements = await Settlement.find(query)
      .populate('vendorId', 'name businessName phone')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Settlement.countDocuments(query);

    res.status(200).json({
      success: true,
      data: settlements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get settlement history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settlement history'
    });
  }
};

/**
 * Dashboard summary for admin
 */
const getSettlementDashboard = async (req, res) => {
  try {
    // Total amount due to admin
    // Total amount due to admin
    const totalDueResult = await Vendor.aggregate([
      { $match: { 'wallet.dues': { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$wallet.dues' } } }
    ]);
    const totalDueToAdmin = totalDueResult[0]?.total || 0;

    // Pending settlements
    const pendingSettlements = await Settlement.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Today's cash collections
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCollections = await Transaction.aggregate([
      {
        $match: {
          type: 'cash_collected',
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // This week settlements
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekSettlements = await Transaction.aggregate([
      {
        $match: {
          type: 'settlement',
          status: 'completed',
          createdAt: { $gte: weekStart }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalDueToAdmin,
        vendorsWithDue: await Vendor.countDocuments({ 'wallet.dues': { $gt: 0 } }),
        pendingSettlements: {
          amount: pendingSettlements[0]?.total || 0,
          count: pendingSettlements[0]?.count || 0
        },
        todayCashCollected: {
          amount: todayCollections[0]?.total || 0,
          count: todayCollections[0]?.count || 0
        },
        weeklySettlements: {
          amount: weekSettlements[0]?.total || 0,
          count: weekSettlements[0]?.count || 0
        }
      }
    });
  } catch (error) {
    console.error('Get settlement dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
};

/**
 * Block Vendor (Manual or auto-triggered)
 */
const blockVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { reason } = req.body;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    vendor.wallet.isBlocked = true;
    vendor.wallet.blockedAt = new Date();
    vendor.wallet.blockReason = reason || 'Blocked by admin due to pending dues.';
    await vendor.save();

    res.status(200).json({ success: true, message: 'Vendor blocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Unblock Vendor
 */
const unblockVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    vendor.wallet.isBlocked = false;
    vendor.wallet.blockedAt = null;
    vendor.wallet.blockReason = null;
    await vendor.save();

    res.status(200).json({ success: true, message: 'Vendor unblocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update Vendor Cash Limit
 */
const updateCashLimit = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { limit } = req.body;

    if (!limit || limit < 0) {
      return res.status(400).json({ success: false, message: 'Invalid limit' });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    vendor.wallet.cashLimit = limit;

    // Auto unblock if new limit covers dues
    if (vendor.wallet.isBlocked && (vendor.wallet.dues || 0) <= limit) {
      vendor.wallet.isBlocked = false;
      vendor.wallet.blockedAt = null;
      vendor.wallet.blockReason = null;
    }

    await vendor.save();

    res.status(200).json({ success: true, message: 'Cash limit updated successfully', limit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin edits a vendor wallet (earnings, cash dues, cash limit).
 * Requires a reason; every changed field is logged as a 'wallet_adjustment' transaction
 * (before → after, admin id). The client sends the values it was shown (expected*);
 * if the wallet changed meanwhile (e.g. a booking credited earnings) the edit is refused.
 */
const updateVendorWallet = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { earnings, dues, cashLimit, expectedEarnings, expectedDues, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor id' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Please give a reason for this change' });
    }
    const next = { earnings: Number(earnings), dues: Number(dues), cashLimit: Number(cashLimit) };
    if (Object.values(next).some(v => !Number.isFinite(v) || v < 0)) {
      return res.status(400).json({ success: false, message: 'Amounts must be 0 or more' });
    }
    next.earnings = Math.round(next.earnings * 100) / 100;
    next.dues = Math.round(next.dues * 100) / 100;

    const vendor = await Vendor.findById(vendorId).select('name wallet');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const before = {
      earnings: vendor.wallet?.earnings || 0,
      dues: vendor.wallet?.dues || 0,
      cashLimit: vendor.wallet?.cashLimit || 10000
    };
    if (Number(expectedEarnings) !== before.earnings || Number(expectedDues) !== before.dues) {
      return res.status(409).json({ success: false, message: 'This wallet changed while you were editing. Please reopen and try again.' });
    }

    const changed = Object.keys(next).filter(k => next[k] !== before[k]);
    if (changed.length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing changed' });
    }

    // Compare-and-set: only applies if the wallet still has the values we validated against
    const updated = await Vendor.updateOne(
      { _id: vendorId, 'wallet.earnings': before.earnings, 'wallet.dues': before.dues },
      { $set: { 'wallet.earnings': next.earnings, 'wallet.dues': next.dues, 'wallet.cashLimit': next.cashLimit } }
    );
    if (updated.modifiedCount === 0) {
      return res.status(409).json({ success: false, message: 'This wallet changed while you were editing. Please reopen and try again.' });
    }

    const labels = { earnings: 'Available earnings', dues: 'Cash due to admin', cashLimit: 'Cash limit' };
    const note = String(reason).trim().slice(0, 300);
    await Transaction.insertMany(changed.map(field => ({
      vendorId,
      type: 'wallet_adjustment',
      amount: Math.abs(next[field] - before[field]),
      status: 'completed',
      paymentMethod: 'system',
      description: `Admin changed ${labels[field]}: ₹${before[field]} → ₹${next[field]}. Reason: ${note}`,
      metadata: { field, before: before[field], after: next[field], reason: note, adminId: req.user?._id }
    })));

    console.log(`[ADMIN] Wallet of vendor ${vendorId} edited by admin ${req.user?._id}: ${changed.map(f => `${f} ${before[f]}→${next[f]}`).join(', ')}`);
    res.status(200).json({ success: true, message: 'Wallet updated', data: { before, after: next } });
  } catch (error) {
    console.error('Update vendor wallet error:', error);
    res.status(500).json({ success: false, message: 'Failed to update wallet' });
  }
};

module.exports = {
  getVendorBalances,
  updateVendorWallet,
  getVendorLedger,
  getPendingSettlements,
  approveSettlement,
  rejectSettlement,
  getSettlementHistory,
  getSettlementDashboard,
  blockVendor,
  unblockVendor,
  updateCashLimit,

  // Withdrawal functions
  getWithdrawalRequests: async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // ?status=history → processed (approved/rejected), newest first; default → pending queue, oldest first
      const isHistory = status === 'history';
      const filter = isHistory ? { status: { $in: ['approved', 'rejected'] } } : { status: 'pending' };

      const withdrawals = await Withdrawal.find(filter)
        .populate('vendorId', 'name businessName phone wallet.earnings')
        .sort(isHistory ? { processedDate: -1, createdAt: -1 } : { createdAt: 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Withdrawal.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  approveWithdrawal: async (req, res) => {
    try {
      const { withdrawalId } = req.params;
      const { transactionReference, notes } = req.body;
      const adminId = req.user.id;

      // Fetch global settings for rates
      const Settings = require('../../models/Settings');
      const settings = await Settings.findOne({ type: 'global' });
      // No TDS on vendor withdrawals (business decision, Oct 2026); only the platform fee is deducted.
      // ?? (not ||) so an admin can set the platform fee to 0%
      const tdsRate = 0;
      const platformFeeRate = settings?.platformFeePercentage ?? 1;

      // Claim the withdrawal atomically: a double click / two admins can't both approve it
      const withdrawal = await Withdrawal.findOneAndUpdate(
        { _id: withdrawalId, status: 'pending' },
        { $set: { status: 'approved' } },
        { new: true }
      );
      if (!withdrawal) return res.status(400).json({ success: false, message: 'Withdrawal not found or not pending' });

      // Debit only if earnings still cover it (atomic)
      let vendor;
      if (withdrawal.isDebited) {
        // Debited when withdrawal request was placed, so only record totalWithdrawn
        vendor = await Vendor.findByIdAndUpdate(
          withdrawal.vendorId,
          { $inc: { 'wallet.totalWithdrawn': withdrawal.amount } },
          { new: true }
        );
      } else {
        vendor = await Vendor.findOneAndUpdate(
          { _id: withdrawal.vendorId, 'wallet.earnings': { $gte: withdrawal.amount } },
          { $inc: { 'wallet.earnings': -withdrawal.amount, 'wallet.totalWithdrawn': withdrawal.amount } },
          { new: true }
        );
      }
      if (!vendor) {
        await Withdrawal.updateOne({ _id: withdrawal._id }, { $set: { status: 'pending' } });
        return res.status(400).json({ success: false, message: 'Vendor not found or insufficient earnings' });
      }

      // Calculate Deductions
      const grossAmount = withdrawal.amount;
      const tdsAmount = Math.round((grossAmount * tdsRate) / 100);
      const platformFeeAmount = Math.round((grossAmount * platformFeeRate) / 100);
      const netAmount = grossAmount - tdsAmount - platformFeeAmount;

      // Update withdrawal with details (vendor wallet already debited above)
      withdrawal.processedBy = adminId;
      withdrawal.processedDate = new Date();
      withdrawal.transactionReference = transactionReference;
      withdrawal.adminNotes = notes;
      withdrawal.tdsRate = tdsRate;
      withdrawal.tdsAmount = tdsAmount;
      withdrawal.platformFeeRate = platformFeeRate;
      withdrawal.platformFeeAmount = platformFeeAmount;
      withdrawal.netAmount = netAmount;
      await withdrawal.save();

      // Record withdrawal payout in earning tracker
      // We pass the amount that legitimately left platform bounds to Vendor (including TDS tracking separately later if needed)
      recordWithdrawal(new Date(), grossAmount);

      // Send Withdrawal Approved Email
      const { sendWithdrawalApprovedEmail } = require('../../services/emailService');
      sendWithdrawalApprovedEmail(vendor, grossAmount, transactionReference).catch(e => console.error(e));

      // Transaction 1: Update existing pending withdrawal transaction or create if not present
      const existingTxn = await Transaction.findOne({
        'metadata.withdrawalId': withdrawal._id,
        type: 'withdrawal'
      });

      if (existingTxn) {
        existingTxn.status = 'completed';
        existingTxn.referenceId = transactionReference;
        existingTxn.description = `Withdrawal payout processed. Gross: ₹${grossAmount}`;
        existingTxn.metadata = {
          ...existingTxn.metadata,
          withdrawalId: withdrawal._id,
          tdsRate,
          tdsAmount,
          platformFeeRate,
          platformFeeAmount,
          netAmount
        };
        await existingTxn.save();
      } else {
        await Transaction.create({
          vendorId: vendor._id,
          type: 'withdrawal',
          amount: grossAmount,
          status: 'completed',
          paymentMethod: 'bank_transfer',
          description: `Withdrawal payout processed. Gross: ₹${grossAmount}`,
          referenceId: transactionReference,
          metadata: {
            withdrawalId: withdrawal._id,
            tdsRate,
            tdsAmount,
            platformFeeRate,
            platformFeeAmount,
            netAmount
          }
        });
      }

      // Transaction 2: Platform Fee Deduction (skipped when the fee is 0%)
      if (platformFeeAmount > 0) await Transaction.create({
        vendorId: vendor._id,
        type: 'platform_fee',
        amount: platformFeeAmount,
        status: 'completed',
        paymentMethod: 'system',
        description: `Platform Charge Fee (${platformFeeRate}%) on withdrawal of ₹${grossAmount}`,
        referenceId: transactionReference,
        metadata: {
          withdrawalId: withdrawal._id,
          grossAmount,
          platformFeeRate,
          netAmountTransferred: netAmount
        }
      });

      // Send in-app notification to vendor
      try {
        const { createNotification } = require('../notificationControllers/notificationController');
        await createNotification({
          vendorId: vendor._id,
          type: 'withdrawal_approved',
          title: 'Withdrawal Approved',
          message: `Your withdrawal of ₹${grossAmount} has been approved and processed. Reference: ${transactionReference || 'N/A'}`,
          relatedId: withdrawal._id,
          relatedType: 'withdrawal'
        });
      } catch (notifyErr) {
        console.error('[Withdrawal] Failed to notify vendor of approval:', notifyErr);
      }

      res.status(200).json({
        success: true,
        message: 'Withdrawal approved with deductions',
        data: {
          grossAmount,
          tdsRate,
          tdsAmount,
          platformFeeRate,
          platformFeeAmount,
          netAmount,
          transactionReference
        }
      });
    } catch (error) {
      console.error('Approve withdrawal error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },


  rejectWithdrawal: async (req, res) => {
    try {
      const { withdrawalId } = req.params;
      const reason = req.body.rejectionReason || req.body.reason;
      const adminId = req.user.id;

      // Only a pending withdrawal can be rejected (an approved one was already paid out)
      const withdrawal = await Withdrawal.findOneAndUpdate(
        { _id: withdrawalId, status: 'pending' },
        { $set: { status: 'rejected', processedBy: adminId, processedDate: new Date(), rejectionReason: reason } },
        { new: true }
      );
      if (!withdrawal) return res.status(400).json({ success: false, message: 'Withdrawal not found or not pending' });

      // If amount was debited at request time, refund it back to vendor's wallet earnings!
      if (withdrawal.isDebited) {
        await Vendor.findByIdAndUpdate(withdrawal.vendorId, {
          $inc: { 'wallet.earnings': withdrawal.amount }
        });
      }

      // Update pending transaction if exists
      const existingTxn = await Transaction.findOne({
        'metadata.withdrawalId': withdrawal._id,
        type: 'withdrawal'
      });
      if (existingTxn) {
        existingTxn.status = 'failed';
        existingTxn.description = `Withdrawal request of ₹${withdrawal.amount} rejected${reason ? `: ${reason}` : ''}. Amount refunded.`;
        await existingTxn.save();
      }

      const { createNotification } = require('../notificationControllers/notificationController');
      await createNotification({
        vendorId: withdrawal.vendorId,
        type: 'withdrawal_rejected',
        title: 'Withdrawal Rejected',
        message: `Your withdrawal of ₹${withdrawal.amount} was rejected${reason ? `: ${reason}` : '.'}${withdrawal.isDebited ? ' The amount has been refunded to your earnings.' : ''}`,
        relatedId: withdrawal._id,
        relatedType: 'withdrawal'
      }).catch(() => {});

      res.status(200).json({ success: true, message: 'Withdrawal rejected' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getWithdrawalSettings: async (req, res) => {
    try {
      const Settings = require('../../models/Settings');
      let settings = await Settings.findOne({ type: 'global' });
      if (!settings) {
        settings = await Settings.create({ type: 'global' });
      }
      res.status(200).json({
        success: true,
        data: {
          minWithdrawalAmount: settings.minWithdrawalAmount ?? 100,
          platformFeePercentage: settings.platformFeePercentage ?? 1
        }
      });
    } catch (error) {
      console.error('getWithdrawalSettings error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  updateMinWithdrawalLimit: async (req, res) => {
    try {
      const { minWithdrawalAmount } = req.body;
      const amount = Number(minWithdrawalAmount);
      if (isNaN(amount) || amount < 0) {
        return res.status(400).json({ success: false, message: 'Valid minimum withdrawal amount is required' });
      }

      const Settings = require('../../models/Settings');
      let settings = await Settings.findOne({ type: 'global' });
      if (!settings) {
        settings = new Settings({ type: 'global' });
      }
      settings.minWithdrawalAmount = amount;
      await settings.save();

      res.status(200).json({
        success: true,
        message: `Vendor minimum withdrawal limit updated to ₹${amount.toLocaleString()}`,
        data: {
          minWithdrawalAmount: settings.minWithdrawalAmount
        }
      });
    } catch (error) {
      console.error('updateMinWithdrawalLimit error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
