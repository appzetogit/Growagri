const Settings = require('../../models/Settings');
const Vendor = require('../../models/Vendor');

// Never sent to the browser
const SECRET_FIELDS = '-razorpayKeySecret -razorpayWebhookSecret -cloudinaryApiSecret';

const UPDATABLE_FIELDS = [
  'visitedCharges', 'serviceGstPercentage', 'partsGstPercentage', 'servicePayoutPercentage', 'partsPayoutPercentage',
  'rentalGstPercentage', 'rentalPayoutPercentage', 'tdsPercentage', 'platformFeePercentage', 'vendorCashLimit',
  'cancellationPenalty', 'bookingCommissionPercentage',
  'razorpayKeyId', 'razorpayKeySecret', 'razorpayWebhookSecret', 'cloudinaryCloudName', 'cloudinaryApiKey', 'cloudinaryApiSecret',
  'companyName', 'companyGSTIN', 'companyPAN', 'companyAddress', 'companyCity', 'companyState', 'companyPincode',
  'companyPhone', 'companyEmail', 'invoicePrefix', 'sacCode',
  'supportEmail', 'supportPhone', 'supportWhatsapp'
];

// Get Global Settings
exports.getSettings = async (req, res, next) => {
  try {
    if (!(await Settings.exists({ type: 'global' }))) await Settings.create({ type: 'global' });
    const settings = await Settings.findOne({ type: 'global' }).select(SECRET_FIELDS);

    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
};

// Update Global Settings
exports.updateSettings = async (req, res, next) => {
  try {
    const settings = (await Settings.findOne({ type: 'global' })) || new Settings({ type: 'global' });
    for (const field of UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) settings[field] = req.body[field];
    }
    await settings.save();
    const { vendorCashLimit } = req.body;

    // Propagate vendorCashLimit to all existing vendors if it was changed
    if (vendorCashLimit !== undefined) {
      console.log(`Updating all vendors with new cash limit: ${vendorCashLimit}`);
      await Vendor.updateMany(
        {}, // Filter: all vendors
        { $set: { 'wallet.cashLimit': vendorCashLimit } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'System settings updated successfully',
      settings: await Settings.findById(settings._id).select(SECRET_FIELDS)
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
};
// Get Public Settings (Visited Charges, GST)
exports.getPublicSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne({ type: 'global' }).select('visitedCharges serviceGstPercentage partsGstPercentage supportEmail supportPhone supportWhatsapp cancellationPenalty bookingCommissionPercentage');

    // Default if not found (fallback values)
    if (!settings) {
      settings = { visitedCharges: 29, serviceGstPercentage: 18, partsGstPercentage: 18 };
    }

    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
};
