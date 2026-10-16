const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isUser } = require('../../middleware/roleMiddleware');
const { getReferralStats } = require('../../controllers/userControllers/userReferralController');

// GET /user/referral/stats — logged-in user ka referral code + stats
router.get('/stats', authenticate, isUser, getReferralStats);

module.exports = router;
