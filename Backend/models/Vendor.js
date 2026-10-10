const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { VENDOR_STATUS } = require('../utils/constants');

// KYC docs are mandatory at signup only; older vendors created before a field existed must still be savable
function isNewVendor() { return this.isNew; }

const vendorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: [true, 'Please provide a phone number'],
    unique: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['vendor'],
    default: 'vendor'
  },
  password: {
    type: String,
    select: false
  },
  businessName: {
    type: String,
    trim: true
  },
  service: {
    type: [String], // Changed to array for multiple categories
    default: [],
    // required: [true, 'Please provide at least one service category'] 
  },
  categories: {
    type: [String],
    default: []
  },
  skills: {
    type: [String],
    default: []
  },
  aadhar: {
    number: {
      type: String,
      required: [isNewVendor, 'Please provide Aadhar number'],
      trim: true
    },
    document: {
      type: String, // Cloudinary URL (Front Side)
      required: [isNewVendor, 'Please upload Aadhar Front document']
    },
    backDocument: {
      type: String, // Cloudinary URL (Back Side)
      required: [isNewVendor, 'Please upload Aadhar Back document']
    }
  },
  pan: {
    number: {
      type: String,
      trim: true,
      uppercase: true
    },
    document: {
      type: String // Cloudinary URL
    }
  },
  otherDocuments: [{
    type: String // Cloudinary URLs
  }],
  approvalStatus: {
    type: String,
    enum: Object.values(VENDOR_STATUS),
    default: VENDOR_STATUS.PENDING
  },
  kyc_status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  kyc_documents: [{
    type: String
  }],
  // ==========================================
  // AGRICULTURE COMPLIANCE DOCUMENTS
  // ==========================================
  complianceDocuments: {
    drivingLicense: {
      number: String,
      document: String, // Cloudinary URL
      expiryDate: Date
    },
    rcBook: {
      number: String,
      document: String, // Cloudinary URL
      expiryDate: Date
    },
    insurance: {
      number: String,
      document: String, // Cloudinary URL
      expiryDate: Date
    },
    fitnessCertificate: {
      number: String,
      document: String, // Cloudinary URL
      expiryDate: Date
    }
  },
  // ==========================================
  // LAB DETAILS (For Soil Testing)
  // ==========================================
  labDetails: {
    labName: { type: String, trim: true },
    licenseNumber: { type: String, trim: true },
    certificationDocument: { type: String } // Cloudinary URL
  },
  // ==========================================
  // SHOP DETAILS (For Agri-Store / Ecommerce)
  // ==========================================
  shopDetails: {
    shopName: { type: String, trim: true },
    shopAddress: { type: String, trim: true },
    shopLocation: {
      lat: Number,
      lng: Number
    },
    shopLicense: { type: String, trim: true },
    licenseDocument: { type: String }, // Cloudinary URL
    isStoreApproved: {
      type: Boolean,
      default: false
    },
    storeApprovalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'not_submitted'],
      default: 'not_submitted'
    },
    deliveryRadius: {
      type: Number,
      default: 50
    }
  },
  approvalDate: {
    type: Date
  },
  rejectedReason: {
    type: String
  },
  profilePhoto: {
    type: String,
    default: null
  },
  address: {
    fullAddress: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      default: null,
      index: true
    },
    state: String,
    pincode: String,
    landmark: String,
    lat: {
      type: Number,
      default: null
    },
    lng: {
      type: Number,
      default: null
    }
  },
  cityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'City',
    default: null,
    index: true
  },
  wallet: {
    dues: {
      type: Number,
      default: 0 // Amount owed TO admin (from cash collection)
    },
    earnings: {
      type: Number,
      default: 0 // Amount owed BY admin (net income from jobs)
    },
    totalCashCollected: {
      type: Number,
      default: 0
    },
    totalWithdrawn: {
      type: Number,
      default: 0
    },
    totalSettled: {
      type: Number,
      default: 0
    },
    cashLimit: {
      type: Number,
      default: 10000
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    blockedAt: {
      type: Date,
      default: null
    },
    blockReason: {
      type: String,
      default: null
    }
  },
  bankAccount: {
    accountHolderName: { type: String, trim: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    ifscCode: { type: String, trim: true, uppercase: true, default: '' },
    upiId: { type: String, trim: true, default: '' },
    isVerified: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  // Settings
  settings: {
    notifications: {
      type: Boolean,
      default: true
    },
    soundAlerts: {
      type: Boolean,
      default: true
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  // Real-time Location
  location: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  // GeoJSON Location for 2dsphere indexing (fast geo queries)
  geoLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
  },
  // Real-time Online Status
  isOnline: {
    type: Boolean,
    default: false,
    index: true
  },
  lastSeenAt: {
    type: Date,
    default: null
  },
  currentSocketId: {
    type: String,
    default: null
  },
  // Availability Status
  availability: {
    type: String,
    enum: ['AVAILABLE', 'BUSY', 'ON_JOB', 'OFFLINE'],
    default: 'OFFLINE',
    index: true
  },
  // Rating & Stats
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalJobs: {
    type: Number,
    default: 0
  },
  completedJobs: {
    type: Number,
    default: 0
  },
  cancelledJobs: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  // Business Hours
  businessHours: {
    monday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    tuesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    wednesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    thursday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    friday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    saturday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    sunday: { open: String, close: String, isOpen: { type: Boolean, default: false } }
  },

  // FCM Push Notification Tokens
  fcmTokens: {
    type: [String],
    default: []
  },
  fcmTokenMobile: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Indexes for faster queries
vendorSchema.index({ approvalStatus: 1 });
vendorSchema.index({ 'wallet.earnings': -1 });
vendorSchema.index({ geoLocation: '2dsphere' }); // Fast geo queries
vendorSchema.index({ isOnline: 1, availability: 1, approvalStatus: 1 }); // Compound index for vendor search

// Hash password before saving
vendorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
vendorSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Vendor', vendorSchema);

