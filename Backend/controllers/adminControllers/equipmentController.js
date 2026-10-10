const VendorEquipment = require('../../models/VendorEquipment');
const { validationResult } = require('express-validator');

/**
 * Get all equipment for management
 * GET /api/admin/equipment
 */
exports.getAllEquipment = async (req, res) => {
  try {
    const { status, vendorId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (vendorId) query.vendorId = vendorId;

    const equipment = await VendorEquipment.find(query)
      .populate({ 
        path: 'vendorId', 
        select: 'name email phone avatar businessName cityId address', 
        populate: { path: 'cityId', select: 'name' } 
      })
      .populate('cityIds', 'name')
      .populate('categoryId', 'title slug')
      .populate('subCategoryIds', 'title')
      .populate('implements.subCategoryId', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: equipment.length,
      data: equipment
    });
  } catch (error) {
    console.error('Fetch Admin Equipment Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Approve or Reject Equipment
 * PATCH /api/admin/equipment/:id/status
 */
exports.updateEquipmentStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const { id } = req.params;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const equipment = await VendorEquipment.findByIdAndUpdate(
      id,
      { status, adminRemarks: remarks },
      { new: true }
    );

    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
    }

    if (status !== 'pending') {
      const { createNotification } = require('../notificationControllers/notificationController');
      await createNotification({
        vendorId: equipment.vendorId,
        type: status === 'approved' ? 'vendor_approved' : 'vendor_rejected',
        title: status === 'approved' ? 'Machinery Approved' : 'Machinery Rejected',
        message: status === 'approved'
          ? `Your machinery "${equipment.name}" is approved and now visible to farmers.`
          : `Your machinery "${equipment.name}" was rejected.${remarks ? ` Reason: ${remarks}` : ''}`,
        relatedId: equipment._id,
        relatedType: 'service'
      }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: `Equipment ${status} successfully`,
      data: equipment
    });
  } catch (error) {
    console.error('Update Equipment Status Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Delete Equipment (Admin Only)
 */
exports.deleteEquipment = async (req, res) => {
  try {
    const equipment = await VendorEquipment.findByIdAndDelete(req.params.id);
    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Update Equipment (Admin Only)
 */
exports.updateEquipment = async (req, res) => {
  try {
    const equipment = await VendorEquipment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.status(200).json({ success: true, message: 'Updated successfully', data: equipment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
