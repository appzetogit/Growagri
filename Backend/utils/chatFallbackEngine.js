/**
 * GrooAgri Intelligent Offline & Resilient Fallback Engine
 * Provides context-aware agricultural diagnostics, GrooAgri platform support,
 * multi-lingual replies (14 languages), clarification prompts for vague queries,
 * and zero-failure fallback when cloud AI models are unavailable or rate-limited.
 */

// Script Unicode Ranges & Language Detection
const SCRIPT_DETECTION_RULES = [
  { lang: 'Urdu', regex: /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/ },
  { lang: 'Punjabi', regex: /[\u0A00-\u0A7F]/ },
  { lang: 'Gujarati', regex: /[\u0A80-\u0AFF]/ },
  { lang: 'Odia', regex: /[\u0B00-\u0B7F]/ },
  { lang: 'Tamil', regex: /[\u0B80-\u0BFF]/ },
  { lang: 'Telugu', regex: /[\u0C00-\u0C7F]/ },
  { lang: 'Kannada', regex: /[\u0C80-\u0CFF]/ },
  { lang: 'Malayalam', regex: /[\u0D00-\u0D7F]/ },
  { 
    lang: 'Assamese', 
    test: (text) => {
      // Bengali/Assamese unicode script range
      if (/[\u0980-\u09FF]/.test(text)) {
        // Specific Assamese characters: ৰ (\u09F0), ৱ (\u09F1) or distinctive Assamese vocabulary
        if (/[\u09F0\u09F1]/.test(text) || /(অসম|খেতি|সাৰ|কেনে|হ'ব|পথাৰ|বাবে|লাগে|কৰিব|কৰা|বন্ধুসকল|বাই-ভনী)/i.test(text)) {
          return true;
        }
      }
      return false;
    }
  },
  { 
    lang: 'Bengali', 
    test: (text) => /[\u0980-\u09FF]/.test(text)
  },
  { 
    lang: 'Marathi', 
    test: (text) => {
      if (/[\u0900-\u097F]/.test(text)) {
        // Marathi specific vocabulary markers
        return /(आहे|नाही|शेतकरी|पिके|खते|कसे|माहिती|करावे|करा|बंधूंनो|भगिनींनो|बियाणे|अवजारे)/i.test(text);
      }
      return false;
    }
  },
  { 
    lang: 'Hindi', 
    test: (text) => /[\u0900-\u097F]/.test(text)
  }
];

const HINGLISH_MARKERS = [
  'kisan', 'fasal', 'kheti', 'paani', 'keeda', 'keede', 'keet', 'beej', 'khad', 'dawa', 
  'ilaj', 'yojana', 'sarkari', 'kaise', 'kya', 'hai', 'karo', 'booking', 'paise', 'khet', 
  'bima', 'gehun', 'dhan', 'sarson', 'tamatar', 'aalu', 'bhai', 'namaste', 'mandi'
];

/**
 * Detect language from user text
 */
function detectLanguage(text, preferredLang = null) {
  if (preferredLang && preferredLang !== 'auto' && preferredLang !== 'Auto') {
    return preferredLang;
  }
  if (!text || typeof text !== 'string') return 'Hindi';

  // Check script regexes
  for (const rule of SCRIPT_DETECTION_RULES) {
    if (rule.regex && rule.regex.test(text)) {
      return rule.lang;
    }
    if (rule.test && rule.test(text)) {
      return rule.lang;
    }
  }

  // Check Hinglish vs English
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const hinglishMatchCount = words.filter(w => HINGLISH_MARKERS.includes(w)).length;
  if (hinglishMatchCount >= 2 || (hinglishMatchCount >= 1 && words.length <= 5)) {
    return 'Hinglish';
  }

  return 'English';
}

/**
 * Cultural Greetings & Honorifics for All 14 Languages
 */
const GREETINGS = {
  'Hindi': 'नमस्ते किसान भाई/बहन!',
  'Hinglish': 'Namaste Kisan bhai!',
  'English': 'Hello Farmer Friend!',
  'Punjabi': 'ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ ਕਿਸਾਨ ਵੀਰੋ!',
  'Marathi': 'नमस्कार शेतकरी बंधूंनो!',
  'Gujarati': 'નમસ્તે ખેડૂત મિત્રો!',
  'Bengali': 'নমস্কার কৃষক ভাই ও বোনেরা!',
  'Telugu': 'నమస్కారం రైతు సోదరులారా!',
  'Tamil': 'வணக்கம் விவசாய தோழர்களே!',
  'Kannada': 'ನಮಸ್ಕಾರ ರೈತ ಬಾಂಧವರೇ!',
  'Malayalam': 'നമസ്കാരം കർഷക സുഹൃത്തുക്കളെ!',
  'Odia': 'ନମସ୍କାର କୃଷକ ଭାଇ ଓ ଭଉଣୀମାନେ!',
  'Assamese': 'নমস্কাৰ কৃষক বন্ধুসকল!',
  'Urdu': 'السلام علیکم کسان بھائی!'
};

/**
 * Help & Platform Support Sign-off in All 14 Languages
 */
const SIGN_OFFS = {
  'Hindi': '\n\nकृषि संबंधी किसी भी अन्य समस्या के लिए हमारे हेल्पलाइन **+91 91177 04450** या राष्ट्रीय किसान कॉल सेंटर **1800-180-1551** पर संपर्क करें।',
  'Hinglish': '\n\nKisi bhi aur kheti ya GrooAgri help ke liye hamari helpline **+91 91177 04450** ya Kisan Call Center **1800-180-1551** par call karein.',
  'English': '\n\nFor any further assistance, reach our GrooAgri helpline at **+91 91177 04450** or the National Kisan Call Center at **1800-180-1551**.',
  'Punjabi': '\n\nਕਿਸੇ ਵੀ ਹੋਰ ਜਾਣਕਾਰੀ ਲਈ ਸਾਡੀ ਹੈਲਪਲਾਈਨ **+91 91177 04450** ਜਾਂ ਕਿਸਾਨ ਕਾਲ ਸੈਂਟਰ **1800-180-1551** ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
  'Marathi': '\n\nइतर कोणत्याही मदतीसाठी आमची हेल्पलाइन **+91 91177 04450** किंवा किसान कॉल सेंटर **1800-180-1551** वर संपर्क साधा.',
  'Gujarati': '\n\nવધુ માહિતી માટે અમારી હેલ્પલાઇન **+91 91177 04450** અથવા કિસાન કૉલ સેન્ટર **1800-180-1551** પર સંપર્ક કરો.',
  'Bengali': '\n\nযেকোনো সহায়তার জন্য আমাদের হেল্পলাইন **+91 91177 04450** বা কিষাণ কল সেন্টার **1800-180-1551**-এ কল করুন।',
  'Telugu': '\n\nమరిన్ని వివరాల కోసం మా హెల్ప్‌లైన్ **+91 91177 04450** లేదా కిసాన్ కాల్ సెంటర్ **1800-180-1551** ని సంప్రదించండి.',
  'Tamil': '\n\nகூடுதல் உதவிக்கு எங்களின் உதவி எண் **+91 91177 04450** அல்லது கிசான் கால் சென்டர் **1800-180-1551** ஐ தொடர்பு கொள்ளவும்.',
  'Kannada': '\n\nಯಾವುದೇ ಹೆಚ್ಚಿನ ಮಾಹಿತಿಗಾಗಿ ನಮ್ಮ ಸಹಾಯವಾಣಿ **+91 91177 04450** ಅಥವಾ ಕಿಸಾನ್ ಕಾಲ್ ಸೆಂಟರ್ **1800-180-1551** ಅನ್ನು ಸಂಪರ್ಕಿಸಿ.',
  'Malayalam': '\n\nകൂടുതൽ വിവരങ്ങൾക്ക് ഞങ്ങളുടെ ഹെൽപ്പ് ലൈൻ **+91 91177 04450** അല്ലെങ്കിൽ കിസാൻ കോൾ സെന്റർ **1800-180-1551** നമ്പറിൽ ബന്ധപ്പെടുക.',
  'Odia': '\n\nଅନ୍ୟ କୌଣସି ସହାୟତା ପାଇଁ ଆମର ହେଲ୍ପଲାଇନ **+91 91177 04450** ବା କିଷାନ କଲ୍ ସେଣ୍ଟର **1800-180-1551** ରେ ଯୋଗାଯୋଗ କରନ୍ତୁ।',
  'Assamese': '\n\nযিকোনো কৃষি পৰামৰ্শৰ বাবে আমাৰ হেল্পলাইন **+91 91177 04450** বা কিষাণ কল চেণ্টাৰ **1800-180-1551** ত যোগাযোগ কৰক।',
  'Urdu': '\n\nمزید زرعی رہنمائی کے لیے ہماری ہیلپ لائن **+91 91177 04450** یا قومی کسان کال سینٹر **1800-180-1551** پر رابطہ کریں۔'
};

/**
 * Intelligent Fallback Intent Classifier & Content Generator
 */
function generateFallbackResponse(userMessage, preferredLanguage = 'Hindi') {
  const lang = detectLanguage(userMessage, preferredLanguage);
  const greeting = GREETINGS[lang] || GREETINGS['Hindi'];
  const signOff = SIGN_OFFS[lang] || SIGN_OFFS['Hindi'];
  const msgLower = (userMessage || '').toLowerCase();

  // 1. Guardrail for Off-Topic non-agricultural queries
  if (isOffTopic(msgLower)) {
    return handleOffTopic(lang);
  }

  // 2. GrooAgri Soil Testing Intent
  if (/(soil|test|mitti|jaanch|parikshan|card|ମାଟି|মাটি|ਮਿੱਟੀ|నేల|மண்|ಮಣ್ಣು|മണ്ണ്|જમીન|مٹی)/i.test(msgLower) &&
      /(test|sample|jaanch|book|parikshan|report|card|ପରୀକ୍ଷା|পরীক্ষা|ਪਰਖ|పరీక్ష|பரிசோதனை|ಪರೀಕ್ಷೆ|പരിശോധന|ચકાસણી|معائنہ)/i.test(msgLower)) {
    return handleSoilTestingIntent(lang, greeting, signOff);
  }

  // 3. GrooAgri Machinery & Drone Rental Intent
  if (/(machinery|equipment|tractor|drone|rotavator|harvester|kiraya|rent|spray|leveler|ਟਰੈਕਟਰ|ट्रैक्टर|ট্ৰেক্টৰ|ట్రాక్టర్|டிராக்டர்|ಟ್ರಾಕ್ಟರ್|ട്രാക്ടർ|ટ્રેક્ટર|ٹریکٹر|మషీన్|இயந்திரம்|যন্ত্র)/i.test(msgLower) &&
      /(rent|kiraya|book|hire|hourly|rate|ଭଡ଼ା|ভাড়া|ਕਿਰਾਇਆ|అద్దె|வாடகை|ಬಾಡಿಗೆ|വാടക|ભાડે|کرایہ)/i.test(msgLower)) {
    return handleMachineryRentalIntent(lang, greeting, signOff);
  }

  // 4. GrooAgri Store / Marketplace / Seeds / Fertilizers Purchase Intent
  if (/(buy|order|store|shop|marketplace|seed|beej|fertilizer|khad|pesticide|dawa|price|दुकान|बाज़ार|खरीद|ବିହନ|বীজ|ਬੀਜ|విత్తనాలు|விதைகள்|ಬೀಜ|വിത്തുകൾ|બિયારણ|بیج|ਸਟੋਰ|দোকান)/i.test(msgLower) &&
      /(buy|order|cart|price|rate|shop|kharid|mangwana|how to buy|ଦର|କିଣିବା|কিনতে|ਖਰੀਦ|కొనుగోలు|வாங்க|ಖರೀದಿಸುವುದು|വാങ്ങാൻ|ખરીદી|خرید)/i.test(msgLower)) {
    return handleMarketplaceIntent(lang, greeting, signOff);
  }

  // 5. Wallet, Payment Deductions & Refund Troubleshooting Intent
  if (/(wallet|payment|money|deduct|refund|fail|pending|cancel|dispute|paise|kat gaye|kat gaya|rupaye|વાલેટ|વોલેٹ|વોલેટ|वॉलेट|টাকা|পয়সা|వాలెట్|பணம்|ವ್ಯಾಲೆಟ್|വാലറ്റ്|پیسے)/i.test(msgLower)) {
    return handleWalletTroubleshootingIntent(lang, greeting, signOff);
  }

  // 6. Weather & Spray Timing Intent
  if (/(weather|barish|rain|mausam|forecast|humidity|wind|हवा|तापमान|বৃষ্টি|বৃষ্টিপাত|ਮੀਂਹ|ਮੌਸਮ|వర్షం|வானிலை|மழை|ಹವಾಮಾನ|കാലാവസ്ഥ|વરસાદ|હવામાન|بارش|موسم)/i.test(msgLower)) {
    return handleWeatherIntent(lang, greeting, signOff);
  }

  // 7. Government Schemes (PM-KISAN, PMFBY, KCC, Subsidies)
  if (/(pm-kisan|pmkisan|kisan samman|fasal bima|pmfby|kcc|credit card|subsidy|yojana|scheme|6000|योजना|યોજના|ਯੋਜਨਾ|যোজনা|పథకం|திட்டம்|ಯೋಜನೆ|പദ്ധതി|اسکیم)/i.test(msgLower)) {
    return handleGovtSchemesIntent(lang, greeting, signOff);
  }

  // 8. Sucking Pests & Insect Management (Aphids, Whiteflies, Thrips, Caterpillars)
  if (/(keeda|keede|insect|pest|aphid|whitefly|thrips|chepa|mahu|caterpillar|sundi|larva|stem borer|bollworm|worm|कीड़ा|कीट|कीड़े|কীট|পোকা|ਕੀੜੇ|పురుగు|பூச்சி|ಕೀಟ|കീടം|જીવાત|کیڑے)/i.test(msgLower)) {
    return handlePestControlIntent(lang, greeting, signOff, userMessage);
  }

  // 9. Crop Diseases (Rust, Blight, Wilt, Fungal, Yellowing, Leaf Curl)
  if (/(disease|fungus|blight|rust|wilt|fungal|peeli kungi|rot|leaf curl|peela|peeli|dhaba|रोग|बीमारी|फफूंद|রোগ|ਬਿਮਾਰੀ|తెగులు|நோய்|ರೋಗ|രോഗം|રોગ|بیماری)/i.test(msgLower)) {
    return handleDiseaseControlIntent(lang, greeting, signOff, userMessage);
  }

  // 10. Fertilizers, Nano Urea, Nutrition & Dosing
  if (/(fertilizer|urea|dap|npk|potash|khad|nano urea|nano dap|zinc|sulphur|boron|vermicompost|खाद|उर्वरक|সার|ਸਾਰ|ఎరువు|உரம்|ಗೊಬ್ಬರ|വളം|ખાતર|کھاد)/i.test(msgLower)) {
    return handleFertilizerNutritionIntent(lang, greeting, signOff);
  }

  // 11. Irrigation, Drip, Sprinkler & Water Management
  if (/(irrigation|drip|sprinkler|paani|sinchai|fertigation|water|टपक|सिंचाई|সেচ|ਸਿੰਚਾਈ|సాగునీరు|பாசனம்|ನೀರಾವರಿ|നന|સિંચાઈ|آبپاشی)/i.test(msgLower)) {
    return handleIrrigationIntent(lang, greeting, signOff);
  }

  // 12. Livestock, Dairy, Milk Yield & Cattle Care
  if (/(cow|buffalo|cattle|dairy|milk|doodh|gai|bhains|goat|poultry|fodder|silage|napier|vaccine|गाय|भैंस|दूध|पशु|डेयरी|পশু|গাভী|দুধ|ਗਾਂ|ਮੱਝ|దూడ|ఆవు|பால்|மாடு|ಹಸು|പശു|ગાય|بھینس|دودھ|جانور)/i.test(msgLower)) {
    return handleLivestockIntent(lang, greeting, signOff);
  }

  // 13. Smart Farming, Drones, IoT & Modern AgriTech
  if (/(drone|iot|sensor|smart farm|ai|precision|satellite|polyhouse|hydroponic|automation|स्मार्ट|ड्रोन|સેન્સર|డ్రోన్|ட்ரோன்|ಡ್ರೋನ್|ڈرون)/i.test(msgLower)) {
    return handleSmartAgriTechIntent(lang, greeting, signOff);
  }

  // 14. Major Crops Cultivation (Wheat, Rice, Cotton, Mustard, Sugarcane, Soybean, Tomato)
  if (/(wheat|gehun|paddy|dhan|rice|cotton|kapas|mustard|sarson|soybean|maize|makka|tamatar|tomato|aalu|potato|ganna|sugarcane|गेहूं|धान|कपास|सरसों|ধান|কপাহ|கோதுமை|వరి|ಗೋಧಿ|നെല്ല്|ચોખા|گندم|دھان)/i.test(msgLower)) {
    return handleCropCultivationIntent(lang, greeting, signOff, userMessage);
  }

  // 15. Ambiguous / Vague Farmer Queries -> Diagnostic Triage with Clarification
  if (isVagueFarmerQuery(msgLower)) {
    return handleClarificationTriage(lang, greeting, signOff, userMessage);
  }

  // 16. Comprehensive Open-Ended Agronomic Fallback (Never says "I don't know")
  return handleComprehensiveOpenFallback(lang, greeting, signOff, userMessage);
}

/**
 * Check if query is completely off-topic (movies, cricket, politics, code, etc.)
 */
function isOffTopic(lower) {
  const nonAgriKeywords = [
    'movie', 'actor', 'actress', 'cinema', 'bollywood', 'hollywood',
    'cricket score', 'ipl match', 'football',
    'write python', 'react component', 'javascript code', 'html css',
    'politics', 'election result', 'prime minister name', 'who will win election',
    'girlfriend', 'dating', 'joke'
  ];
  return nonAgriKeywords.some(k => lower.includes(k));
}

function handleOffTopic(lang) {
  const messages = {
    'Hindi': 'नमस्ते! मैं GrooAgri का कृषि मित्र हूँ। मैं केवल खेती-किसानी, फसल, मिट्टी, मौसम, पशुपालन और GrooAgri की सेवाओं से जुड़े सवालों में आपकी सहायता कर सकता हूँ। कृपया कृषि या GrooAgri से संबंधित कोई भी सवाल पूछें!',
    'Hinglish': 'Namaste! Main GrooAgri ka Krishi Mitra hoon. Main sirf farming, fasal, mitti, weather, livestock aur GrooAgri app services me aapki help kar sakta hoon. Kripya agriculture se juda koi bhi sawal poochhein!',
    'English': 'Hello! I am GrooAgri Krishi Mitra, your dedicated agricultural and platform companion. I specialize in farming, crop agronomy, soil health, pest management, weather advisories, and GrooAgri services. Please feel free to ask any agriculture-related question!',
    'Punjabi': 'ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ! ਮੈਂ GrooAgri ਦਾ ਕ੍ਰਿਸ਼ੀ ਮਿੱਤਰ ਹਾਂ। ਮੈਂ ਸਿਰਫ਼ ਖੇਤੀਬਾੜੀ, ਫਸਲਾਂ, ਮਿੱਟੀ ਪਰਖ, ਮੌਸਮ ਅਤੇ GrooAgri ਸੇਵਾਵਾਂ ਬਾਰੇ ਤੁਹਾਡੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਖੇਤੀ ਨਾਲ ਸਬੰਧਤ ਕੋਈ ਵੀ ਸਵਾਲ ਪੁੱਛੋ!',
    'Marathi': 'नमस्कार! मी GrooAgri चा कृषी मित्र आहे. मी केवळ शेती, पिके, खते, माती परीक्षण, हवामान आणि GrooAgri सेवांविषयी आपल्या प्रश्नांची उत्तरे देऊ शकतो. कृपया कृषी संदर्भातील प्रश्न विचारा!',
    'Gujarati': 'નમસ્તે! હું GrooAgri નો કૃષિ મિત્ર છું. હું માત્ર ખેતી, પાક, ખાતર, જમીન ચકાસણી અને GrooAgri સેવાઓ વિશે આપને મદદ કરી શકું છું. કૃપા કરીને ખેતી સંબંધિત પ્રશ્ન પૂછો!',
    'Bengali': 'নমস্কার! আমি GrooAgri-র কৃষি মিত্র। আমি শুধুমাত্র কৃষি, ফসল, সার, মাটি পরীক্ষা এবং GrooAgri পরিষেবা সংক্রান্ত প্রশ্নের উত্তর দিতে পারি। অনুগ্রহ করে কৃষি সম্পর্কিত প্রশ্ন করুন!',
    'Telugu': 'నమస్కారం! నేను GrooAgri కృషి మిత్రుడిని. నేను వ్యవసాయం, పంటలు, నేల పరీక్ష, వాతావరణం మరియు GrooAgri సేవల గురించి మాత్రమే మీకు సహాయం చేయగలను. దయచేసి వ్యవసాయానికి సంబంధించిన ప్రశ్నలు అడగండి!',
    'Tamil': 'வணக்கம்! நான் GrooAgri-ன் கிருஷி மித்ரா. விவசாயம், பயிர்கள், மண் பரிசோதனை, வானிலை மற்றும் GrooAgri சேவைகள் பற்றி மட்டுமே நான் உதவ முடியும். தயவுசெய்து விவசாயம் சார்ந்த கேள்விகளை கேளுங்கள்!',
    'Kannada': 'ನಮಸ್ಕಾರ! ನಾನು GrooAgri ಕೃಷಿ ಮಿತ್ರ. ಕೃಷಿ, ಬೆಳೆಗಳು, ರಸಗೊಬ್ಬರ, ಮಣ್ಣು ಪರೀಕ್ಷೆ ಮತ್ತು GrooAgri ಸೇವೆಗಳ ಕುರಿತು ಮಾತ್ರ ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ದಯವಿಟ್ಟು ಕೃಷಿಗೆ ಸಂಬಂಧಿಸಿದ ಪ್ರಶ್ನೆ ಕೇಳಿ!',
    'Malayalam': 'നമസ്കാരം! ഞാൻ GrooAgri കൃഷി മിത്രയാണ്. കൃഷി, വിളകൾ, മണ്ണ് പരിശോധന, വളങ്ങൾ, GrooAgri സേവനങ്ങൾ എന്നിവയിൽ മാത്രമേ എനിക്ക് സഹായിക്കാനാകൂ. ദയവായി കാർഷിക വിഷയങ്ങൾ ചോദിക്കുക!',
    'Odia': 'ନମସ୍କାର! ମୁଁ GrooAgri ର କୃଷି ମିତ୍ର। ମୁଁ କେବଳ କୃଷି, ଫସଲ, ସାର, ମାଟି ପରୀକ୍ଷା ଏବଂ GrooAgri ସେବା ବିଷୟରେ ଆପଣଙ୍କୁ ସାହାଯ୍ୟ କରିପାରିବି। ଦୟାକରି କୃଷି ସମ୍ବନ୍ଧୀୟ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ!',
    'Assamese': 'নমস্কাৰ! মই GrooAgri-ৰ কৃষি মিত্ৰ। মই কেৱল কৃষি, শস্য, সাৰ, মাটি পৰীক্ষা আৰু GrooAgri সেৱা সম্পৰ্কীয় প্ৰশ্নৰ উত্তৰ দিব পাৰোঁ। অনুগ্ৰহ কৰি কৃষিসম্পৰ্কীয় প্ৰশ্ন সোধক!',
    'Urdu': 'السلام علیکم! میں GrooAgri کا کرشی متر ہوں۔ میں صرف کھیتی باڑی، فصلوں، مٹی، کھاد اور GrooAgri کی خدمات میں آپ کی مدد کر سکتا ہوں۔ براہ کرم زراعت سے متعلق کوئی سوال پوچھیں!'
  };
  return messages[lang] || messages['Hindi'];
}

/**
 * Check if farmer query is too short/vague
 */
function isVagueFarmerQuery(lower) {
  const vaguePatterns = [
    /^(keeda|keede|keet)\s*(lag\s*gaya|hai|lagi|aaya)?$/i,
    /^(dawa|dawai)\s*(batao|chahiye|dein)?$/i,
    /^(khad|fertilizer)\s*(kab|kaise)\s*(dalein|dena|chahiye)?$/i,
    /^(paani|pani)\s*(kab|kitne)\s*(dein|din)?$/i,
    /^(patte|patti)\s*(peele|peeli|sukhe|kharab)\s*(hai|hain)?$/i,
    /^(kheti\s*me\s*munafa|kamai\s*kaise)?$/i,
    /^(fasal\s*kharab\s*ho\s*rahi\s*hai)?$/i
  ];
  return vaguePatterns.some(p => p.test(lower.trim())) || lower.trim().length <= 15;
}

/**
 * Diagnostic Clarification Handler for Vague Farmer Queries
 */
function handleClarificationTriage(lang, greeting, signOff, rawQuery) {
  return `${greeting}

आपकी समस्या को सही ढंग से समझकर सटीक समाधान देने के लिए मुझे कुछ अतिरिक्त विवरण चाहिए:

🔍 **कृपया नीचे दिए गए 3 सवालों के जवाब दें:**
1. **कौन सी फसल है?** (उदा. गेहूं, धान, टमाटर, सरसों, कपास आदि) और फसल की उम्र कितने दिन की है?
2. **लक्षण क्या दिखाई दे रहे हैं?** 
   - क्या पत्ते मुड़ रहे हैं, पीले पड़ रहे हैं या काले/भूरे धब्बे हैं?
   - क्या पत्तों या तनों पर छेद हैं या सफेद फफूंद/पाउडर दिख रहा है?
   - क्या पौधे की जड़ों में गलन या उकठा (मुरझाना) दिख रहा है?
3. **मिट्टी का प्रकार क्या है** और आपने पिछली सिंचाई व खाद कब दी थी?

💡 **तुरंत प्राथमिक उपाय:**
- यदि रस चूसक कीटों या फफूंद का अंदेशा हो, तो खेत में **नीम का तेल (Neem Oil 10,000 ppm @ 2-3 मिली प्रति लीटर पानी)** में मिलाकर तुरंत छिड़काव करें।
- खेत में अत्यधिक पानी जमा न होने दें और जल निकासी सुनिश्चित करें।
- सही पोषक तत्वों की जांच के लिए अपने खेत की [Book Soil Test](/user/soil-testing) बुक करें।
- प्रमाणित कीटनाशक व जैविक खाद के लिए [Visit Agri Marketplace](/user/agri-marketplace) देखें।${signOff}`;
}

/**
 * Soil Testing Intent Handler
 */
function handleSoilTestingIntent(lang, greeting, signOff) {
  return `${greeting}

🌱 **GrooAgri मिट्टी परीक्षण (Soil Testing) सेवा की पूरी जानकारी:**

मिट्टी की जांच से आपकी जमीन में मौजूद 14+ आवश्यक पोषक तत्वों (pH, EC, जैविक कार्बन, नाइट्रोजन, फास्फोरस, पोटाश, जिंक, सल्फर, बोरॉन, आयरन आदि) की सटीक जानकारी मिलती है। इससे खाद का अनावश्यक खर्च बचता है और पैदावार में 20-30% की वृद्धि होती है।

📋 **GrooAgri ऐप पर मिट्टी जांच बुक करने की आसान प्रक्रिया:**
1. ऐप में [Book Soil Test](/user/soil-testing) पर टैप करें।
2. अपने खेत का क्षेत्रफल (एकड़ में) और जीपीएस (GPS) लोकेशन चुनें।
3. बुकिंग के 24-48 घंटों के भीतर GrooAgri का प्रशिक्षित फील्ड प्रतिनिधि आपके खेत पर आकर वैज्ञानिक तरीके से नमूना (Core Sample) एकत्रित करेगा।
4. प्रमाणित प्रयोगशाला में जांच के बाद **3 से 5 दिनों में** आपके ऐप पर विस्तृत **डिजिटल सॉइल हेल्थ कार्ड** और फसल अनुसार खाद की सलाह उपलब्ध हो जाएगी।

💰 **लागत व लाभ:** अत्यधिक यूरिया व डीएपी के 20-25% अनावश्यक खर्च की बचत और संतुलित खाद से मृदा स्वास्थ्य सुरक्षित!${signOff}`;
}

/**
 * Machinery & Drone Rental Intent Handler
 */
function handleMachineryRentalIntent(lang, greeting, signOff) {
  return `${greeting}

🚜 **GrooAgri आधुनिक कृषि मशीनरी व ड्रोन किराया सेवा:**

GrooAgri के जरिए आप अपने नजदीकी सत्यापित वेंडरों से बिना किसी बिचौलिए के आधुनिक कृषि उपकरण उचित किराए पर बुक कर सकते हैं:

🛠️ **उपलब्ध मशीनरी:**
- **ट्रैक्टर (35 HP से 75 HP):** जुताई, कल्टीवेटर, रोटावेटर और ढुलाई के लिए (2WD व 4WD विकल्प)।
- **रोटावेटर व डिस्क हैरो:** खेत की बारीक तैयारी और मिट्टी भुरभुरी करने हेतु।
- **कंबाइन हार्वेस्टर:** धान, गेहूं, सोयाबीन, मक्का की त्वरित कटाई व मड़ाई।
- **लेजर लैंड लेवलर:** जमीन को मिलीमीटर स्तर तक समतल कर 20-25% पानी की बचत।
- **कृषि ड्रोन (Agricultural Drone):** 1 एकड़ में सिर्फ 7-10 मिनट में नैनो यूरिया व कीटनाशकों का समान छिड़काव!
- **सुपर सीडर / हैप्पी सीडर:** पराली जलाए बिना सीधे गेहूं की बुवाई।

📲 **बुकिंग कैसे करें:**
1. [Rent Farm Machinery](/user/machinery-explorer) पर क्लिक करें।
2. अपनी आवश्यकतानुसार मशीनरी चुनें, तारीख व समय स्लॉट सेट करें।
3. मशीन चालक के खेत पर पहुंचने पर ओटीपी (OTP) साझा कर काम शुरू कराएं।
4. बुकिंग रद्द करने पर 24 घंटे पहले 100% पूरा रिफंड मिलता है।${signOff}`;
}

/**
 * Marketplace & Seeds/Fertilizer Purchase Intent
 */
function handleMarketplaceIntent(lang, greeting, signOff) {
  return `${greeting}

🛒 **GrooAgri कृषि बाज़ार (Agri Marketplace) स्टोर:**

GrooAgri स्टोर से आप 100% प्रमाणित, ब्रांडेड और गुणवत्तायुक्त कृषि सामग्री घर बैठे मंगा सकते हैं:

🌾 **उपलब्ध उत्पाद श्रेणी:**
- **प्रमाणित संकर बीज (Certified Hybrid Seeds):** अनाज, दालें, तिलहन, कपास व मौसमी सब्जियों के उच्च उपज वाले बीज।
- **उर्वरक (Fertilizers):** नीम कोटेड यूरिया, DAP (18:46:0), MOP पोटाश (0:0:60), SSP, पानी में घुलनशील 19:19:19, 0:52:34।
- **नैनो उर्वरक:** IFFCO नैनो यूरिया व नैनो डीएपी बोतलें।
- **जैव उर्वरक व कार्बनिक खाद:** राइजोबियम, पीएसबी (PSB), वर्मीकम्पोस्ट (केंचुआ खाद), नीम खली।
- **फसल सुरक्षा रसायन:** ट्राइकोडर्मा विरिडी, नीम तेल (10,000 ppm), कीटनाशक, फफूंदनाशक।
- **सिंचाई उपकरण:** ड्रिप पाइप, ड्रिपर्स, मिनी स्प्रिंकलर व स्प्रेयर पंप।

🚚 **ऑर्डर व डिलीवरी:**
- स्टोर देखने के लिए [Visit Agri Marketplace](/user/agri-marketplace) पर जाएं।
- चयनित सामान को [View Cart](/user/agri-cart) में जोड़ें और कैश ऑन डिलीवरी (COD) या ऑनलाइन पेमेंट (UPI/Card) से ऑर्डर पूरा करें।
- ऑर्डर स्थिति देखने के लिए [Track Orders](/user/my-agri-orders) पर टैप करें।${signOff}`;
}

/**
 * Wallet Troubleshooting & Payment Intent
 */
function handleWalletTroubleshootingIntent(lang, greeting, signOff) {
  return `${greeting}

💳 **GrooAgri डिजिटल वॉलेट व भुगतान सहायता:**

GrooAgri वॉलेट आपके लेन-देन को सुरक्षित, त्वरित और बिना किसी अतिरिक्त शुल्क के पूरा करता है।

⚠️ **यदि बैंक/UPI से पैसे कट गए और बुकिंग पेंडिंग या फेल दिख रही है:**
1. **चिंता न करें:** बैंकिंग सर्वर या पेमेंट गेटवे (Razorpay/UPI) के धीमे नेटवर्क के कारण कभी-कभी 24 घंटे का सिंक समय लग सकता है।
2. यदि बुकिंग सफल नहीं होती है, तो कटी हुई राशि स्वतः **5 से 7 कार्यदिवसों (Business Days)** के भीतर आपके मूल बैंक खाते में रिफंड कर दी जाती है।
3. अपने वॉलेट बैलेंस और ट्रांजेक्शन हिस्ट्री देखने के लिए [My Wallet](/user/wallet) खोलें।

🔄 **रिफंड और रद्दीकरण नियम:**
- मशीनरी स्लॉट से 24 घंटे पहले रद्द करने पर **100% फुल रिफंड** मिलता है।
- क्षतिग्रस्त या एक्सपायर्ड उत्पाद मिलने पर डिलीवरी के 48 घंटे के भीतर [Track Orders](/user/my-agri-orders) से डिस्प्यूट दर्ज करें।
- सीधे सहायता के लिए [Help & Support](/user/help-support) पर टिकट बनाएं या हमारे हेल्पलाइन **+91 91177 04450** पर संपर्क करें।${signOff}`;
}

/**
 * Weather & Spray Advisory Intent
 */
function handleWeatherIntent(lang, greeting, signOff) {
  return `${greeting}

🌦️ **GrooAgri मौसम एवं कृषि स्प्रे एडवाइजरी:**

सटीक मौसम पूर्वानुमान खेती में सिंचाई, बुवाई और कीटनाशक छिड़काव की सफलता की कुंजी है।

📲 **लाइव रिपोर्ट देखें:** [Weather Report](/user/weather)
- **7-दिवसीय हाइपर-लोकल पूर्वानुमान:** आपके गांव/ब्लॉक का तापमान, वर्षा की संभावना, हवा की गति और सापेक्षिक आर्द्रता (Humidity)।

⚠️ **स्प्रे के लिए मौसम संबंधी जरूरी नियम:**
1. यदि अगले 4-6 घंटों में बारिश की संभावना हो, तो कीटनाशक या फफूंदनाशक का छिड़काव बिल्कुल न करें।
2. तेज हवाओं (>15 किमी/घंटा) में छिड़काव न करें, इससे दवा उड़कर पड़ोसी खेतों में नष्ट हो जाती है।
3. छिड़काव का सबसे उत्तम समय: सुबह 7:00 से 10:00 बजे या शाम 4:00 से 6:30 बजे तक होता है। तेज धूप और दोपहर की गर्मी (>35°C) में छिड़काव से बचें।${signOff}`;
}

/**
 * Government Schemes Intent
 */
function handleGovtSchemesIntent(lang, greeting, signOff) {
  return `${greeting}

🏛️ **किसानों के लिए प्रमुख सरकारी योजनाएं एवं लाभ:**

1. **PM-KISAN (प्रधानमंत्री किसान सम्मान निधि):**
   - सभी भूमिधारक किसान परिवारों को प्रति वर्ष **₹6,000** की प्रत्यक्ष आर्थिक सहायता (DBT) 3 समान किस्तों (₹2,000 हर 4 माह) में दी जाती है।
   - अनिवार्य शर्तें: बैंक खाते में आधार लिंक, भू-अभिलेख सत्यापन (Land Seeding), और e-KYC (pmkisan.gov.in पर)।

2. **PMFBY (प्रधानमंत्री फसल बीमा योजना):**
   - प्राकृतिक आपदाओं (सूखा, बाढ़, ओलावृष्टि, कीट प्रकोप, चक्रवात) से फसल नुकसान का व्यापक बीमा सुरक्षा कवच।
   - किसान प्रीमियम दर: खरीफ फसलें: केवल 2%, रबी फसलें: केवल 1.5%, वाणिज्यिक/बागवानी फसलें: केवल 5%। बाकी प्रीमियम सरकार वहन करती है। नुकसान होने पर 72 घंटे में सूचना देना अनिवार्य है।

3. **किसान क्रेडिट कार्ड (KCC - Kisan Credit Card):**
   - ₹3 लाख तक का रियायती कृषि ऋण केवल 7% ब्याज पर।
   - समय पर भुगतान करने पर **3% ब्याज छूट (Subvention)** मिलती है, जिससे प्रभावी ब्याज दर मात्र **4.0% प्रति वर्ष** रह जाती है!
   - पशुपालन एवं मत्स्य पालन के लिए भी ₹2 लाख तक का KCC उपलब्ध है।

4. **PMKSY (प्रति बूंद अधिक फसल - ड्रिप/स्प्रिंकलर सब्सिडी):**
   - टपक (ड्रिप) व फव्वारा सिंचाई उपकरण लगाने पर छोटे व सीमांत किसानों को **55%** तथा अन्य किसानों को **45%** तक सरकारी सब्सिडी मिलती है।

5. **SMAM (कृषि यंत्रीकरण उप-मिशन):**
   - ट्रैक्टर व आधुनिक कृषि यंत्रों की खरीद पर व्यक्तिगत किसानों को 40-50% तथा कस्टम हायरिंग सेंटर (CHC) खोलने पर FPO को 80% तक सब्सिडी।

📞 **राष्ट्रीय किसान हेल्पलाइन:** किसी भी सरकारी योजना की जानकारी के लिए टोल-फ्री **1800-180-1551** पर कभी भी कॉल करें।${signOff}`;
}

/**
 * Pest Control Intent
 */
function handlePestControlIntent(lang, greeting, signOff, userMessage) {
  return `${greeting}

🐛 **एकीकृत कीट प्रबंधन (Integrated Pest Management - IPM) गाइड:**

फसलों में कीट नियंत्रण के लिए रासायनिक दवाओं से पहले जैविक व यांत्रिक तरीके अपनाना पर्यावरण व फसल दोनों के लिए सबसे सुरक्षित है:

1. **रस चूसक कीट (माहू, सफेद मक्खी, थ्रिप्स, हरा तेला):**
   - **लक्षण:** पत्तों का मुड़ना, पीला पड़ना, पौधे का बौना रह जाना और पत्तियों पर चिपचिपा काला फफूंद (Sooty Mold)।
   - **जैविक नियंत्रण:** 
     * 1 एकड़ में 15 **पीले स्टिकी ट्रैप (Yellow Sticky Traps)** और 15 **नीले स्टिकी ट्रैप (Blue Sticky Traps)** लगाएं।
     * **नीम का तेल (Neem Oil 10,000 ppm @ 2-3 मिली प्रति लीटर पानी)** में थोड़ा तरल साबुन मिलाकर छिड़कें।
   - **रासायनिक नियंत्रण (गंभीर प्रकोप होने पर):**
     * **थियामेथोक्सम 25% WG (Thiamethoxam)** @ 0.5 ग्राम प्रति लीटर पानी या **इमिडाक्लोप्रिड 17.8% SL (Imidacloprid)** @ 0.5 मिली प्रति लीटर पानी।

2. **तना छेदक (Stem Borer) व सुंडी (Caterpillar/Bollworm):**
   - **धान/मक्का/गन्ना:** तने में छेद, "डेड हार्ट" (Dead Heart) और सफेद बालियां।
   - **कपास:** गुलाबी सुंडी (Pink Bollworm)।
   - **नियंत्रण:** फेरोमोन ट्रैप (Pheromone Traps @ 5-8 प्रति एकड़) लगाएं। ट्राइकोग्रामा परजीवी कार्ड लगाएं। 
   - रासायनिक छिड़काव: **क्लोरांट्रानिलीप्रोल 18.5% SC (Coragen)** @ 0.3-0.4 मिली प्रति लीटर पानी या **एमामेक्टिन बेंजोएट 5% SG** @ 0.5 ग्राम प्रति लीटर पानी।

⚠️ **सावधानी:** स्प्रे करते समय मास्क व दस्ताने पहनें और फसल कटाई से 10-15 दिन पहले कोई भी जहरीला रसायन न छिड़कें।

दवाइयां ऑर्डर करने के लिए [Visit Agri Marketplace](/user/agri-marketplace) देखें और ड्रोन स्प्रे के लिए [Rent Farm Machinery](/user/machinery-explorer) का उपयोग करें।${signOff}`;
}

/**
 * Disease Control Intent
 */
function handleDiseaseControlIntent(lang, greeting, signOff, userMessage) {
  return `${greeting}

🍂 **प्रमुख पादप रोग एवं वैज्ञानिक उपचार गाइड:**

1. **झुलसा रोग (Early & Late Blight) - आलू, टमाटर:**
   - **लक्षण:** पत्तियों पर पानी से भीगे भूरे-काले धब्बे जो तेजी से फैलते हैं।
   - **रोकथाम:** मैनकोजेब 75% WP @ 2.5 ग्राम प्रति लीटर पानी।
   - **उपचार (Curative):** मेटालेक्सिल 8% + मैनकोजेब 64% WP (रिडोमिल एमजेड) @ 2.5 ग्राम प्रति लीटर पानी या साइमोक्सानिल + मैनकोजेब का छिड़काव करें।

2. **गेहूं में पीली कुंगी / रतुआ (Yellow Rust):**
   - **लक्षण:** पत्तियों पर पीले रंग की समानांतर धारियों में पाउडर जैसी फफूंद।
   - **रोकथाम:** लक्षण दिखते ही **प्रोपिकोनाजोल 25% EC (टिल्ट)** @ 1 मिली प्रति लीटर पानी (200 मिली प्रति 200 लीटर पानी प्रति एकड़) या टेबुकोनाजोल 25.9% EC @ 1 मिली प्रति लीटर पानी का छिड़काव करें।

3. **उकठा रोग (Fusarium Wilt) - चना, अरहर, टमाटर:**
   - **लक्षण:** पौधे का अचानक मुरझाना और तने को चीरने पर अंदर संवहनी ऊतक काले/भूरे दिखना।
   - **नियंत्रण:** बीजोपचार **ट्राइकोडर्मा विरिडी (Trichoderma viride @ 5-10 ग्राम/किग्रा बीज)** से करें। खेत में गोबर की खाद (FYM) के साथ 2 किग्रा/एकड़ ट्राइकोडर्मा मिलाकर डालें।

4. **चूर्णिल आसिता / छाछिया (Powdery Mildew):**
   - **लक्षण:** पत्तियों और तनों पर सफेद पाउडर जैसा लेप।
   - **उपचार:** घुलनशील सल्फर 80% WP @ 2.5 ग्राम प्रति लीटर या हेक्साकोनाजोल 5% EC @ 1 मिली प्रति लीटर पानी।

मिट्टी जनित रोगों से सुरक्षा के लिए पहले [Book Soil Test](/user/soil-testing) कराएं और विश्वसनीय फफूंदनाशक [Visit Agri Marketplace](/user/agri-marketplace) से मंगाएं।${signOff}`;
}

/**
 * Fertilizer & Nutrition Intent
 */
function handleFertilizerNutritionIntent(lang, greeting, signOff) {
  return `${greeting}

🧪 **संतुलित उर्वरक एवं फसल पोषण प्रबंधन:**

फसल की भरपूर पैदावार के लिए संतुलित N:P:K (नाइट्रोजन, फास्फोरस, पोटाश) और सूक्ष्म पोषक तत्वों का उचित समय पर प्रयोग अत्यंत आवश्यक है:

1. **मुख्य पोषक तत्व (NPK):**
   - **नाइट्रोजन (Urea 46% N):** वानस्पतिक बढ़वार और हरियाली के लिए। हमेशा 2 से 3 किस्तों में दें (1/3 बुवाई के समय, 1/3 कल्ले निकलते समय, 1/3 फूल आने से पहले)। नीम कोटेड यूरिया ही प्रयोग करें।
   - **फास्फोरस (DAP 18:46:0 या SSP 16% P):** मजबूत जड़ों के विकास और कल्ले फूटने के लिए। हमेशा बुवाई के समय कतारों में बीज से 3-5 सेमी नीचे दें।
   - **पोटैशियम (MOP 60% K2O):** दानों की चमक, वजन, सूखा व रोग रोधी क्षमता बढ़ाने हेतु।

2. **नैनो यूरिया व नैनो डीएपी (IFFCO Nano Fertilizers):**
   - **खुराक:** 2 से 4 मिली प्रति लीटर पानी (250-500 मिली प्रति एकड़)।
   - **छिड़काव समय:** पहला छिड़काव बुवाई के 30-35 दिन बाद (शाखाएं/कल्ले निकलते समय) और दूसरा छिड़काव फूल आने से 15 दिन पहले।
   - **लाभ:** 80-90% अवशोषण क्षमता, पत्तियों द्वारा सीधा प्रवेश, मिट्टी में प्रदूषण नहीं, और पारंपरिक यूरिया की 1 बोरी की बचत!

3. **सूक्ष्म पोषक तत्व (Micronutrients):**
   - **जिंक सल्फेट (Zinc Sulphate 21%):** धान में खैरा रोग और मक्का में सफेद कली की रोकथाम हेतु 10 किग्रा प्रति एकड़ बेसल डोज।
   - **सल्फर (Bentonite Sulphur 90%):** सरसों, सोयाबीन व मूंगफली में तेल की मात्रा और दालों में प्रोटीन बढ़ाने हेतु 10-15 किग्रा/एकड़।
   - **बोरॉन (Solubor 20%):** फूल झड़ने से रोकने और दानों के भराव के लिए 1 ग्राम प्रति लीटर पानी का छिड़काव।

उर्वरक खरीदने के लिए [Visit Agri Marketplace](/user/agri-marketplace) देखें या खेत की सटीक आवश्यकता जानने हेतु [Book Soil Test](/user/soil-testing) बुक करें।${signOff}`;
}

/**
 * Irrigation Intent
 */
function handleIrrigationIntent(lang, greeting, signOff) {
  return `${greeting}

💧 **आधुनिक सिंचाई एवं जल संरक्षण प्रबंधन:**

1. **टपक सिंचाई (Drip Irrigation) के फायदे:**
   - पारंपरिक बाढ़ सिंचाई की तुलना में **50% से 70% पानी की बचत**।
   - फसलों की पैदावार में 25% से 45% की वृद्धि क्योंकि पौधों की जड़ों में निरंतर इष्टतम नमी बनी रहती है।
   - फर्टिगेशन (Fertigation) के जरिए घुलनशील खाद सीधे ड्रिप से देने पर खाद की उपयोग दक्षता 85% से अधिक हो जाती है।
   - सरकारी योजना (PMKSY) के तहत ड्रिप लगाने पर 45% से 55% तक की सब्सिडी मिलती है।

2. **फव्वारा सिंचाई (Sprinkler Irrigation):**
   - ऊबड़-खाबड़ और रेतीली जमीन के लिए सर्वोत्तम। गेहूं, सरसों, चना और मूंगफली के लिए आदर्श। 30-40% पानी की बचत।

3. **लेजर लैंड लेवलर (Laser Land Leveler):**
   - खेत को लेजर किरण तकनीक से पूरी तरह समतल करने पर 20-25% सिंचाई जल की बचत होती है और बीज का जमाव 95% से अधिक एकसमान होता है।
   - GrooAgri से लेजर लेवलर किराए पर लेने के लिए [Rent Farm Machinery](/user/machinery-explorer) पर जाएं।

4. **फसलों की महत्वपूर्ण जल क्रांति अवस्थाएं (Critical Stages):**
   - **गेहूं:** पहली सिंचाई क्राउन रूट इनिशिएशन (CRI) 20-25 दिन पर सबसे महत्वपूर्ण! इसके बाद कल्ले निकलते समय (40-45 दिन), फूल आने पर (80-85 दिन)।
   - **धान:** कल्ले निकलते समय, बाली बनते समय और दाना भरते समय खेत में पर्याप्त नमी अनिवार्य है।${signOff}`;
}

/**
 * Livestock & Dairy Intent
 */
function handleLivestockIntent(lang, greeting, signOff) {
  return `${greeting}

🐄 **उन्नत डेयरी व पशुपालन प्रबंधन (Dairy & Livestock Management):**

1. **उच्च दुग्ध उत्पादक नस्लें:**
   - **देसी गाय:** गिर (Gir - गुजरात, 2,500-3,500 लीटर दूध/ब्यात, रोग प्रतिरोधी), साहीवाल (Sahiwal - पंजाब/हरियाणा, मीठा A2 दूध), थारपारकर, राठी।
   - **भैंस:** मुर्रा (Murrah - हरियाणा, उच्च दूध व 7-8% फैट, 2,500-3,500 लीटर प्रति ब्यात), मेहसाणा, जाफराबादी।

2. **संतुलित आहार व दूध उत्पादन बढ़ाना (TMR):**
   - एक दुधारू पशु को प्रतिदिन: **25-30 किग्रा हरा चारा** + **5-7 किग्रा सूखा चारा (भूसा)** + प्रति 2.5-3 लीटर दूध पर **1 किग्रा संतुलित दाना/पशु आहार** देना चाहिए।
   - प्रतिदिन **50 ग्राम मिनरल मिक्सचर (खनिज मिश्रण)** और 30 ग्राम सादा नमक जरूर खिलाएं।
   - भरपूर स्वच्छ पीने का पानी (60-80 लीटर प्रतिदिन)।

3. **पौष्टिक हरा चारा व साइलेज (Silage):**
   - **नेपियर घास (Super Napier / Hybrid Napier):** साल भर 150-200 टन प्रति एकड़ हरा चारा देती है।
   - **बरसीम ও ल्यूसर्न:** सर्दियों का प्रोटीन युक्त सर्वोत्तम चारा।
   - **साइलेज (गड्ढे में दबाकर सुरक्षित चारा):** हरी मक्का को दूधिया अवस्था में काटकर हवा-रहित गड्ढे या साइलेज बैग में 45 दिन किण्वित करके 2 साल तक के लिए पौष्टिक चारा सुरक्षित किया जा सकता है।

4. **टीकाकरण कैलेंडर (Vaccination Schedule):**
   - **खुरपका-मुंहपका (FMD):** वर्ष में दो बार (मई और नवंबर)।
   - **गलघोंटू (HS) व लंगड़ा बुखार (BQ):** मानसून आने से पहले (मई-जून)।
   - **पेट के कीड़ों की दवा (Deworming):** हर 3 से 4 महीने में एल्बेंडाजोल या फेनबेंडाजोल दें।

5. **KCC ऋण सुविधा:** पशुपालन व डेयरी के लिए भी किसान क्रेडिट कार्ड के तहत ₹2 लाख तक का ऋण केवल 4% ब्याज पर मिलता है।${signOff}`;
}

/**
 * Smart Farming & AgriTech Intent
 */
function handleSmartAgriTechIntent(lang, greeting, signOff) {
  return `${greeting}

🛰️ **स्मार्ट फार्मिंग, ड्रोन एवं आधुनिक एग्रीटेक (AgriTech):**

1. **कृषि ड्रोन (Agricultural Drone Sprayers):**
   - 10 से 16 लीटर क्षमता वाले ड्रोन से मात्र **7 से 10 मिनट में 1 एकड़** खेत में एकसमान नैनो यूरिया व कीटनाशक का छिड़काव होता है।
   - मैनुअल स्प्रेयर के 150-200 लीटर पानी की तुलना में केवल **8-10 लीटर पानी** लगता है (90% पानी की बचत)।
   - किसान को जहरीली दवाओं के सीधे संपर्क से मुक्ति मिलती है।
   - ड्रोन स्प्रेयर बुक करने के लिए [Rent Farm Machinery](/user/machinery-explorer) खोलें।

2. **मल्टीस्पेक्ट्रल इमेजिंग व सैटेलाइट NDVI:**
   - ड्रोन व उपग्रह से खेत का स्वास्थ्य सूचकांक (NDVI) तैयार कर फसल में नाइट्रोजन की कमी, जल संकट या कीटों का प्रकोप 7-10 दिन पहले पहचान लिया जाता है।

3. **IoT मृदा सेंसर व ऑटोमेशन:**
   - जमीन में दबे वायरलेस नमी सेंसर खेत में नमी कम होने पर अपने आप ड्रिप वाल्व चालू कर देते हैं और नमी पूरी होते ही मोटर बंद कर देते हैं। बिजली व पानी दोनों की भारी बचत होती है।

4. **पॉलीहाउस व संरक्षित खेती (Protected Cultivation):**
   - नियंत्रित वातावरण वाले पॉलीहाउस में रंगीन शिमला मिर्च, चेरी टमाटर, खीरा व जरबेरा की 4-5 गुना अधिक पैदावार होती है। राष्ट्रीय बागवानी मिशन (MIDH) के तहत पॉलीहाउस निर्माण पर 50% तक सरकारी सब्सिडी मिलती है।${signOff}`;
}

/**
 * Crop Cultivation Intent
 */
function handleCropCultivationIntent(lang, greeting, signOff, userMessage) {
  const msg = userMessage.toLowerCase();
  let cropName = "फसल";
  let tips = "";

  if (msg.includes('gehun') || msg.includes('wheat') || msg.includes('गेहूं') || msg.includes('கோதுமை') || msg.includes('گندم')) {
    cropName = "गेहूं (Wheat)";
    tips = `
- **बुवाई का सही समय:** 1 से 20 नवंबर। बीज दर: 40-50 किग्रा/एकड़।
- **बीजोपचार:** थीरम 2 ग्राम + कार्बेन्डाजिम 1 ग्राम प्रति किग्रा बीज।
- **सिंचाई:** पहली सिंचाई क्राउन रूट (CRI - 20-25 दिन) पर अनिवार्य।
- **उर्वरक:** 60 किग्रा नाइट्रोजन, 25 किग्रा फास्फोरस, 16 किग्रा पोटाश प्रति एकड़।
- **पीली कुंगी से बचाव:** प्रोपिकोनाजोल 25% EC @ 1 मिली प्रति लीटर पानी।`;
  } else if (msg.includes('dhan') || msg.includes('paddy') || msg.includes('rice') || msg.includes('धान') || msg.includes('వరి') || msg.includes('ನೆಲ್ಲ್') || msg.includes('دھان')) {
    cropName = "धान (Paddy/Rice)";
    tips = `
- **रोपाई:** 21-25 दिन के स्वस्थ पौधे। 2 पौधे प्रति थान (20x15 सेमी दूरी)।
- **जिंक की आपूर्ति:** खैरा रोग से बचाव के लिए 10 किग्रा जिंक सल्फेट 21% बेसल डोज में अवश्य डालें।
- **तना छेदक (Stem Borer):** कारटैप हाइड्रोक्लोराइड 4G @ 7-8 किग्रा/एकड़ या कोराजन 0.3 मिली/लीटर।
- **जल प्रबंधन:** कल्ले निकलते समय और बाली निकलते समय 3-5 सेमी पानी बनाए रखें।`;
  } else if (msg.includes('sarson') || msg.includes('mustard') || msg.includes('सरसों')) {
    cropName = "सरसों (Mustard)";
    tips = `
- **बुवाई समय:** 10 से 25 अक्टूबर। बीज दर: 1.5-2 किग्रा/एकड़।
- **सल्फर का महत्व:** तेल की मात्रा बढ़ाने के लिए 10-15 किग्रा बेंटोनाइट सल्फर 90% जरूर डालें।
- **माहू (चेपा/Aphid) नियंत्रण:** थियामेथोक्सम 25% WG @ 0.5 ग्राम प्रति लीटर पानी का छिड़काव करें।`;
  } else {
    cropName = "प्रमुख फसल प्रबंधन";
    tips = `
- प्रमाणित उच्च उपज वाले बीजों का चयन करें और बीजोपचार अवश्य करें।
- मिट्टी जांच रिपोर्ट के आधार पर ही संतुलित N:P:K और सूक्ष्म पोषक तत्व डालें।
- कीट व रोगों की नियमित निगरानी करें और जैविक कीटनाशकों को प्राथमिकता दें।`;
  }

  return `${greeting}

🌾 **${cropName} की वैज्ञानिक खेती सलाह:**
${tips}

खेत की उर्वरता परखने के लिए [Book Soil Test](/user/soil-testing) बुक करें, गुणवत्तापूर्ण बीज व खाद के लिए [Visit Agri Marketplace](/user/agri-marketplace) देखें, और बुवाई/कटाई के लिए [Rent Farm Machinery](/user/machinery-explorer) से मशीनरी किराए पर लें।${signOff}`;
}

/**
 * Open-ended agronomic fallback when query is not matched
 * (Ensures the chatbot NEVER returns an unknown error)
 */
function handleComprehensiveOpenFallback(lang, greeting, signOff, userMessage) {
  return `${greeting}

कृषि और ग्रामीण समृद्धि के लिए वैज्ञानिक दृष्टिकोण अपनाना सबसे लाभकारी है। आपके सवाल के संदर्भ में मुख्य कृषि परामर्श इस प्रकार है:

🌾 **सफल खेती के 5 मुख्य वैज्ञानिक स्तंभ:**
1. **मिट्टी की जांच व सुधार:** खेत की मिट्टी का pH, जैविक कार्बन और पोषक तत्व स्तर जानने के लिए हर 2 वर्ष में परीक्षण कराएं। इसके लिए GrooAgri ऐप पर [Book Soil Test](/user/soil-testing) बुक करें।
2. **प्रमाणित बीज व बीजोपचार:** हमेशा अनुशंसित किस्में बोएं और फफूंद जनित रोगों से सुरक्षा के लिए ट्राइकोडर्मा विरिडी या थीरम से बीजोपचार करें। [Visit Agri Marketplace](/user/agri-marketplace) से गुणवत्तापूर्ण बीज प्राप्त करें।
3. **संतुलित पोषक तत्व प्रबंधन:** केवल यूरिया पर निर्भर न रहें। N:P:K के साथ जिंक, सल्फर और नैनो यूरिया का सही अनुपात में प्रयोग करें।
4. **जल दक्षता एवं ड्रिप तकनीक:** बूंद-बूंद सिंचाई (ड्रिप) अपनाएं, जिससे 50-70% पानी की बचत होती है और फसल को लगातार नमी मिलती है।
5. **एकीकृत कीट व रोग प्रबंधन (IPM):** रासायनिक दवाओं से पहले नीम तेल, फेरोमोन ट्रैप और मित्र कीटों का प्रयोग करें।

🚜 **GrooAgri उपयोगी सेवाएं:**
- आधुनिक कृषि मशीनरी व ड्रोन किराया: [Rent Farm Machinery](/user/machinery-explorer)
- प्रमाणित बीज, खाद व कीटनाशक: [Visit Agri Marketplace](/user/agri-marketplace)
- दैनिक मौसम एवं स्प्रे अलर्ट: [Weather Report](/user/weather)
- किसी भी समस्या पर सहायता: [Help & Support](/user/help-support)

💬 *यदि आपके पास किसी विशिष्ट फसल, कीट या लक्षण के बारे में सवाल है, तो कृपया फसल का नाम और लक्षण लिखकर पूछें!*${signOff}`;
}

module.exports = {
  detectLanguage,
  generateFallbackResponse,
  SCRIPT_DETECTION_RULES,
  GREETINGS,
  SIGN_OFFS
};
