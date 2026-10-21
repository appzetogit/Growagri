const mongoose = require('mongoose');

const startupRecognitionSchema = new mongoose.Schema(
  {
    badge: {
      type: String,
      default: '',
      trim: true,
    },
    headingPrefix: {
      type: String,
      default: '',
      trim: true,
    },
    headingHighlight: {
      type: String,
      default: '',
      trim: true,
    },
    tagline: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    buttonText: {
      type: String,
      default: '',
      trim: true,
    },
    buttonUrl: {
      type: String,
      default: '',
      trim: true,
    },
    portalTrustText: {
      type: String,
      default: '',
      trim: true,
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    images: [
      {
        url: { type: String, required: true },
        name: { type: String, default: '' },
      },
    ],
    highlights: [
      {
        title: { type: String, default: '', trim: true },
        subtitle: { type: String, default: '', trim: true },
        iconType: { type: String, default: 'award', trim: true },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StartupRecognition', startupRecognitionSchema);
