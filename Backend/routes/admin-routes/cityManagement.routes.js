const express = require('express');
const router = express.Router();
const {
  getAllCities,
  getCity,
  createCity,
  updateCity,
  deleteCity,
  toggleCityStatus
} = require('../../controllers/cityController');
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin, isSuperAdmin } = require('../../middleware/roleMiddleware');

/**
 * @route   /api/admin/cities
 * @desc    Admin city management routes
 * @access  Private (Super Admin)
 */
router.get('/cities', authenticate, isAdmin, getAllCities);
router.get('/cities/:id', authenticate, isAdmin, getCity);
router.post('/cities', authenticate, isSuperAdmin, createCity);
router.put('/cities/:id', authenticate, isSuperAdmin, updateCity);
router.delete('/cities/:id', authenticate, isSuperAdmin, deleteCity);
router.patch('/cities/:id/status', authenticate, isSuperAdmin, toggleCityStatus);

module.exports = router;
