const mongoose = require('mongoose');

/**
 * Cart Model
 * Stores user's cart items per user
 */
const cartItemSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: false
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false
  },
  equipmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VendorEquipment',
    default: null
  },
  isVendorEquipment: {
    type: Boolean,
    default: false
  },
  isProductMachinery: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'service'
  },
  pricing_context: {
    type: String,
    default: 'any'
  },
  parentSourceId: {
    type: String,
    default: null
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    default: null
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true
  },
  categoryTitle: {
    type: String,
    default: ''
  },
  categoryIcon: {
    type: String,
    default: null
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    default: null
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  serviceCount: {
    type: Number,
    default: 1,
    min: 1
  },
  rating: {
    type: String,
    default: '4.8'
  },
  reviews: {
    type: String,
    default: '10k+'
  },
  // Section / Brand info (from service catalog)
  sectionTitle: {
    type: String,
    default: ''
  },
  sectionIcon: {
    type: String,
    default: null
  },
  sectionId: {
    type: String,
    default: null
  },
  // Card details (matching service catalog structure)
  card: {
    title: String,
    subtitle: String,
    price: Number,
    originalPrice: Number,
    duration: String,
    description: String,
    imageUrl: String,
    features: [String]
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null
  },
  scheduledDate: {
    type: Date,
    default: null
  },
  timeSlot: {
    id: String,
    label: String,
    start: String,
    end: String
  },
  // Agriculture Equipment Rental Guideline Prices
  hourly_price: { type: Number, default: 0 },
  land_price:   { type: Number, default: 0 },
  land_unit: { type: String, default: 'acre' },
  daily_price:  { type: Number, default: 0 },
}, { _id: true });

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  items: [cartItemSchema],
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update updatedAt on save
cartSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Cart', cartSchema);

