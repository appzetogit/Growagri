require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('../models/Settings');
const { getSoilTestPricing } = require('../services/soilTestPricing');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const existing = await Settings.findOne({ type: 'global' });
    if (!existing.soilTestTypes || existing.soilTestTypes.length === 0) {
      await Settings.updateOne(
        { type: 'global' },
        {
          $set: {
            soilTestTypes: [
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
            ]
          }
        }
      );
    }
    const p = await getSoilTestPricing();
    console.log('SOIL TEST PACKAGES IN DB:', p.testTypes.length, p.testTypes.map(t => t.name));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
