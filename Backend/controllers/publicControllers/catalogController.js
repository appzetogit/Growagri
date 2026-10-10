const Category = require('../../models/Category');
const Brand = require('../../models/Brand');
const Service = require('../../models/Service');
const HomeContent = require('../../models/HomeContent');

// In-memory high performance cache for public catalog endpoints
const catalogCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

const getCached = (key) => {
  const item = catalogCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    catalogCache.delete(key);
    return null;
  }
  return item.data;
};

const setCached = (key, data, ttl = CACHE_TTL_MS) => {
  catalogCache.set(key, { data, expiry: Date.now() + ttl });
};

const clearCatalogCache = (prefix = '') => {
  if (!prefix) {
    catalogCache.clear();
  } else {
    for (const key of catalogCache.keys()) {
      if (key.startsWith(prefix)) catalogCache.delete(key);
    }
  }
};

/**
 * Public Catalog Controllers
 * These endpoints are accessible without authentication for user app
 */

/**
 * Get all active categories for user app
 * GET /api/public/categories
 */
const getPublicCategories = async (req, res) => {
  try {
    const { cityId, type } = req.query;
    const cacheKey = `categories:${cityId || 'default'}:${type || 'all'}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const mongoose = require('mongoose');

    // Build query - Match city-specific categories as well as global/fallback categories (cityIds: [])
    const query = { status: 'active' };
    if (cityId) {
      let cityObjectId;
      try {
        cityObjectId = new mongoose.Types.ObjectId(cityId);
      } catch (e) {
        cityObjectId = cityId; // fallback if invalid ObjectId format
      }
      
      query.$or = [
        { cityIds: cityObjectId },
        { cityIds: cityId.toString() },
        { cityIds: { $size: 0 } },
        { cityIds: { $exists: false } },
        { cityIds: null }
      ];
    }

    let categories = await Category.find(query)
      .select('title slug homeIconUrl homeBadge hasSaleBadge homeOrder showOnHome parentCategory parentCategories isAlwaysMain trackingType requiresDriver sectionType')
      .populate('parentCategories', 'title slug')
      .sort({ homeOrder: 1, createdAt: -1 })
      .lean();

    // Fallback removed as per user request to only show explicitly mapped categories.

    const initialCategories = categories.map(cat => ({
      id: cat._id?.toString() || '',
      title: cat.title || '',
      slug: cat.slug || '',
      icon: cat.homeIconUrl || '',
      badge: cat.homeBadge || '',
      hasSaleBadge: !!cat.hasSaleBadge,
      showOnHome: !!cat.showOnHome,
      homeOrder: cat.homeOrder || 0,
      parentCategory: cat.parentCategory || null,
      parentCategories: Array.isArray(cat.parentCategories)
        ? cat.parentCategories.map(p => ({
            id: p._id?.toString() || p.toString(),
            title: p.title || '',
            slug: p.slug || ''
          }))
        : [],
      isAlwaysMain: !!cat.isAlwaysMain,
      trackingType: cat.trackingType || 'none',
      requiresDriver: cat.requiresDriver || false,
      sectionType: cat.sectionType || 'General',
    }));

    // Fetch brands for these categories
    const categoryIds = categories.map(c => c._id).filter(id => id);

    const brandQuery = {
      categoryIds: { $in: categoryIds },
      status: 'active'
    };
    if (cityId) {
      let cityObjectId;
      try {
        cityObjectId = new mongoose.Types.ObjectId(cityId);
      } catch (e) {
        cityObjectId = cityId;
      }
      brandQuery.$or = [
        { cityIds: cityObjectId },
        { cityIds: cityId.toString() },
        { cityIds: { $size: 0 } },
        { cityIds: { $exists: false } },
        { cityIds: null }
      ];
    }

    const brands = await Brand.find(brandQuery).select('title categoryIds').lean();

    // Map brands to categories
    const categoriesWithBrands = initialCategories.map(cat => {
      const catBrands = brands.filter(b => 
        b.categoryIds && Array.isArray(b.categoryIds) && b.categoryIds.some(id => id.toString() === cat.id)
      ).map(b => b.title);
      return { ...cat, subBrands: catBrands };
    });

    const responseData = {
      success: true,
      categories: categoriesWithBrands
    };
    setCached(cacheKey, responseData, 60000);

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Get public categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories. Please try again.'
    });
  }
};

/**
 * Get all active brands for user app (Formerly Services)
 * GET /api/public/brands
 */
const getPublicBrands = async (req, res) => {
  try {
    const { categoryId, categorySlug, search, cityId } = req.query;

    // Build query
    const query = { status: 'active' };
    if (categoryId) query.categoryIds = categoryId;
    if (cityId) {
      const mongoose = require('mongoose');
      let cityObjectId;
      try {
        cityObjectId = new mongoose.Types.ObjectId(cityId);
      } catch (e) {
        cityObjectId = cityId; // fallback if invalid ObjectId format
      }
      
      query.cityIds = cityObjectId;
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.title = { $regex: escapedSearch, $options: 'i' };
    }

    let brands = await Brand.find(query)
      .select('title slug iconUrl logo imageUrl badge categoryIds basePrice discountPrice sections')
      .sort({ createdAt: -1 })
      .lean();

    // If categorySlug is provided, filter by category
    if (categorySlug) {
      const catQuery = { slug: categorySlug, status: 'active' };
      if (cityId) {
        catQuery.cityIds = cityId;
      }

      let category = await Category.findOne(catQuery).lean();

      if (!category && cityId) {
        category = await Category.findOne({ slug: categorySlug, status: 'active' }).lean();
      }

      if (category) {
        brands = brands.filter(b =>
          Array.isArray(b.categoryIds) &&
          b.categoryIds.some(id => id.toString() === category._id.toString())
        );
      }
    }

    res.status(200).json({
      success: true,
      brands: brands.map(brand => ({
        id: brand._id.toString(),
        title: brand.title,
        slug: brand.slug,
        icon: brand.iconUrl || '',
        logo: brand.logo || brand.iconUrl || '',
        imageUrl: brand.imageUrl || brand.iconUrl || '',
        badge: brand.badge || '',
        price: brand.basePrice || 0, // Legacy support
        originalPrice: brand.discountPrice ? (brand.basePrice + brand.discountPrice) : (brand.basePrice || 0),
        categoryId: brand.categoryIds && brand.categoryIds.length > 0 ? brand.categoryIds[0].toString() : null,
        categoryIds: (brand.categoryIds || []).map(id => id.toString()),
        sections: brand.sections || []
      }))
    });
  } catch (error) {
    console.error('Get public brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brands. Please try again.'
    });
  }
};

/**
 * Get brand by slug for user app
 * GET /api/public/brands/slug/:slug
 */
const getPublicBrandBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const brand = await Brand.findOne({ slug, status: 'active' })
      .populate('categoryIds', 'title slug')
      .lean();

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Remove _id from nested objects
    const cleanBrand = JSON.parse(JSON.stringify(brand));
    const removeIds = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(item => {
          if (item && typeof item === 'object') {
            const { _id, ...rest } = item;
            return removeIds(rest);
          }
          return item;
        });
      } else if (obj && typeof obj === 'object') {
        const { _id, ...rest } = obj;
        return Object.keys(rest).reduce((acc, key) => {
          acc[key] = removeIds(rest[key]);
          return acc;
        }, {});
      }
      return obj;
    };

    // Fetch services associated with this brand
    const brandServices = await Service.find({ brandId: brand._id, status: 'active' }).lean();

    // Map services to a default section structure for the frontend
    const servicesSection = {
      title: brand.title,
      subtitle: 'Available Services',
      cards: brandServices.map(svc => ({
        id: svc._id.toString(),
        title: svc.title,
        subtitle: svc.description || '',
        price: svc.basePrice,
        hourly_price: svc.hourly_price || svc.basePrice || 0,
        land_price: svc.land_price || 0,
        land_unit: svc.land_unit || 'acre',
        daily_price: svc.daily_price || 0,
        rating: "4.8", // Default rating
        reviews: "1k+", // Default reviews
        imageUrl: svc.iconUrl || brand.iconUrl || '',
        features: svc.description ? [svc.description] : [],
        duration: "60 min" // Default duration
      }))
    };

    const formattedBrand = {
      id: brand._id.toString(),
      title: brand.title,
      slug: brand.slug,
      icon: brand.iconUrl || '',
      logo: brand.logo || '',
      badge: brand.badge || '',
      basePrice: brand.basePrice, // Legacy
      category: brand.categoryIds && brand.categoryIds[0] ? {
        id: brand.categoryIds[0]._id.toString(),
        title: brand.categoryIds[0].title,
        slug: brand.categoryIds[0].slug
      } : null,
      categories: (brand.categoryIds || []).map(cat => ({
        id: cat._id.toString(),
        title: cat.title,
        slug: cat.slug
      })),
      page: brand.page ? removeIds(brand.page) : {
        banners: brand.iconUrl ? [{ imageUrl: brand.iconUrl, text: brand.title }] : [],
        paymentOffers: [],
        paymentOffersEnabled: false
      },
      sections: brandServices.length > 0 ? [servicesSection] : []
    };

    res.status(200).json({
      success: true,
      brand: formattedBrand
    });
  } catch (error) {
    console.error('Get public brand by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brand. Please try again.'
    });
  }
};

/**
 * Get services based on brand
 * GET /api/public/services
 */
const getPublicServices = async (req, res) => {
  try {
    const { brandId, brandSlug, categoryId, parentSourceId, pricing_context, search, cityId } = req.query;

    const query = { status: 'active' };

    let matchedCategoryIds = [];
    let resolvedCategory = null;

    if (categoryId) {
      matchedCategoryIds = [categoryId];
      try {
        const Category = require('../../models/Category');
        resolvedCategory = await Category.findById(categoryId).lean();
        if (resolvedCategory) {
          const orFilters = [];
          if (resolvedCategory.slug) {
            orFilters.push({ slug: resolvedCategory.slug });
          }
          if (resolvedCategory.title) {
            const escapedTitle = resolvedCategory.title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            orFilters.push({ title: { $regex: new RegExp(`^${escapedTitle}$`, 'i') } });
          }
          if (orFilters.length > 0) {
            const siblings = await Category.find({ $or: orFilters }).select('_id title slug').lean();
            matchedCategoryIds = siblings.map(c => c._id);
          }
        }
      } catch (catErr) {
        console.warn('Error resolving sibling categories in getPublicServices:', catErr);
      }
      query.categoryId = { $in: matchedCategoryIds };
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    if (brandId) {
      query.brandId = brandId;
    } else if (brandSlug) {
      const brand = await Brand.findOne({ slug: brandSlug });
      if (brand) {
        query.brandId = brand._id;
      } else {
        return res.status(200).json({ success: true, services: [] });
      }
    }

    if (parentSourceId) {
      query.parentSourceId = parentSourceId;
    }

    if (pricing_context) {
      // Include services tagged with the specific context OR 'any' (which means valid for all contexts)
      query.pricing_context = { $in: [pricing_context, 'any'] };
    }

    const services = await Service.find(query).sort({ createdAt: 1 }).lean();

    const formattedServices = services.map(svc => ({
      id: svc._id.toString(),
      _id: svc._id.toString(),
      title: svc.title,
      slug: svc.slug,
      icon: svc.iconUrl,
      iconUrl: svc.iconUrl,
      basePrice: svc.basePrice,
      hourly_price: svc.hourly_price || svc.basePrice || 0,
      land_price: svc.land_price || 0,
      land_unit: svc.land_unit || 'acre',
      daily_price: svc.daily_price || 0,
      pricing_context: svc.pricing_context || 'any',
      parentSourceId: svc.parentSourceId ? svc.parentSourceId.toString() : null,
      categoryId: svc.categoryId ? svc.categoryId.toString() : null,
      brandId: svc.brandId ? svc.brandId.toString() : null,
      gstPercentage: svc.gstPercentage,
      description: svc.description,
      isVendorEquipment: false
    }));

    // If pricing_context is 'sub-category' or specific brand query, return only catalog services
    if (pricing_context === 'sub-category' || brandId || brandSlug || parentSourceId) {
      return res.status(200).json({
        success: true,
        services: formattedServices
      });
    }

    // Otherwise, also query approved VendorEquipment and Product (machinery)
    const VendorEquipment = require('../../models/VendorEquipment');
    const Product = require('../../models/Product');

    const eqAndClauses = [{ status: 'approved' }];

    // Category filter for equipment
    if (categoryId && matchedCategoryIds.length > 0) {
      const catOrConditions = [
        { categoryId: { $in: matchedCategoryIds } }
      ];
      if (resolvedCategory?.title) {
        const escapedTitle = resolvedCategory.title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        catOrConditions.push({
          requestedCategoryName: { $regex: new RegExp(`^${escapedTitle}$`, 'i') }
        });
      }
      eqAndClauses.push({ $or: catOrConditions });
    }

    // Search filter for equipment
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      eqAndClauses.push({
        $or: [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { description: { $regex: escapedSearch, $options: 'i' } },
          { modelNumber: { $regex: escapedSearch, $options: 'i' } },
          { requestedCategoryName: { $regex: escapedSearch, $options: 'i' } }
        ]
      });
    }

    // City filter for equipment (empty cityIds array = Global fleet available across all cities)
    if (cityId) {
      const mongoose = require('mongoose');
      let cityObjId;
      try {
        cityObjId = new mongoose.Types.ObjectId(cityId);
      } catch (e) {
        cityObjId = cityId;
      }
      eqAndClauses.push({
        $or: [
          { cityIds: cityObjId },
          { cityIds: { $size: 0 } },
          { cityIds: { $exists: false } },
          { cityIds: null }
        ]
      });
    }

    const equipmentQuery = eqAndClauses.length === 1 ? eqAndClauses[0] : { $and: eqAndClauses };

    const equipmentList = await VendorEquipment.find(equipmentQuery)
      .populate('vendorId', 'name businessName phone rating avatar')
      .populate('categoryId', 'title slug')
      .sort({ createdAt: -1 })
      .lean();

    const getEquipPrice = (pricingObj) => {
      if (!pricingObj) return 0;
      if (pricingObj.isEnabled === false) return 0;
      return Number(pricingObj.price) || 0;
    };

    const vendorEquipmentItems = equipmentList.map(eq => {
      const hourly = getEquipPrice(eq.pricing?.hourly);
      const land = getEquipPrice(eq.pricing?.land_based);
      const daily = getEquipPrice(eq.pricing?.daily);
      const base = hourly || land || daily || 500;
      const imgUrl = (Array.isArray(eq.images) && eq.images.length > 0) ? eq.images[0] : '';
      const vendorName = eq.vendorId?.businessName || eq.vendorId?.name || 'Verified Vendor';

      return {
        id: eq._id.toString(),
        _id: eq._id.toString(),
        title: eq.name,
        slug: (eq.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        icon: imgUrl,
        iconUrl: imgUrl,
        images: eq.images || [],
        basePrice: base,
        price: base,
        hourly_price: hourly,
        land_price: land,
        land_unit: 'bigha',
        daily_price: daily,
        pricing_context: 'any',
        parentSourceId: null,
        categoryId: eq.categoryId?._id ? eq.categoryId._id.toString() : (eq.categoryId ? eq.categoryId.toString() : (categoryId ? categoryId.toString() : null)),
        categoryTitle: eq.categoryId?.title || resolvedCategory?.title || eq.requestedCategoryName || 'Machinery',
        brandId: null,
        gstPercentage: 18,
        description: eq.description || (eq.modelNumber ? `Model: ${eq.modelNumber}` : `Listed by ${vendorName}`),
        vendorId: eq.vendorId?._id ? eq.vendorId._id.toString() : (eq.vendorId ? eq.vendorId.toString() : null),
        vendorName: vendorName,
        vendorPhone: eq.vendorId?.phone || '',
        isVendorEquipment: true,
        equipmentId: eq._id.toString(),
        modelNumber: eq.modelNumber || '',
        year: eq.year || null,
        includesDriver: eq.includesDriver !== false
      };
    });

    // Also fetch Product machinery if any matching category or search
    let productMachineryItems = [];
    if (categoryId && matchedCategoryIds.length > 0) {
      const prodQuery = {
        type: 'machinery',
        status: 'active',
        categoryId: { $in: matchedCategoryIds }
      };
      if (search) {
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        prodQuery.$or = [
          { title: { $regex: escapedSearch, $options: 'i' } },
          { description: { $regex: escapedSearch, $options: 'i' } }
        ];
      }
      const prodList = await Product.find(prodQuery).lean();
      productMachineryItems = prodList.map(p => ({
        id: p._id.toString(),
        _id: p._id.toString(),
        title: p.title,
        slug: p.slug,
        icon: p.imageUrl || (p.images && p.images[0]) || '',
        iconUrl: p.imageUrl || (p.images && p.images[0]) || '',
        images: p.images || (p.imageUrl ? [p.imageUrl] : []),
        basePrice: p.price,
        price: p.price,
        hourly_price: p.unit === 'hour' ? p.price : 0,
        land_price: (p.unit === 'acre' || p.unit === 'bigha') ? p.price : 0,
        land_unit: p.unit === 'bigha' ? 'bigha' : 'acre',
        daily_price: p.unit === 'day' ? p.price : 0,
        pricing_context: 'any',
        parentSourceId: null,
        categoryId: p.categoryId ? p.categoryId.toString() : (categoryId ? categoryId.toString() : null),
        categoryTitle: resolvedCategory?.title || 'Machinery',
        brandId: null,
        gstPercentage: 18,
        description: p.description || 'Admin Machinery',
        vendorId: null,
        vendorName: 'GrooAgri Official',
        isVendorEquipment: false,
        isProductMachinery: true
      }));
    }

    // Combine all and remove duplicate IDs if any
    const allItems = [...vendorEquipmentItems, ...productMachineryItems, ...formattedServices];
    const seenIds = new Set();
    const uniqueItems = allItems.filter(item => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

    res.status(200).json({
      success: true,
      services: uniqueItems
    });
  } catch (error) {
    console.error('Get public services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services'
    });
  }
};

/**
 * Get home content
 */
const getPublicHomeContent = async (req, res) => {
  try {
    const { cityId } = req.query;
    const cacheKey = `homeContent:${cityId || 'default'}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    let homeContent = await HomeContent.getHomeContent(cityId);

    // FALLBACK LOGIC: Check if the city-specific content is essentially empty
    if (cityId && homeContent) {
      const isEmpty = (!homeContent.banners || homeContent.banners.length === 0) &&
                      (!homeContent.promos || homeContent.promos.length === 0) &&
                      (!homeContent.curated || homeContent.curated.length === 0) &&
                      (!homeContent.noteworthy || homeContent.noteworthy.length === 0) &&
                      (!homeContent.booked || homeContent.booked.length === 0) &&
                      (!homeContent.categorySections || homeContent.categorySections.length === 0) &&
                      (!homeContent.premiumOfferings || homeContent.premiumOfferings.length === 0);
      
      // If empty, fallback to the default content (where cityId is null)
      if (isEmpty) {
        homeContent = await HomeContent.getHomeContent(null);
      }
    }

    if (!homeContent) {
      const emptyResponse = {
        success: true,
        homeContent: {
          banners: [],
          promos: [],
          curated: [],
          noteworthy: [],
          booked: [],
          premiumOfferings: [],
          categorySections: []
        }
      };
      setCached(cacheKey, emptyResponse, 60000);
      return res.status(200).json(emptyResponse);
    }

    // Used for backwards compatibility, we might need to update this to refer to Brands?
    // For now keeping as is, but assuming targetServiceId will point to Brand ID essentially.

    const contentObj = homeContent.toObject();

    const formattedContent = {
      banners: (contentObj.banners || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      promos: (contentObj.promos || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      curated: (contentObj.curated || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      noteworthy: (contentObj.noteworthy || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      booked: (contentObj.booked || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      premiumOfferings: (contentObj.premiumOfferings || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
      })),
      categorySections: (contentObj.categorySections || []).map(section => ({
        ...section,
        id: section._id ? section._id.toString() : section.id,
        seeAllTargetCategoryId: section.seeAllTargetCategoryId?.toString() || null,
        seeAllTargetServiceId: section.seeAllTargetServiceId?.toString() || null,
        cards: (section.cards || []).map(card => ({
          ...card,
          id: card._id ? card._id.toString() : card.id,
          targetCategoryId: card.targetCategoryId?.toString() || null,
          targetServiceId: card.targetServiceId?.toString() || null,
        }))
      })),
      isBannersVisible: contentObj.isBannersVisible ?? true,
      isPromosVisible: contentObj.isPromosVisible ?? true,
      isCuratedVisible: contentObj.isCuratedVisible ?? true,
      isNoteworthyVisible: contentObj.isNoteworthyVisible ?? true,
      isBookedVisible: contentObj.isBookedVisible ?? true,
      isPremiumOfferingsVisible: contentObj.isPremiumOfferingsVisible ?? true,
      isCategorySectionsVisible: contentObj.isCategorySectionsVisible ?? true,
      isCategoriesVisible: contentObj.isCategoriesVisible ?? true,
      exploreServicesTitle: contentObj.exploreServicesTitle || 'Explore Services',
      exploreServicesSubtitle: contentObj.exploreServicesSubtitle || 'Discover Services for a Better Tomorrow',
      showWeatherTile: contentObj.showWeatherTile ?? true
    };

    const responseData = {
      success: true,
      homeContent: formattedContent
    };
    setCached(cacheKey, responseData, 60000);

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Get public home content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home content. Please try again.'
    });
  }
};

module.exports = {
  getPublicCategories,
  getPublicBrands,
  getPublicBrandBySlug,
  getPublicServices,
  getPublicHomeContent,
  clearCatalogCache
};
