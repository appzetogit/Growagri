const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/roleMiddleware');
const {
    getSoilTestSettings,
    updateSoilTestSettings,
    getAllSoilTestRequests,
    updateSoilTestRequest,
    deleteSoilTestRequest,
    assignVendor,
    approveReport,
    rejectReport
} = require('../../controllers/adminControllers/soilTestController');

router.use(authenticate, isAdmin);

// Must stay above /soil-tests/:id
router.get('/soil-tests/settings', getSoilTestSettings);
router.put('/soil-tests/settings', updateSoilTestSettings);

router.get('/soil-tests', getAllSoilTestRequests);
router.put('/soil-tests/:id', updateSoilTestRequest);
router.delete('/soil-tests/:id', deleteSoilTestRequest);
router.post('/soil-tests/:id/assign', assignVendor);
router.post('/soil-tests/:id/approve', approveReport);
router.post('/soil-tests/:id/reject-report', rejectReport);

module.exports = router;
