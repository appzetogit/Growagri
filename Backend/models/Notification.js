const mongoose = require('mongoose');

/**
 * Notification Model
 * Stores notifications for users, vendors, workers, and admins
 */
const notificationSchema = new mongoose.Schema({
  // Recipient Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null,
    index: true
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    default: null,
    index: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
    index: true
  },
  // Notification Type
  type: {
    type: String,
    required: true,
    enum: [
      'booking_created',
      'booking_request',      // New booking request to vendor
      'booking_requested',    // New booking created confirmation to user
      'booking_accepted',     // Vendor accepted booking
      'booking_confirmed',
      'booking_cancelled',
      'booking_completed',
      'booking_rejected',
      'booking_rescheduled',
      'job_accepted',
      'job_rejected',
      'job_cancelled',
      'worker_assigned',
      'worker_started',
      'worker_completed',
      'work_done',
      'work_completed',       // Added for vendor self completion
      'vendor_reached',
      'journey_started',
      'visit_verified',
      'payment_received',
      'payment_success',
      'payment_failed',
      'payment_refunded',
      'review_submitted',
      'vendor_approved',
      'vendor_rejected',
      'wallet_topup',
      'payout_requested',
      'payout_processed',
      'scrap_listed',
      'new_scrap_added',
      'scrap_accepted',
      'scrap_completed',
      'vendor_withdrawal_request',
      'soil_test_request',
      'soil_test_assigned',
      'soil_test_report_uploaded',
      'soil_test_report_approved',
      'soil_test_payment_received',
      'soil_test_rejected_by_vendor',
      'soil_test_rejected',
      'soil_test_status_updated',
      'weather_update',
      'weather_critical',
      'ecommerce_order',
      'ecommerce_order_update',
      'ecommerce_out_of_stock',
      // types already used by controllers (were silently rejected by validation)
      'worker_approved',
      'work_started',
      'worker_accepted',
      'support_update',
      'vendor_approval_request',
      'vendor_cash_limit_exceeded',
      'vendor_settlement_request',
      'dispute_update',
      'shop_approved',
      'shop_rejected',
      'withdrawal_rejected',
      'admin_broadcast',
      'general'
    ],
    index: true
  },
  // Notification Content
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  // Related Entity (optional)
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  relatedType: {
    type: String,
    enum: ['booking', 'payment', 'user', 'vendor', 'worker', 'service', 'scrap', 'withdrawal', 'dispute', 'settlement', 'support_query', 'order'],
    default: null
  },
  // Notification Status
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  // Additional Data
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for faster queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ vendorId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ workerId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ adminId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

