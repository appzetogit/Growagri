const Product = require('../../models/Product');
const EcommerceOrder = require('../../models/EcommerceOrder');
const User = require('../../models/User'); // Required for populate('userId')
const Vendor = require('../../models/Vendor');
const { createNotification } = require('../notificationControllers/notificationController');

/**
 * Vendor: Get my products (Only Physical Goods for Ecommerce Store)
 */
const getMyProducts = async (req, res) => {
    try {
        const products = await Product.find({ 
            vendorId: req.user._id,
            type: 'physical_good' 
        }).populate('categoryId', 'title').lean();
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
};

/**
 * Vendor: Add product to my store (Starts as PENDING, Forced Type: physical_good)
 */
const addProduct = async (req, res) => {
    try {
        const productData = {
            ...req.body,
            vendorId: req.user._id,
            type: 'physical_good',
            approvalStatus: 'pending',
            status: 'inactive'
        };

        // If categoryId is empty string, remove it (Mongoose CastError prevention)
        if (productData.categoryId === "") delete productData.categoryId;

        const product = new Product(productData);
        await product.save();
        res.status(201).json({ success: true, data: product, message: 'Product submitted for admin review' });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateMyProduct = async (req, res) => {
    try {
        // Vendors can't approve their own products or change ownership/type
        const { approvalStatus: _a, vendorId: _v, type: _t, _id: _i, ...updateData } = req.body;
        if (updateData.status) {
            const existing = await Product.findOne({ _id: req.params.id, vendorId: req.user._id }).select('approvalStatus');
            if (existing?.approvalStatus !== 'approved') delete updateData.status;
        }
        
        // Sanitize categoryId to prevent Mongoose conversion errors if arriving as empty string or object
        if (updateData.categoryId === "") {
            delete updateData.categoryId;
        } else if (updateData.categoryId && typeof updateData.categoryId === 'object') {
            updateData.categoryId = updateData.categoryId._id || updateData.categoryId;
        }

        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, vendorId: req.user._id, type: 'physical_good' },
            updateData,
            { new: true, runValidators: true }
        );
        if (!product) return res.status(404).json({ success: false, message: 'Product not found or not an ecommerce item' });
        res.status(200).json({ success: true, data: product, message: 'Product updated successfully' });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ success: false, message: 'Failed to update product' });
    }
};

const deleteMyProduct = async (req, res) => {
    try {
        const product = await Product.findOneAndDelete({ 
            _id: req.params.id, 
            vendorId: req.user._id,
            type: 'physical_good'
        });
        if (!product) return res.status(404).json({ success: false, message: 'Product not found or not an ecommerce item' });
        res.status(200).json({ success: true, message: 'Product removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
};

/**
 * Vendor: Get orders for my shop
 */
const getMyOrders = async (req, res) => {
    try {
        const orders = await EcommerceOrder.find({ vendorId: req.user._id })
            .populate('userId', 'name phone')
            .populate('items.productId', 'unit bagWeight')
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch orders' });
    }
};

/**
 * Vendor: Update order tracking status
 */
    const updateOrderStatus = async (req, res) => {
        try {
            const { status, trackingNumber, courierName, deliveryOtp } = req.body;
            if (status === 'refunded') {
                return refundOrder(req, res);
            }
            const allowedStatuses = ['packed', 'shipped', 'delivered', 'cancelled'];
            
            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: 'Invalid status' });
            }

            const isAdminActor = ['ADMIN', 'admin', 'super_admin'].includes(req.userRole);
            const order = await EcommerceOrder.findOne(isAdminActor ? { _id: req.params.id } : { _id: req.params.id, vendorId: req.user._id });
            if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

            if (status === 'cancelled') {
                if (order.deliveryStatus === 'cancelled') {
                    return res.status(400).json({ success: false, message: 'Order is already cancelled' });
                }
                if (order.deliveryStatus === 'delivered') {
                    return res.status(400).json({ success: false, message: 'Cannot cancel a delivered order' });
                }
            }

            if (['delivered', 'cancelled'].includes(order.deliveryStatus)) {
                return res.status(400).json({ success: false, message: `Order is already ${order.deliveryStatus}` });
            }

            if (status === 'delivered') {
                if (!isAdminActor && order.deliveryOtp && order.deliveryOtp !== deliveryOtp) {
                    return res.status(400).json({ success: false, message: 'Invalid Verification OTP' });
                }
                if (order.paymentType === 'cod') {
                    order.paymentStatus = 'paid';
                }
            }

            // Lock the transition so wallet credits/refunds below run only once
            const locked = await EcommerceOrder.updateOne(
                { _id: order._id, deliveryStatus: order.deliveryStatus },
                { $set: { deliveryStatus: status } }
            );
            if (!locked.modifiedCount) {
                return res.status(409).json({ success: false, message: 'Order status already updated' });
            }

            const updateData = { deliveryStatus: status };
            
            // Add timestamps
            if (status === 'packed') updateData['trackingDetails.packedAt'] = new Date();
            if (status === 'shipped') {
                updateData['trackingDetails.shippedAt'] = new Date();
                updateData['trackingDetails.trackingNumber'] = trackingNumber;
                updateData['trackingDetails.courierName'] = courierName;
            }
            if (status === 'delivered') updateData['trackingDetails.deliveredAt'] = new Date();
            if (status === 'cancelled') updateData['trackingDetails.cancelledAt'] = new Date();

            Object.assign(order, updateData);
            if(status === 'shipped') {
                if(!order.trackingDetails) order.trackingDetails = {};
                order.trackingDetails.shippedAt = updateData['trackingDetails.shippedAt'];
                order.trackingDetails.trackingNumber = updateData['trackingDetails.trackingNumber'];
                order.trackingDetails.courierName = updateData['trackingDetails.courierName'];
            }
            if(status === 'packed' && !order.trackingDetails) order.trackingDetails = { packedAt: new Date() };
            if(status === 'delivered' && order.trackingDetails) order.trackingDetails.deliveredAt = new Date();
            if(status === 'cancelled' && order.trackingDetails) order.trackingDetails.cancelledAt = new Date();
            
            if (status === 'cancelled') {
                const Transaction = require('../../models/Transaction');
                // If it was already paid, refund directly to customer's wallet
                if (order.paymentStatus === 'paid') {
                    const user = await User.findById(order.userId);
                    if (user) {
                        let refundAmount = order.pricing?.orderTotal || 0;
                        if (order.paymentType === 'split') {
                            refundAmount = order.pricing?.platformFee || 0;
                        }

                        if (refundAmount > 0) {
                            const oldBal = user.wallet?.balance || 0;
                            const newBal = oldBal + refundAmount;
                            if (!user.wallet) {
                                user.wallet = { balance: newBal, penalty: 0 };
                            } else {
                                user.wallet.balance = newBal;
                            }
                            await user.save();

                            await Transaction.create({
                                userId: user._id,
                                type: 'refund',
                                amount: refundAmount,
                                status: 'completed',
                                paymentMethod: 'wallet',
                                balanceBefore: oldBal,
                                balanceAfter: newBal,
                                description: `Refund for Cancelled Ecommerce Order: #${order._id.toString().slice(-8)} (Credited to Wallet)`,
                                metadata: { orderId: order._id, reason: 'vendor_or_admin_cancelled', originalPaymentMethod: order.paymentMethod || 'wallet' }
                            });
                        }
                    }
                    order.paymentStatus = 'refunded';
                }

                // Return items to stock
                for (const item of order.items) {
                    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
                }
            }

            await order.save();

            // If COD and Delivered, we need to add platform fee to vendor's dues
            if (status === 'delivered' && order.paymentType === 'cod') {
                const Transaction = require('../../models/Transaction');
                const vendor = await Vendor.findById(order.vendorId);
                if (vendor) {
                    const platformFee = order.pricing.platformFee;
                    const vendorBalance = order.pricing.vendorBalance;
                    const orderTotal = order.pricing.orderTotal;

                    const cashLimit = vendor.wallet?.cashLimit || 10000;
                    const currentDues = (vendor.wallet?.dues || 0) + platformFee;
                    const currentEarnings = vendor.wallet?.earnings || 0;
                    const netOwed = currentDues - currentEarnings;

                    const updateQuery = {
                        $inc: { 
                            'wallet.dues': platformFee,
                            'wallet.totalCashCollected': orderTotal
                        }
                    };

                    if (netOwed > cashLimit) {
                        updateQuery.$set = {
                            'wallet.isBlocked': true,
                            'wallet.blockedAt': new Date(),
                            'wallet.blockReason': `Cash limit exceeded. Net owed: ₹${netOwed.toFixed(2)}, Limit: ₹${cashLimit}`
                        };
                        // Notify admins about block
                        try {
                            const Admin = require('../../models/Admin');
                            const admins = await Admin.find({ isActive: true }).select('_id');
                            for (const admin of admins) {
                                await createNotification({
                                    adminId: admin._id,
                                    type: 'vendor_cash_limit_exceeded',
                                    title: '⚠️ Cash Limit Exceeded',
                                    message: `${vendor.businessName || vendor.name} exceeded cash limit on COD Delivery! Net owed: ₹${netOwed.toFixed(2)}, Limit: ₹${cashLimit}`,
                                    relatedId: vendor._id,
                                    relatedType: 'vendor'
                                });
                            }
                        } catch (err) { console.error('Admin notification error:', err); }
                    }

                    await Vendor.findByIdAndUpdate(vendor._id, updateQuery);

                    // Single Transaction: Earnings credited to vendor (settled directly in cash)
                    const shippingCharges = order.pricing.shippingCharges || 0;
                    const totalVendorCredit = order.pricing.vendorBalance;
                    if (totalVendorCredit > 0) {
                        await Transaction.create({
                            vendorId: vendor._id,
                            bookingId: null,
                            type: 'earnings_credit',
                            amount: totalVendorCredit,
                            status: 'completed',
                            paymentMethod: 'cash',
                            description: `Earnings ₹${totalVendorCredit} settled directly in cash for COD Order #${order._id.toString().slice(-8)} (Total Paid: ₹${orderTotal}, Admin Commission: ₹${platformFee}).`,
                            metadata: {
                                type: 'earnings_increase',
                                orderId: order._id.toString(),
                                orderTotal,
                                companyRevenue: platformFee,
                                shippingCharges
                            }
                        });
                    }
                }
            } else if (status === 'delivered' && (order.paymentType === 'online_full' || order.paymentType === 'wallet' || order.paymentMethod === 'wallet')) {
                const Transaction = require('../../models/Transaction');
                const vendor = await Vendor.findById(order.vendorId);
                if (vendor) {
                    const shippingCharges = order.pricing.shippingCharges || 0;
                    const totalVendorCredit = order.pricing.vendorBalance;
                    
                    const updateQuery = {
                        $inc: { 'wallet.earnings': totalVendorCredit }
                    };
                    await Vendor.findByIdAndUpdate(vendor._id, updateQuery);

                    if (totalVendorCredit > 0) {
                        await Transaction.create({
                            vendorId: vendor._id,
                            bookingId: null, // No booking for ecommerce
                            type: 'earnings_credit',
                            amount: totalVendorCredit,
                            status: 'completed',
                            paymentMethod: 'system',
                            description: `Earnings ₹${totalVendorCredit} credited for Prepaid Ecommerce Order #${order._id.toString().slice(-8)} on delivery (includes ₹${shippingCharges} shipping).`,
                            metadata: {
                                type: 'earnings_increase',
                                orderId: order._id.toString()
                            }
                        });
                    }
                }
            } else if (status === 'delivered' && order.paymentType === 'split') {
                const Transaction = require('../../models/Transaction');
                const vendor = await Vendor.findById(order.vendorId);
                if (vendor) {
                    const totalCashCollectedByVendor = order.pricing.vendorBalance;

                    const updateQuery = {
                        $inc: { 
                            'wallet.totalCashCollected': totalCashCollectedByVendor
                        }
                    };

                    await Vendor.findByIdAndUpdate(vendor._id, updateQuery);

                    // Single Transaction: Earnings credited to vendor (settled directly in cash)
                    const shippingCharges = order.pricing.shippingCharges || 0;
                    if (totalCashCollectedByVendor > 0) {
                        await Transaction.create({
                            vendorId: vendor._id,
                            bookingId: null,
                            type: 'earnings_credit',
                            amount: totalCashCollectedByVendor,
                            status: 'completed',
                            paymentMethod: 'cash',
                            description: `Earnings ₹${totalCashCollectedByVendor} settled directly in cash for Split Order #${order._id.toString().slice(-8)} (includes ₹${shippingCharges} shipping, No Admin Dues).`,
                            metadata: {
                                type: 'earnings_increase',
                                orderId: order._id.toString(),
                                companyRevenue: 0,
                                shippingCharges
                            }
                        });
                    }
                }
            }

            // Notify User
            try {
                let msg = `Your order status has been updated to ${status}.`;
                if (status === 'shipped') msg = `Your order has been shipped via ${courierName} (Trk: ${trackingNumber}).`;
                if (status === 'delivered') msg = `Your order has been delivered!`;
                
                await createNotification({
                    recipientId: order.userId,
                    recipientModel: 'User',
                    title: `Order Update: ${status.toUpperCase()}`,
                    message: msg,
                    type: 'ecommerce_order_update',
                    metadata: { orderId: order._id, status }
                });
            } catch (nErr) { console.error('Push notification error:', nErr); }

            res.status(200).json({ success: true, message: `Order marked as ${status}`, data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update order status' });
    }
};

/**
 * Admin: Refund Online Order to User Wallet
 */
const refundOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await EcommerceOrder.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.paymentType === 'cod') {
            return res.status(400).json({ success: false, message: 'Cash on Delivery orders cannot be refunded.' });
        }

        if (order.paymentStatus === 'refunded') {
            return res.status(400).json({ success: false, message: 'This order is already marked as refunded.' });
        }

        // Calculate refund amount
        let refundAmount = order.pricing?.orderTotal || (order.pricing?.itemsTotal + (order.pricing?.shippingCharges || 0));
        if (order.paymentType === 'split') {
            refundAmount = order.pricing?.platformFee || 0;
        }

        const Transaction = require('../../models/Transaction');
        const User = require('../../models/User');

        // Check if user has already received a refund transaction for this order
        const existingRefundTx = await Transaction.findOne({
            userId: order.userId,
            type: 'refund',
            $or: [
                { 'metadata.orderId': order._id },
                { description: new RegExp(order._id.toString().slice(-8), 'i') }
            ]
        });

        // Record refund transaction and credit wallet directly
        if (!existingRefundTx && refundAmount > 0) {
            const user = await User.findById(order.userId);
            if (user) {
                const oldBal = user.wallet?.balance || 0;
                const newBal = oldBal + refundAmount;
                if (!user.wallet) {
                    user.wallet = { balance: newBal, penalty: 0 };
                } else {
                    user.wallet.balance = newBal;
                }
                await user.save();

                await Transaction.create({
                    userId: user._id,
                    type: 'refund',
                    amount: refundAmount,
                    status: 'completed',
                    paymentMethod: 'wallet',
                    balanceBefore: oldBal,
                    balanceAfter: newBal,
                    description: `Refund for Cancelled Ecommerce Order: #${order._id.toString().slice(-8)} (Credited to Wallet by Admin)`,
                    metadata: { orderId: order._id, reason: 'admin_refunded', originalPaymentMethod: order.paymentMethod || 'wallet' }
                });
            }
        }

        // Return stock back if order was not cancelled yet
        if (order.deliveryStatus !== 'cancelled') {
            const Product = require('../../models/Product');
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
            }
        }

        order.paymentStatus = 'refunded';
        order.deliveryStatus = 'cancelled';
        if (!order.trackingDetails) order.trackingDetails = {};
        order.trackingDetails.cancelledAt = new Date();

        await order.save();

        // Notify user about refund
        try {
            await createNotification({
                userId: order.userId,
                title: 'Order Refunded',
                message: `Your order #${order._id.toString().slice(-6).toUpperCase()} has been refunded (₹${refundAmount.toLocaleString()}) to your account.`,
                type: 'ecommerce_order_update',
                metadata: { orderId: order._id, status: 'refunded' }
            });
        } catch (nErr) { console.error('Push notification error:', nErr); }

        res.status(200).json({
            success: true,
            message: `Order successfully marked as refunded (₹${refundAmount.toLocaleString()} to customer account).`,
            data: order
        });
    } catch (error) {
        console.error('Refund order error:', error);
        res.status(500).json({ success: false, message: 'Failed to process refund: ' + error.message });
    }
};

module.exports = {
    getMyProducts,
    addProduct,
    updateMyProduct,
    deleteMyProduct,
    getMyOrders,
    updateOrderStatus,
    refundOrder
};
