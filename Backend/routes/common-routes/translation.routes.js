const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const translationController = require('../../controllers/commonControllers/translationController');

// Public endpoint that calls an external translation service: cap volume per IP and request size
const translationLimiter = rateLimit({
    windowMs: 60000,
    max: 120, // the app batches every 100ms and caches results
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many translation requests. Please wait a minute.' }
});

const MAX_TEXT_CHARS = 5000;
const MAX_BATCH_ITEMS = 1000;
const limitSize = (req, res, next) => {
    const { text, texts, obj } = req.body || {};
    const tooBig = (typeof text === 'string' && text.length > MAX_TEXT_CHARS)
        || (Array.isArray(texts) && (texts.length > MAX_BATCH_ITEMS || texts.some(t => typeof t === 'string' && t.length > MAX_TEXT_CHARS)))
        || (obj && JSON.stringify(obj).length > MAX_TEXT_CHARS * 10);
    if (tooBig) {
        return res.status(413).json({ success: false, message: 'Text is too long to translate' });
    }
    next();
};

router.use(translationLimiter, limitSize);

/**
 * Route for individual translation
 */
router.post('/translate', translationController.translateText);

/**
 * Route for batch translation
 */
router.post('/batch', translationController.translateBatch);

/**
 * Route for object translation
 */
router.post('/object', translationController.translateObject);

module.exports = router;
