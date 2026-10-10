const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Scheme = require('../models/Scheme');

dotenv.config();

const INITIAL_SCHEMES = [
  {
    title: 'PM-Kisan',
    fullName: 'Pradhan Mantri Kisan Samman Nidhi',
    subtitleLine1: 'Farmer income',
    subtitleLine2: 'support',
    slug: 'pm-kisan',
    category: 'Direct Income Support',
    bannerImage: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?q=80&w=1200&auto=format&fit=crop',
    badgeBg: 'bg-[#dcfce7]',
    iconColor: 'text-[#166534]',
    iconType: 'tractor',
    shortDescription: '₹6,000 yearly financial assistance in 3 equal installments of ₹2,000 directly to bank accounts.',
    detailedDescription: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) is a Central Sector Scheme launched to supplement the financial needs of all landholding farmer families in procuring various inputs to ensure proper crop health and appropriate yields, commensurate with anticipated farm income as well as to meet domestic needs. Under the scheme, an amount of ₹6,000 per year is transferred directly into the bank accounts of farmers through Direct Benefit Transfer (DBT) mode in three equal installments of ₹2,000 every 4 months.',
    benefits: [
      '₹6,000 annual direct income support credited directly into the farmer’s Aadhaar-seeded bank account.',
      'Three equal installments of ₹2,000 disbursed every 4 months (April-July, August-November, December-March).',
      '100% centrally funded scheme with complete transparency and zero commission/middlemen.',
      'Aadhaar-based e-KYC integration ensuring prompt and hassle-free benefit delivery.'
    ],
    eligibility: [
      'All landholding farmer families having cultivable land in their names.',
      'Both small and marginal farmers as well as other landholding agricultural families.',
      'Exclusions: Institutional landholders, farmer families holding constitutional posts, serving/retired government employees, and income tax payees.'
    ],
    documentsRequired: [
      'Aadhaar Card (Mandatory & linked to mobile number)',
      'Landholding documents (Khatauni / Land Record / RoR)',
      'Active Bank Account details (IFSC code & account linked with Aadhaar)',
      'Valid Mobile number for OTP verification'
    ],
    officialPortalUrl: 'https://pmkisan.gov.in/',
    whatsappNumber: '+91 91177 04450',
    whatsappMessage: 'Namaste GrooAgri Team, I need help and guidance regarding the PM-Kisan scheme application and e-KYC status. Please assist me.',
    order: 1,
    isActive: true
  },
  {
    title: 'PMFBY',
    fullName: 'Pradhan Mantri Fasal Bima Yojana',
    subtitleLine1: 'Crop insurance',
    subtitleLine2: 'scheme',
    slug: 'pmfby',
    category: 'Crop Insurance',
    bannerImage: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=1200&auto=format&fit=crop',
    badgeBg: 'bg-[#fef3c7]',
    iconColor: 'text-[#b45309]',
    iconType: 'wheat',
    shortDescription: 'Comprehensive crop insurance against crop failure due to drought, flood, pests & natural calamities at nominal premium.',
    detailedDescription: 'Pradhan Mantri Fasal Bima Yojana (PMFBY) provides a comprehensive insurance cover against failure of crops thus helping in stabilizing the income of the farmers and encouraging them for adoption of innovative practices. It covers all food & oilseed crops and annual commercial/horticultural crops against non-preventable natural risks from pre-sowing to post-harvest stages.',
    benefits: [
      'Very low farmer premium: Only 2% for Kharif crops, 1.5% for Rabi crops, and 5% for Annual Commercial & Horticultural crops.',
      'The remaining balance premium is heavily subsidized by Central and State Governments equally.',
      'Comprehensive coverage: Prevented sowing, mid-season adversity, localized calamities (hailstorm, landslide), and post-harvest losses.',
      'Use of satellites, smartphones, and drones for rapid crop cutting experiments and claim disbursement directly to bank accounts.'
    ],
    eligibility: [
      'All farmers growing notified crops in notified areas are eligible.',
      'Both loanee farmers (who took Kisan Credit Card / crop loans) and non-loanee farmers.',
      'Sharecroppers and tenant farmers are also fully covered.'
    ],
    documentsRequired: [
      'Land Ownership document / Patta / Tenancy agreement or Sowing Certificate',
      'Bank Account Passbook / Statement',
      'Aadhaar Card copy',
      'Crop Sowing Certificate issued by Patwari / Village Agriculture Officer'
    ],
    officialPortalUrl: 'https://pmfby.gov.in/',
    whatsappNumber: '+91 91177 04450',
    whatsappMessage: 'Namaste GrooAgri Team, I want to inquire about crop insurance under PMFBY and claim procedures. Please guide me.',
    order: 2,
    isActive: true
  },
  {
    title: 'Kisan Credit Card',
    fullName: 'Kisan Credit Card (KCC) Scheme',
    subtitleLine1: 'Easy credit',
    subtitleLine2: 'for farmers',
    slug: 'kisan-credit-card',
    category: 'Agricultural Credit & Finance',
    bannerImage: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?q=80&w=1200&auto=format&fit=crop',
    badgeBg: 'bg-[#e0f2fe]',
    iconColor: 'text-[#2563eb]',
    iconType: 'rupee',
    shortDescription: 'Institutional credit up to ₹3 Lakh at an effective interest rate of just 4% with timely repayment subsidy.',
    detailedDescription: 'The Kisan Credit Card (KCC) scheme meets the production credit requirements of farmers along with working capital expenses for allied activities like dairy, fisheries, and animal husbandry. The scheme provides revolving cash credit facilities with flexible repayment schedules aligned with harvest seasons and market arrivals.',
    benefits: [
      'Low interest rate: 7% base rate with an additional 3% prompt repayment incentive, making effective rate only 4% per annum.',
      'Collateral-free loan up to ₹1.60 Lakh for agricultural crops.',
      'Flexible credit limit tailored to cropping patterns and farm size with validity of up to 5 years.',
      'ATM enabled Rupay Kisan Card for easy withdrawals at rural ATMs and purchase of agricultural inputs.'
    ],
    eligibility: [
      'All individual farmers, joint borrowers who are owner cultivators.',
      'Tenant farmers, oral lessees, and sharecroppers.',
      'Self Help Groups (SHGs) or Joint Liability Groups (JLGs) of farmers.',
      'Farmers engaged in animal husbandry, dairy farming, poultry, and fisheries.'
    ],
    documentsRequired: [
      'Duly filled KCC Application Form',
      'Identity Proof (Aadhaar Card, Voter ID, PAN)',
      'Address Proof (Aadhaar, Electricity Bill)',
      'Land Record / Khasra-Khatauni certified by Revenue Authority',
      'Passport size photographs'
    ],
    officialPortalUrl: 'https://myscheme.gov.in/schemes/kcc',
    whatsappNumber: '+91 91177 04450',
    whatsappMessage: 'Namaste GrooAgri Team, I want help regarding Kisan Credit Card (KCC) loan application and documentation. Please help me.',
    order: 3,
    isActive: true
  },
  {
    title: 'Soil Health Card',
    fullName: 'Soil Health Card Scheme',
    subtitleLine1: 'Better soil,',
    subtitleLine2: 'better yield',
    slug: 'soil-health-card',
    category: 'Soil Testing & Yield Optimization',
    bannerImage: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=1200&auto=format&fit=crop',
    badgeBg: 'bg-[#f3e8ff]',
    iconColor: 'text-[#9333ea]',
    iconType: 'sprout',
    shortDescription: 'Detailed soil test report covering 12 nutrient parameters with crop-wise fertilizer recommendations.',
    detailedDescription: 'Soil Health Card (SHC) Scheme promotes soil test based balanced use of fertilizers to enable farmers to realize higher yields at lower cost of cultivation. The card contains status of soil with respect to 12 parameters: Macro-nutrients (N, P, K), Secondary-nutrient (S), Micro-nutrients (Zn, Fe, Cu, Mn, Bo), and Physical parameters (pH, EC, OC). It provides customized fertilizer recommendations for targeted crop production.',
    benefits: [
      'Comprehensive report covering 12 critical chemical and physical soil parameters.',
      'Crop-specific customized fertilizer and bio-fertilizer dosage recommendations to prevent soil degradation.',
      'Reduces input fertilizer costs by up to 15-20% by avoiding excessive urea/DAP usage.',
      'Periodic soil testing updates provided every 2 years for each farm holding.'
    ],
    eligibility: [
      'All farmers cultivating agricultural lands across India.',
      'Issued free of cost or at nominal testing charge under National Soil Mission.'
    ],
    documentsRequired: [
      'Farmer Aadhaar Card',
      'Land details (Survey Number / Gata No / Village Name)',
      'Representative soil sample collected by Krishi Vigyan Kendra (KVK) or GrooAgri soil test partner'
    ],
    officialPortalUrl: 'https://soilhealth.dac.gov.in/',
    whatsappNumber: '+91 91177 04450',
    whatsappMessage: 'Namaste GrooAgri Team, I want to get my soil tested and get a Soil Health Card. Please connect me with the soil testing team.',
    order: 4,
    isActive: true
  }
];

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not set in environment.');
      process.exit(1);
    }

    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    for (const schemeData of INITIAL_SCHEMES) {
      const existing = await Scheme.findOne({ slug: schemeData.slug });
      if (existing) {
        console.log(`Scheme '${schemeData.title}' already exists. Updating...`);
        await Scheme.findOneAndUpdate({ slug: schemeData.slug }, schemeData, { new: true });
      } else {
        console.log(`Creating Scheme '${schemeData.title}'...`);
        await Scheme.create(schemeData);
      }
    }

    const count = await Scheme.countDocuments();
    console.log(`✅ Successfully seeded/updated schemes! Total schemes in DB: ${count}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();
