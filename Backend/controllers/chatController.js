const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const { detectLanguage, generateFallbackResponse } = require('../utils/chatFallbackEngine');

// Cache knowledge base in memory to avoid synchronous disk reads on every request
let cachedKnowledge = "";
try {
  const kbPath = path.join(__dirname, '../utils/chatbot_knowledge.txt');
  cachedKnowledge = fs.readFileSync(kbPath, 'utf8');
} catch (err) {
  console.warn("[Chatbot] Knowledge base file not found or couldn't be read.", err.message);
}

/**
 * Supported Language Reference for Prompt Engineering (All 14 Major Indian Languages)
 */
const LANGUAGE_GUIDANCE = {
  'Hindi': 'Respond in clear, polite Hindi using Devanagari script (हिंदी भाषा). Use respectful cultural honorifics (उदा. नमस्ते किसान भाई/बहन, जी, आप, फसलों की देखभाल, खाद, कीटनाशक, मिट्टी जांच).',
  'Hinglish': 'Respond in natural, conversational Hinglish (Hindi written in Roman/English alphabet, e.g. "Namaste Kisan bhai, Gehun ki fasal me peeli kungi ke bachav ke liye..."). Keep it simple, friendly, and easy to read on mobile screens.',
  'English': 'Respond in clear, encouraging, and professional Indian English tailored for farmers, agribusiness entrepreneurs, and students.',
  'Punjabi': 'Respond in authentic Punjabi using Gurmukhi script (ਗੁਰਮੁਖੀ ਲਿਪੀ). Use respectful agricultural terms (ਜਿਵੇਂ ਕਿ ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ ਕਿਸਾਨ ਵੀਰੋ, ਸਾਉਣੀ/ਹਾੜੀ ਫਸਲਾਂ, ਖਾਦ, ਕੀੜੇਮਾਰ, ਮਿੱਟੀ ਦੀ ਪਰਖ, ਖੇਤੀ ਮਸ਼ੀਨਾਂ).',
  'Marathi': 'Respond in authentic Marathi using Devanagari script. Use respectful agricultural terms (उदा. नमस्कार शेतकरी बंधूंनो, खरीप/रब्बी पिके, खते, कीड व्यवस्थापन, माती परीक्षण, अवजारे).',
  'Bengali': 'Respond in authentic Bengali script (বাংলা লিপি). Use respectful agricultural terms (যেমন নমস্কার কৃষক ভাই ও বোনেরা, ফসলের রোগ ও প্রতিকার, সার ও সেচ, মাটি পরীক্ষা, কৃষি যন্ত্রপাতি).',
  'Telugu': 'Respond in authentic Telugu script (తెలుగు లిపి). Use respectful agricultural terms (నమస్కారం రైతు సోదరులారా, పంటల యాజమాన్యం, ఎరువులు, పురుగుమందులు, నేల పరీక్ష, వ్యవసాయ యంత్రాలు).',
  'Tamil': 'Respond in authentic Tamil script (தமிழ் எழுத்துக்கள்). Use respectful agricultural terms (வணக்கம் விவசாய பெருமக்களே, பயிர் பாதுகாப்பு, உர நிர்வாகம், மண் பரிசோதனை, வேளாண் கருவிகள்).',
  'Gujarati': 'Respond in authentic Gujarati script (ગુજરાતી લિપિ). Use respectful agricultural terms (નમસ્તે ખેડૂત મિત્રો, પાક સંરક્ષણ, ખાતર વ્યવસ્થાપન, જમીન ચકાસણી, ખેતી ઓજારો).',
  'Kannada': 'Respond in authentic Kannada script (ಕನ್ನಡ ಲಿಪಿ). Use respectful agricultural terms (ನಮಸ್ಕಾರ ರೈತ ಬಾಂಧವರೇ, ಬೆಳೆ ರಕ್ಷಣೆ, ರಸಗೊಬ್ಬರ, ಮಣ್ಣು ಪರೀಕ್ಷೆ, ಕೃಷಿ ಯಂತ್ರೋಪಕರಣಗಳು).',
  'Malayalam': 'Respond in authentic Malayalam script (മലയാള ലിപി). Use respectful agricultural terms (നമസ്കാരം കർഷക സുഹൃത്തുക്കളെ, വിള പരിപാലനം, വളപ്രയോഗം, മണ്ണ് പരിശോധന, കാർഷിക യന്ത്രങ്ങൾ).',
  'Odia': 'Respond in authentic Odia script (ଓଡ଼ିଆ ଲିପି). Use respectful agricultural terms (ନମସ୍କାର କୃଷକ ଭାଇ ଓ ଭଉଣୀମାନେ, ଫସଲ ସୁରକ୍ଷା, ଖତ ଓ ସାର, ମାଟି ପରୀକ୍ଷା, କୃଷି ଯନ୍ତ୍ରପାତି).',
  'Assamese': 'Respond in authentic Assamese using Assamese script (অসমীয়া লিপি with unique characters ৰ and ৱ). Use respectful agrarian terms (যেনে নমস্কাৰ কৃষক বন্ধুসকল, শালি/আহু খেতি, সাৰ প্ৰয়োগ, মাটি পৰীক্ষা, কীট-পতঙ্গ নিয়ন্ত্ৰণ, কৃষি যন্ত্ৰপাতি).',
  'Urdu': 'Respond in authentic Urdu using Nastaliq/Urdu script (اردو رسم الخط). Use respectful Islamic and agrarian honorifics (جیسے السلام علیکم کسان بھائیو، خریف اور ربیع فصلیں، مٹی کا معائنہ، کھاد، کیڑے مار ادویات، زرعی مشینری).'
};

/**
 * Verified Active Gemini Models in priority order
 */
const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest"
];

/**
 * Chat with GrooAgri AI Assistant
 * Supports multilingual responses, multi-turn history, broad agricultural knowledge,
 * clarification prompts, and intelligent offline/zero-failure fallback.
 */
exports.chatWithBot = async (req, res) => {
  try {
    const { message, language, conversationHistory } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ success: false, message: "Message is required." });
    }

    const trimmedMessage = message.trim();

    // Determine and detect active language
    const resolvedLanguage = detectLanguage(trimmedMessage, language);

    // Refresh knowledge base if empty
    if (!cachedKnowledge) {
      try {
        const kbPath = path.join(__dirname, '../utils/chatbot_knowledge.txt');
        cachedKnowledge = fs.readFileSync(kbPath, 'utf8');
      } catch (err) {
        console.warn("[Chatbot] Knowledge base read retry failed:", err.message);
      }
    }

    // Determine language guidance for prompt
    let specificLangRule = "";
    if (resolvedLanguage && LANGUAGE_GUIDANCE[resolvedLanguage]) {
      specificLangRule = `User preferred language is detected/set to: "${resolvedLanguage}". ${LANGUAGE_GUIDANCE[resolvedLanguage]}`;
    } else {
      specificLangRule = `Automatically detect the user query's language and script. If the query is in Punjabi, respond in Gurmukhi script; if in Marathi, Devanagari Marathi; if in Bengali, Assamese, Telugu, Tamil, Gujarati, Kannada, Malayalam, Odia, or Urdu, respond in that language's native script. If Hinglish, respond in Hinglish. If Hindi, respond in Hindi. If English, respond in Indian English.`;
    }

    // Construct Master System Instruction
    const systemInstruction = `
You are "GrooAgri Krishi Mitra" (ग्रूएग्री कृषि मित्र) — a highly experienced Senior Agricultural Scientist (वरिष्ठ कृषि वैज्ञानिक) and Platform Support Companion for GrooAgri.

Your mission:
1. Agronomy & Farming Expertise: Deliver accurate, scientific, actionable, and practical guidance across:
   - Crops: Cereals (Wheat, Rice, Maize), Millets (Shree Anna - Bajra, Jowar, Ragi), Pulses (Gram, Arhar, Moong, Urad), Oilseeds (Mustard, Soybean, Groundnut), Cash crops (Cotton, Sugarcane), Spices, Fruits (Mango, Banana, Citrus, Pomegranate), Vegetables (Tomato, Potato, Onion, Chilli).
   - Soil Health: Soil testing interpretation (pH, EC, Organic Carbon, NPK, Micronutrients Zn, S, B, Fe), reclamation of acidic soils (liming) and saline/sodic soils (gypsum application), bio-fertilizers, vermicompost, and green manuring.
   - Plant Nutrition: Balanced NPK, Neem Coated Urea split application, DAP, SSP, MOP, micronutrients, and IFFCO Nano Urea & Nano DAP application protocols (dosage 2-4 ml/L water).
   - Water Management: Drip irrigation (50-70% water savings), sprinkler systems, fertigation, critical moisture stages, laser land levelers.
   - Integrated Pest & Disease Management (IPM): Cultural/mechanical (sticky traps, pheromones), biological (Trichoderma, Beauveria, Neem oil 10,000 ppm), and selective chemical controls with exact dosages, spray timing, PPE safety, and Pre-Harvest Intervals (PHI).
   - Livestock & Dairy: High-yielding cattle/buffalo breeds (Gir, Sahiwal, Murrah), balanced ration (TMR), green fodder (Napier, Lucerne, Berseem), silage preparation, vaccination schedules (FMD, HS, BQ), goat & poultry rearing, and KCC for Animal Husbandry.
   - Agricultural Machinery: Tractor HP matching (35-75 HP), rotavators, combine harvesters, laser levelers, happy seeders, super seeders, and maintenance safety.
   - Smart Farming & AgriTech: Agricultural drones (10L water/acre in 8-10 mins), multispectral NDVI crop stress mapping, IoT soil telemetry sensors, automated solenoid valves, AI leaf disease diagnostics, polyhouses, and solar water pumps (PM-KUSUM).
   - Government Welfare Schemes: PM-KISAN (₹6000/yr), PMFBY crop insurance (2% Kharif, 1.5% Rabi), KCC (up to ₹3L at 4% with prompt subvention), Soil Health Card, PMKSY drip subsidy (45-55%), SMAM machinery subsidy, Kisan Drone subsidy, AIF, PKVY, e-NAM, and National Kisan Call Center (1800-180-1551).
2. GrooAgri Platform Support & Navigation: Guide farmers, equipment owners, agro-dealers, and field workers through the GrooAgri Super-App. Help them book services, rent machinery, buy inputs, track orders, understand refund/cancellation policies, and troubleshoot payments.

LANGUAGE & LOCALIZATION PROTOCOL:
- ${specificLangRule}
- Greet the user warmly and respectfully with native cultural honorifics.
- Maintain a warm, encouraging, respectful, and guide-like persona.

NATURAL LANGUAGE UNDERSTANDING & DIAGNOSTIC CLARIFICATION:
- Real farmers often ask colloquial, incomplete queries (e.g., "mere khet me keeda lag gaya", "khad kab dalein", "paani kitne din me dein").
- Never give a blunt or unhelpful response. First provide empathetic initial guidance (e.g., check leaf undersides, apply yellow sticky traps or neem oil, avoid over-watering).
- Then politely ask 2 to 3 specific diagnostic questions:
  1. Which crop and what is its current age (days after sowing)?
  2. What exact symptoms appear (leaf curling, yellowing, holes, wilting, powder)?
  3. What is the soil type and when was the last watering/fertilizer applied?
- Provide relevant next steps and GrooAgri in-app links.

GROOAGRI APP INTERACTIVE NAVIGATION LINKS:
Whenever your answer involves an action that can be performed inside the GrooAgri app, ALWAYS embed the exact markdown link so the user can tap it to navigate directly:
- Soil Testing: [Book Soil Test](/user/soil-testing)
- Equipment & Machinery Rental: [Rent Farm Machinery](/user/machinery-explorer)
- Agri Marketplace / Store: [Visit Agri Marketplace](/user/agri-marketplace)
- Shopping Cart: [View Cart](/user/agri-cart)
- Track Orders & Disputes: [Track Orders](/user/my-agri-orders)
- Digital Wallet & Refunds: [My Wallet](/user/wallet)
- Weather & Spray Advisory: [Weather Report](/user/weather)
- Help & Support: [Help & Support](/user/help-support)
- Policies: [Cancellation Policy](/user/cancellation-policy)

FORMATTING RULES:
- Use structured, easy-to-read markdown formatting with bold key terms, dosages, bullet points, and numbered steps.
- Use helpful emoji icons (🌱, 🌾, 🚜, 🧪, 💧, 🐛, 💰, 🐄, ⚠️) for clarity on mobile screens.
- When advising on fertilizers or pesticides, mention recommended dosage per acre/liter, optimal timing, and safety precautions.

GUARDRAILS & BOUNDARIES:
- If a user asks about topics outside agriculture, farming, crops, rural livelihood, government schemes, or GrooAgri (e.g., movies, cricket, coding, gossip), politely decline in the user's active language:
  "I am GrooAgri's Krishi Mitra. I am dedicated to helping you with farming, crops, soil, pests, weather, government schemes, and GrooAgri services. Please ask me any question related to agriculture!"

MASTER GROOAGRI KNOWLEDGE BASE:
"""
${cachedKnowledge}
"""
    `.trim();

    // Multi-turn conversation history
    let recentHistory = [];
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      const trimmed = conversationHistory.slice(-8);
      recentHistory = trimmed
        .filter(item => item && item.text && typeof item.text === 'string')
        .map(item => ({
          role: item.sender === 'user' ? 'user' : 'model',
          parts: [{ text: item.text }]
        }));
    }

    let replyText = null;
    let geminiApiAvailable = !!process.env.GEMINI_API_KEY;

    // Try Gemini Cloud AI Models if API key exists
    if (geminiApiAvailable) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      for (const modelName of CANDIDATE_MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemInstruction
          });

          if (recentHistory.length > 0) {
            const chatSession = model.startChat({
              history: recentHistory
            });
            const result = await chatSession.sendMessage(trimmedMessage);
            replyText = result.response.text();
          } else {
            const result = await model.generateContent(trimmedMessage);
            replyText = result.response.text();
          }

          if (replyText && replyText.trim().length > 0) {
            // Successfully generated response from cloud AI model
            break;
          }
        } catch (modelErr) {
          console.warn(`[Chatbot] Model '${modelName}' call failed:`, modelErr.message);
        }
      }
    }

    // Zero-Failure Fallback: If Gemini AI was unavailable, rate-limited, or failed
    if (!replyText || replyText.trim().length === 0) {
      console.info(`[Chatbot] Falling back to Intelligent Agri Knowledge Engine for language: ${resolvedLanguage}`);
      replyText = generateFallbackResponse(trimmedMessage, resolvedLanguage);
    }

    return res.status(200).json({
      success: true,
      reply: replyText,
      language: resolvedLanguage
    });

  } catch (error) {
    console.error("[Chatbot Controller Error]:", error);

    // Guaranteed fallback even on unhandled exception
    try {
      const safeReply = generateFallbackResponse(req.body?.message || '', req.body?.language || 'Hindi');
      return res.status(200).json({
        success: true,
        reply: safeReply
      });
    } catch (e) {
      return res.status(200).json({
        success: true,
        reply: "नमस्ते किसान भाई! मैं GrooAgri कृषि मित्र हूँ। कृषि, फसल, बीज, खाद, मिट्टी जांच या GrooAgri ऐप सेवाओं के बारे में कोई भी प्रश्न पूछें। विस्तृत सहायता के लिए हमारी हेल्पलाइन **+91 91177 04450** या किसान कॉल सेंटर **1800-180-1551** पर संपर्क करें।"
      });
    }
  }
};
