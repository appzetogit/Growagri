const Product = require('../../models/Product');
const EcommerceOrder = require('../../models/EcommerceOrder');
const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const EcommerceCart = require('../../models/EcommerceCart');
const { createOrder, verifyAndClaimPayment, releasePayment } = require('../../services/razorpayService');
const { createNotification } = require('../notificationControllers/notificationController');
const PDFDocument = require('pdfkit');

const checkAndNotifyOutOfStock = async (productId) => {
    try {
        const prod = await Product.findById(productId);
        if (prod && prod.vendorId && prod.stock <= 0) {
            await createNotification({
                recipientId: prod.vendorId,
                recipientModel: 'Vendor',
                title: '🚨 Out of Stock Alert!',
                message: `Your product "${prod.title}" is now out of stock. Please update your inventory to continue receiving orders.`,
                type: 'ecommerce_out_of_stock',
                metadata: { productId: prod._id }
            });
        }
    } catch (err) {
        console.error('Out of stock check/notify error:', err);
    }
};

/**
 * User: Get all approved products (Marketplace)
 */
const getApprovedProducts = async (req, res) => {
    try {
        const { categoryId, query, lat, lng, radius, cityId } = req.query;
        let filter = { 
            approvalStatus: 'approved', 
            status: 'active'
        };

        if (categoryId) filter.categoryId = categoryId;
        if (query) {
            filter.$or = [
                { title: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
            ];
        }

        let vendorMap = {};

        // Zone-based filtering logic
        if (lat && lng && lat !== 'undefined' && lng !== 'undefined') {
            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);
            const searchRadius = (parseInt(radius) || 1000) * 1000; // Search widely initially (1000km)

            const Vendor = require('../../models/Vendor');
            const nearbyVendors = await Vendor.aggregate([
                {
                    $geoNear: {
                        near: { type: "Point", coordinates: [userLng, userLat] },
                        distanceField: "calculatedDistance", // This will be in meters before multiplier
                        maxDistance: searchRadius,
                        spherical: true,
                        distanceMultiplier: 0.001 // Convert meters to km
                    }
                },
                {
                    $match: {
                        $expr: {
                            $lte: ["$calculatedDistance", { $ifNull: ["$shopDetails.deliveryRadius", 50] }]
                        }
                    }
                },
                {
                    $project: { _id: 1, calculatedDistance: 1 }
                }
            ]);

            nearbyVendors.forEach(v => {
                vendorMap[v._id.toString()] = v.calculatedDistance;
            });

            const vendorIds = nearbyVendors.map(v => v._id);
            filter.vendorId = { $in: vendorIds };
        }

        // City-based filtering logic
        if (cityId) {
            const Vendor = require('../../models/Vendor');
            const vendorsInCity = await Vendor.find({ cityId }).select('_id');
            const vendorIds = vendorsInCity.map(v => v._id);
            if (filter.vendorId) {
                // Intersect GPS filters and City filters if both are present
                filter.vendorId = { 
                    $in: filter.vendorId.$in.filter(id => vendorIds.some(vid => vid.toString() === id.toString())) 
                };
            } else {
                filter.vendorId = { $in: vendorIds };
            }
        }

        let productsQuery = Product.find(filter)
            .populate('categoryId', 'title imageUrl')
            .populate('vendorId', 'businessName name profilePhoto')
            .lean();

        if (!lat || !lng || lat === 'undefined' || lng === 'undefined') {
            productsQuery = productsQuery.sort({ isFeatured: -1, createdAt: -1 });
        }

        let products = await productsQuery;

        if (lat && lng && lat !== 'undefined' && lng !== 'undefined') {
            products = products.map(p => ({
                ...p,
                distance: vendorMap[p.vendorId?._id?.toString()] || 0
            }));
            products.sort((a, b) => a.distance - b.distance);
        }

        res.status(200).json({ success: true, data: products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
};

const getProductDetails = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('categoryId', 'title')
            .populate('vendorId', 'businessName phone profilePhoto');
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch product' });
    }
};

/**
 * User: Create an order (Calculates Platform Fee vs Vendor Balance + Shipping Charges)
 */
const placeOrder = async (req, res) => {
    try {
        const { productId, quantity, shippingAddress, paymentMethod, paymentType } = req.body;
        const userId = req.user._id;

        let checkoutItems = [];
        let isFromCart = false;

        if (productId) {
            // Single Item Buy Flow
            const product = await Product.findById(productId);
            if (!product || product.approvalStatus !== 'approved' || product.stock < quantity) {
                return res.status(400).json({ success: false, message: 'Product unavailable or out of stock' });
            }
            checkoutItems.push({
                product,
                quantity: Number(quantity)
            });
        } else {
            // Cart Checkout Flow
            const cart = await EcommerceCart.findOne({ userId }).populate('items.productId');
            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({ success: false, message: 'Your e-commerce cart is empty' });
            }
            for (const item of cart.items) {
                const product = item.productId;
                if (!product || product.approvalStatus !== 'approved' || product.status !== 'active') {
                    return res.status(400).json({ success: false, message: `Product ${product?.title || 'Unknown'} is unavailable` });
                }
                if (product.stock < item.quantity) {
                    return res.status(400).json({ success: false, message: `Product ${product.title} does not have enough stock` });
                }
                checkoutItems.push({
                    product,
                    quantity: item.quantity
                });
            }
            isFromCart = true;
        }

        // Group items by vendorId
        const vendorGroups = {};
        for (const item of checkoutItems) {
            const vendorId = item.product.vendorId.toString();
            if (!vendorGroups[vendorId]) {
                vendorGroups[vendorId] = [];
            }
            vendorGroups[vendorId].push(item);
        }

        const createdOrders = [];

        // Loop through each vendor group and create separate orders
        for (const [vendorId, items] of Object.entries(vendorGroups)) {
            let itemsTotal = 0;
            let adminCommission = 0;
            let gstAmount = 0;
            let shippingCharges = 0;

            const orderItems = items.map(item => {
                const subtotal = item.product.price * item.quantity;
                itemsTotal += subtotal;
                adminCommission += (subtotal * (item.product.commissionPercentage / 100));
                gstAmount += (subtotal * (item.product.gstPercentage / 100));
                shippingCharges += ((item.product.shippingCharge || 0) * item.quantity);

                return {
                    productId: item.product._id,
                    name: item.product.title,
                    quantity: item.quantity,
                    price: item.product.price,
                    bagWeight: item.product.bagWeight,
                    subtotal
                };
            });

            const platformFee = adminCommission + gstAmount;
            const vendorBalance = itemsTotal;
            const orderTotal = itemsTotal + platformFee + shippingCharges;

            const order = new EcommerceOrder({
                userId,
                vendorId,
                items: orderItems,
                pricing: {
                    itemsTotal,
                    adminCommission,
                    gstAmount,
                    platformFee,
                    vendorBalance,
                    shippingCharges,
                    orderTotal
                },
                shippingAddress,
                deliveryOtp: Math.floor(1000 + Math.random() * 9000).toString(),
                paymentMethod: paymentMethod || 'wallet',
                paymentType: paymentType || 'split'
            });

            if (order.paymentType === 'cod') {
                order.deliveryStatus = 'ordered'; // Direct to vendor
                order.paymentMethod = 'cash';
                await order.save();

                // Reduce Stock
                for (const item of items) {
                    await Product.findByIdAndUpdate(item.product._id, { $inc: { stock: -item.quantity } });
                    await checkAndNotifyOutOfStock(item.product._id);
                }

                // Notify Vendor
                try {
                    await createNotification({
                        recipientId: order.vendorId,
                        recipientModel: 'Vendor',
                        title: 'New COD Store Order!',
                        message: `You received a COD order for ${order.items[0].name}. Please pack it for shipping.`,
                        type: 'ecommerce_order',
                        metadata: { orderId: order._id }
                    });
                } catch (nErr) { console.error('Push notification error:', nErr); }

            } else {
                await order.save();
            }

            createdOrders.push(order);
        }

        // Clear cart if ordered from cart
        if (isFromCart) {
            await EcommerceCart.findOneAndUpdate({ userId }, { $set: { items: [] } });
        }

        // Handle response
        // If there's only one order created (standard single item checkout or single vendor checkout)
        if (createdOrders.length === 1) {
            const order = createdOrders[0];
            return res.status(201).json({
                success: true,
                data: order,
                orders: createdOrders,
                message: order.paymentType === 'cod' 
                    ? 'COD Order placed successfully.' 
                    : (order.paymentType === 'online_full' ? 'Order created. Please pay full amount to confirm.' : 'Order created. Please pay Platform Fee to confirm.'),
                amountToPay: order.paymentType === 'online_full' ? order.pricing.orderTotal : order.pricing.platformFee,
                paymentType: order.paymentType
            });
        }

        // Multi-vendor checkout response
        const totalAmountToPay = createdOrders.reduce((sum, order) => {
            return sum + (order.paymentType === 'online_full' ? order.pricing.orderTotal : order.pricing.platformFee);
        }, 0);

        res.status(201).json({
            success: true,
            orders: createdOrders,
            message: `Created ${createdOrders.length} orders for different vendors.`,
            amountToPay: totalAmountToPay,
            paymentType: paymentType
        });

    } catch (error) {
        console.error('Place Order error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * User: Create Razorpay Order for Platform Fee
 */
const createPaymentOrder = async (req, res) => {
    try {
        const order = await EcommerceOrder.findOne({ _id: req.params.id, userId: req.user._id });
        if (!order || order.paymentStatus === 'paid') {
            return res.status(400).json({ success: false, message: 'Order already paid or not found' });
        }

        const amountToPay = order.paymentType === 'online_full' ? order.pricing.orderTotal : order.pricing.platformFee;

        // Create Razorpay order
        const razorpayOrder = await createOrder(
            amountToPay,
            'INR',
            `eco_${order._id.toString().substring(0, 8)}`,
            {
                orderId: order._id.toString(),
                type: 'ecommerce_platform_fee'
            }
        );

        if (!razorpayOrder.success) {
            return res.status(500).json({ success: false, message: razorpayOrder.error || 'Failed to create payment order' });
        }

        res.status(200).json({
            success: true,
            data: {
                order_id: razorpayOrder.orderId,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key: process.env.RAZORPAY_KEY_ID
            }
        });
    } catch (error) {
        console.error('Create Ecommerce Payment Order error:', error);
        res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }
};

/**
 * User: Verify Razorpay Payment for Platform Fee
 */
const payPlatformFee = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const order = await EcommerceOrder.findOne({ _id: req.params.id, userId: req.user._id });
        
        if (!order || order.paymentStatus === 'paid') {
            return res.status(400).json({ success: false, message: 'Order already paid or not found' });
        }

        const amountToPay = order.paymentType === 'online_full' ? order.pricing.orderTotal : order.pricing.platformFee;

        if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
             const verified = await verifyAndClaimPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
             if (!verified.success) {
                 return res.status(verified.status).json({ success: false, message: verified.error });
             }
             // The Razorpay order must be the one created for this ecommerce order, for the full amount
             if (verified.notes.orderId !== order._id.toString() || verified.amountPaise < Math.round(amountToPay * 100)) {
                 await releasePayment(razorpay_payment_id);
                 return res.status(400).json({ success: false, message: 'Payment does not match this order' });
             }

             // Record Transaction
             const transaction = new Transaction({
                 userId: req.user._id,
                 type: order.paymentType === 'online_full' ? 'ecommerce_full_payment' : 'platform_fee',
                 amount: amountToPay,
                 status: 'completed',
                 paymentMethod: 'razorpay',
                 referenceId: razorpay_payment_id,
                 description: order.paymentType === 'online_full' ? `Full payment for Ecommerce Order: ${order._id.toString().slice(-8)}` : `Platform fee (Comm+GST) for Ecommerce Order: ${order._id.toString().slice(-8)}`,
                 metadata: { 
                    orderId: order._id, 
                    razorpay_order_id,
                    razorpay_payment_id,
                 }
             });
             await transaction.save();

             if (order.paymentType === 'online_full') {
                 // Removed: Vendor wallet credit is now handled on delivery.
             }

             // Update Order
             order.paymentStatus = 'paid';
             order.deliveryStatus = 'ordered'; 
             order.adminTransactionId = transaction._id;
             await order.save();

             // Reduce Stock
             for (const item of order.items) {
                 await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
                 await checkAndNotifyOutOfStock(item.productId);
             }

             // Notify Vendor
             try {
                 await createNotification({
                     recipientId: order.vendorId,
                     recipientModel: 'Vendor',
                     title: 'New Store Order!',
                     message: `You received a new ${order.paymentType === 'online_full' ? 'PREPAID ' : ''}order for ${order.items[0].name}. Please pack it for shipping.`,
                     type: 'ecommerce_order',
                     metadata: { orderId: order._id }
                 });
             } catch (nErr) { console.error('Push notification error:', nErr); }

             return res.status(200).json({ 
                 success: true, 
                 message: order.paymentType === 'online_full' ? 'Order confirmed! Full payment received.' : 'Order confirmed! Platform fee paid via Razorpay.', 
                 data: order 
             });
        } 
        
        // Fallback for wallet (Optional, but Razorpay requested)
        // Claim the order first so a double click can't debit twice
        const prevPaymentStatus = order.paymentStatus;
        const claimed = await EcommerceOrder.updateOne({ _id: order._id, paymentStatus: { $ne: 'paid' } }, { paymentStatus: 'paid' });
        if (!claimed.modifiedCount) {
            return res.status(400).json({ success: false, message: 'Order already paid' });
        }
        const user = await User.findOneAndUpdate(
            { _id: req.user._id, 'wallet.balance': { $gte: amountToPay } },
            { $inc: { 'wallet.balance': -amountToPay } },
            { new: true }
        );
        if (!user) {
            await EcommerceOrder.updateOne({ _id: order._id }, { paymentStatus: prevPaymentStatus });
            return res.status(400).json({ 
                success: false, 
                message: 'Insufficient balance in wallet',
                needsOnlinePayment: true 
            });
        }


        const transaction = new Transaction({
            userId: user._id,
            type: order.paymentType === 'online_full' ? 'ecommerce_full_payment' : 'platform_fee',
            amount: amountToPay,
            status: 'completed',
            paymentMethod: 'wallet',
            description: order.paymentType === 'online_full' ? `Full payment for Ecommerce Order: ${order._id.toString().slice(-8)}` : `Platform fee (Comm+GST) for Ecommerce Order: ${order._id.toString().slice(-8)}`,
            metadata: { orderId: order._id }
        });
        await transaction.save();

        if (order.paymentType === 'online_full') {
            // Removed: Vendor wallet credit is now handled on delivery.
        }

        order.paymentStatus = 'paid';
        order.deliveryStatus = 'ordered';
        order.adminTransactionId = transaction._id;
        await order.save();

        for (const item of order.items) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
            await checkAndNotifyOutOfStock(item.productId);
        }

        // Notify Vendor
        try {
            await createNotification({
                recipientId: order.vendorId,
                recipientModel: 'Vendor',
                title: 'New Store Order!',
                message: `You received a new ${order.paymentType === 'online_full' ? 'PREPAID ' : ''}order for ${order.items[0].name}. Please pack it for shipping.`,
                type: 'ecommerce_order',
                metadata: { orderId: order._id }
            });
        } catch (nErr) { console.error('Push notification error:', nErr); }

        res.status(200).json({ 
            success: true, 
            message: order.paymentType === 'online_full' ? 'Order confirmed! Full payment paid from wallet.' : 'Order confirmed! Platform fee paid from wallet.', 
            data: order 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const orders = await EcommerceOrder.find({ userId: req.user._id })
            .populate('vendorId', 'businessName phone')
            .populate('items.productId', 'unit bagWeight')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        console.error('[GetMyOrders Error]:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch orders: ' + error.message });
    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await EcommerceOrder.findById(req.params.id)
            .populate('vendorId', 'businessName phone')
            .populate('items.productId', 'unit bagWeight');
        if (!order || order.userId.toString() !== req.user._id.toString()) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        console.error('[GetOrderById Error]:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch order: ' + error.message });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user._id;

        const order = await EcommerceOrder.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const nonCancellable = ['shipped', 'delivered', 'cancelled'];
        if (nonCancellable.includes(order.deliveryStatus)) {
            return res.status(400).json({ success: false, message: `Cannot cancel order in ${order.deliveryStatus} status` });
        }

        // Lock the transition so a double click can't refund twice
        const locked = await EcommerceOrder.updateOne(
            { _id: order._id, deliveryStatus: order.deliveryStatus },
            { $set: { deliveryStatus: 'cancelled' } }
        );
        if (!locked.modifiedCount) {
            return res.status(409).json({ success: false, message: 'Order status already changed' });
        }
        order.deliveryStatus = 'cancelled';
        
        // If it was already paid, refund the correct amount to the user's wallet
        if (order.paymentStatus === 'paid') {
            const user = await User.findById(userId);
            let refundAmount = order.pricing.platformFee;
            if (order.paymentType === 'online_full') {
                refundAmount = order.pricing.orderTotal;
            }
            
            user.wallet.balance += refundAmount;
            await user.save();

            const transaction = new Transaction({
                userId: user._id,
                type: 'refund',
                amount: refundAmount,
                status: 'completed',
                paymentMethod: 'system',
                description: `Refund for Cancelled Ecommerce Order: ${order._id.toString().slice(-8)}`,
                metadata: { orderId: order._id, reason: 'user_cancelled' }
            });
            await transaction.save();
        }

        // Stock was reduced at placement for COD, or after payment for online orders
        if (order.paymentType === 'cod' || order.paymentStatus === 'paid') {
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
            }
        }

        await order.save();
        res.status(200).json({ success: true, message: 'Order cancelled successfully', data: order });
    } catch (error) {
        console.error('Cancel Order Error:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel order: ' + error.message });
    }
};

const generateInvoice = async (req, res) => {
    try {
        const order = await EcommerceOrder.findById(req.params.id)
            .populate('userId', 'name phone email')
            .populate('vendorId', 'businessName phone name')
            .populate('items.productId', 'title price unit bagWeight gstPercentage commissionPercentage brandName');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Create PDF Document
        const doc = new PDFDocument({ margin: 50 });
        
        // Header Response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${order._id}.pdf`);
        
        doc.pipe(res);
        
        // Invoice Branding
        doc.fontSize(24).font('Helvetica-Bold').fillColor('#2E7D32').text('GrooAgri Marketplace', { align: 'left' });
        doc.fontSize(10).font('Helvetica').fillColor('#555555').text('Sustainable Farming Inputs & Services', { align: 'left' });
        doc.moveDown();
        
        // Horizontal Line
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#dddddd').stroke();
        doc.moveDown();
        
        // Details Row
        const yStart = doc.y;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333').text('Seller Details:', 50, yStart);
        doc.font('Helvetica').text(order.vendorId?.businessName || order.vendorId?.name || 'Local Seller', 50, yStart + 15);
        doc.text(`Phone: ${order.vendorId?.phone || 'N/A'}`, 50, yStart + 30);
        
        doc.font('Helvetica-Bold').text('Customer Details:', 300, yStart);
        doc.font('Helvetica').text(order.shippingAddress?.name || order.userId?.name || 'Customer', 300, yStart + 15);
        doc.text(`Phone: ${order.shippingAddress?.phone || order.userId?.phone || 'N/A'}`, 300, yStart + 30);
        
        let addressText = '';
        if (order.shippingAddress) {
            addressText = [order.shippingAddress.addressLine1, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.pincode].filter(Boolean).join(', ');
        }
        doc.text(`Address: ${addressText || 'N/A'}`, 300, yStart + 45, { width: 250 });
        
        doc.y = Math.max(yStart + 70, doc.y);
        doc.moveDown();
        
        // Order Info
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#dddddd').stroke();
        doc.moveDown();
        
        const infoY = doc.y;
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333');
        doc.text(`Invoice No: INV-${order._id.toString().substring(12).toUpperCase()}`, 50, infoY);
        doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 300, infoY);
        doc.text(`Payment Status: ${order.paymentStatus.toUpperCase()} (${order.paymentType.toUpperCase()})`, 50, infoY + 20);
        doc.text(`Delivery Status: ${order.deliveryStatus.toUpperCase()}`, 300, infoY + 20);
        
        doc.y = infoY + 45;
        doc.moveDown();
        
        // Table Header
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
        // Draw green header background
        doc.rect(50, doc.y, 500, 20).fill('#2E7D32');
        doc.fillColor('#ffffff');
        doc.text('Item Name', 60, doc.y + 5);
        doc.text('Qty', 280, doc.y + 5);
        doc.text('Price/Unit', 330, doc.y + 5);
        doc.text('GST %', 400, doc.y + 5);
        doc.text('Subtotal', 480, doc.y + 5);
        
        doc.y = doc.y + 20;
        doc.moveDown(0.5);
        
        // Table Rows
        doc.font('Helvetica').fillColor('#333333');
        let index = 0;
        for (const item of order.items) {
            const product = item.productId;
            const gstPercent = product?.gstPercentage || 5;
            const unitPrice = item.price;
            const subtotal = item.subtotal || (unitPrice * item.quantity);
            
            // Draw zebra striping
            if (index % 2 === 1) {
                doc.rect(50, doc.y - 2, 500, 18).fill('#f9f9f9');
                doc.fillColor('#333333');
            }
            
            doc.text(item.name || 'Product', 60, doc.y);
            doc.text(item.quantity.toString(), 280, doc.y);
            doc.text(`₹${unitPrice.toFixed(2)}`, 330, doc.y);
            doc.text(`${gstPercent}%`, 400, doc.y);
            doc.text(`₹${subtotal.toFixed(2)}`, 480, doc.y);
            
            doc.y = doc.y + 18;
            index++;
        }
        
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#dddddd').stroke();
        doc.moveDown();
        
        // Summary
        const summaryY = doc.y;
        doc.font('Helvetica').fontSize(10);
        doc.text('Items Total:', 350, summaryY);
        doc.text(`₹${order.pricing.itemsTotal.toFixed(2)}`, 480, summaryY);
        
        doc.text('Platform Fee (Comm+GST):', 350, summaryY + 15);
        doc.text(`₹${order.pricing.platformFee.toFixed(2)}`, 480, summaryY + 15);
        
        doc.text('Shipping & Delivery:', 350, summaryY + 30);
        doc.text(`₹${(order.pricing.shippingCharges || 0).toFixed(2)}`, 480, summaryY + 30);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#2E7D32');
        doc.text('Grand Total:', 350, summaryY + 50);
        doc.text(`₹${order.pricing.orderTotal.toFixed(2)}`, 480, summaryY + 50);
        
        doc.moveDown(4);
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#888888').text('Thank you for shopping with GrooAgri! This is an electronically generated document.', { align: 'center' });
        
        doc.end();
        
    } catch (error) {
        console.error('Invoice PDF Generation error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate invoice PDF: ' + error.message });
    }
};

module.exports = {
    getApprovedProducts,
    getProductDetails,
    placeOrder,
    createPaymentOrder,
    payPlatformFee,
    getMyOrders,
    getOrderById,
    cancelOrder,
    generateInvoice
};
