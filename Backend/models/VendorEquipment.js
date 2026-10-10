const mongoose = require('mongoose');

/**
 * VendorEquipment Model
 * Represents machinery listed by vendors for rent.
 * Completely separate from E-commerce Products and Soil Testing.
 */
const vendorEquipmentSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor ID is required'],
    index: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false,
    index: true
  },
  requestedCategoryName: {
    type: String,
    default: null
  },
  // ============================================================
  // LISTING TYPE: Drives the tracking & driver flow
  // 'service' = Tractor/Harvester with driver + KM tracking
  // 'rental'  = Pump/Sprayer/Tool - no driver, time-based only
  // Inherited from Category.trackingType on the frontend
  // ============================================================
  listingType: {
    type: String,
    enum: ['service', 'rental'],
    default: 'service'
  },
  // Dynamic Implements (Sub-categories) WITH per-implement pricing
  implements: [{
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    pricing: {
      hourly:     { price: { type: Number, default: 0 }, isEnabled: { type: Boolean, default: false } },
      land_based: { price: { type: Number, default: 0 }, isEnabled: { type: Boolean, default: false } },
      daily:      { price: { type: Number, default: 0 }, isEnabled: { type: Boolean, default: false } }
    }
  }],
  // Legacy: kept for backward compat with older listings
  subCategoryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true
  }],
  name: {
    type: String,
    required: [true, 'Name/Title of equipment is required'],
    trim: true
  },
  modelNumber: {
    type: String,
    trim: true
  },
  year: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  description: {
    type: String,
    trim: true
  },
  images: [{
    type: String
  }],
  // Rental Pricing Logic
  pricing: {
    hourly: {
      price: { type: Number, default: 0 },
      isEnabled: { type: Boolean, default: false }
    },
    land_based: {
      price: { type: Number, default: 0 },
      isEnabled: { type: Boolean, default: false }
    },
    daily: {
      price: { type: Number, default: 0 },
      isEnabled: { type: Boolean, default: false }
    }
  },
  cityIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    index: true
  }],
  requestedCityName: {
    type: String,
    default: null
  },
  // Machine Verification & Status
  adminRemarks: { type: String, default: null },
  status: {
    type: String,
    enum: ['pending', 'approved', 'active', 'inactive', 'rejected'],
    default: 'pending',
    index: true
  },
  rejectionReason: {
    type: String,
    default: null
  },
  // Metadata for start/end work flow (future use)
  totalHoursWorked: {
    type: Number,
    default: 0
  },
  // Driver / Operator Config
  includesDriver: {
    type: Boolean,
    default: true
  },
  driver: {
    name: String,
    phone: String,
    photo: String,
    aadharNumber: String,
    licenseNumber: String,
    aadharImage: String,
    licenseImage: String,
    additionalCharge: {
      type: Number,
      default: 0
    }
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    default: null,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for search and landing page
vendorEquipmentSchema.index({ categoryId: 1, status: 1 });
vendorEquipmentSchema.index({ vendorId: 1, status: 1 });

module.exports = mongoose.model('VendorEquipment', vendorEquipmentSchema);
