const Settings = require('../models/Settings');

const DEFAULT_SOIL_TEST_TYPES = [
    {
        name: 'Basic Test',
        title: 'Basic Test (3 Parameters - NPK)',
        description: 'Tests Nitrogen, Phosphorus, and Potassium',
        price: 100,
        isActive: true
    },
    {
        name: 'Advanced Test',
        title: 'Advanced Test (12 Parameters - Govt. Standard)',
        description: 'Complete analysis including pH, EC, OC, NPK & Micro-nutrients',
        price: 1000,
        isActive: true
    }
];

const getSoilTestPricing = async () => {
    const s = await Settings.findOne({ type: 'global' })
        .select('soilTestBasicPrice soilTestAdvancedPrice soilTestCommissionPercentage soilTestTypes').lean();

    let testTypes = [];
    if (Array.isArray(s?.soilTestTypes) && s.soilTestTypes.length > 0) {
        testTypes = s.soilTestTypes;
    } else {
        const basicP = (s?.soilTestBasicPrice !== undefined && s.soilTestBasicPrice > 0) ? s.soilTestBasicPrice : 100;
        const advP = (s?.soilTestAdvancedPrice !== undefined && s.soilTestAdvancedPrice > 0) ? s.soilTestAdvancedPrice : 1000;
        testTypes = [
            {
                name: 'Basic Test',
                title: 'Basic Test (3 Parameters - NPK)',
                description: 'Tests Nitrogen, Phosphorus, and Potassium',
                price: basicP,
                isActive: true
            },
            {
                name: 'Advanced Test',
                title: 'Advanced Test (12 Parameters - Govt. Standard)',
                description: 'Complete analysis including pH, EC, OC, NPK & Micro-nutrients',
                price: advP,
                isActive: true
            }
        ];
    }

    const basicTest = testTypes.find(t => t.name?.toLowerCase().includes('basic') || t.title?.toLowerCase().includes('basic')) || testTypes[0];
    const advancedTest = testTypes.find(t => t.name?.toLowerCase().includes('advanced') || t.title?.toLowerCase().includes('advanced')) || testTypes[1];

    return {
        basicPrice: s?.soilTestBasicPrice !== undefined ? s.soilTestBasicPrice : (basicTest?.price || 100),
        advancedPrice: s?.soilTestAdvancedPrice !== undefined ? s.soilTestAdvancedPrice : (advancedTest?.price || 1000),
        commissionPercentage: s?.soilTestCommissionPercentage ?? 10,
        testTypes
    };
};

// Split what the farmer paid into the admin's cut and the vendor's earning (rounded to paise)
const splitSoilTestAmount = (totalAmount, commissionPercentage) => {
    const adminCommission = Math.round(totalAmount * (commissionPercentage || 0)) / 100;
    return { adminCommission, vendorEarning: Math.round((totalAmount - adminCommission) * 100) / 100 };
};

module.exports = { getSoilTestPricing, splitSoilTestAmount, DEFAULT_SOIL_TEST_TYPES };
