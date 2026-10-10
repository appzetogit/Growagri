const mongoose = require('mongoose');

const schemeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Scheme title is required'],
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full official name is required'],
      trim: true,
    },
    subtitleLine1: {
      type: String,
      default: '',
      trim: true,
    },
    subtitleLine2: {
      type: String,
      default: '',
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'Central Government Scheme',
      trim: true,
    },
    bannerImage: {
      type: String,
      default: '',
    },
    badgeBg: {
      type: String,
      default: 'bg-[#dcfce7]',
    },
    iconColor: {
      type: String,
      default: 'text-[#166534]',
    },
    iconType: {
      type: String,
      enum: ['tractor', 'wheat', 'rupee', 'sprout', 'landmark', 'shield'],
      default: 'landmark',
    },
    shortDescription: {
      type: String,
      default: '',
    },
    detailedDescription: {
      type: String,
      default: '',
    },
    benefits: {
      type: [String],
      default: [],
    },
    eligibility: {
      type: [String],
      default: [],
    },
    documentsRequired: {
      type: [String],
      default: [],
    },
    officialPortalUrl: {
      type: String,
      required: [true, 'Official portal link is required'],
      trim: true,
    },
    whatsappNumber: {
      type: String,
      default: '+91 91177 04450',
      trim: true,
    },
    whatsappMessage: {
      type: String,
      default: 'Namaste GrooAgri Team, I want more information about this scheme. Please assist me.',
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for search & sorting
schemeSchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.model('Scheme', schemeSchema);
