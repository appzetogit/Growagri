const VendorEquipment = require('../../models/VendorEquipment');

/**
 * Public Equipment Controllers (For Farmers)
 * Handles browsing and viewing details of equipment without needing login.
 */

// GET /api/public/equipment
exports.getPublicEquipment = async (req, res) => {
  try {
    const { cityId, categoryId, search, isFeatured } = req.query;
    const Category = require('../../models/Category');
    const mongoose = require('mongoose');

    const andConditions = [{ status: 'approved' }];

    // Category matching with siblings & requestedCategoryName
    if (categoryId) {
      let matchedCategoryIds = [categoryId];
      let catTitle = '';
      try {
        const currentCat = await Category.findById(categoryId).lean();
        if (currentCat) {
          catTitle = currentCat.title || '';
          const orFilters = [];
          if (currentCat.slug) orFilters.push({ slug: currentCat.slug });
          if (currentCat.title) {
            const escapedTitle = currentCat.title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            orFilters.push({ title: { $regex: new RegExp(`^${escapedTitle}$`, 'i') } });
          }
          if (orFilters.length > 0) {
            const siblings = await Category.find({ $or: orFilters }).select('_id title slug').lean();
            matchedCategoryIds = siblings.map(s => s._id);
          }
        }
      } catch (catErr) {
        console.warn('Error resolving category in getPublicEquipment:', catErr);
      }

      const catOrConditions = [
        { categoryId: { $in: matchedCategoryIds } }
      ];
      if (catTitle) {
        const escapedTitle = catTitle.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        catOrConditions.push({
          requestedCategoryName: { $regex: new RegExp(`^${escapedTitle}$`, 'i') }
        });
      }
      andConditions.push({ $or: catOrConditions });
    }

    // City matching (specific city or global fleet where cityIds is empty)
    if (cityId) {
      let cityObjId;
      try {
        cityObjId = new mongoose.Types.ObjectId(cityId);
      } catch (e) {
        cityObjId = cityId;
      }
      andConditions.push({
        $or: [
          { cityIds: cityObjId },
          { cityIds: { $size: 0 } },
          { cityIds: { $exists: false } },
          { cityIds: null }
        ]
      });
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andConditions.push({
        $or: [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { description: { $regex: escapedSearch, $options: 'i' } },
          { modelNumber: { $regex: escapedSearch, $options: 'i' } },
          { requestedCategoryName: { $regex: escapedSearch, $options: 'i' } }
        ]
      });
    }

    if (isFeatured === 'true' || isFeatured === true) {
      andConditions.push({ isFeatured: true });
    }

    const query = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    let equipment = await VendorEquipment.find(query)
      .populate('categoryId', 'title slug homeIconUrl')
      .populate('subCategoryIds', 'title slug')
      .populate('vendorId', 'name businessName phone rating avatar')
      .sort({ createdAt: -1 })
      .lean();

    // If isFeatured was requested but returned 0 results, fallback to latest approved equipment
    if ((isFeatured === 'true' || isFeatured === true) && equipment.length === 0) {
      const fallbackAnd = andConditions.filter(c => !c.isFeatured);
      const fallbackQuery = fallbackAnd.length === 1 ? fallbackAnd[0] : { $and: fallbackAnd };
      equipment = await VendorEquipment.find(fallbackQuery)
        .populate('categoryId', 'title slug homeIconUrl')
        .populate('subCategoryIds', 'title slug')
        .populate('vendorId', 'name businessName phone rating avatar')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    res.status(200).json({
      success: true,
      count: equipment.length,
      data: equipment
    });
  } catch (error) {
    console.error('Get public equipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch machinery catalog'
    });
  }
};

// GET /api/public/equipment/:id
exports.getPublicEquipmentById = async (req, res) => {
  try {
    const equipment = await VendorEquipment.findOne({
      _id: req.params.id,
      status: 'approved'
    })
      .populate('categoryId', 'title slug homeIconUrl')
      .populate('subCategoryIds', 'title slug')
      .populate('vendorId', 'name phone rating avatar')
      .lean();

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Machinery not found or not yet approved'
      });
    }

    res.status(200).json({
      success: true,
      data: equipment
    });
  } catch (error) {
    console.error('Get public equipment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch machinery details'
    });
  }
};

// GET /api/public/equipment/:id/availability
exports.checkAvailability = async (req, res) => {
  try {
    const { date, timeSlot } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    // Logic for checking existing bookings will go here later
    // For now, return available: true
    res.status(200).json({
      success: true,
      available: true,
      message: 'Slot is available'
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check availability'
    });
  }
};
