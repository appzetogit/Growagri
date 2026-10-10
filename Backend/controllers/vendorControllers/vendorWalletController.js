const Vendor = require('../../models/Vendor');
const Transaction = require('../../models/Transaction');
const Settlement = require('../../models/Settlement');
const Withdrawal = require('../../models/Withdrawal');
const Booking = require('../../models/Booking');
const Worker = require('../../models/Worker');
const { uploadPaymentScreenshot } = require('../../utils/cloudinaryUpload');
const { createOrder, verifyAndClaimPayment, releasePayment } = require('../../services/razorpayService');

/**
 * Get vendor wallet with ledger balance
 * Get vendor wallet with ledger details
 * dues = Amount owed to admin
 * earnings = Amount admin owes vendor
 */
const getWallet = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const vendor = await Vendor.findById(vendorId).select('wallet name businessName');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const dues = vendor.wallet?.dues || 0;
    const earnings = vendor.wallet?.earnings || 0;
    const totalWithdrawn = vendor.wallet?.totalWithdrawn || 0;

    // Get pending settlements count
    const pendingSettlements = await Settlement.countDocuments({
      vendorId,
      status: 'pending'
    });

    // Get total cash collected (sum of all cash_collected transactions)
    const cashCollectedResult = await Transaction.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          type: 'cash_collected',
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Get total settled amount
    const settledResult = await Transaction.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          type: 'settlement',
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const totalCashCollected = cashCollectedResult[0]?.total || 0;
    const totalSettled = settledResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: {
        dues,
        earnings,
        amountDue: dues, // Clarification for frontend but 'dues' is self-explanatory
        balance: earnings - dues, // Net position for reference (optional)
        totalWithdrawn,
        totalCashCollected,
        totalSettled,
        pendingSettlements,
        cashLimit: vendor.wallet?.cashLimit || 10000,
        vendor: {
          name: vendor.name,
          businessName: vendor.businessName
        }
      }
    });
  } catch (error) {
    console.error('Get vendor wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet'
    });
  }
};

/**
 * Get vendor transactions/ledger
 */
const getTransactions = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, limit = 20, type, status } = req.query;

    const query = { vendorId };
    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('bookingId', 'bookingNumber serviceName scheduledDate');

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get vendor transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
};


/**
 * Request settlement (vendor pays admin to clear negative balance)
 */
const requestSettlement = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { amount, paymentMethod, paymentReference, paymentProof, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const currentDues = vendor.wallet?.dues || 0;

    if (amount > currentDues) {
      return res.status(400).json({
        success: false,
        message: `Settlement amount (₹${amount}) cannot exceed current dues (₹${currentDues})`
      });
    }

    // Check for existing pending settlement
    const existingPending = await Settlement.findOne({
      vendorId,
      status: 'pending'
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending settlement request. Please wait for it to be processed.'
      });
    }

    // Create settlement request
    const settlement = await Settlement.create({
      vendorId,
      amount,
      balanceBefore: currentDues,
      balanceAfter: currentDues - amount, // Dues will decrease
      paymentMethod: paymentMethod || 'upi',
      paymentReference,
      paymentProof,
      vendorNotes: notes,
      status: 'pending'
    });

    // 🔔 NOTIFY ALL ADMINS about settlement request
    try {
      const { createNotification } = require('../notificationControllers/notificationController');
      const Admin = require('../../models/Admin');

      const admins = await Admin.find({ isActive: true }).select('_id');

      for (const admin of admins) {
        await createNotification({
          adminId: admin._id,
          type: 'vendor_settlement_request',
          title: '💰 Settlement Request',
          message: `${vendor.businessName || vendor.name} submitted settlement of ₹${amount}`,
          relatedId: settlement._id,
          relatedType: 'settlement',
          data: {
            vendorId: vendor._id,
            vendorName: vendor.businessName || vendor.name,
            amount,
            settlementId: settlement._id
          },
          pushData: {
            type: 'admin_alert',
            link: '/admin/settlements'
          }
        });
      }
      console.log(`[Settlement] Notified ${admins.length} admins about settlement request from ${vendor.name}`);
    } catch (notifyErr) {
      console.error('[Settlement] Failed to notify admins:', notifyErr);
    }

    res.status(200).json({
      success: true,
      message: 'Settlement request submitted successfully. Pending admin approval.',
      data: settlement
    });
  } catch (error) {
    console.error('Request settlement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit settlement request'
    });
  }
};

/**
 * Create Razorpay Order for Vendor Settlement
 */
const createSettlementOrder = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const currentDues = vendor.wallet?.dues || 0;
    if (amount > currentDues) {
      return res.status(400).json({ 
        success: false, 
        message: `Amount cannot exceed current dues (₹${currentDues})` 
      });
    }

    const orderResult = await createOrder(
      amount,
      'INR',
      `STL_${vendorId.toString().slice(-6)}_${Date.now()}`,
      { type: 'vendor_settlement', vendorId: vendorId.toString() }
    );

    if (!orderResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to create payment order', error: orderResult.error });
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: orderResult.orderId,
        amount: orderResult.amount / 100,
        currency: orderResult.currency,
        key: process.env.RAZORPAY_KEY_ID
      }
    });

  } catch (error) {
    console.error('Create settlement order error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Verify Razorpay Settlement Payment
 */
const verifySettlementPayment = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const verified = await verifyAndClaimPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!verified.success) {
      return res.status(verified.status).json({ success: false, message: verified.error });
    }
    if (verified.notes.type !== 'vendor_settlement' || verified.notes.vendorId !== vendorId.toString()) {
      await releasePayment(razorpay_payment_id);
      return res.status(400).json({ success: false, message: 'Payment does not belong to this settlement' });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      await releasePayment(razorpay_payment_id);
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const currentDues = vendor.wallet?.dues || 0;
    // Amount actually paid, as recorded by Razorpay
    const settlementAmount = verified.amount;
    
    // Create an auto-approved settlement record
    const settlement = await Settlement.create({
      vendorId,
      amount: settlementAmount,
      balanceBefore: currentDues,
      balanceAfter: currentDues - settlementAmount,
      paymentMethod: 'razorpay',
      paymentReference: razorpay_payment_id,
      status: 'completed', // Auto completed
      adminNotes: 'Automated Razorpay Settlement'
    });

    // Update Vendor Wallet
    vendor.wallet.dues -= settlementAmount;
    if (vendor.wallet.dues < 0) vendor.wallet.dues = 0;
    
    vendor.wallet.totalSettled = (vendor.wallet.totalSettled || 0) + settlementAmount;

    // Check if we should unblock the vendor
    const cashLimit = vendor.wallet.cashLimit || 10000;
    const netOwed = vendor.wallet.dues - (vendor.wallet.earnings || 0);
    if (vendor.wallet.isBlocked && netOwed <= cashLimit) {
      vendor.wallet.isBlocked = false;
      vendor.wallet.blockReason = null;
      vendor.wallet.blockedAt = null;
    }

    await vendor.save();

    // Create Transaction Record
    await Transaction.create({
      vendorId,
      type: 'settlement',
      amount: settlementAmount,
      status: 'completed',
      paymentMethod: 'razorpay',
      referenceId: razorpay_payment_id,
      description: `Settlement of ₹${settlementAmount} paid via Razorpay`,
      metadata: { settlementId: settlement._id.toString() }
    });

    res.status(200).json({
      success: true,
      message: 'Settlement completed successfully'
    });

  } catch (error) {
    console.error('Verify settlement payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};

/**
 * Request Withdrawal (Vendor requests payout of earnings)
 */
const requestWithdrawal = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { amount, bankDetails, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const currentEarnings = vendor.wallet?.earnings || 0;

    // Check pending withdrawals?
    const pendingWithdrawals = await Withdrawal.aggregate([
      { $match: { vendorId: vendor._id, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const pendingAmount = pendingWithdrawals[0]?.total || 0;
    // Dues = cash the vendor already holds (incl. their own share), so it is netted off first
    const currentDues = vendor.wallet?.dues || 0;
    const availableEarnings = Math.max(0, currentEarnings - currentDues - pendingAmount);

    if (vendor.wallet?.isBlocked) {
      return res.status(403).json({ success: false, message: 'Wallet is blocked. Please clear your dues first.' });
    }

    if (Number(amount) > availableEarnings) {
      return res.status(400).json({
        success: false,
        message: `Insufficient earnings. Available: ₹${availableEarnings} (Dues: ₹${currentDues}, Pending: ₹${pendingAmount})`
      });
    }

    const withdrawal = await Withdrawal.create({
      vendorId,
      amount,
      bankDetails: bankDetails || vendor.bankAccount,
      adminNotes: notes,
      status: 'pending'
    });

    // 🔔 NOTIFY ALL ADMINS about withdrawal request
    try {
      const { createNotification } = require('../notificationControllers/notificationController');
      const Admin = require('../../models/Admin');

      const admins = await Admin.find({ isActive: true }).select('_id');

      for (const admin of admins) {
        await createNotification({
          adminId: admin._id,
          type: 'vendor_withdrawal_request',
          title: '💸 Withdrawal Request',
          message: `${vendor.businessName || vendor.name} requested withdrawal of ₹${amount}`,
          relatedId: withdrawal._id,
          relatedType: 'withdrawal',
          data: {
            vendorId: vendor._id,
            vendorName: vendor.businessName || vendor.name,
            amount,
            withdrawalId: withdrawal._id
          },
          pushData: {
            type: 'admin_alert',
            link: '/admin/settlements'
          }
        });
      }
      console.log(`[Withdrawal] Notified ${admins.length} admins about withdrawal request from ${vendor.name}`);
    } catch (notifyErr) {
      console.error('[Withdrawal] Failed to notify admins:', notifyErr);
    }

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: withdrawal
    });

  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Failed to request withdrawal' });
  }
};

/**
 * Get vendor's settlement history
 */
const getSettlements = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { vendorId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const settlements = await Settlement.find(query)
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
    console.error('Get settlements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settlements'
    });
  }
};

/**
 * Get wallet summary for dashboard
 */
const getWalletSummary = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const vendor = await Vendor.findById(vendorId).select('wallet');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const balance = vendor.wallet?.balance || 0;

    // Get today's cash collections
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCollections = await Transaction.aggregate([
      {
        $match: {
          vendorId: vendor._id,
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

    // Get this week's collections
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const weekCollections = await Transaction.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          type: 'cash_collected',
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
        dues: vendor.wallet?.dues || 0,
        earnings: vendor.wallet?.earnings || 0,
        amountDue: vendor.wallet?.dues || 0,
        today: {
          amount: todayCollections[0]?.total || 0,
          count: todayCollections[0]?.count || 0
        },
        thisWeek: {
          amount: weekCollections[0]?.total || 0,
          count: weekCollections[0]?.count || 0
        }
      }
    });
  } catch (error) {
    console.error('Get wallet summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet summary'
    });
  }
};

/**
 * Pay worker for a booking
 */
const payWorker = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { bookingId, amount, notes, transactionId, screenshot, paymentMethod = 'cash' } = req.body;

    if (!bookingId || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid booking ID and amount are required'
      });
    }

    const booking = await Booking.findOne({ _id: bookingId, vendorId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not authorized'
      });
    }

    if (!booking.workerId) {
      return res.status(400).json({
        success: false,
        message: 'No worker assigned to this booking'
      });
    }

    if (['PAID', 'SUCCESS'].includes(booking.workerPaymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Worker already paid for this booking'
      });
    }

    const worker = await Worker.findById(booking.workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Upload screenshot to Cloudinary if provided
    let screenshotUrl = null;
    if (screenshot) {
      try {
        // Check if screenshot is base64
        if (screenshot.startsWith('data:image')) {
          screenshotUrl = await uploadPaymentScreenshot(screenshot, bookingId);
          console.log('Payment screenshot uploaded to Cloudinary:', screenshotUrl);
        } else {
          // If already a URL, use it as is
          screenshotUrl = screenshot;
        }
      } catch (uploadError) {
        console.error('Failed to upload payment screenshot:', uploadError);
        // Continue without screenshot rather than failing the entire payment
        screenshotUrl = null;
      }
    }

    // Record Transaction
    const transaction = new Transaction({
      vendorId,
      workerId: worker._id,
      bookingId: booking._id,
      type: 'worker_payment',
      amount: parseFloat(amount),
      status: 'completed',
      paymentMethod: paymentMethod || 'cash',
      description: `Payment for booking #${booking.bookingNumber}. ${notes || ''}`,
      referenceId: transactionId || null,
      metadata: {
        notes,
        transactionId,
        screenshot: screenshotUrl, // Store Cloudinary URL instead of base64
        paymentMethod
      }
    });

    // Claim the payment atomically so a double submit can't pay twice.
    // Paying the worker does not change the job status; completion goes through OTP/payment.
    const claimed = await Booking.updateOne(
      { _id: booking._id, workerPaymentStatus: { $nin: ['PAID', 'SUCCESS'] } },
      { $set: { workerPaymentStatus: 'PAID', isWorkerPaid: true, workerPaidAt: new Date() } }
    );
    if (!claimed.modifiedCount) {
      return res.status(400).json({ success: false, message: 'Worker already paid for this booking' });
    }

    await Promise.all([
      transaction.save(),
      Worker.updateOne({ _id: worker._id }, { $inc: { 'wallet.balance': parseFloat(amount) } })
    ]);

    // Notify worker about payment
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      workerId: worker._id,
      type: 'payment_received',
      title: '💰 Payment Received',
      message: `You received ₹${amount.toLocaleString()} from ${booking.vendorId?.businessName || 'vendor'} for booking #${booking.bookingNumber}`,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'payment_received',
        bookingId: booking._id.toString(),
        amount: parseFloat(amount),
        link: `/worker/wallet`
      }
    });

    res.status(200).json({
      success: true,
      message: `Payment of ₹${amount} recorded for ${worker.name}`,
      data: {
        bookingId: booking._id,
        workerName: worker.name,
        amount: parseFloat(amount),
        screenshotUploaded: !!screenshotUrl
      }
    });
  } catch (error) {
    console.error('Pay worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment'
    });
  }
};

/**
 * Get vendor's withdrawal history
 */
const getWithdrawals = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { vendorId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const withdrawals = await Withdrawal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Withdrawal.countDocuments(query);

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
    console.error('Get withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawals'
    });
  }
};

/**
 * Get vendor bank account details
 */
const getBankAccount = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const vendor = await Vendor.findById(vendorId).select('bankAccount');
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.status(200).json({
      success: true,
      data: vendor.bankAccount || {}
    });
  } catch (error) {
    console.error('Get bank account error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bank account details' });
  }
};

/**
 * Save or update vendor bank account details
 */
const saveBankAccount = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { accountHolderName, bankName, accountNumber, ifscCode, upiId } = req.body;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    vendor.bankAccount = {
      accountHolderName: accountHolderName !== undefined ? accountHolderName : (vendor.bankAccount?.accountHolderName || ''),
      bankName: bankName !== undefined ? bankName : (vendor.bankAccount?.bankName || ''),
      accountNumber: accountNumber !== undefined ? accountNumber : (vendor.bankAccount?.accountNumber || ''),
      ifscCode: (ifscCode !== undefined ? ifscCode : (vendor.bankAccount?.ifscCode || '')).toUpperCase(),
      upiId: upiId !== undefined ? upiId : (vendor.bankAccount?.upiId || ''),
      isVerified: vendor.bankAccount?.isVerified || false,
      updatedAt: new Date()
    };

    await vendor.save();

    res.status(200).json({
      success: true,
      message: 'Bank account details saved successfully',
      data: vendor.bankAccount
    });
  } catch (error) {
    console.error('Save bank account error:', error);
    res.status(500).json({ success: false, message: 'Failed to save bank account details' });
  }
};

module.exports = {
  getWallet,
  getTransactions,
  requestSettlement,
  getSettlements,
  getWalletSummary,
  payWorker,
  createSettlementOrder,
  verifySettlementPayment,
  requestWithdrawal,
  getWithdrawals,
  getBankAccount,
  saveBankAccount
};
