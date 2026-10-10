const express = require('express');
const router = express.Router();
const { submitQuery } = require('../../controllers/commonControllers/supportController');
const { authenticate } = require('../../middleware/authMiddleware');

// Help & Support is public: logged-in users are linked to their query, guests just leave name/email
const optionalAuth = (req, res, next) => (req.headers.authorization ? authenticate(req, res, next) : next());

router.post('/submit', optionalAuth, submitQuery);

module.exports = router;
