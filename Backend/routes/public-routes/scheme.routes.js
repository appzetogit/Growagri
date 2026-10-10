const express = require('express');
const router = express.Router();
const schemeController = require('../../controllers/publicControllers/schemeController');

/**
 * Public Scheme Routes (Accessible without login)
 * Base route: /api/public/schemes
 */

router.get('/', schemeController.getPublicSchemes);
router.get('/:identifier', schemeController.getPublicSchemeBySlugOrId);

module.exports = router;
