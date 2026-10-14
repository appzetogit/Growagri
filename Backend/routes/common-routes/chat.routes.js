const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const chatController = require('../../controllers/chatController');

// Public endpoint backed by a paid LLM: keep it well below the global API limit
const chatLimiter = rateLimit({
  windowMs: 60000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages. Please wait a minute and try again.' }
});

// POST /api/chat
router.post('/', chatLimiter, chatController.chatWithBot);

module.exports = router;
