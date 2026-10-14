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

router.use(authenticate);

router.get('/prices', getSoilTestPrices);
router.post('/request', createSoilTestRequest);
router.get('/my-requests', getMySoilTestRequests);
router.put('/request/:id', updateSoilTestRequest);
router.post('/verify-payment/:id', verifySoilTestPayment);

module.exports = router;
