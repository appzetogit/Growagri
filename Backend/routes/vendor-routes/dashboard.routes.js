const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isVendor } = require('../../middleware/roleMiddleware');
const {
  getDashboardStats,
  getRevenueAnalytics,
  getWorkerPerformance,
  getServicePerformance,
  getEquipmentROIAnalytics,
  getEarningsSummary
} = require('../../controllers/vendorControllers/vendorDashboardController');

// Routes
router.get('/dashboard/stats', authenticate, isVendor, getDashboardStats);
router.get('/dashboard/revenue', authenticate, isVendor, getRevenueAnalytics);
router.get('/dashboard/earnings-summary', authenticate, isVendor, getEarningsSummary);
router.get('/dashboard/workers', authenticate, isVendor, getWorkerPerformance);
router.get('/dashboard/services', authenticate, isVendor, getServicePerformance);
router.get('/dashboard/equipment-roi', authenticate, isVendor, getEquipmentROIAnalytics);

module.exports = router;


