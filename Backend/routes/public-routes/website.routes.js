const express = require('express');
const router = express.Router();
const websiteController = require('../../controllers/adminControllers/websiteManagementController');

// Public endpoints to fetch content (hidden items are filtered out)
const publicOnly = (req, res, next) => { req.publicOnly = true; next(); };

router.get('/blogs', publicOnly, websiteController.getBlogs);
router.get('/articles', publicOnly, websiteController.getArticles);
router.get('/reviews', publicOnly, websiteController.getReviews);

module.exports = router;
