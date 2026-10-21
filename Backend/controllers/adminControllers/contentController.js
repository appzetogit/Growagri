const FAQ = require('../../models/FAQ');
const About = require('../../models/About');

// ==================== FAQ Controllers ====================

// @desc    Get all FAQs (Public & Admin)
exports.getFAQs = async (req, res) => {
    try {
        const faqs = await FAQ.find({ isActive: true }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: faqs.length, data: faqs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get all FAQs incl. hidden (Admin)
exports.getAllFAQs = async (req, res) => {
    try {
        const faqs = await FAQ.find({}).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: faqs.length, data: faqs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Create new FAQ (Admin)
exports.createFAQ = async (req, res) => {
    try {
        const faq = await FAQ.create(req.body);
        res.status(201).json({ success: true, data: faq });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update FAQ (Admin)
exports.updateFAQ = async (req, res) => {
    try {
        const faq = await FAQ.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
        res.status(200).json({ success: true, data: faq });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Delete FAQ (Admin)
exports.deleteFAQ = async (req, res) => {
    try {
        const faq = await FAQ.findByIdAndDelete(req.params.id);
        if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// ==================== About Controllers ====================

// @desc    Get About Content (Public & Admin)
exports.getAbout = async (req, res) => {
    try {
        let about = await About.findOne();
        if (!about) {
            about = await About.create({ title: 'About Us', content: '<p>Welcome to GrooAgri.</p>' });
        }
        res.status(200).json({ success: true, data: about });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update About Content (Admin)
exports.updateAbout = async (req, res) => {
    try {
        if (req.body.images && Array.isArray(req.body.images) && req.body.images.length > 4) {
            return res.status(400).json({ success: false, message: 'Maximum 4 images allowed for About section' });
        }
        let about = await About.findOne();
        if (about) {
            about = await About.findByIdAndUpdate(about._id, req.body, { new: true, runValidators: true });
        } else {
            about = await About.create(req.body);
        }
        res.status(200).json({ success: true, data: about });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

const AppGuide = require('../../models/AppGuide');

// ==================== App Guide Controllers ====================

// @desc    Get App Guide Content (Public & Admin)
exports.getAppGuide = async (req, res) => {
    try {
        let guide = await AppGuide.findOne();
        if (!guide) {
            guide = await AppGuide.create({ questions: [{ question: 'How to book?', answer: 'Select a machine and click book.' }] });
        }
        res.status(200).json({ success: true, data: guide });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update App Guide Content (Admin)
exports.updateAppGuide = async (req, res) => {
    try {
        let guide = await AppGuide.findOne();
        if (guide) {
            guide = await AppGuide.findByIdAndUpdate(guide._id, req.body, { new: true, runValidators: true });
        } else {
            guide = await AppGuide.create(req.body);
        }
        res.status(200).json({ success: true, data: guide });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

const Policy = require('../../models/Policy');

// ==================== Policy Controllers ====================

// @desc    Get Policy Content (Public)
exports.getPolicy = async (req, res) => {
    try {
        const { role, type } = req.params;
        let policy = await Policy.findOne({ role, type });
        if (!policy) {
            policy = { role, type, content: '' };
        }
        res.status(200).json({ success: true, data: policy });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update Policy Content (Admin)
exports.updatePolicy = async (req, res) => {
    try {
        const { role, type, content } = req.body;
        if (!role || !type) {
            return res.status(400).json({ success: false, message: 'Role and type are required' });
        }
        let policy = await Policy.findOne({ role, type });
        if (policy) {
            policy = await Policy.findByIdAndUpdate(policy._id, { content }, { new: true, runValidators: true });
        } else {
            policy = await Policy.create({ role, type, content });
        }
        res.status(200).json({ success: true, data: policy });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

const StartupRecognition = require('../../models/StartupRecognition');

// ==================== Startup Recognition Controllers ====================

// @desc    Get Startup Recognition (Public & Admin)
exports.getStartupRecognition = async (req, res) => {
    try {
        let recognition = await StartupRecognition.findOne();
        res.status(200).json({ success: true, data: recognition || null });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Upload Recognition Certificate (Admin)
exports.uploadStartupCertificate = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No certificate file uploaded'
            });
        }

        const certificateUrl = req.file.path; // Cloudinary secure_url

        let recognition = await StartupRecognition.findOne();
        if (recognition) {
            recognition.certificateUrl = certificateUrl;
            recognition.imageUrl = certificateUrl;
            if (!Array.isArray(recognition.images)) {
                recognition.images = [];
            }
            recognition.images = [{ url: certificateUrl, name: 'Recognition Certificate' }];
            await recognition.save();
        } else {
            recognition = await StartupRecognition.create({
                certificateUrl,
                imageUrl: certificateUrl,
                images: [{ url: certificateUrl, name: 'Recognition Certificate' }]
            });
        }

        res.status(200).json({
            success: true,
            certificateUrl,
            imageUrl: certificateUrl,
            data: recognition,
            message: 'Certificate uploaded and saved successfully'
        });
    } catch (error) {
        console.error('Certificate upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload certificate',
            error: error.message
        });
    }
};

// @desc    Update Startup Recognition (Admin)
exports.updateStartupRecognition = async (req, res) => {
    try {
        let recognition = await StartupRecognition.findOne();
        const updateData = { ...req.body };
        if (updateData.certificateUrl) {
            updateData.imageUrl = updateData.certificateUrl;
            updateData.images = [{ url: updateData.certificateUrl, name: 'Recognition Certificate' }];
        }
        if (recognition) {
            recognition = await StartupRecognition.findByIdAndUpdate(recognition._id, updateData, {
                new: true,
                runValidators: true
            });
        } else {
            recognition = await StartupRecognition.create(updateData);
        }
        res.status(200).json({ success: true, message: 'Startup Recognition updated successfully', data: recognition });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
