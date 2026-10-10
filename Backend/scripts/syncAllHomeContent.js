const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/db');

async function syncAll() {
  await connectDB();
  const HomeContent = mongoose.model('HomeContent', new mongoose.Schema({}, { strict: false }));
  
  // Find the doc that was recently updated (Prayagraj or latest updatedAt)
  const latestDoc = await HomeContent.findOne({ 'premiumOfferings.0.imageUrl': { $regex: 'premium' } }).sort({ updatedAt: -1 });
  if (!latestDoc) {
    console.log('No updated doc found!');
    process.exit(1);
  }
  
  console.log('Found latest doc:', latestDoc._id, 'with', latestDoc.premiumOfferings?.length, 'offerings');
  latestDoc.premiumOfferings.forEach(p => console.log(' -', p.title, p.imageUrl));
  
  const result = await HomeContent.updateMany({}, {
    $set: {
      premiumOfferings: latestDoc.premiumOfferings,
      promos: latestDoc.promos || [],
      curated: latestDoc.curated || [],
      noteworthy: latestDoc.noteworthy || [],
      banners: [],
      booked: [],
      categorySections: [],
      isBannersVisible: false,
      isBookedVisible: false,
      isCategorySectionsVisible: false
    }
  });

  console.log(`Successfully synced to all ${result.modifiedCount} HomeContent documents!`);
  process.exit(0);
}

syncAll().catch(err => {
  console.error(err);
  process.exit(1);
});
