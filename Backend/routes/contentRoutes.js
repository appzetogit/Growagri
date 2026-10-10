const express = require('express');
const router = express.Router();
const contentController = require('../controllers/adminControllers/contentController');
const { authenticate } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');

// Public routes
router.get('/faq', contentController.getFAQs);
router.get('/faq/all', authenticate, isAdmin, contentController.getAllFAQs);
router.get('/about', contentController.getAbout);
router.get('/app-guide', contentController.getAppGuide);
router.get('/policy/:role/:type', contentController.getPolicy);

// Admin routes
router.post('/faq', authenticate, isAdmin, contentController.createFAQ);
router.put('/faq/:id', authenticate, isAdmin, contentController.updateFAQ);
router.delete('/faq/:id', authenticate, isAdmin, contentController.deleteFAQ);

router.put('/about', authenticate, isAdmin, contentController.updateAbout);
router.put('/app-guide', authenticate, isAdmin, contentController.updateAppGuide);
router.put('/policy', authenticate, isAdmin, contentController.updatePolicy);

module.exports = router;
