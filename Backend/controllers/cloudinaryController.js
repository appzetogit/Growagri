const cloudinary = require('../config/cloudinary');

/**
 * Cloudinary Controller
 * Handles server-side logic for Cloudinary interactions
 */

/**
 * Generate a signed upload signature for direct frontend uploads
 * This offloads the file transfer from our server to Cloudinary directly.
 */
// Folders the apps upload to; admins (catalog/website content) may use any simple folder name
const NON_ADMIN_FOLDERS = ['appzeto', 'trips', 'evidence'];
const ADMIN_ROLES = ['ADMIN', 'admin', 'super_admin'];

exports.getSignature = async (req, res) => {
  try {
    const folder = typeof req.query.folder === 'string' && req.query.folder ? req.query.folder : 'appzeto';
    const allowed = ADMIN_ROLES.includes(req.userRole)
      ? /^[a-zA-Z0-9_-]{1,40}(\/[a-zA-Z0-9_-]{1,40}){0,2}$/.test(folder)
      : NON_ADMIN_FOLDERS.includes(folder);
    if (!allowed) {
      return res.status(400).json({ success: false, message: 'Invalid upload folder' });
    }
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Params to be signed
    const paramsToSign = {
      timestamp,
      folder
    };

    // Generate signature using API Secret
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      success: true,
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder
    });
  } catch (error) {
    console.error('Cloudinary signature error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate upload signature',
      error: error.message
    });
  }
};
