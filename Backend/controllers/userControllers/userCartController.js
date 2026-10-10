const mongoose = require('mongoose');
const Cart = require('../../models/Cart');
const Service = require('../../models/Service');
const { validationResult } = require('express-validator');

/**
 * Get user's cart
 */
const getUserCart = async (req, res) => {
  try {
    const userId = req.user.id;

    let cart = await Cart.findOne({ userId }).lean();

    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const VendorEquipment = require('../../models/VendorEquipment');
    const Product = require('../../models/Product');
    const Category = require('../../models/Category');

    const populatedItems = await Promise.all((cart.items || []).map(async (item) => {
      let populatedService = null;
      let populatedCategory = null;

      if (item.serviceId && mongoose.Types.ObjectId.isValid(item.serviceId)) {
        // 1. Try Service first
        populatedService = await Service.findById(item.serviceId)
          .select('title iconUrl slug hourly_price land_price land_unit daily_price')
          .lean();

        // 2. Fallback to VendorEquipment
        if (!populatedService) {
          const equip = await VendorEquipment.findById(item.serviceId).lean();
          if (equip) {
            populatedService = {
              _id: equip._id,
              title: equip.name,
              iconUrl: (equip.images && equip.images[0]) || '',
              slug: (equip.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              hourly_price: Number(equip.pricing?.hourly?.price) || 0,
              land_price: Number(equip.pricing?.land_based?.price) || 0,
              land_unit: 'bigha',
              daily_price: Number(equip.pricing?.daily?.price) || 0,
              isVendorEquipment: true
            };
          }
        }

        // 3. Fallback to Product machinery
        if (!populatedService) {
          const prod = await Product.findById(item.serviceId).lean();
          if (prod) {
            populatedService = {
              _id: prod._id,
              title: prod.title,
              iconUrl: prod.imageUrl || (prod.images && prod.images[0]) || '',
              slug: prod.slug,
              hourly_price: prod.unit === 'hour' ? prod.price : 0,
              land_price: (prod.unit === 'acre' || prod.unit === 'bigha') ? prod.price : 0,
              land_unit: prod.unit === 'bigha' ? 'bigha' : 'acre',
              daily_price: prod.unit === 'day' ? prod.price : 0,
              isProductMachinery: true
            };
          }
        }
      }

      if (item.categoryId && mongoose.Types.ObjectId.isValid(item.categoryId)) {
        populatedCategory = await Category.findById(item.categoryId)
          .select('title slug')
          .lean();
      }

      return {
        ...item,
        // Crucial: keep populated object or original ID string so serviceId is NEVER null!
        serviceId: populatedService || item.serviceId,
        categoryId: populatedCategory || item.categoryId
      };
    }));

    res.status(200).json({
      success: true,
      data: populatedItems
    });
  } catch (error) {
    console.error('Get user cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart. Please try again.'
    });
  }
};

/**
 * Add item to cart
 */
const addToCart = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const {
      serviceId,
      categoryId,
      equipmentId,
      isVendorEquipment,
      title,
      description,
      icon,
      category,
      categoryTitle,
      categoryIcon,
      price,
      originalPrice,
      unitPrice,
      serviceCount,
      rating,
      reviews,
      vendorId,
      sectionTitle,
      sectionIcon,
      sectionId,
      brandId,
      card,
      hourly_price,
      land_price,
      land_unit,
      daily_price,
      pricing_context,
      parentSourceId,
      scheduledDate,
      timeSlot,
      type
    } = req.body;

    console.log(`[AddToCart] Request details - Title: ${title}, ServiceId: ${serviceId}, Category: ${category}`);

    // Verify service exists (Service collection, or VendorEquipment / Product machinery fallback)
    let service = null;
    let vendorEquipment = null;
    let productDoc = null;
    let resolvedVendorId = vendorId || null;
    let resolvedEquipmentId = equipmentId || null;

    if (serviceId) {
      const isValidObjectId = mongoose.Types.ObjectId.isValid(serviceId);
      if (isValidObjectId) {
        service = await Service.findById(serviceId);
        if (!service) {
          const VendorEquipment = require('../../models/VendorEquipment');
          vendorEquipment = await VendorEquipment.findById(serviceId);
          if (vendorEquipment) {
            resolvedEquipmentId = vendorEquipment._id;
            if (!resolvedVendorId && vendorEquipment.vendorId) {
              resolvedVendorId = vendorEquipment.vendorId;
            }
          } else {
            const Product = require('../../models/Product');
            productDoc = await Product.findById(serviceId);
          }
        }
      }

      // If serviceId is provided, but not found in any collection AND title is missing, return 404
      if (!service && !vendorEquipment && !productDoc && !title) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
    }

    // Get or create cart
    let cart = await Cart.findOne({ userId });

    console.log(`[AddToCart] User: ${userId}, Cart Found: ${!!cart}`);

    if (!cart) {
      console.log('[AddToCart] Creating new cart');
      cart = await Cart.create({ userId, items: [] });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.title === title && (!serviceId || item.serviceId?.toString() === serviceId?.toString())
    );

    const calculatedPrice = price !== undefined ? price : (unitPrice !== undefined ? unitPrice : (service?.basePrice || 0));
    const calculatedUnitPrice = unitPrice !== undefined ? unitPrice : (price !== undefined ? price : (service?.basePrice || 0));

    if (existingItemIndex !== -1) {
      // Update quantity if item exists
      const existingItem = cart.items[existingItemIndex];
      const newCount = (existingItem.serviceCount || 1) + (serviceCount || 1);
      const newPrice = (existingItem.unitPrice || calculatedUnitPrice) * newCount;

      cart.items[existingItemIndex].serviceCount = newCount;
      cart.items[existingItemIndex].price = newPrice;
    } else {
      // Add new item
      const newItem = {
        title: title || service?.title || vendorEquipment?.name || productDoc?.title,
        description: description || service?.description || vendorEquipment?.description || '',
        icon: icon || service?.iconUrl || (vendorEquipment?.images && vendorEquipment.images[0]) || productDoc?.imageUrl || '',
        category: category || service?.category || vendorEquipment?.requestedCategoryName || 'Agriculture',
        categoryTitle: categoryTitle || category || service?.category || 'Agriculture',
        categoryIcon: categoryIcon || null,
        price: calculatedPrice,
        originalPrice: originalPrice || null,
        unitPrice: calculatedUnitPrice,
        serviceCount: serviceCount || 1,
        rating: rating || '4.8',
        reviews: reviews || '10k+',
        vendorId: resolvedVendorId,
        equipmentId: resolvedEquipmentId,
        isVendorEquipment: !!(isVendorEquipment || vendorEquipment),
        isProductMachinery: !!(productDoc && productDoc.type === 'machinery'),
        type: type || (productDoc ? 'product' : 'service'),
        sectionTitle: sectionTitle || '',
        sectionIcon: sectionIcon || null,
        sectionId: sectionId || brandId || null,
        brandId: (brandId && mongoose.Types.ObjectId.isValid(brandId)) ? brandId : null,
        card: card || null,
        scheduledDate: scheduledDate || null,
        timeSlot: timeSlot || null,
        pricing_context: pricing_context || 'any',
        parentSourceId: parentSourceId || null,
        // Agriculture rental guideline prices
        hourly_price: hourly_price || service?.hourly_price || (vendorEquipment?.pricing?.hourly?.price ? Number(vendorEquipment.pricing.hourly.price) : 0),
        land_price: land_price || service?.land_price || (vendorEquipment?.pricing?.land_based?.price ? Number(vendorEquipment.pricing.land_based.price) : 0),
        land_unit: land_unit || service?.land_unit || 'acre',
        daily_price: daily_price || service?.daily_price || (vendorEquipment?.pricing?.daily?.price ? Number(vendorEquipment.pricing.daily.price) : 0),
      };

      // Only add serviceId and categoryId if they are valid ObjectIds
      if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) newItem.serviceId = serviceId;
      if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) newItem.categoryId = categoryId;

      console.log(`[AddToCart] Adding new item: ${newItem.title}`);
      cart.items.push(newItem);
    }

    await cart.save();
    console.log(`[AddToCart] Cart saved. Total items: ${cart.items.length}`);

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: cart.items
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart. Please try again.'
    });
  }
};

/**
 * Update cart item quantity
 */
const updateCartItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { itemId } = req.params;
    const { serviceCount } = req.body;

    if (serviceCount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    item.serviceCount = serviceCount;
    item.price = item.unitPrice * serviceCount;
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: cart.items
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart item. Please try again.'
    });
  }
};

/**
 * Remove item from cart
 */
const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(item => item._id.toString() !== itemId);
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: cart.items
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart. Please try again.'
    });
  }
};

/**
 * Clear cart (remove all items)
 */
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared',
      data: []
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart. Please try again.'
    });
  }
};

/**
 * Remove items by category
 */
const removeCategoryItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category } = req.params;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(item => item.category !== category);
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Category items removed from cart',
      data: cart.items
    });
  } catch (error) {
    console.error('Remove category items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove category items. Please try again.'
    });
  }
};

module.exports = {
  getUserCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  removeCategoryItems
};

