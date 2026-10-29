const mongoose = require('mongoose');
const { SERVICE_STATUS } = require('../utils/constants');

/**
 * Category Model
 * Represents service categories (e.g., Electrician, Plumber, Salon, etc.)
 */
const categorySchema = new mongoose.Schema({
  // Frontend matching fields
  title: {
    type: String,
    required: [true, 'Please provide a category title'],
    trim: true,
    index: true
  },
  type: {
    type: String,
    enum: ['service', 'product'],
    default: 'service',
    index: true
  },
  slug: {
    type: String,
    required: true,
    index: true,      // Removed global unique: true → same slug allowed in different cities
    lowercase: true
  },
  homeIconUrl: {
    type: String,
    default: null
  },
  homeBadge: {
    type: String,
    default: null,
    trim: true
  },
  hasSaleBadge: {
    type: Boolean,
    default: false
  },
  showOnHome: {
    type: Boolean,
    default: true,
    index: true
  },
  sectionType: {
    type: String,
    default: 'General'
  },
  minutePrice: {
    type: Number,
    default: 0
  },
  hourlyPrice: {
    type: Number,
    default: 0
  },
  acrePrice: {
    type: Number,
    default: 0
  },
  bighaPrice: {
    type: Number,
    default: 0
  },
  homeOrder: {
    type: Number,
    default: 0,
    index: true
  },
  // Cities where this category is available
  cityIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    index: true
  }],
  // For dynamic subcategories (e.g. Tractor -> Rotavator)
  // DEPRECATED: use parentCategories instead for new logic
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
    index: true
  },
  // Multi-parent support: a tool can belong to multiple categories (e.g. Rotavator under Tractor AND Standalone)
  parentCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true
  }],
  // If true, this category will ALWAYS appear in the Main Categories list, even if it has parents
  isAlwaysMain: {
    type: Boolean,
    default: false
  },
  // ==========================================
  // MACHINERY CLASSIFICATION (New)
  // Controls tracking & driver logic for Equipment Rental flow
  // Does NOT affect Soil Testing or E-commerce
  // ==========================================
  // 'odometer' = Moving machine (Tractor/Harvester) - KM photo required
  // 'timestamp' = Static tool (Pump/Sprayer) - only time-based billing
  // 'none' = Non-machinery (default - Soil Testing, E-commerce, etc.)
  trackingType: {
    type: String,
    enum: ['odometer', 'timestamp', 'none'],
    default: 'none'
  },
  // If true, vendor MUST register an operator/driver for this category
  requiresDriver: {
    type: Boolean,
    default: false
  },
  // Additional backend fields
  description: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: Object.values(SERVICE_STATUS),
    default: SERVICE_STATUS.ACTIVE,
    index: true
  },
  isPopular: {
    type: Boolean,
    default: false,
    index: true
  },
  metaTitle: {
    type: String,
    trim: true
  },
  metaDescription: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
}, {
  timestamps: true
});

// Generate slug from title before validation
categorySchema.pre('validate', async function (next) {
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

// Index for faster queries
categorySchema.index({ status: 1, homeOrder: 1 });
categorySchema.index({ isPopular: 1, status: 1 });
categorySchema.index({ showOnHome: 1, homeOrder: 1 });

module.exports = mongoose.model('Category', categorySchema);

