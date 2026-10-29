const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team member name is required'],
    trim: true,
  },
  role: {
    type: String,
    required: [true, 'Role or designation is required'],
    trim: true,
  },
  image: {
    type: String,
    default: '',
  },
  bio: {
    type: String,
    default: '',
    trim: true,
  },
  order: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  socialLinks: {
    linkedin: { type: String, default: '', trim: true },
    twitter: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('TeamMember', teamMemberSchema);
