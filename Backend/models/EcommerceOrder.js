const mongoose = require('mongoose');

/**
 * EcommerceOrder Model (Fertilizers & Seeds)
 * Handles orders where User pays Admin Fee (Comm + GST) on platform
 * and the main balance is settled directly with the Vendor.
 */
const ecommerceOrderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true,
        index: true
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: String,
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }, // Base price at time of order
        bagWeight: Number,
        subtotal: Number
    }],
    pricing: {
        itemsTotal: { type: Number, required: true }, // Sum of all items price * qty
        adminCommission: { type: Number, required: true }, // Platform fee portion
        gstAmount: { type: Number, required: true }, // Tax portion
        platformFee: { type: Number, required: true }, // adminCommission + gstAmount
        vendorBalance: { type: Number, required: true }, // itemsTotal - adminCommission
        shippingCharges: { type: Number, required: true, default: 0 },
        orderTotal: { type: Number, required: true, default: 0 } // itemsTotal + gstAmount
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    deliveryStatus: {
        type: String,
        enum: ['pending', 'ordered', 'packed', 'shipped', 'delivered', 'cancelled'],
        default: 'pending' // 'ordered' means platform fee is paid
    },
    shippingAddress: {
        name: String,
        phone: String,
        addressLine1: String,
        city: String,
        state: String,
        pincode: String,
        lat: Number,
        lng: Number
    },
    deliveryOtp: {
        type: String,
        default: null
    },
    adminTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        default: null
    },
    paymentMethod: {
        type: String,
        enum: ['wallet', 'razorpay', 'cash'], // Add 'cash' for COD
        default: 'wallet'
    },
    paymentType: {
        type: String,
        enum: ['split', 'online_full', 'cod', 'wallet'],
        default: 'split'
    },
    trackingDetails: {
        packedAt: Date,
        shippedAt: Date,
        deliveredAt: Date,
        cancelledAt: Date,
        trackingNumber: String,
        courierName: String
    },
    notes: String
}, {
    timestamps: true
});

// Indexes for faster queries
ecommerceOrderSchema.index({ userId: 1, createdAt: -1 });
ecommerceOrderSchema.index({ vendorId: 1, createdAt: -1 });
ecommerceOrderSchema.index({ deliveryStatus: 1, paymentStatus: 1 });

module.exports = mongoose.model('EcommerceOrder', ecommerceOrderSchema);
