const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin, isSuperAdmin } = require('../../middleware/roleMiddleware');
const { getSettings, updateSettings } = require('../../controllers/adminControllers/settingsController');

// All routes are protected and for admin only
router.get('/settings', authenticate, isAdmin, getSettings);
router.put('/settings', authenticate, isSuperAdmin, updateSettings);

module.exports = router;
