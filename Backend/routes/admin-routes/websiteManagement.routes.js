const express = require('express');
const router = express.Router();
const websiteController = require('../../controllers/adminControllers/websiteManagementController');
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/roleMiddleware');

router.use(authenticate, isAdmin);

// Blog CRUD
router.route('/blog')
  .get(websiteController.getBlogs)
  .post(websiteController.createBlog);

router.route('/blog/:id')
  .put(websiteController.updateBlog)
  .delete(websiteController.deleteBlog);

// Article CRUD
router.route('/article')
  .get(websiteController.getArticles)
  .post(websiteController.createArticle);

router.route('/article/:id')
  .put(websiteController.updateArticle)
  .delete(websiteController.deleteArticle);

// WebsiteReview CRUD
router.route('/review')
  .get(websiteController.getReviews)
  .post(websiteController.createReview);

router.route('/review/:id')
  .put(websiteController.updateReview)
  .delete(websiteController.deleteReview);

// WebsiteBanner CRUD
router.route('/banner')
  .get(websiteController.getBanners)
  .post(websiteController.createBanner);

router.route('/banner/:id')
  .put(websiteController.updateBanner)
  .delete(websiteController.deleteBanner);

module.exports = router;
