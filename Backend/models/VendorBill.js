const mongoose = require('mongoose');
const { BILL_STATUS } = require('../utils/constants');

/**
 * Vendor Bill Model
 * ─────────────────
 * Single source of truth for the final bill and revenue split.
 * 
 * Revenue Model:
 *   Vendor gets 70% of total service BASE
 *   Vendor gets 10% of total parts BASE
 *   Company gets remainder (30% service + 90% parts)
 */
const vendorBillSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true,
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },

  // ==========================================
  // 1. BILL LINE ITEMS (Input)
  // ==========================================

  /** Services — original booking service + vendor-added extras */
  services: [{
    catalogId: {
      type: mongoose.Schema.Types.ObjectId
    },
    name: String,
    price: Number,            // Unit price
    quantity: { type: Number, default: 1 },
    total: Number,            // price × qty
    isOriginal: { type: Boolean, default: false } // true = from booking, false = vendor-added
  }],

  /** Parts used during the job */
  parts: [{
    catalogId: {
      type: mongoose.Schema.Types.ObjectId
    },
    name: String,
    price: Number,            // Unit price
    quantity: { type: Number, default: 1 },
    total: Number
  }],

  /** Custom items added by vendor (ad-hoc parts/materials) */
  customItems: [{
    name: String,
    price: Number,            // Unit price
    quantity: { type: Number, default: 1 },
    total: Number
  }],

  // ==========================================
  // 2. CALCULATED BASE TOTALS
  // ==========================================

  // Service bases
  originalServiceBase: { type: Number, default: 0 },  // Σ(original service price×qty)
  vendorServiceBase: { type: Number, default: 0 },  // Σ(added service price×qty)
  totalServiceBase: { type: Number, default: 0 },  // original + vendor

  // Parts base
  totalPartsBase: { type: Number, default: 0 },  // Σ(part price×qty)

  // Visiting Charges
  visitingCharges: { type: Number, default: 0 },

  // Transport Charges
  transportCharges: { type: Number, default: 0 },

  // ==========================================
  // 3. FINAL BILL (What user pays)
  // ==========================================

  grandTotal: {
    type: Number,
    required: true
    // = totalServiceBase + totalPartsBase + visitingCharges + transportCharges
  },

  // ==========================================
  // 4. REVENUE SPLIT (Internal — never shown to vendor before payment)
  // ==========================================

  /** Config snapshot — frozen at bill-generation time */
  payoutConfig: {
    serviceSplitPercentage: { type: Number, default: 70 },  // vendor gets 70%
    partsSplitPercentage: { type: Number, default: 10 }  // vendor gets 10%
  },

  /** Vendor earnings (calculated on BASE prices) */
  vendorServiceEarning: { type: Number, default: 0 },  // totalServiceBase × 70%
  vendorPartsEarning: { type: Number, default: 0 },  // totalPartsBase  × 10%
  vendorTotalEarning: { type: Number, default: 0 },  // service + parts earning

  /** Company revenue */
  companyRevenue: { type: Number, default: 0 },  // grandTotal − vendorTotalEarning

  // ==========================================
  // 5. STATUS & META
  // ==========================================

  status: {
    type: String,
    enum: Object.values(BILL_STATUS),
    default: BILL_STATUS.DRAFT,
    index: true
  },

  generatedAt: {
    type: Date,
    default: Date.now
  },

  paidAt: {
    type: Date,
    default: null
  },

  note: { type: String, default: null }

}, {
  timestamps: true
});

module.exports = mongoose.model('VendorBill', vendorBillSchema);
