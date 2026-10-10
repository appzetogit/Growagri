const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isUser } = require('../../middleware/roleMiddleware');
const { USER_ROLES } = require('../../utils/constants');

const isVendorOrWorker = (req, res, next) => [USER_ROLES.VENDOR, USER_ROLES.WORKER].includes(req.userRole)
  ? next()
  : res.status(403).json({ success: false, message: 'Access denied. Vendor or worker role required.' });
const {
  initiateCashCollection,
  confirmCashCollection,
  customerConfirmPayment,
  getCashCollectionStatus
} = require('../../controllers/bookingControllers/cashCollectionController');

// All routes require authentication
router.use(authenticate);

// Vendor/Worker routes
router.post('/:id/initiate', isVendorOrWorker, initiateCashCollection);
router.post('/:id/confirm', isVendorOrWorker, confirmCashCollection);

// Customer route
router.post('/:id/customer-confirm', isUser, customerConfirmPayment);

// Status route (shared)
router.get('/:id/status', getCashCollectionStatus);

module.exports = router;
