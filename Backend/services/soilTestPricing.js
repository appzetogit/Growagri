const Settings = require('../models/Settings');

const getSoilTestPricing = async () => {
    const s = await Settings.findOne({ type: 'global' })
        .select('soilTestBasicPrice soilTestAdvancedPrice soilTestCommissionPercentage').lean();
    return {
        basicPrice: s?.soilTestBasicPrice || 0,
        advancedPrice: s?.soilTestAdvancedPrice || 0,
        commissionPercentage: s?.soilTestCommissionPercentage ?? 10
    };
};

// Split what the farmer paid into the admin's cut and the vendor's earning (rounded to paise)
const splitSoilTestAmount = (totalAmount, commissionPercentage) => {
    const adminCommission = Math.round(totalAmount * commissionPercentage) / 100;
    return { adminCommission, vendorEarning: Math.round((totalAmount - adminCommission) * 100) / 100 };
};

module.exports = { getSoilTestPricing, splitSoilTestAmount };
