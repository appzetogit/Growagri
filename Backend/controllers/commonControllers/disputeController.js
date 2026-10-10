const Dispute = require('../../models/Dispute');
const Booking = require('../../models/Booking');
const { createNotification } = require('../notificationControllers/notificationController');

/**
 * Dispute Controller
 */

// Raise a new dispute (User or Vendor)
const raiseDispute = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.userRole;
        const { bookingId, reason, description, attachments } = req.body;

        // Only the booking's own customer or vendor can dispute it
        const booking = await Booking.findOne({ _id: bookingId, $or: [{ userId }, { vendorId: userId }] });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Check for existing dispute for this booking by this user to avoid duplication
        const existing = await Dispute.findOne({ bookingId, raisedBy: userId });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Dispute already raised for this booking' });
        }

        const dispute = await Dispute.create({
            bookingId,
            raisedBy: userId,
            raisedByRole: userRole === 'VENDOR' ? 'VENDOR' : 'USER',
            reason,
            description,
            attachments
        });

        // Notify Admin (optional - usually Admin has a dashboard, but a notification is good)
        // We can use createNotification to internal admin if needed.

        res.status(201).json({
            success: true,
            data: dispute,
            message: 'Dispute raised successfully. Admin will review it shortly.'
        });
    } catch (error) {
        console.error('Raise dispute error:', error);
        res.status(500).json({ success: false, message: 'Failed to raise dispute' });
    }
};

// Admin: Get all disputes with filters
const getAdminDisputes = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const filter = {};
        if (status) filter.status = status;

        const disputes = await Dispute.find(filter)
            .populate('bookingId', 'bookingNumber status')
            .populate('raisedBy', 'name phone email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Dispute.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: disputes,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get admin disputes error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch disputes' });
    }
};

// Admin: Get single dispute details
const getAdminDisputeById = async (req, res) => {
    try {
        const { id } = req.params;
        const dispute = await Dispute.findById(id)
            .populate({
                path: 'bookingId',
                populate: [
                    { path: 'userId', select: 'name phone' },
                    { path: 'vendorId', select: 'name phone' }
                ]
            })
            .populate('raisedBy', 'name phone profilePhoto')
            .populate('resolvedBy', 'name');

        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Dispute not found' });
        }

        res.status(200).json({ success: true, data: dispute });
    } catch (error) {
        console.error('Get single dispute error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch dispute details' });
    }
};

// Admin: Resolve/Investigate/Dismiss dispute
const resolveDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolutionNotes, refundAmount, vendorDeduction } = req.body;
        const adminId = req.user.id;

        const dispute = await Dispute.findById(id).populate('bookingId', 'bookingNumber vendorId');
        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Dispute not found' });
        }

        // Optional money outcome of the decision (only when resolving)
        let moneyNote = '';
        if (status === 'resolved' && dispute.bookingId) {
            const { refundBookingToWallet, deductVendorEarnings } = require('../../services/refundService');
            if (Number(refundAmount) > 0) {
                try {
                    const { refundAmount: refunded } = await refundBookingToWallet({ bookingId: dispute.bookingId._id, amount: refundAmount, reason: 'Dispute resolution' });
                    moneyNote += ` ₹${refunded} refunded to customer wallet.`;
                } catch (err) {
                    return res.status(err.status || 500).json({ success: false, message: err.message });
                }
            }
            const deducted = await deductVendorEarnings({
                vendorId: dispute.bookingId.vendorId,
                bookingId: dispute.bookingId._id,
                amount: vendorDeduction,
                reason: `Dispute adjustment for booking #${dispute.bookingId.bookingNumber}`
            });
            if (deducted) moneyNote += ` ₹${deducted} deducted from vendor earnings.`;
        }

        dispute.status = status;
        dispute.resolutionNotes = `${resolutionNotes || ''}${moneyNote}`.trim();
        if (status === 'resolved' || status === 'dismissed') {
            dispute.resolvedAt = new Date();
            dispute.resolvedBy = adminId;
        }

        await dispute.save();

        // Get booking number for message
        const bookingNumber = dispute.bookingId?.bookingNumber || 'N/A';

        // Notify the person who raised the dispute (Routes correctly to User or Vendor for Push)
        const notificationData = {
            type: 'dispute_update',
            title: `Dispute Case ${status.toUpperCase()}`,
            message: `Admin has ${status} your dispute for booking #${bookingNumber}.${moneyNote}`,
            relatedId: dispute._id,
            relatedType: 'dispute',
            data: {
                bookingId: dispute.bookingId._id,
                status: status
            }
        };

        // Determine if it should go to userId or vendorId for proper Push Routing
        if (dispute.raisedByRole === 'VENDOR') {
            notificationData.vendorId = dispute.raisedBy;
        } else {
            notificationData.userId = dispute.raisedBy;
        }

        await createNotification(notificationData);

        res.status(200).json({
            success: true,
            data: dispute,
            message: `Dispute status updated to ${status}`
        });
    } catch (error) {
        console.error('Resolve dispute error:', error);
        res.status(500).json({ success: false, message: 'Failed to update dispute status' });
    }
};

module.exports = {
    raiseDispute,
    getAdminDisputes,
    getAdminDisputeById,
    resolveDispute
};
