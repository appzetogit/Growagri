const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/roleMiddleware');
const schemeController = require('../../controllers/adminControllers/schemeManagementController');

/**
 * Admin Schemes Management Routes
 * Base route: /api/admin/schemes
 */

router.use(authenticate, isAdmin);

router
  .route('/')
  .get(schemeController.getSchemes)
  .post(schemeController.createScheme);

router
  .route('/:id')
  .get(schemeController.getSchemeById)
  .put(schemeController.updateScheme)
  .delete(schemeController.deleteScheme);

router.patch('/:id/toggle-status', schemeController.toggleSchemeStatus);

module.exports = router;
