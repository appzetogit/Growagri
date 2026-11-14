const mongoose = require('mongoose');

/**
 * Product Model
 * Represents physical agricultural inputs like Seeds, Fertilizers, Pesticides
 */
const productSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['physical_good', 'machinery'],
        default: 'physical_good',
        index: true
    },
    title: {
        type: String,
        required: [true, 'Please provide a product title'],
        trim: true,
        index: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        index: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        // Category is optional for some vendor submissions
        index: true
    },
    // Agri Market bucket; required for new vendor submissions (enforced in controller, legacy docs may lack it)
    productCategory: {
        type: String,
        enum: ['seeds', 'fertilizer', 'pesticide'],
        index: true
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        default: null, // null means Admin/Central Store product
        index: true
    },
    brandName: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        trim: true
    },
    imageUrl: {
        type: String,
        default: null
    },
    images: [{
        type: String
    }],
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: 0
    },
    discountPrice: {
        type: Number,
        default: null
    },
    unit: {
        type: String,
        required: [true, 'Unit (kg, bag, litre) is required'],
        default: 'bag'
    },
    bagWeight: {
        type: Number, // Weight of a single unit/bag in kg
        default: 50
    },
    stock: {
        type: Number,
        required: true,
        default: 0
    },
    commissionPercentage: {
        type: Number,
        default: 0 // Admin sets this during approval
    },
    shippingCharge: {
        type: Number,
        default: 0,
        min: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'out_of_stock'],
        default: 'active',
        index: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rejectionReason: {
        type: String,
        default: null
    },
    specifications: [{
        name: String,
        value: String
    }]
}, {
    timestamps: true
});

// Generate slug
productSchema.pre('validate', async function (next) {
    if (this.isModified('title') && !this.slug) {
        const baseSlug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/(^-|-$)/g, '');
        // Append a short random string to guarantee uniqueness across multiple vendors with same product names
        this.slug = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;
    }
    next();
});

module.exports = mongoose.model('Product', productSchema);
