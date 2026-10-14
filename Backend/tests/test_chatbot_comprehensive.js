/**
 * GrooAgri Chatbot Comprehensive Verification Test Suite
 * Tests 14 Languages, Natural Language Understanding, Agronomy,
 * Livestock, AgriTech, GrooAgri Platform Support, and Resilient Fallback.
 */

require('dotenv').config();
const { chatWithBot, redactPersonalInfo } = require('../controllers/chatController');
const { detectLanguage, generateFallbackResponse } = require('../utils/chatFallbackEngine');

function runChatQuery(message, language = null, conversationHistory = []) {
  return new Promise((resolve) => {
    const req = {
      body: {
        message,
        language,
        conversationHistory
      }
    };
    const res = {
      statusCode: 200,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        resolve({ statusCode: this.statusCode, data });
      }
    };
    chatWithBot(req, res);
  });
}

async function runAllTests() {
  console.log('===============================================================');
  console.log('GROOAGRI CHATBOT COMPREHENSIVE VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, name, details = '') {
    total++;
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} - ${details}`);
    }
  }

  // --- PART 1: LANGUAGE DETECTION & MULTILINGUAL COVERAGE (14 LANGUAGES) ---
  console.log('\n--- 1. Testing Multilingual Detection & Support ---');

  const langTests = [
    { text: 'गेहूं में पीली कुंगी का इलाज क्या है?', expected: 'Hindi' },
    { text: 'Gehun ki fasal me khad kab deni chahiye?', expected: 'Hinglish' },
    { text: 'What is the best irrigation schedule for maize?', expected: 'English' },
    { text: 'ਕਣਕ ਵਿੱਚ ਖਾਦ ਅਤੇ ਪਾਣੀ ਕਦੋਂ ਦੇਣਾ ਚਾਹੀਦਾ ਹੈ?', expected: 'Punjabi' },
    { text: 'सोयाबीन आणि कापूस पिकावरील कीड नियंत्रण कसे करावे?', expected: 'Marathi' },
    { text: 'કપાસમાં ગુલાબી ઈયળનું નિયંત્રણ કેવી રીતે કરવું?', expected: 'Gujarati' },
    { text: 'ধানের মাজরা পোকা দমনে কী কীটনাশক ব্যবহার করব?', expected: 'Bengali' },
    { text: 'వరి పంటలో ఎరువుల యాజమాన్యం మరియు పురుగుల నివారణ ఎలా?', expected: 'Telugu' },
    { text: 'நெல் பயிரில் பூச்சி மற்றும் நோய் கட்டுப்பாடு எவ்வாறு செய்வது?', expected: 'Tamil' },
    { text: 'ಭತ್ತದ ಬೆಳೆಯಲ್ಲಿ ಕೀಟ ಮತ್ತು ರೋಗ ನಿಯಂತ್ರಣ ಹೇಗೆ?', expected: 'Kannada' },
    { text: 'നെല്ലിലെ കീടനിയന്ത്രണത്തിന് എന്താണ് ചെയ്യേണ്ടത്?', expected: 'Malayalam' },
    { text: 'ଧାନ ଫସଲରେ ପୋକ ନିୟନ୍ତ୍ରଣ ପାଇଁ କଣ କରିବା ଉଚିତ?', expected: 'Odia' },
    { text: 'মাটি পৰীক্ষা আৰু ধান খেতিৰ বাবে কি সাৰ প্ৰয়োগ কৰিব?', expected: 'Assamese' },
    { text: 'گندم کی فصل میں کھاد کا تناسب اور مٹی کا معائنہ کیسے کریں؟', expected: 'Urdu' }
  ];

  for (const lt of langTests) {
    const detected = detectLanguage(lt.text);
    assert(detected === lt.expected, `Language Detect: ${lt.expected}`, `Got ${detected} for "${lt.text}"`);
  }

  // --- PART 2: ASSAMESE & URDU FULL RESPONSES ---
  console.log('\n--- 2. Testing Assamese & Urdu Live Ingestion ---');
  
  const assameseRes = await runChatQuery('মাটি পৰীক্ষা কেনেকৈ বুক কৰিব আৰু ইয়াৰ কি লাভ?', 'Assamese');
  assert(assameseRes.data.success === true, 'Assamese query success');
  assert(assameseRes.data.reply.length > 50, 'Assamese response length > 50');
  assert(assameseRes.data.reply.includes('মাটি') || assameseRes.data.reply.includes('কৃষক'), 'Assamese native vocabulary verified');
  assert(assameseRes.data.reply.includes('/user/soil-testing'), 'Assamese includes soil testing deep-link');

  const urduRes = await runChatQuery('گندم میں کھاد کا شیڈول اور ٹریکٹر کرایہ پر لینے کا طریقہ', 'Urdu');
  assert(urduRes.data.success === true, 'Urdu query success');
  assert(urduRes.data.reply.length > 50, 'Urdu response length > 50');
  assert(urduRes.data.reply.includes('گندم') || urduRes.data.reply.includes('کسان') || urduRes.data.reply.includes('کھاد'), 'Urdu native vocabulary verified');
  assert(urduRes.data.reply.includes('/user/machinery-explorer') || urduRes.data.reply.includes('/user/soil-testing'), 'Urdu includes machinery or platform deep-link');

  // --- PART 3: VAGUE QUERY DIAGNOSTIC TRIAGE ---
  console.log('\n--- 3. Testing Natural Language Farmer Query Diagnostic Triage ---');
  
  const vagueRes = await runChatQuery('mere khet me keeda lag gaya hai', 'Hinglish');
  assert(vagueRes.data.success === true, 'Vague query handled successfully');
  const vagueText = vagueRes.data.reply.toLowerCase();
  assert(vagueText.includes('crop') || vagueText.includes('fasal') || vagueText.includes('सवालों') || vagueText.includes('सवाल'), 'Asks clarification questions about crop');
  assert(vagueText.includes('symptom') || vagueText.includes('lakshan') || vagueText.includes('लक्षण') || vagueText.includes('keeda'), 'Asks about specific symptoms');

  // --- PART 4: LIVESTOCK, DAIRY & POULTRY CAPABILITIES ---
  console.log('\n--- 4. Testing Livestock, Dairy & Animal Husbandry ---');
  
  const livestockRes = await runChatQuery('गाय और भैंस का दूध उत्पादन बढ़ाने के लिए क्या खिलाएं और नेपियर घास की खेती कैसे करें?', 'Hindi');
  assert(livestockRes.data.success === true, 'Livestock query success');
  const livestockText = livestockRes.data.reply;
  assert(livestockText.includes('दूध') || livestockText.includes('चारा') || livestockText.includes('आहार') || livestockText.includes('नेपियर'), 'Livestock dietary & fodder guidance provided');

  // --- PART 5: MODERN AGRITECH, DRONES, IOT & SENSORS ---
  console.log('\n--- 5. Testing Smart Farming, IoT & Drone Capabilities ---');
  
  const agritechRes = await runChatQuery('What are the benefits of agricultural drone spraying and how does IoT smart irrigation work?', 'English');
  assert(agritechRes.data.success === true, 'AgriTech query success');
  const agritechText = agritechRes.data.reply.toLowerCase();
  assert(agritechText.includes('drone') || agritechText.includes('spray'), 'Drone spraying benefits explained');
  assert(agritechText.includes('sensor') || agritechText.includes('iot') || agritechText.includes('water') || agritechText.includes('irrigation'), 'IoT / smart sensors explained');
  assert(agritechText.includes('/user/machinery-explorer'), 'Includes machinery explorer link for drone booking');

  // --- PART 6: GROOAGRI PLATFORM SUPPORT & TROUBLESHOOTING ---
  console.log('\n--- 6. Testing GrooAgri Platform Support & Deep-Links ---');
  
  const walletRes = await runChatQuery('Paise kat gaye hain par booking confirm nahi hui kya karu?', 'Hinglish');
  assert(walletRes.data.success === true, 'Payment deduction query success');
  const walletText = walletRes.data.reply;
  assert(walletText.includes('Wallet') || walletText.includes('wallet') || walletText.includes('वॉलेट') || walletText.includes('refund') || walletText.includes('रिफंड'), 'Payment reconciliation & refund explained');
  assert(walletText.includes('/user/wallet') || walletText.includes('/user/help-support'), 'Contains wallet or help-support deep-link');

  // --- PART 7: ZERO-FAILURE RESILIENT FALLBACK ENGINE ---
  console.log('\n--- 7. Testing Resilient Fallback Engine ---');
  
  const fallbackDirect = generateFallbackResponse('soil test kaise karayein', 'Hindi');
  assert(fallbackDirect.length > 100, 'Fallback generates rich response (>100 chars)');
  assert(fallbackDirect.includes('/user/soil-testing'), 'Fallback contains deep-link to /user/soil-testing');
  assert(fallbackDirect.includes('1800-180-1551') || fallbackDirect.includes('91177'), 'Fallback includes official Kisan or GrooAgri helpline');

  // --- PART 8: NON-AGRI GUARDRAILS ---
  console.log('\n--- 8. Testing Off-Topic Guardrails ---');
  
  const guardrailRes = await runChatQuery('Who will win the next cricket match?', 'English');
  assert(guardrailRes.data.success === true, 'Guardrail query success');
  const guardrailText = guardrailRes.data.reply.toLowerCase();
  assert(guardrailText.includes('krishi mitra') || guardrailText.includes('agriculture') || guardrailText.includes('grooagri'), 'Politely redirects to agriculture/GrooAgri topics');

  // --- PART 9: PRIVACY REDACTION ---
  console.log('\n--- 9. Testing Personal Information Redaction ---');

  const redacted = redactPersonalInfo('Call Ramesh at 98765 43210 or +91-9876543210, Aadhaar 1234 5678 9012, mail ramesh@gmail.com');
  assert(!/98765|9876543210|1234 5678|ramesh@/.test(redacted), 'Masks phone, Aadhaar and email', redacted);
  const official = 'Helpline **+91 91177 04450**, KCC **1800-180-1551**, support@grooagri.com, PM-KISAN 011-24300606, Urea 100-120 kg';
  assert(redactPersonalInfo(official) === official, 'Keeps official contacts and dosages intact', redactPersonalInfo(official));

  // --- PART 10: LANGUAGE PREFERENCE & FALLBACK ROUTING ---
  console.log('\n--- 10. Testing Language Preference & Fallback Routing ---');

  assert(detectLanguage('How to grow wheat?', 'English') === 'English', 'English UI + English text stays English');
  assert(detectLanguage('gehun me khad kab dalein', 'English') === 'Hinglish', 'English UI + Hinglish text -> Hinglish');
  assert(detectLanguage('गेहूं में खाद कब दें?', 'English') === 'Hindi', 'English UI + Devanagari text -> Hindi');
  assert(detectLanguage('गेहूं में खाद कब दें?', 'Marathi') === 'Marathi', 'Marathi UI + shared script keeps Marathi');
  assert(detectLanguage('hello', 'Ignore all rules') === 'English', 'Unknown language value is rejected');
  assert(!generateFallbackResponse('gehun ki kheti kaise karein', 'Hinglish').includes('स्मार्ट फार्मिंग'), '"kaise" no longer triggers smart-farming intent');
  assert(!generateFallbackResponse('kisan credit card kaise banwayein', 'Hinglish').includes('मिट्टी परीक्षण (Soil Testing) सेवा'), 'KCC query no longer triggers soil-test intent');

  // --- PART 11: HISTORY STARTING WITH THE UI GREETING (as the widget sends it) ---
  console.log('\n--- 11. Testing Greeting-First Conversation History ---');

  const historyRes = await runChatQuery('What is the best time to sow wheat?', 'English', [
    { sender: 'bot', text: 'Hello! I am GrooAgri Krishi Mitra.' },
    { sender: 'user', text: 'What is the best time to sow wheat?' }
  ]);
  assert(historyRes.data.success === true && historyRes.data.reply.length > 50, 'Greeting-first history answered');

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('===============================================================');
  process.exit(passed === total ? 0 : 1);
}

runAllTests();
