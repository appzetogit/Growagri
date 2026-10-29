const mongoose = require('mongoose');

const soilTestRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    landSize: {
        type: String,
        required: [true, 'Land size is required']
    },
    location: {
        type: String,
        required: [true, 'Location/Address is required']
    },
    latitude: {
        type: Number,
        default: null
    },
    longitude: {
        type: Number,
        default: null
    },
    cropType: {
        type: String,
        default: ''
    },
    testType: {
        type: String,
        default: 'Basic'
    },
    phoneNumber: {
        type: String,
        required: true
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        default: null,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'sample_collected', 'at_lab', 'completed', 'cancelled'],
        default: 'pending',
        index: true
    },
    reportStatus: {
        type: String,
        enum: ['pending', 'uploaded', 'approved', 'rejected'],
        default: 'pending'
    },
    adminNotes: {
        type: String,
        default: ''
    },
    reportUrl: {
        type: String,
        default: null
    },
    reportDate: {
        type: Date,
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid'],
        default: 'pending'
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    adminCommission: {
        type: Number,
        default: 0
    },
    commissionPercentage: {
        type: Number,
        default: 0
    },
    vendorEarning: {
        type: Number,
        default: 0
    },
    paymentMethod: {
        type: String, // 'wallet', 'online'
        default: ''
    },
    transactionId: {
        type: String,
        default: ''
    },
    rejectionReason: {
        type: String,
        default: ''
    },
    // Admin's reason for sending the lab report back to the vendor
    reportRejectionReason: {
        type: String,
        default: ''
    },
    // Created for an online payment that hasn't been verified yet; hidden until paid
    awaitingPayment: {
        type: Boolean,
        default: false,
        index: true
    },
    rejectedByVendors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor'
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('SoilTestRequest', soilTestRequestSchema);
