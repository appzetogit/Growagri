const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isUser } = require('../../middleware/roleMiddleware');
const {
    getApprovedProducts,
    getProductDetails,
    placeOrder,
    createPaymentOrder,
    payPlatformFee,
    getMyOrders,
    getOrderById,
    cancelOrder,
    generateInvoice
} = require('../../controllers/userControllers/productController');

// ✅ PUBLIC routes — No auth required (browsing marketplace)
router.get('/marketplace', getApprovedProducts);
router.get('/products/:id', getProductDetails);

// 🔒 PROTECTED routes — Auth required (ordering & tracking)
router.post('/orders', authenticate, isUser, placeOrder);
router.get('/orders/:id', authenticate, isUser, getOrderById);
router.get('/orders/:id/invoice', authenticate, isUser, generateInvoice);
router.post('/orders/:id/create-payment-order', authenticate, isUser, createPaymentOrder);
router.post('/orders/:id/pay-platform-fee', authenticate, isUser, payPlatformFee);
router.post('/orders/:id/cancel', authenticate, isUser, cancelOrder);
router.get('/my-orders', authenticate, isUser, getMyOrders);

module.exports = router;
