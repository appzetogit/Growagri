const Scheme = require('../../models/Scheme');
const Settings = require('../../models/Settings');
const mongoose = require('mongoose');

// GET all active schemes (Public / User App)
exports.getPublicSchemes = async (req, res) => {
  try {
    const schemes = await Scheme.find({ isActive: true }).sort({
      order: 1,
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: schemes.length,
      data: schemes,
    });
  } catch (error) {
    console.error('Error in getPublicSchemes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch government schemes',
      error: error.message,
    });
  }
};

// GET single scheme by slug or ID (Public / User App)
exports.getPublicSchemeBySlugOrId = async (req, res) => {
  try {
    const { identifier } = req.params;

    let query = { slug: identifier.toLowerCase(), isActive: true };

    // If identifier is a valid ObjectId, search by either _id OR slug
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query = {
        $or: [{ _id: identifier }, { slug: identifier.toLowerCase() }],
        isActive: true,
      };
    }

    const scheme = await Scheme.findOne(query);

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Government scheme not found',
      });
    }

    // Check if scheme has a custom whatsappNumber, otherwise fallback to platform Settings
    let effectiveWhatsapp = scheme.whatsappNumber;
    if (!effectiveWhatsapp) {
      const settings = await Settings.findOne({ type: 'global' });
      if (settings?.supportWhatsapp) {
        effectiveWhatsapp = settings.supportWhatsapp;
      }
    }

    const responseData = scheme.toObject();
    responseData.effectiveWhatsapp = effectiveWhatsapp || '+91 91177 04450';

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Error in getPublicSchemeBySlugOrId:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheme details',
      error: error.message,
    });
  }
};
