const express = require('express');
const router = express.Router();
const websiteController = require('../../controllers/adminControllers/websiteManagementController');
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/roleMiddleware');
const { uploadImage, handleMulterError } = require('../../middleware/uploadMiddleware');

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

// TeamMember CRUD
router.route('/team-member')
  .get(websiteController.getTeamMembers)
  .post(websiteController.createTeamMember);

router.route('/team-member/:id')
  .put(websiteController.updateTeamMember)
  .delete(websiteController.deleteTeamMember);

// Direct team member image upload
router.post('/team-member/upload', uploadImage, handleMulterError, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  res.status(200).json({
    success: true,
    imageUrl: req.file.path,
    message: 'Team member image uploaded successfully'
  });
});

module.exports = router;
