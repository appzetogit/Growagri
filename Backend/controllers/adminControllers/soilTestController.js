const SoilTestRequest = require('../../models/SoilTestRequest');
const Settings = require('../../models/Settings');
const Vendor = require('../../models/Vendor');
const Transaction = require('../../models/Transaction');
const { createNotification } = require('../notificationControllers/notificationController');
const { getSoilTestPricing } = require('../../services/soilTestPricing');

/**
 * Admin: Get soil test prices & commission
 */
const getSoilTestSettings = async (req, res) => {
    try {
        res.status(200).json({ success: true, data: await getSoilTestPricing() });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Update soil test prices & commission
 */
const updateSoilTestSettings = async (req, res) => {
    try {
        const basicPrice = Number(req.body.basicPrice);
        const advancedPrice = Number(req.body.advancedPrice);
        const commissionPercentage = Number(req.body.commissionPercentage);

        if (![basicPrice, advancedPrice].every(n => Number.isFinite(n) && n >= 0)) {
            return res.status(400).json({ success: false, message: 'Prices must be 0 or more' });
        }
        if (!Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
            return res.status(400).json({ success: false, message: 'Commission must be between 0 and 100' });
        }

        await Settings.updateOne(
            { type: 'global' },
            { $set: { soilTestBasicPrice: basicPrice, soilTestAdvancedPrice: advancedPrice, soilTestCommissionPercentage: commissionPercentage } },
            { upsert: true }
        );

        res.status(200).json({ success: true, message: 'Soil test pricing updated', data: { basicPrice, advancedPrice, commissionPercentage } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Get all soil test requests (only paid ones; unverified online payments are hidden)
 */
const getAllSoilTestRequests = async (req, res) => {
    try {
        const requests = await SoilTestRequest.find({ awaitingPayment: { $ne: true } })
            .populate('userId', 'name email phone')
            .populate('vendorId', 'name labDetails.labName')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: requests
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Update soil test request status/report
 */
const updateSoilTestRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes, reportUrl } = req.body;

        const request = await SoilTestRequest.findByIdAndUpdate(
            id,
            { status, adminNotes, reportUrl },
            { new: true, runValidators: true }
        );

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Soil test request updated successfully',
            data: request
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Assign a vendor to a soil test request
 */
const assignVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { vendorId } = req.body;

        if (!vendorId) {
            return res.status(400).json({ success: false, message: 'Vendor ID is required' });
        }

        const request = await SoilTestRequest.findOneAndUpdate(
            { _id: id, paymentStatus: 'paid', status: { $in: ['pending', 'assigned', 'cancelled'] } },
            { vendorId, status: 'assigned', reportStatus: 'pending', reportRejectionReason: '' },
            { new: true }
        );

        if (!request) {
            return res.status(400).json({ success: false, message: 'Request not found, not paid, or already in progress' });
        }

        // Push Notification: Notify Vendor about new assignment
        try {
            await createNotification({
                vendorId: vendorId,
                type: 'soil_test_assigned',
                title: '🧪 New Task: Soil Test Assigned',
                message: `You have been assigned a new soil test request from ${request.location}.`,
                relatedId: request._id,
                relatedType: 'service',
                pushData: {
                    type: 'soil_test_assigned',
                    requestId: request._id.toString(),
                    link: '/vendor/soil-tests'
                }
            });
        } catch (noticeErr) {
            console.error('Notification error (Vendor Assignment):', noticeErr);
        }

        res.status(200).json({
            success: true,
            message: 'Vendor assigned successfully',
            data: request
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Approve a soil test report — report becomes visible to the farmer
 * and the vendor's share is credited to their wallet right away.
 */
const approveReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { adminNotes } = req.body;

        // Claim the approval atomically so a double click can't credit the vendor twice
        const request = await SoilTestRequest.findOneAndUpdate(
            { _id: id, reportStatus: 'uploaded' },
            { $set: { reportStatus: 'approved', status: 'completed', reportRejectionReason: '', ...(adminNotes ? { adminNotes } : {}) } },
            { new: true }
        );

        if (!request) {
            return res.status(400).json({ success: false, message: 'No report waiting for approval' });
        }

        const vendorEarning = request.paymentStatus === 'paid' ? (request.vendorEarning || 0) : 0;
        if (request.vendorId && vendorEarning > 0) {
            const vendor = await Vendor.findByIdAndUpdate(
                request.vendorId,
                { $inc: { 'wallet.earnings': vendorEarning } },
                { new: true }
            );
            if (vendor) {
                await Transaction.create({
                    vendorId: vendor._id,
                    type: 'earnings_credit',
                    amount: vendorEarning,
                    status: 'completed',
                    paymentMethod: 'system',
                    description: `Earnings ₹${vendorEarning} credited for soil test #${request._id.toString().slice(-6)}`,
                    balanceBefore: (vendor.wallet?.earnings || 0) - vendorEarning,
                    balanceAfter: vendor.wallet?.earnings || 0,
                    referenceId: request._id.toString(),
                    metadata: { type: 'soil_test', totalAmount: request.totalAmount, adminCommission: request.adminCommission }
                }).catch(err => console.error('[SoilTest] Vendor txn error:', err));

                createNotification({
                    vendorId: vendor._id,
                    type: 'soil_test_payment_received',
                    title: '💰 Report Approved — Payment Received',
                    message: `₹${vendorEarning} has been credited to your wallet for soil test #${request._id.toString().slice(-6)}.`,
                    relatedId: request._id,
                    relatedType: 'service',
                    pushData: {
                        type: 'soil_test_payment_received',
                        requestId: request._id.toString(),
                        amount: vendorEarning,
                        link: '/vendor/soil-tests'
                    }
                }).catch(err => console.error('Notification error (Vendor Credit):', err));
            }
        }

        createNotification({
            userId: request.userId,
            type: 'soil_test_report_approved',
            title: '🎉 Soil Report Ready!',
            message: 'Your soil test report is ready. Open Soil Testing to view and download it.',
            relatedId: request._id,
            relatedType: 'service',
            pushData: {
                type: 'soil_test_report_approved',
                requestId: request._id.toString(),
                link: '/user/soil-testing'
            }
        }).catch(err => console.error('Notification error (User Approval):', err));

        res.status(200).json({
            success: true,
            message: vendorEarning > 0 ? `Report approved. ₹${vendorEarning} credited to vendor.` : 'Report approved.',
            data: request
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Reject a soil test report — vendor must upload it again
 */
const rejectReport = async (req, res) => {
    try {
        const reason = (req.body.reason || '').trim();
        if (!reason) {
            return res.status(400).json({ success: false, message: 'Please give a reason for rejecting the report' });
        }

        const request = await SoilTestRequest.findOneAndUpdate(
            { _id: req.params.id, reportStatus: 'uploaded' },
            { $set: { reportStatus: 'rejected', reportRejectionReason: reason } },
            { new: true }
        );
        if (!request) {
            return res.status(400).json({ success: false, message: 'No report waiting for review' });
        }

        if (request.vendorId) {
            createNotification({
                vendorId: request.vendorId,
                type: 'soil_test_rejected',
                title: '⚠️ Soil Report Rejected',
                message: `Admin rejected your report for soil test #${request._id.toString().slice(-6)}. Reason: ${reason}. Please upload it again.`,
                relatedId: request._id,
                relatedType: 'service',
                pushData: {
                    type: 'soil_test_rejected',
                    requestId: request._id.toString(),
                    link: '/vendor/soil-tests'
                }
            }).catch(err => console.error('Notification error (Report Rejected):', err));
        }

        res.status(200).json({ success: true, message: 'Report sent back to vendor', data: request });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Delete soil test request (paid requests can't be deleted — the farmer's money is in them)
 */
const deleteSoilTestRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await SoilTestRequest.findOneAndDelete({ _id: id, paymentStatus: { $ne: 'paid' } });

        if (!request) {
            return res.status(400).json({ success: false, message: 'Request not found or already paid' });
        }

        res.status(200).json({
            success: true,
            message: 'Soil test request deleted'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getSoilTestSettings,
    updateSoilTestSettings,
    getAllSoilTestRequests,
    updateSoilTestRequest,
    deleteSoilTestRequest,
    assignVendor,
    approveReport,
    rejectReport
};
