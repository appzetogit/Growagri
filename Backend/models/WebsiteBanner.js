const mongoose = require('mongoose');

const websiteBannerSchema = new mongoose.Schema({
  title: {
    type: String,
    default: '',
    trim: true
  },
  subtitle: {
    type: String,
    default: '',
    trim: true
  },
  badge: {
    type: String,
    default: 'Special Offer',
    trim: true
  },
  imageUrl: {
    type: String,
    required: [true, 'Banner image URL is required'],
    trim: true
  },
  linkUrl: {
    type: String,
    default: '',
    trim: true
  },
  buttonText: {
    type: String,
    default: 'Explore Now',
    trim: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('WebsiteBanner', websiteBannerSchema);
