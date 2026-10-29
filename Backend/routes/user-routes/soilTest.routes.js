const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const {
    getSoilTestPrices,
    createSoilTestRequest,
    getMySoilTestRequests,
    verifySoilTestPayment,
    updateSoilTestRequest
} = require('../../controllers/userControllers/soilTestController');

// Public route - soil test packages & pricing
router.get('/prices', getSoilTestPrices);

router.use(authenticate);
router.post('/request', createSoilTestRequest);
router.get('/my-requests', getMySoilTestRequests);
router.put('/request/:id', updateSoilTestRequest);
router.post('/verify-payment/:id', verifySoilTestPayment);

module.exports = router;
