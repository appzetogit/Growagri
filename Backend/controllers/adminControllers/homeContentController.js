const HomeContent = require('../../models/HomeContent');
const { validationResult } = require('express-validator');

/**
 * Get Home Content
 * GET /api/admin/home-content
 */
const getHomeContent = async (req, res) => {
  try {
    const { cityId } = req.query;
    // Use the static method which handles default/creation
    let homeContent = await HomeContent.getHomeContent(cityId);

    res.status(200).json({
      success: true,
      homeContent: {
        id: homeContent._id,
        cityId: homeContent.cityId,
        banners: homeContent.banners || [],
        promos: homeContent.promos || [],
        curated: homeContent.curated || [],
        noteworthy: homeContent.noteworthy || [],
        booked: homeContent.booked || [],
        premiumOfferings: homeContent.premiumOfferings || [],
        categorySections: homeContent.categorySections || [],
        isActive: homeContent.isActive,
        isBannersVisible: homeContent.isBannersVisible ?? true,
        isPromosVisible: homeContent.isPromosVisible ?? true,
        isCuratedVisible: homeContent.isCuratedVisible ?? true,
        isNoteworthyVisible: homeContent.isNoteworthyVisible ?? true,
        isBookedVisible: homeContent.isBookedVisible ?? true,
        isCategorySectionsVisible: homeContent.isCategorySectionsVisible ?? true,
        isCategoriesVisible: homeContent.isCategoriesVisible ?? true,
        isPremiumOfferingsVisible: homeContent.isPremiumOfferingsVisible ?? true,
        exploreServicesTitle: homeContent.exploreServicesTitle || 'Explore Services',
        exploreServicesSubtitle: homeContent.exploreServicesSubtitle || 'Discover Services for a Better Tomorrow',
        showWeatherTile: homeContent.showWeatherTile ?? true,
        createdAt: homeContent.createdAt,
        updatedAt: homeContent.updatedAt
      }
    });
  } catch (error) {
    console.error('Get home content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home content. Please try again.'
    });
  }
};

/**
 * Update Home Content
 * PUT /api/admin/home-content
 */
const updateHomeContent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { cityId } = req.query;

    // Use static method to ensure we get the correct doc (or create if needed)
    let homeContent = await HomeContent.getHomeContent(cityId);

    // Helper to sanitize array items
    const sanitizeItems = (items) => {
      if (!Array.isArray(items)) return [];
      return items.map(item => {
        const newItem = { ...item };
        // Remove frontend-only 'id' fields that are strings
        // Added 'hsec-' for category sections, 'hpre-' for premium offerings
        if (typeof newItem.id === 'string' && (
          newItem.id.startsWith('hbnr-') ||
          newItem.id.startsWith('hprm-') ||
          newItem.id.startsWith('hcur-') ||
          newItem.id.startsWith('hnot-') ||
          newItem.id.startsWith('hbkd-') ||
          newItem.id.startsWith('hsec-') ||
          newItem.id.startsWith('hpre-')
        )) {
          delete newItem.id;
        }

        // Handle targetCategoryId/seeAllTargetCategoryId
        if (newItem.targetCategoryId === '') newItem.targetCategoryId = null;
        if (newItem.seeAllTargetCategoryId === '') newItem.seeAllTargetCategoryId = null;
        if (newItem.targetServiceId === '') newItem.targetServiceId = null;
        if (newItem.seeAllTargetServiceId === '') newItem.seeAllTargetServiceId = null;

        // Handle nested cards in categorySections
        if (Array.isArray(newItem.cards)) {
          newItem.cards = newItem.cards.map(card => {
            const newCard = { ...card };
            if (newCard.targetCategoryId === '') newCard.targetCategoryId = null;
            if (newCard.targetServiceId === '') newCard.targetServiceId = null;

            // Remove frontend-only 'id' fields from cards ie. 'hcard-'
            if (typeof newCard.id === 'string' && newCard.id.startsWith('hcard-')) {
              delete newCard.id;
            }

            return newCard;
          });
        }

        return newItem;
      });
    };

    // Update fields with sanitization
    if (req.body.banners !== undefined) {
      homeContent.banners = sanitizeItems(req.body.banners);
      homeContent.markModified('banners');
    }
    if (req.body.promos !== undefined) {
      homeContent.promos = sanitizeItems(req.body.promos);
      homeContent.markModified('promos');
    }
    if (req.body.curated !== undefined) {
      homeContent.curated = sanitizeItems(req.body.curated);
      homeContent.markModified('curated');
    }
    if (req.body.noteworthy !== undefined) {
      homeContent.noteworthy = sanitizeItems(req.body.noteworthy);
      homeContent.markModified('noteworthy');
    }
    if (req.body.booked !== undefined) {
      homeContent.booked = sanitizeItems(req.body.booked);
      homeContent.markModified('booked');
    }
    if (req.body.premiumOfferings !== undefined) {
      homeContent.premiumOfferings = sanitizeItems(req.body.premiumOfferings);
      homeContent.markModified('premiumOfferings');
    }
    if (req.body.categorySections !== undefined) {
      homeContent.categorySections = sanitizeItems(req.body.categorySections);
      homeContent.markModified('categorySections');
    }
    if (req.body.isActive !== undefined) homeContent.isActive = req.body.isActive;
    if (req.body.isBannersVisible !== undefined) homeContent.isBannersVisible = req.body.isBannersVisible;
    if (req.body.isPromosVisible !== undefined) homeContent.isPromosVisible = req.body.isPromosVisible;
    if (req.body.isCuratedVisible !== undefined) homeContent.isCuratedVisible = req.body.isCuratedVisible;
    if (req.body.isNoteworthyVisible !== undefined) homeContent.isNoteworthyVisible = req.body.isNoteworthyVisible;
    if (req.body.isBookedVisible !== undefined) homeContent.isBookedVisible = req.body.isBookedVisible;
    if (req.body.isCategorySectionsVisible !== undefined) homeContent.isCategorySectionsVisible = req.body.isCategorySectionsVisible;
    if (req.body.isCategoriesVisible !== undefined) homeContent.isCategoriesVisible = req.body.isCategoriesVisible;
    if (req.body.isPremiumOfferingsVisible !== undefined) homeContent.isPremiumOfferingsVisible = req.body.isPremiumOfferingsVisible;
    if (req.body.exploreServicesTitle !== undefined) homeContent.exploreServicesTitle = req.body.exploreServicesTitle;
    if (req.body.exploreServicesSubtitle !== undefined) homeContent.exploreServicesSubtitle = req.body.exploreServicesSubtitle;
    if (req.body.showWeatherTile !== undefined) homeContent.showWeatherTile = req.body.showWeatherTile;

    await homeContent.save();

    // Synchronize home sections to all city documents & default document so every user sees the update
    const globalSyncPayload = {};
    if (req.body.banners !== undefined) globalSyncPayload.banners = homeContent.banners;
    if (req.body.promos !== undefined) globalSyncPayload.promos = homeContent.promos;
    if (req.body.curated !== undefined) globalSyncPayload.curated = homeContent.curated;
    if (req.body.noteworthy !== undefined) globalSyncPayload.noteworthy = homeContent.noteworthy;
    if (req.body.booked !== undefined) globalSyncPayload.booked = homeContent.booked;
    if (req.body.premiumOfferings !== undefined) globalSyncPayload.premiumOfferings = homeContent.premiumOfferings;
    if (req.body.categorySections !== undefined) globalSyncPayload.categorySections = homeContent.categorySections;
    if (req.body.isBannersVisible !== undefined) globalSyncPayload.isBannersVisible = homeContent.isBannersVisible;
    if (req.body.isPromosVisible !== undefined) globalSyncPayload.isPromosVisible = homeContent.isPromosVisible;
    if (req.body.isCuratedVisible !== undefined) globalSyncPayload.isCuratedVisible = homeContent.isCuratedVisible;
    if (req.body.isNoteworthyVisible !== undefined) globalSyncPayload.isNoteworthyVisible = homeContent.isNoteworthyVisible;
    if (req.body.isBookedVisible !== undefined) globalSyncPayload.isBookedVisible = homeContent.isBookedVisible;
    if (req.body.isCategorySectionsVisible !== undefined) globalSyncPayload.isCategorySectionsVisible = homeContent.isCategorySectionsVisible;
    if (req.body.isCategoriesVisible !== undefined) globalSyncPayload.isCategoriesVisible = homeContent.isCategoriesVisible;
    if (req.body.isPremiumOfferingsVisible !== undefined) globalSyncPayload.isPremiumOfferingsVisible = homeContent.isPremiumOfferingsVisible;
    if (req.body.exploreServicesTitle !== undefined) globalSyncPayload.exploreServicesTitle = homeContent.exploreServicesTitle;
    if (req.body.exploreServicesSubtitle !== undefined) globalSyncPayload.exploreServicesSubtitle = homeContent.exploreServicesSubtitle;
    if (req.body.showWeatherTile !== undefined) globalSyncPayload.showWeatherTile = homeContent.showWeatherTile;

    // Editing the default (global) page pushes it to every city; editing a city changes only that city.
    // (Cities with empty content already fall back to the default on the public API.)
    if (!cityId && Object.keys(globalSyncPayload).length > 0) {
      await HomeContent.updateMany({ _id: { $ne: homeContent._id } }, { $set: globalSyncPayload });
    }

    // 1. Invalidate in-memory server cache
    try {
      const { clearCatalogCache } = require('../publicControllers/catalogController');
      if (clearCatalogCache) {
        clearCatalogCache('homeContent');
        clearCatalogCache(); // Clear complete public catalog cache
      }
    } catch (e) {
      console.warn('Cache clear error:', e.message);
    }

    const formattedContent = {
      id: homeContent._id,
      cityId: homeContent.cityId,
      banners: (homeContent.banners || []).map(item => ({
        ...(item.toObject ? item.toObject() : item),
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      promos: (homeContent.promos || []).map(item => ({
        ...(item.toObject ? item.toObject() : item),
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      curated: (homeContent.curated || []).map(item => ({
        ...(item.toObject ? item.toObject() : item),
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      noteworthy: (homeContent.noteworthy || []).map(item => ({
        ...(item.toObject ? item.toObject() : item),
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      booked: (homeContent.booked || []).map(item => ({
        ...(item.toObject ? item.toObject() : item),
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      premiumOfferings: homeContent.premiumOfferings || [],
      categorySections: homeContent.categorySections || [],
      isActive: homeContent.isActive,
      isBannersVisible: homeContent.isBannersVisible ?? true,
      isPromosVisible: homeContent.isPromosVisible ?? true,
      isCuratedVisible: homeContent.isCuratedVisible ?? true,
      isNoteworthyVisible: homeContent.isNoteworthyVisible ?? true,
      isBookedVisible: homeContent.isBookedVisible ?? true,
      isCategorySectionsVisible: homeContent.isCategorySectionsVisible ?? true,
      isCategoriesVisible: homeContent.isCategoriesVisible ?? true,
      isPremiumOfferingsVisible: homeContent.isPremiumOfferingsVisible ?? true,
      exploreServicesTitle: homeContent.exploreServicesTitle || 'Explore Services',
      exploreServicesSubtitle: homeContent.exploreServicesSubtitle || 'Discover Services for a Better Tomorrow',
      showWeatherTile: homeContent.showWeatherTile ?? true,
      updatedAt: homeContent.updatedAt
    };

    // 2. Broadcast real-time update to all connected users
    try {
      const { getIO } = require('../../sockets');
      const io = getIO();
      if (io) {
        const updatePayload = {
          cityId: null, // Broadcast as global so all users regardless of city receive it
          homeContent: formattedContent,
          timestamp: Date.now()
        };
        io.emit('home_content_updated', updatePayload);
        console.log(`[Socket] Broadcasted home_content_updated globally to all users`);
      }
    } catch (socketErr) {
      console.warn('[Socket] Emission failed in updateHomeContent:', socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Home content updated successfully',
      homeContent: formattedContent
    });
  } catch (error) {
    console.error('Update home content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update home content. Please try again.'
    });
  }
};

module.exports = {
  getHomeContent,
  updateHomeContent
};

