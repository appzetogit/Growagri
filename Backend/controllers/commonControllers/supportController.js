const SupportQuery = require('../../models/SupportQuery');
const { createNotification } = require('../notificationControllers/notificationController');

// User: Submit a support query
const submitQuery = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        const userId = req.user?.id || null;

        const query = await SupportQuery.create({
            userId,
            name,
            email,
            subject,
            message
        });

        res.status(201).json({
            success: true,
            data: query,
            message: 'Support request submitted successfully. We will get back to you soon.'
        });
    } catch (error) {
        console.error('Submit query error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit support request' });
    }
};

// Admin: Get all queries
const getAdminQueries = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const queries = await SupportQuery.find(filter)
            .populate('userId', 'name phone profilePhoto')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: queries
        });
    } catch (error) {
        console.error('Fetch queries error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch support queries' });
    }
};

// Admin: Respond to a query
const respondToQuery = async (req, res) => {
    try {
        const { id } = req.params;
        const { response, status } = req.body;
        const adminId = req.user.id;

        const query = await SupportQuery.findById(id);
        if (!query) {
            return res.status(404).json({ success: false, message: 'Query not found' });
        }

        query.response = response;
        query.status = status || 'resolved';
        query.respondedAt = new Date();
        query.respondedBy = adminId;

        await query.save();

        // Notify User
        await createNotification({
            userId: query.userId,
            type: 'support_update',
            title: 'Support Request Update',
            message: `Your support request regarding "${query.subject}" has been updated.`,
            relatedId: query._id,
            relatedType: 'support_query'
        });

        res.status(200).json({
            success: true,
            data: query,
            message: 'Response sent successfully'
        });
    } catch (error) {
        console.error('Respond to query error:', error);
        res.status(500).json({ success: false, message: 'Failed to send response' });
    }
};

module.exports = {
    submitQuery,
    getAdminQueries,
    respondToQuery
};
