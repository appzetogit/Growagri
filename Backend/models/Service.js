const mongoose = require('mongoose');
const { SERVICE_STATUS } = require('../utils/constants');

/**
 * Service Model (New Structure)
 * Represents individual services strictly under a Brand
 */
const serviceSchema = new mongoose.Schema({
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: false,
    index: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a service title'],
    trim: true,
    index: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  iconUrl: {
    type: String,
    default: null
  },
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Price cannot be negative']
  },
  gstPercentage: {
    type: Number,
    required: [true, 'GST percentage is required'],
    min: 0,
    default: 18
  },
  status: {
    type: String,
    enum: Object.values(SERVICE_STATUS),
    default: SERVICE_STATUS.ACTIVE,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  // ==========================================
  // EQUIPMENT RENTAL SPECIFIC FIELDS
  // ==========================================
  rental_type: {
    type: String,
    enum: ['hourly', 'minute', 'acre', 'bigha', 'land_based', 'monthly', 'daily'],
    default: 'hourly'
  },
  minute_price: {
    type: Number,
    default: 0
  },
  hourly_price: {
    type: Number,
    default: 0
  },
  acre_price: {
    type: Number,
    default: 0
  },
  bigha_price: {
    type: Number,
    default: 0
  },
  land_price: {
    type: Number,
    default: 0
  },
  land_unit: {
    type: String,
    default: 'acre'
  },
  daily_price: {
    type: Number,
    default: 0
  },
  // ==========================================
  // CONTEXTUAL PRICING (New)
  // Differentiates between Standalone vs Sub-category Implement pricing
  // ==========================================
  pricing_context: {
    type: String,
    enum: ['standalone', 'sub-category', 'any'],
    default: 'any'
  },
  // If context is 'sub-category', this specifies the parent it applies to
  // (e.g. Rate for 'Rotavator' when rented with 'Mahindra Tractor')
  parentSourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  equipment_features: [{
    type: String
  }]
}, {
  timestamps: true
});

// Generate slug from title before saving
serviceSchema.pre('validate', async function (next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Service', serviceSchema);
