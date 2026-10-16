const mongoose = require('mongoose');
const EcommerceOrder = require('./models/EcommerceOrder');
const Notification = require('./models/Notification');
const User = require('./models/User');
const Vendor = require('./models/Vendor');
const Product = require('./models/Product');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB!");
        
        const orders = await EcommerceOrder.find();
        console.log("Total orders:", orders.length);
        for (const o of orders) {
            o.pricing.gstAmount = 0;
            o.pricing.platformFee = o.pricing.adminCommission;
            o.pricing.vendorBalance = (o.pricing.itemsTotal - o.pricing.adminCommission) + (o.pricing.shippingCharges || 0);
            await o.save();
            console.log(`Updated order ${o._id}:`, o.pricing);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}

run();
