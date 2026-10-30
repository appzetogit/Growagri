const mongoose = require('mongoose');

/**
 * Server-side booking price. Every rate comes from the catalog in the DB (Service / VendorEquipment /
 * Category / Product); the client only says WHAT is booked and HOW MUCH (hours/acres/days).
 * Mirrors the checkout formula (Frontend Checkout calculateItemPrice) so the amount shown is the
 * amount charged:
 *   item   = round(unitRate * (1 - planDiscount%)) * qty        (0 if the plan covers it)
 *   final  = itemTotal + visitedCharges (+ pending penalty, added by the caller)
 * GST is not charged on bookings (tax is always 0).
 */

const RATE_KEYS = ['minute', 'hourly', 'acre', 'bigha', 'land_based', 'daily'];

// Which catalog field holds each rental rate, per model
const SERVICE_FIELDS = { minute: 'minute_price', hourly: 'hourly_price', acre: 'acre_price', bigha: 'bigha_price', land_based: 'land_price', daily: 'daily_price' };
const CATEGORY_FIELDS = { minute: 'minutePrice', hourly: 'hourlyPrice', acre: 'acrePrice', bigha: 'bighaPrice', land_based: 'acrePrice' };

// Smallest/largest quantity the checkout allows per rental unit
const QTY_LIMITS = { minute: [1, 10000], hourly: [0.5, 1000], acre: [0.5, 10000], bigha: [0.5, 10000], land_based: [0.5, 10000], daily: [1, 366], monthly: [1, 366] };

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const idOf = (v) => {
  const id = v && typeof v === 'object' ? (v._id || v.id) : v;
  return id && mongoose.isValidObjectId(id) ? String(id) : null;
};

/** Load one catalog entry by id and normalise its prices */
const loadCatalogItem = async (id) => {
  if (!id) return null;
  const Service = require('../models/Service');
  const VendorEquipment = require('../models/VendorEquipment');
  const Category = require('../models/Category');
  const Product = require('../models/Product');

  const service = await Service.findById(id).lean();
  if (service) {
    const rates = Object.fromEntries(RATE_KEYS.map(k => [k, num(service[SERVICE_FIELDS[k]])]));
    return {
      id: String(service._id),
      title: service.title,
      rates,
      basePrice: num(service.basePrice),
      isAgri: RATE_KEYS.some(k => rates[k] > 0) || service.category === 'Agriculture',
      categoryId: idOf(service.categoryId) || idOf(service.categoryIds?.[0]),
      brandId: idOf(service.brandId)
    };
  }

  const equipment = await VendorEquipment.findById(id).lean();
  if (equipment) {
    const rate = (key) => (equipment.pricing?.[key]?.isEnabled !== false ? num(equipment.pricing?.[key]?.price) : 0);
    const rates = Object.fromEntries(RATE_KEYS.map(k => [k, rate(k)]));
    rates.acre = rates.acre || rates.land_based;
    rates.land_based = rates.land_based || rates.acre;
    return {
      id: String(equipment._id),
      title: equipment.name,
      rates,
      basePrice: rates.hourly || rates.land_based || rates.daily || 0,
      isAgri: true,
      categoryId: idOf(equipment.categoryId),
      implements: equipment.implements || []
    };
  }

  const category = await Category.findById(id).lean();
  if (category) {
    const rates = Object.fromEntries(RATE_KEYS.map(k => [k, CATEGORY_FIELDS[k] ? num(category[CATEGORY_FIELDS[k]]) : 0]));
    return {
      id: String(category._id),
      title: category.title,
      rates,
      basePrice: num(category.price) || rates.hourly || rates.acre || 0,
      isAgri: true,
      categoryId: String(category._id)
    };
  }

  const product = await Product.findById(id).lean();
  if (product) {
    const price = num(product.discountPrice) && num(product.discountPrice) < num(product.price) ? num(product.discountPrice) : num(product.price);
    const isMachinery = product.type === 'machinery';
    const rates = Object.fromEntries(RATE_KEYS.map(k => [k, 0]));
    if (isMachinery) {
      if (product.unit === 'hour') rates.hourly = price;
      if (product.unit === 'acre' || product.unit === 'bigha') { rates.acre = price; rates.bigha = price; rates.land_based = price; }
      if (product.unit === 'day') rates.daily = price;
    }
    return {
      id: String(product._id),
      title: product.title,
      rates,
      basePrice: price,
      isAgri: isMachinery,
      isProduct: !isMachinery,
      categoryId: idOf(product.categoryId)
    };
  }

  return null;
};

/** Rate for the chosen rental type (same fallbacks as the checkout) */
const unitRateFor = (item, rentalType) => {
  if (!item.isAgri) return item.basePrice;
  const r = item.rates;
  if (rentalType === 'minute') return r.minute || (r.hourly ? Math.round(r.hourly / 60) : 0) || item.basePrice;
  if (rentalType === 'acre') return r.acre || r.land_based || item.basePrice;
  if (rentalType === 'monthly') return r.daily || item.basePrice;
  return r[rentalType] || item.basePrice;
};

/** Validated hours / acres / days for agri bookings; throws a 400-style error when out of range */
const agriQuantity = ({ rentalType, estimatedDuration, landSize }) => {
  if (!QTY_LIMITS[rentalType]) return 1; // no rental unit chosen: checkout uses 1
  const isLand = ['acre', 'bigha', 'land_based'].includes(rentalType);
  const raw = isLand ? parseFloat(String(landSize ?? '').replace(/[^\d.]/g, '')) : parseFloat(estimatedDuration);
  if (Number.isNaN(raw)) return 1; // checkout default
  const [min, max] = QTY_LIMITS[rentalType];
  if (!(raw >= min && raw <= max)) {
    const err = new Error(`${isLand ? 'Land size' : 'Duration'} must be between ${min} and ${max}`);
    err.status = 400;
    throw err;
  }
  return raw;
};

/**
 * Price a booking request.
 * @returns {{ basePrice, discount, tax, visitingCharges, itemTotal, finalAmount, pricedItems, isRental }}
 */
const priceBooking = async ({ serviceId, bookedItems, selectedImplements, rentalType, estimatedDuration, landSize, user }) => {
  const Settings = require('../models/Settings');
  const Plan = require('../models/Plan');

  const settings = await Settings.findOne({ type: 'global' }).lean();
  // Same defaults the public config endpoint gives the app when no settings exist yet
  const visitedCharges = settings ? num(settings.visitedCharges) : 29;

  // Active plan benefits (checkout applies them whenever the farmer has an active plan)
  let plan = null;
  if (user?.plans?.isActive && (!user.plans.expiry || new Date(user.plans.expiry) > new Date())) {
    plan = (user.plans.planId && await Plan.findById(user.plans.planId).lean())
      || (user.plans.name && await Plan.findOne({ name: user.plans.name }).lean())
      || null;
  }
  const inList = (list, id) => !!id && (list || []).some(x => String(x) === String(id));

  // Resolve what is being booked
  const requested = Array.isArray(bookedItems) && bookedItems.length > 0 ? bookedItems.slice(0, 50) : [{ serviceId, quantity: 1 }];
  const qtyAgri = agriQuantity({ rentalType, estimatedDuration, landSize });

  let itemTotal = 0;
  let originalTotal = 0;
  let isRental = !!rentalType;
  const pricedItems = [];
  const pricedIds = new Set();

  for (const reqItem of requested) {
    const id = idOf(reqItem.serviceId) || idOf(reqItem.card?.serviceId) || (requested.length === 1 ? idOf(serviceId) : null);
    const item = await loadCatalogItem(id);
    if (!item) {
      const err = new Error('Some items in your cart are no longer available. Please refresh your cart and try again.');
      err.status = 400;
      throw err;
    }
    pricedIds.add(item.id);

    const unit = unitRateFor(item, rentalType);
    const serviceCount = Math.min(Math.max(parseInt(reqItem.quantity, 10) || 1, 1), 100);
    const qty = item.isAgri ? qtyAgri : serviceCount;
    if (item.isAgri) isRental = true;

    const isFree = plan && (inList(plan.freeCategories, item.categoryId) || inList(plan.freeBrands, item.brandId) || inList(plan.freeServices, item.id));
    let discountPct = 0;
    if (plan && item.isAgri) discountPct = num(plan.rentalDiscountPercentage);
    else if (plan && item.isProduct) discountPct = num(plan.marketplaceDiscountPercentage);

    const linePrice = isFree ? 0 : Math.round(unit * (1 - discountPct / 100)) * qty;
    itemTotal += linePrice;
    originalTotal += unit * qty;
    pricedItems.push({ request: reqItem, catalog: item, unitPrice: unit, quantity: item.isAgri ? 1 : serviceCount, lineTotal: linePrice });
  }

  // Machine add-ons picked on the equipment page (not separate cart items): priced from the machine's own implements
  const machine = pricedItems.find(p => p.catalog.implements)?.catalog;
  if (machine && Array.isArray(selectedImplements)) {
    for (const impl of selectedImplements.slice(0, 20)) {
      const implId = idOf(impl.subCategoryId);
      if (!implId || pricedIds.has(implId)) continue;
      const own = machine.implements.find(i => String(i.subCategoryId) === implId);
      const pricing = own?.pricing?.[rentalType === 'monthly' ? 'daily' : rentalType];
      if (!pricing?.isEnabled || !num(pricing.price)) continue;
      pricedIds.add(implId);
      const discountPct = plan ? num(plan.rentalDiscountPercentage) : 0;
      itemTotal += Math.round(num(pricing.price) * (1 - discountPct / 100)) * qtyAgri;
      originalTotal += num(pricing.price) * qtyAgri;
    }
  }

  const tax = 0; // GST is not charged on bookings
  const visitingCharges = itemTotal === 0 || plan?.freeTransport ? 0 : visitedCharges;
  const basePrice = Math.round(originalTotal);
  const discount = Math.max(0, basePrice - itemTotal);

  return {
    basePrice,
    discount,
    tax,
    visitingCharges,
    itemTotal,
    finalAmount: itemTotal + tax + visitingCharges,
    pricedItems,
    isRental,
    agriQuantity: qtyAgri
  };
};

module.exports = { priceBooking, loadCatalogItem, unitRateFor, agriQuantity };
