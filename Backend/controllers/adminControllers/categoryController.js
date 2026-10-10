const Category = require('../../models/Category');
const { validationResult } = require('express-validator');
const { SERVICE_STATUS } = require('../../utils/constants');

const broadcastCategoryChange = () => {
  try {
    const { clearCatalogCache } = require('../publicControllers/catalogController');
    if (clearCatalogCache) clearCatalogCache();
  } catch (e) {}

  try {
    const { getIO } = require('../../sockets');
    const io = getIO();
    if (io) {
      io.emit('categories_updated', { timestamp: Date.now() });
      console.log('[Socket] Broadcasted categories_updated');
    }
  } catch (e) {}
};

const formatCategory = (cat) => ({
  id: cat._id,
  title: cat.title,
  slug: cat.slug,
  homeIconUrl: cat.homeIconUrl,
  homeBadge: cat.homeBadge,
  hasSaleBadge: cat.hasSaleBadge,
  showOnHome: cat.showOnHome,
  homeOrder: cat.homeOrder,
  description: cat.description,
  imageUrl: cat.imageUrl,
  status: cat.status,
  isPopular: cat.isPopular,
  parentCategory: cat.parentCategory
    ? {
        id: cat.parentCategory._id || cat.parentCategory.id || cat.parentCategory,
        title: cat.parentCategory.title || '',
        slug: cat.parentCategory.slug || ''
      }
    : null,
  parentCategories: Array.isArray(cat.parentCategories)
    ? cat.parentCategories.map((parent) => ({
        id: parent._id || parent.id || parent,
        title: parent.title || '',
        slug: parent.slug || ''
      }))
    : [],
  isAlwaysMain: cat.isAlwaysMain || false,
  cityIds: cat.cityIds || [],
  trackingType: cat.trackingType || 'none',
  requiresDriver: cat.requiresDriver || false,
  sectionType: cat.sectionType || 'General',
  metaTitle: cat.metaTitle,
  metaDescription: cat.metaDescription,
  createdAt: cat.createdAt,
  updatedAt: cat.updatedAt
});

/**
 * Get all categories
 * GET /api/admin/categories
 */
const getAllCategories = async (req, res) => {
  try {
    const { status, showOnHome, isPopular, cityId } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (showOnHome !== undefined) query.showOnHome = showOnHome === 'true';
    if (isPopular !== undefined) query.isPopular = isPopular === 'true';
    if (cityId) {
      const mongoose = require('mongoose');
      let cityObjectId;
      try {
        cityObjectId = new mongoose.Types.ObjectId(cityId);
      } catch (e) {
        cityObjectId = cityId;
      }
      
      query.$or = [
        { cityIds: cityObjectId },
        { cityIds: cityId.toString() },
        { cityIds: { $size: 0 } },
        { cityIds: { $exists: false } },
        { cityIds: null }
      ];
    }

    const categories = await Category.find(query)
      .populate('parentCategory', 'title slug')
      .populate('parentCategories', 'title slug')
      .select('-__v')
      .sort({ homeOrder: 1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: categories.length,
      categories: categories.map(formatCategory)
    });
  } catch (error) {
    console.error('Get all categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories. Please try again.'
    });
  }
};

/**
 * Get single category by ID
 * GET /api/admin/categories/:id
 */
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id)
      .populate('parentCategory', 'title slug')
      .populate('parentCategories', 'title slug')
      .select('-__v')
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      category: formatCategory(category)
    });
  } catch (error) {
    console.error('Get category by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category. Please try again.'
    });
  }
};

/**
 * Create new category
 * POST /api/admin/categories
 */
const createCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Category Create Validation Errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      title,
      slug,
      homeIconUrl,
      homeBadge,
      hasSaleBadge,
      showOnHome,
      homeOrder,
      description,
      imageUrl,
      status,
      isPopular,
      metaTitle,
      metaDescription,
      cityIds,
      parentCategory,
      parentCategories,
      isAlwaysMain,
      trackingType,
      requiresDriver,
      sectionType
    } = req.body;

    console.log('Creating category with payload:', req.body);

    const slugToCheck = slug?.trim().toLowerCase() || title.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

    // Find ALL categories with same slug to properly check city overlaps
    const existingCategories = await Category.find({ slug: slugToCheck });

    let isDuplicate = false;
    for (const existingCategory of existingCategories) {
      const existingCities = existingCategory.cityIds.map(id => id.toString());
      const newCities = (cityIds || []).map(id => id.toString());

      if (newCities.length === 0) {
        // New category is global → duplicate only if an existing global one found
        if (existingCities.length === 0) { isDuplicate = true; break; }
      } else {
        // New category is city-specific
        const hasOverlap = newCities.some(cityId => existingCities.includes(cityId));
        if (hasOverlap) { isDuplicate = true; break; }          // Same city → duplicate
        if (existingCities.length === 0) { isDuplicate = true; break; } // Existing is global → duplicate
      }
    }

    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        message: 'Category with this title or slug already exists'
      });
    }

    const category = await Category.create({
      title: title.trim(),
      slug: slug?.trim().toLowerCase() || undefined,
      homeIconUrl: homeIconUrl || null,
      homeBadge: homeBadge?.trim() || null,
      hasSaleBadge: Boolean(hasSaleBadge),
      showOnHome: showOnHome !== false,
      homeOrder: Number(homeOrder) || 0,
      description: description?.trim() || null,
      imageUrl: imageUrl || null,
      status: status || SERVICE_STATUS.ACTIVE,
      isPopular: Boolean(isPopular),
      metaTitle: metaTitle?.trim() || null,
      metaDescription: metaDescription?.trim() || null,
      parentCategory: Array.isArray(parentCategories) && parentCategories.length > 0 ? parentCategories[0] : (parentCategory || null),
      parentCategories: Array.isArray(parentCategories) ? parentCategories : (parentCategory ? [parentCategory] : []),
      isAlwaysMain: Boolean(isAlwaysMain),
      cityIds: cityIds || [],
      trackingType: trackingType || 'none',
      requiresDriver: Boolean(requiresDriver),
      sectionType: sectionType || 'General',
      createdBy: req.user?._id || req.userId || null
    });

    const createdCategory = await Category.findById(category._id)
      .populate('parentCategory', 'title slug')
      .populate('parentCategories', 'title slug')
      .select('-__v')
      .lean();

    broadcastCategoryChange();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: formatCategory(createdCategory)
    });
  } catch (error) {
    console.error('Create category error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this title or slug already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create category. Please try again.'
    });
  }
};

/**
 * Update category
 * PUT /api/admin/categories/:id
 */
const updateCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const {
      title,
      slug,
      homeIconUrl,
      homeBadge,
      hasSaleBadge,
      showOnHome,
      homeOrder,
      description,
      imageUrl,
      status,
      isPopular,
      metaDescription,
      cityIds: updateCityIds,
      parentCategory,
      parentCategories,
      isAlwaysMain,
      trackingType,
      requiresDriver,
      sectionType
    } = req.body;

    const category = await Category.findById(id);
    console.log('[updateCategory] Request body parentCategories:', parentCategories, '| id:', id);
    console.log('[updateCategory] Full req.body:', req.body);
    console.log('[updateCategory] sectionType received:', sectionType);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    if (title || slug || updateCityIds) {
      const slugToCheck = slug?.trim().toLowerCase() || (title ? title.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') : category.slug);

      // Find ALL other categories with same slug (exclude current one being updated)
      const existingCategories = await Category.find({ _id: { $ne: id }, slug: slugToCheck });

      let isDuplicate = false;
      const newCities = (updateCityIds ? updateCityIds : category.cityIds).map(cityId => cityId.toString());

      for (const existingCategory of existingCategories) {
        const existingCities = existingCategory.cityIds.map(cityId => cityId.toString());

        if (newCities.length === 0) {
          if (existingCities.length === 0) { isDuplicate = true; break; }
        } else {
          if (newCities.some(cityId => existingCities.includes(cityId))) { isDuplicate = true; break; }
          if (existingCities.length === 0) { isDuplicate = true; break; }
        }
      }

      if (isDuplicate) {
        return res.status(400).json({
          success: false,
          message: 'Category with this title or slug already exists'
        });
      }
    }

    if (title !== undefined) category.title = title.trim();
    if (slug !== undefined) category.slug = slug.trim().toLowerCase();
    if (homeIconUrl !== undefined) category.homeIconUrl = homeIconUrl || null;
    if (homeBadge !== undefined) category.homeBadge = homeBadge?.trim() || null;
    if (hasSaleBadge !== undefined) category.hasSaleBadge = Boolean(hasSaleBadge);
    if (showOnHome !== undefined) category.showOnHome = showOnHome !== false;
    if (homeOrder !== undefined) category.homeOrder = Number(homeOrder) || 0;
    if (description !== undefined) category.description = description?.trim() || null;
    if (imageUrl !== undefined) category.imageUrl = imageUrl || null;
    if (status !== undefined) category.status = status;
    if (isPopular !== undefined) category.isPopular = Boolean(isPopular);
    
    // Parent logic - Let Mongoose auto-cast ObjectIds, markModified ensures array change is tracked
    if (parentCategories !== undefined) {
      const pCats = Array.isArray(parentCategories) ? parentCategories : (parentCategories ? [parentCategories] : []);
      category.parentCategories = pCats;
      category.parentCategory = pCats.length > 0 ? pCats[0] : null;
      category.markModified('parentCategories');
      category.markModified('parentCategory');
      console.log('[updateCategory] Setting parentCategories:', pCats, '| parentCategory:', category.parentCategory);
    } else if (parentCategory !== undefined) {
      if (parentCategory) {
        category.parentCategory = parentCategory;
        category.parentCategories = [parentCategory];
      } else {
        category.parentCategory = null;
        category.parentCategories = [];
      }
      category.markModified('parentCategories');
      category.markModified('parentCategory');
    }

    if (isAlwaysMain !== undefined) category.isAlwaysMain = Boolean(isAlwaysMain);
    if (trackingType !== undefined) category.trackingType = trackingType;
    if (requiresDriver !== undefined) category.requiresDriver = Boolean(requiresDriver);
    if (sectionType !== undefined) category.sectionType = sectionType;

    if (updateCityIds !== undefined) {
      category.cityIds = updateCityIds;
      category.markModified('cityIds');
    }

    await category.save();

    const updatedCategory = await Category.findById(category._id)
      .populate('parentCategory', 'title slug')
      .populate('parentCategories', 'title slug')
      .select('-__v')
      .lean();

    broadcastCategoryChange();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category: formatCategory(updatedCategory)
    });
  } catch (error) {
    console.error('Update category error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this title or slug already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update category. Please try again.'
    });
  }
};

/**
 * Delete category
 * DELETE /api/admin/categories/:id
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (await require('../../models/Booking').exists({ categoryId: id })) {
      return res.status(400).json({
        success: false,
        message: 'This category has bookings. Set it inactive instead of deleting it.'
      });
    }
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Also delete all associated services (equipment models) for this category
    const Service = require('../../models/Service');
    await Service.deleteMany({ categoryId: id });

    broadcastCategoryChange();

    res.status(200).json({
      success: true,
      message: 'Category and associated equipment deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category'
    });
  }
};

/**
 * Update category order
 * PATCH /api/admin/categories/:id/order
 */
const updateCategoryOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { homeOrder } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    category.homeOrder = homeOrder;
    await category.save();

    broadcastCategoryChange();

    res.status(200).json({
      success: true,
      message: 'Order updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update order'
    });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryOrder
};
