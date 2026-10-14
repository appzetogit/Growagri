const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/roleMiddleware');
const {
  getAllVendors,
  getVendorDetails,
  approveVendor,
  rejectVendor,
  suspendVendor,
  getVendorBookings,
  getVendorEarnings,
  toggleVendorStatus,
  deleteVendor,
  updateVendorServices,
  getPendingShopApprovals,
  updateShopStatus,
  getApprovedShops,
  addVendor,
  addVendorShop
} = require('../../controllers/adminControllers/adminVendorController');

// Validation rules
const rejectVendorValidation = [
  body('reason').optional().trim()
];

// Routes
router.get('/vendors/shop-approvals', authenticate, isAdmin, getPendingShopApprovals);
router.post('/vendors/shop-approvals/:id', authenticate, isAdmin, updateShopStatus);
router.post('/vendors/:id/shop', authenticate, isAdmin, addVendorShop);
router.get('/vendors/approved-shops', authenticate, isAdmin, getApprovedShops);
router.get('/vendors', authenticate, isAdmin, getAllVendors);
router.post('/vendors', authenticate, isAdmin, addVendor);
router.get('/vendors/:id', authenticate, isAdmin, getVendorDetails);
router.post('/vendors/:id/approve', authenticate, isAdmin, approveVendor);
router.post('/vendors/:id/reject', authenticate, isAdmin, rejectVendorValidation, rejectVendor);
router.post('/vendors/:id/suspend', authenticate, isAdmin, suspendVendor);
router.patch('/vendors/:id/status', authenticate, isAdmin, toggleVendorStatus); // New
router.patch('/vendors/:id/services', authenticate, isAdmin, updateVendorServices);
router.delete('/vendors/:id', authenticate, isAdmin, deleteVendor); // New
router.get('/vendors/:id/bookings', authenticate, isAdmin, getVendorBookings);
router.get('/vendors/:id/earnings', authenticate, isAdmin, getVendorEarnings);

module.exports = router;

