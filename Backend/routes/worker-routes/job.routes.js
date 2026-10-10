const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../../middleware/authMiddleware');
const { isWorker } = require('../../middleware/roleMiddleware');
const {
  getAssignedJobs,
  getJobById,
  updateJobStatus,
  startJob,
  completeJob,
  addWorkerNotes,
  verifyVisit,
  workerReachedLocation,
  respondToJob,
  startMachineryWork,
  completeMachineryWork
} = require('../../controllers/bookingControllers/workerBookingController');

// Validation rules
const updateStatusValidation = [
  body('status').isIn(['in_progress', 'completed'])
    .withMessage('Invalid status')
];

const respondValidation = [
  body('status').isIn(['ACCEPTED', 'REJECTED']).withMessage('Invalid status')
];

const addNotesValidation = [
  body('notes').trim().notEmpty().withMessage('Notes are required')
];

// Routes
router.get('/jobs', authenticate, isWorker, getAssignedJobs);
router.get('/jobs/:id', authenticate, isWorker, getJobById);
router.put('/jobs/:id/respond', authenticate, isWorker, respondValidation, respondToJob);
router.put('/jobs/:id/status', authenticate, isWorker, updateStatusValidation, updateJobStatus);
router.post('/jobs/:id/start', authenticate, isWorker, startJob);
router.post('/jobs/:id/reached', authenticate, isWorker, workerReachedLocation);
router.post('/jobs/:id/visit/verify', authenticate, isWorker, verifyVisit);
router.post('/jobs/:id/complete', authenticate, isWorker, completeJob);
router.post('/jobs/:id/machinery/start', authenticate, isWorker, startMachineryWork);
router.post('/jobs/:id/machinery/complete', authenticate, isWorker, completeMachineryWork);
router.post('/jobs/:id/notes', authenticate, isWorker, addNotesValidation, addWorkerNotes);

module.exports = router;

