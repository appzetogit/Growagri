const SoilTestRequest = require('../../models/SoilTestRequest');
const Admin = require('../../models/Admin');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const { createNotification } = require('../notificationControllers/notificationController');
const { createOrder, verifyAndClaimPayment, releasePayment } = require('../../services/razorpayService');
const { getSoilTestPricing, splitSoilTestAmount } = require('../../services/soilTestPricing');

const notifyAdminsOfNewRequest = async (request, farmerName) => {
    try {
        const admins = await Admin.find({ isActive: true });
        await Promise.all(admins.map(admin => createNotification({
            adminId: admin._id,
            type: 'soil_test_request',
            title: '🌾 New Soil Test Request',
            message: `Farmer ${farmerName || 'A user'} has paid ₹${request.totalAmount} for a ${request.testType} soil test on ${request.landSize} land.`,
            relatedId: request._id,
            relatedType: 'service',
            pushData: {
                type: 'soil_test_request',
                requestId: request._id.toString(),
                farmerName,
                link: '/admin/soil-tests'
            }
        })));
    } catch (noticeErr) {
        console.error('[SoilTest] Notification error:', noticeErr);
    }
};

/**
 * User: Soil test prices set by admin
 */
const getSoilTestPrices = async (req, res) => {
    try {
        const { basicPrice, advancedPrice } = await getSoilTestPricing();
        res.status(200).json({ success: true, data: { basicPrice, advancedPrice } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * User: Pay & submit a soil test request.
 * Wallet: debited and submitted in one call. Online: returns a Razorpay order;
 * the request stays hidden (awaitingPayment) until verifySoilTestPayment succeeds.
 */
const createSoilTestRequest = async (req, res) => {
    try {
        const { landSize, location, latitude, longitude, cropType, testType, phoneNumber, paymentMethod } = req.body;
        if (!['wallet', 'online'].includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: 'Please choose a payment method' });
        }

        // Price always comes from admin settings, never from the client
        const pricing = await getSoilTestPricing();
        const totalAmount = testType === 'Advanced' ? pricing.advancedPrice : pricing.basicPrice;
        if (!(totalAmount > 0)) {
            return res.status(400).json({ success: false, message: 'Soil testing is not available right now. Please try again later.' });
        }
        const { adminCommission, vendorEarning } = splitSoilTestAmount(totalAmount, pricing.commissionPercentage);

        const request = new SoilTestRequest({
            userId: req.user.id,
            landSize,
            location,
            latitude,
            longitude,
            cropType,
            testType: testType === 'Advanced' ? 'Advanced' : 'Basic',
            phoneNumber,
            totalAmount,
            commissionPercentage: pricing.commissionPercentage,
            adminCommission,
            vendorEarning,
            paymentMethod
        });
        await request.validate();

        if (paymentMethod === 'wallet') {
            const user = await User.findOneAndUpdate(
                { _id: req.user.id, 'wallet.balance': { $gte: totalAmount } },
                { $inc: { 'wallet.balance': -totalAmount } },
                { new: true }
            );
            if (!user) {
                return res.status(400).json({ success: false, message: 'Insufficient wallet balance', needsOnlinePayment: true });
            }

            request.paymentStatus = 'paid';
            request.transactionId = `WLT_${Date.now()}`;
            try {
                await request.save();
            } catch (saveErr) {
                await User.updateOne({ _id: user._id }, { $inc: { 'wallet.balance': totalAmount } });
                throw saveErr;
            }

            await Transaction.create({
                userId: user._id,
                type: 'debit',
                amount: totalAmount,
                status: 'completed',
                paymentMethod: 'wallet',
                description: `Paid for ${request.testType} Soil Test`,
                balanceBefore: user.wallet.balance + totalAmount,
                balanceAfter: user.wallet.balance,
                referenceId: request._id.toString()
            }).catch(err => console.error('[SoilTest] User txn error:', err));

            await notifyAdminsOfNewRequest(request, req.user.name);
            return res.status(201).json({ success: true, paid: true, message: 'Payment successful. Soil test request submitted!', data: request });
        }

        // Online (Razorpay)
        request.awaitingPayment = true;
        await request.save();

        const orderResult = await createOrder(totalAmount, 'INR', `SOIL_${request._id.toString().slice(-6)}_${Date.now()}`, {
            userId: req.user.id.toString(),
            requestId: request._id.toString()
        });
        if (!orderResult.success) {
            await SoilTestRequest.deleteOne({ _id: request._id });
            return res.status(500).json({ success: false, message: 'Failed to create payment order: ' + (orderResult.error || 'Unknown error') });
        }

        return res.status(200).json({
            success: true,
            data: {
                requestId: request._id,
                orderId: orderResult.orderId,
                amount: orderResult.amount / 100,
                currency: orderResult.currency,
                key: process.env.RAZORPAY_KEY_ID
            }
        });
    } catch (error) {
        const status = error.name === 'ValidationError' ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * User: Get my soil test requests
 */
const getMySoilTestRequests = async (req, res) => {
    try {
        const requests = await SoilTestRequest.find({ userId: req.user.id, awaitingPayment: { $ne: true } }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: requests
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * User: Verify Razorpay payment — submits the request
 */
const verifySoilTestPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.user.id;

        const request = await SoilTestRequest.findOne({ _id: id, userId });
        if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
        if (request.paymentStatus === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

        const verified = await verifyAndClaimPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!verified.success) return res.status(verified.status).json({ success: false, message: verified.error });
        if (verified.notes.requestId !== request._id.toString() || verified.amountPaise < Math.round((request.totalAmount || 0) * 100)) {
            await releasePayment(razorpay_payment_id);
            return res.status(400).json({ success: false, message: 'Payment does not match this soil test' });
        }

        request.paymentStatus = 'paid';
        request.awaitingPayment = false;
        request.paymentMethod = 'online';
        request.transactionId = razorpay_payment_id;
        try {
            await request.save();
        } catch (saveErr) {
            await releasePayment(razorpay_payment_id);
            throw saveErr;
        }

        const user = await User.findById(userId).select('wallet');
        await Transaction.create({
            userId,
            type: 'debit',
            amount: request.totalAmount,
            status: 'completed',
            paymentMethod: 'online',
            description: `Paid for ${request.testType} Soil Test via Online`,
            balanceBefore: user?.wallet?.balance || 0,
            balanceAfter: user?.wallet?.balance || 0,
            referenceId: request._id.toString(),
            metadata: { orderId: razorpay_order_id, paymentId: razorpay_payment_id }
        }).catch(err => console.error('[SoilTest] User txn error:', err));

        await notifyAdminsOfNewRequest(request, req.user.name);

        res.status(200).json({ success: true, message: 'Payment successful. Soil test request submitted!' });
    } catch (error) {
        console.error('Payment Verify Catch Err:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateSoilTestRequest = async (req, res) => {
    try {
        const { id } = req.params;
        // testType is not editable: it decides the price the farmer already paid
        const { landSize, location, latitude, longitude, cropType, phoneNumber } = req.body;

        const request = await SoilTestRequest.findById(id);
        if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

        if (request.userId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (request.status !== 'pending' || request.vendorId) {
            return res.status(400).json({ success: false, message: 'Cannot edit request as it has already been assigned to a lab.' });
        }

        request.landSize = landSize !== undefined ? landSize : request.landSize;
        request.location = location !== undefined ? location : request.location;
        request.latitude = latitude !== undefined ? latitude : request.latitude;
        request.longitude = longitude !== undefined ? longitude : request.longitude;
        request.cropType = cropType !== undefined ? cropType : request.cropType;
        request.phoneNumber = phoneNumber !== undefined ? phoneNumber : request.phoneNumber;

        await request.save();

        res.status(200).json({
            success: true,
            message: 'Soil test request updated successfully!',
            data: request
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getSoilTestPrices,
    createSoilTestRequest,
    getMySoilTestRequests,
    verifySoilTestPayment,
    updateSoilTestRequest
};
