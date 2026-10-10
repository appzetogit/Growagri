const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/roleMiddleware');
const {
  getAllWorkers,
  getWorkerDetails,
  approveWorker,
  rejectWorker,
  suspendWorker,
  getWorkerJobs,
  getWorkerEarnings,
  payWorker,
  getAllWorkerJobs,
  getWorkerPaymentsSummary,
  toggleWorkerStatus,
  deleteWorker
} = require('../../controllers/adminControllers/adminWorkerController');

// Validation rules
const rejectWorkerValidation = [
  body('reason').optional().trim()
];

const payWorkerValidation = [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('reference').optional().trim(),
  body('notes').optional().trim()
];

// Routes
router.get('/', authenticate, isAdmin, getAllWorkers);
router.get('/jobs', authenticate, isAdmin, getAllWorkerJobs);
router.get('/payments', authenticate, isAdmin, getWorkerPaymentsSummary);
router.get('/:id', authenticate, isAdmin, getWorkerDetails);
router.post('/:id/approve', authenticate, isAdmin, approveWorker);
router.post('/:id/reject', authenticate, isAdmin, rejectWorkerValidation, rejectWorker);
router.post('/:id/suspend', authenticate, isAdmin, suspendWorker);
router.post('/:id/pay', authenticate, isAdmin, payWorkerValidation, payWorker);
router.patch('/:id/status', authenticate, isAdmin, toggleWorkerStatus); // New
router.delete('/:id', authenticate, isAdmin, deleteWorker); // New
router.get('/:id/jobs', authenticate, isAdmin, getWorkerJobs);
router.get('/:id/earnings', authenticate, isAdmin, getWorkerEarnings);

module.exports = router;
