const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/roleMiddleware');
const {
    getAllProducts,
    getVendorProducts,
    approveProduct,
    rejectProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getAllEcommerceOrders
} = require('../../controllers/adminControllers/productController');

// All product management routes require admin authentication
router.use(authenticate, isAdmin);

// Central Store (Admin-managed products)
router.get('/products', getAllProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Vendor Product Approval Workflow
router.get('/vendor-submissions', getVendorProducts);
router.post('/vendor-submissions/:id/approve', approveProduct);
router.post('/vendor-submissions/:id/reject', rejectProduct);

// Global Ecommerce Order View
router.get('/orders', getAllEcommerceOrders);
router.patch('/orders/:id/status', require('../../controllers/vendorControllers/vendorProductController').updateOrderStatus);

module.exports = router;

