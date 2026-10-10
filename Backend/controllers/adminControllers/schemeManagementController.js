const Scheme = require('../../models/Scheme');

// Helper to create a clean slug
const createSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

// GET all schemes (Admin)
exports.getSchemes = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (status !== undefined && status !== '') {
      query.isActive = status === 'true';
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    const schemes = await Scheme.find(query).sort({ order: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: schemes.length,
      data: schemes,
    });
  } catch (error) {
    console.error('Error in getSchemes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schemes',
      error: error.message,
    });
  }
};

// GET single scheme by ID (Admin)
exports.getSchemeById = async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id);
    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Scheme not found',
      });
    }

    res.status(200).json({
      success: true,
      data: scheme,
    });
  } catch (error) {
    console.error('Error in getSchemeById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheme details',
      error: error.message,
    });
  }
};

// CREATE Scheme (Admin)
exports.createScheme = async (req, res) => {
  try {
    const payload = { ...req.body };

    // Auto-generate slug if not provided
    if (!payload.slug && payload.title) {
      payload.slug = createSlug(payload.title);
    } else if (payload.slug) {
      payload.slug = createSlug(payload.slug);
    }

    // Check slug uniqueness
    const existing = await Scheme.findOne({ slug: payload.slug });
    if (existing) {
      payload.slug = `${payload.slug}-${Date.now().toString().slice(-4)}`;
    }

    // Ensure array fields are formatted properly
    if (typeof payload.benefits === 'string') {
      payload.benefits = payload.benefits
        .split('\n')
        .map((b) => b.trim())
        .filter(Boolean);
    }
    if (typeof payload.eligibility === 'string') {
      payload.eligibility = payload.eligibility
        .split('\n')
        .map((e) => e.trim())
        .filter(Boolean);
    }
    if (typeof payload.documentsRequired === 'string') {
      payload.documentsRequired = payload.documentsRequired
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean);
    }

    const scheme = await Scheme.create(payload);

    res.status(201).json({
      success: true,
      message: 'Scheme created successfully',
      data: scheme,
    });
  } catch (error) {
    console.error('Error in createScheme:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create scheme',
    });
  }
};

// UPDATE Scheme (Admin)
exports.updateScheme = async (req, res) => {
  try {
    const payload = { ...req.body };

    if (payload.slug) {
      payload.slug = createSlug(payload.slug);
      const existing = await Scheme.findOne({
        slug: payload.slug,
        _id: { $ne: req.params.id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Slug already in use by another scheme',
        });
      }
    }

    if (typeof payload.benefits === 'string') {
      payload.benefits = payload.benefits
        .split('\n')
        .map((b) => b.trim())
        .filter(Boolean);
    }
    if (typeof payload.eligibility === 'string') {
      payload.eligibility = payload.eligibility
        .split('\n')
        .map((e) => e.trim())
        .filter(Boolean);
    }
    if (typeof payload.documentsRequired === 'string') {
      payload.documentsRequired = payload.documentsRequired
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean);
    }

    const scheme = await Scheme.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Scheme not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Scheme updated successfully',
      data: scheme,
    });
  } catch (error) {
    console.error('Error in updateScheme:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update scheme',
    });
  }
};

// DELETE Scheme (Admin)
exports.deleteScheme = async (req, res) => {
  try {
    const scheme = await Scheme.findByIdAndDelete(req.params.id);
    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Scheme not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Scheme deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteScheme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete scheme',
      error: error.message,
    });
  }
};

// TOGGLE Active Status (Admin)
exports.toggleSchemeStatus = async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id);
    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Scheme not found',
      });
    }

    scheme.isActive = !scheme.isActive;
    await scheme.save();

    res.status(200).json({
      success: true,
      message: `Scheme ${scheme.isActive ? 'activated' : 'deactivated'} successfully`,
      data: scheme,
    });
  } catch (error) {
    console.error('Error in toggleSchemeStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scheme status',
      error: error.message,
    });
  }
};
