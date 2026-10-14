const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/roleMiddleware');
const {
  getAllUsers,
  getUserDetails,
  toggleUserStatus,
  deleteUser,
  bulkDeleteUsers,
  getUserBookings,
  getUserWalletTransactions,
  addUser
} = require('../../controllers/adminControllers/adminUserController');

// Validation rules
const toggleStatusValidation = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean')
];

// Routes
router.get('/users', authenticate, isAdmin, getAllUsers);
router.get('/users/:id', authenticate, isAdmin, getUserDetails);
router.put('/users/:id/status', authenticate, isAdmin, toggleStatusValidation, toggleUserStatus);
router.post('/users/bulk-delete', authenticate, isAdmin, bulkDeleteUsers);
router.delete('/users/:id', authenticate, isAdmin, deleteUser);
router.get('/users/:id/bookings', authenticate, isAdmin, getUserBookings);
router.get('/users/:id/wallet', authenticate, isAdmin, getUserWalletTransactions);
router.post('/users', authenticate, isAdmin, addUser);

module.exports = router;

