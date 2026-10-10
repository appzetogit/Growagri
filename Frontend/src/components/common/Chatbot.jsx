import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { BsRobot } from 'react-icons/bs';
import { 
  IoClose, 
  IoSend, 
  IoMic, 
  IoMicOutline, 
  IoVolumeHighOutline, 
  IoVolumeMuteOutline, 
  IoRefreshOutline, 
  IoCopyOutline, 
  IoCheckmarkOutline,
  IoSparkles
} from 'react-icons/io5';
import { FiArrowUpRight, FiGlobe } from 'react-icons/fi';
import { useLanguage } from '../../context/LanguageContext';
import { getVoiceLocale } from '../../utils/languageUtils';

const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Localized Initial Greetings & Quick Prompts
 */
const LOCALIZED_CONTENT = {
  'English': {
    name: 'GrooAgri Krishi Mitra',
    tagline: 'AI Agriculture & Platform Assistant',
    greeting: "Hello! I am GrooAgri Krishi Mitra, your 24/7 AI agricultural scientist and platform guide. How can I assist you with your farming or GrooAgri services today?",
    inputPlaceholder: "Ask about crops, soil, pests, schemes, or GrooAgri...",
    chips: [
      { label: "🌾 Book Soil Test", query: "How do I book a soil test on GrooAgri and what are the benefits?" },
      { label: "🚜 Rent Machinery", query: "How to rent a tractor or drone sprayer on GrooAgri?" },
      { label: "🛒 Agri Marketplace", query: "What seeds and fertilizers can I buy from GrooAgri store?" },
      { label: "🐛 Pest Control Advice", query: "How to control aphids and sucking pests using organic and safe methods?" },
      { label: "💰 PM-KISAN Scheme", query: "Tell me about PM-KISAN scheme eligibility and benefits." },
      { label: "💧 Drip Irrigation Tips", query: "What are the benefits of drip irrigation and fertigation?" },
      { label: "🛠️ Wallet & Support", query: "How does the GrooAgri wallet work and how do I contact support?" }
    ]
  },
  'Hindi': {
    name: 'ग्रूएग्री कृषि मित्र',
    tagline: 'AI कृषि वैज्ञानिक एवं सहायता साथी',
    greeting: "नमस्ते किसान भाई/बहन! मैं GrooAgri का कृषि मित्र हूँ। फसल, बीज, खाद, मिट्टी की जांच, सरकारी योजनाओं या GrooAgri ऐप की सेवाओं के बारे में कोई भी सवाल पूछें!",
    inputPlaceholder: "फसल, खाद, कीट, योजना या GrooAgri के बारे में पूछें...",
    chips: [
      { label: "🌾 मिट्टी जांच कैसे करें?", query: "GrooAgri पर मिट्टी की जांच (Soil Test) कैसे बुक करें और इसकी क्या प्रक्रिया है?" },
      { label: "🚜 ट्रैक्टर/मशीन किराया", query: "GrooAgri से ट्रैक्टर या ड्रोन स्प्रेयर किराये पर कैसे लें?" },
      { label: "🛒 खाद और बीज खरीदारी", query: "GrooAgri की दुकान से प्रमाणित बीज और खाद कैसे खरीदें?" },
      { label: "🐛 कीट व रोग नियंत्रण", query: "फसलों में रस चूसक कीटों और फफूंद जनित रोगों की रोकथाम कैसे करें?" },
      { label: "💰 PM-KISAN सम्मान निधि", query: "प्रधानमंत्री किसान सम्मान निधि योजना के नियम और लाभ बताएं।" },
      { label: "💧 टपक (ड्रिप) सिंचाई", query: "ड्रिप सिंचाई के क्या फायदे हैं और इसपर क्या सरकारी सब्सिडी मिलती है?" },
      { label: "🛠️ वॉलेट व सहायता", query: "GrooAgri वॉलेट और ग्राहक सहायता से कैसे संपर्क करें?" }
    ]
  },
  'Hinglish': {
    name: 'GrooAgri Krishi Mitra',
    tagline: 'AI Agri Scientist & Support',
    greeting: "Namaste Kisan bhai! Main GrooAgri ka Krishi Mitra hoon. Fasal, beej, khad, mitti jaanch, government schemes ya GrooAgri app services ke baare me kuch bhi poochhein!",
    inputPlaceholder: "Fasal, khad, keet ya GrooAgri ke baare me likhein...",
    chips: [
      { label: "🌾 Soil Test Booking", query: "GrooAgri par Soil Test kaise book karein aur sample kaise collect hota hai?" },
      { label: "🚜 Machinery Rent", query: "GrooAgri se Tractor ya Drone spray machine rent par kaise lein?" },
      { label: "🛒 Seeds & Fertilizers", query: "GrooAgri store se hybrid seeds aur fertilizers kaise buy karein?" },
      { label: "🐛 Pest Control Advice", query: "Fasal me insect attack aur fungus rog ka best ilaaj kya hai?" },
      { label: "💰 PM-KISAN Details", query: "PM-KISAN scheme me 6000 rupees pane ke liye kya requirements hain?" },
      { label: "🛠️ Payment & Wallet", query: "Payment deduct hone par booking pending ho to kya karein?" }
    ]
  },
  'Punjabi': {
    name: 'ਗਰੂਐਗਰੀ ਕ੍ਰਿਸ਼ੀ ਮਿੱਤਰ',
    tagline: 'AI ਖੇਤੀ ਵਿਗਿਆਨੀ ਅਤੇ ਸਹਾਇਕ',
    greeting: "ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ ਕਿਸਾਨ ਵੀਰੋ! ਮੈਂ GrooAgri ਦਾ ਕ੍ਰਿਸ਼ੀ ਮਿੱਤਰ ਹਾਂ। ਫਸਲਾਂ ਦੀ ਦੇਖਭਾਲ, ਖਾਦ, ਕੀੜੇਮਾਰ, ਮਿੱਟੀ ਪਰਖ ਜਾਂ GrooAgri ਸੇਵਾਵਾਂ ਬਾਰੇ ਕੋਈ ਵੀ ਸਵਾਲ ਪੁੱਛੋ!",
    inputPlaceholder: "ਫਸਲ, ਖਾਦ, ਬਿਮਾਰੀਆਂ ਜਾਂ GrooAgri ਬਾਰੇ ਪੁੱਛੋ...",
    chips: [
      { label: "🌾 ਮਿੱਟੀ ਦੀ ਜਾਂਚ", query: "GrooAgri 'ਤੇ ਮਿੱਟੀ ਦੀ ਜਾਂਚ (Soil Test) ਕਿਵੇਂ ਬੁੱਕ ਕਰੀਏ?" },
      { label: "🚜 ਟਰੈਕਟਰ ਤੇ ਮਸ਼ੀਨਾਂ", query: "GrooAgri ਰਾਹੀਂ ਟਰੈਕਟਰ ਜਾਂ ਖੇਤੀ ਮਸ਼ੀਨਰੀ ਕਿਰਾਏ 'ਤੇ ਕਿਵੇਂ ਲਈਏ?" },
      { label: "🛒 ਬੀਜ ਅਤੇ ਖਾਦ", query: "GrooAgri ਸਟੋਰ ਤੋਂ ਉੱਤਮ ਕੁਆਲਿਟੀ ਬੀਜ ਅਤੇ ਖਾਦ ਕਿਵੇਂ ਖਰੀਦੀਏ?" },
      { label: "🐛 ਪੀਲੀ ਕੁੰਗੀ / ਕੀੜੇ ਰੋਕਥਾਮ", query: "ਕਣਕ ਵਿੱਚ ਪੀਲੀ ਕੁੰਗੀ ਅਤੇ ਸੁੰਡੀ ਦੀ ਰੋਕਥਾਮ ਦਾ ਸਹੀ ਤਰੀਕਾ ਕੀ ਹੈ?" },
      { label: "💰 PM-KISAN ਸਕੀਮ", query: "PM-KISAN ਯੋਜਨਾ ਦੇ ਲਾਭ ਅਤੇ ਸ਼ਰਤਾਂ ਕੀ ਹਨ?" }
    ]
  },
  'Marathi': {
    name: 'ग्रूएग्री कृषी मित्र',
    tagline: 'AI कृषी शास्त्रज्ञ आणि सहाय्यक',
    greeting: "नमस्कार शेतकरी बंधूंनो! मी GrooAgri चा कृषी मित्र आहे. पिके, खते, कीड व्यवस्थापन, माती परीक्षण किंवा GrooAgri च्या सेवांविषयी कोणताही प्रश्न विचारा!",
    inputPlaceholder: "पिके, खते, कीड नियंत्रण किंवा सेवांबद्दल विचारा...",
    chips: [
      { label: "🌾 माती परीक्षण बुकिंग", query: "GrooAgri वर माती परीक्षण (Soil Testing) कसे बुक करावे?" },
      { label: "🚜 ट्रॅक्टर व अवजारे भाड्याने", query: "GrooAgri वरून शेतीची अवजारे व ट्रॅक्टर भाड्याने कसे मिळवायचे?" },
      { label: "🛒 खते आणि बियाणे खरेदी", query: "GrooAgri अ‍ॅपवरून दर्जेदार बियाणे व खते कशी खरेदी करावीत?" },
      { label: "🐛 बोंडअळी व कीड नियंत्रण", query: "कापूस आणि सोयाबीन पिकावरील कीड व रोगांचे नियंत्रण कसे करावे?" },
      { label: "💰 पीएम किसान योजना", query: "पीएम किसान सन्मान निधी योजनेची संपूर्ण माहिती द्या." }
    ]
  },
  'Gujarati': {
    name: 'ગ્રૂએગ્રી કૃષિ મિત્ર',
    tagline: 'AI કૃષિ નિષ્ણાત અને સહાયક',
    greeting: "નમસ્તે ખેડૂત મિત્રો! હું GrooAgri કૃષિ મિત્ર છું. પાક સંરક્ષણ, ખાતર, જમીન ચકાસણી કે GrooAgri ની સેવાઓ વિશે કોઈ પણ પ્રશ્ન પૂછો!",
    inputPlaceholder: "પાક, ખાતર, દવાઓ કે GrooAgri વિશે પૂછો...",
    chips: [
      { label: "🌾 માટી પરીક્ષણ બુકિંગ", query: "GrooAgri પર સોઇલ ટેસ્ટિંગ કેવી રીતે બુક કરવું?" },
      { label: "🚜 ટ્રેક્ટર અને સાધનો ભાડે", query: "GrooAgri પરથી ટ્રેક્ટર કે ડ્રોન સ્પ્રેયર ભાડે કેવી રીતે મેળવવું?" },
      { label: "🛒 બિયારણ અને ખાતર", query: "GrooAgri સ્ટોર પરથી ગુણવત્તાયુક્ત બિયારણ અને ખાતર કેવી રીતે ખરીદવું?" },
      { label: "🐛 જીવાત અને રોગ નિયંત્રણ", query: "પાકમાં થતી જીવાતો અને ફગ રોગોનું નિયંત્રણ કેવી રીતે કરવું?" },
      { label: "💰 PM-KISAN યોજના", query: "પીએમ કિસાન યોજનાની વિગતો અને ફાયદા જણાવો." }
    ]
  },
  'Bengali': {
    name: 'গ্রুএগ্রি কৃষি মিত্র',
    tagline: 'AI কৃষি বিজ্ঞানী ও সহায়তা সহকারী',
    greeting: "নমস্কার কৃষক ভাইয়েরা! আমি GrooAgri-র কৃষি মিত্র। ফসল, সার, মাটি পরীক্ষা বা GrooAgri-র পরিষেবা সম্পর্কে যেকোনো প্রশ্ন জিজ্ঞাসা করুন!",
    inputPlaceholder: "ফসল, সার, রোগবালাই বা GrooAgri সম্পর্কে লিখুন...",
    chips: [
      { label: "🌾 মাটি পরীক্ষা বুকিং", query: "GrooAgri-তে মাটি পরীক্ষা (Soil Testing) কীভাবে বুক করব?" },
      { label: "🚜 কৃষি যন্ত্রপাতি ভাড়া", query: "GrooAgri থেকে ট্র্যাক্টর বা ড্রোন স্প্রেয়ার কীভাবে ভাড়া নেব?" },
      { label: "🛒 উন্নত বীজ ও সার", query: "GrooAgri স্টোর থেকে ভালো বীজ ও সার কীভাবে অর্ডার করব?" },
      { label: "🐛 পোকা ও রোগ দমন", query: "ধান ও শাকসবজির ক্ষতিকর পোকা ও রোগ কীভাবে নিয়ন্ত্রণ করব?" },
      { label: "💰 পিএম কিষাণ প্রকল্প", query: "প্রধানমন্ত্রী কিষাণ সম্মান নিধি প্রকল্পের নিয়ম ও সুবিধা কী কী?" }
    ]
  },
  'Telugu': {
    name: 'గ్రూఅగ్రి కృషి మిత్ర',
    tagline: 'AI వ్యవసాయ శాస్త్రవేత్త & సహాయకుడు',
    greeting: "నమస్కారం రైతు మిత్రులారా! నేను GrooAgri కృషి మిత్రుడిని. పంటలు, ఎరువులు, పురుగుమందులు, నేల పరీక్ష లేదా GrooAgri సేవల గురించి ఏమైనా అడగండి!",
    inputPlaceholder: "పంటలు, ఎరువులు లేదా GrooAgri సేవల గురించి అడగండి...",
    chips: [
      { label: "🌾 నేల పరీక్ష బుకింగ్", query: "GrooAgri లో నేల పరీక్ష (Soil Test) ఎలా బుక్ చేసుకోవాలి?" },
      { label: "🚜 ట్రాక్టర్ & యంత్రాలు అద్దెకు", query: "GrooAgri లో ట్రాక్టర్ లేదా డ్రోన్ స్ప్రేయర్ అద్దెకు ఎలా తీసుకోవాలి?" },
      { label: "🛒 విత్తనాలు & ఎరువులు", query: "GrooAgri మార్కెట్ ప్లేస్ నుండి విత్తనాలు మరియు ఎరువులు ఎలా కొనాలి?" },
      { label: "🐛 చీడపీడల నివారణ", query: "పంటలలో పురుగులు మరియు తెగుళ్ళ నివారణకు సరైన పద్ధతులు ఏమిటి?" },
      { label: "💰 పీఎం కిసాన్ పథకం", query: "పీఎం కిసాన్ సమ్మాన్ నిధి పథకం ప్రయోజనాలు మరియు అర్హతలు ఏమిటి?" }
    ]
  },
  'Tamil': {
    name: 'குரூஅக்ரி கிருஷி மித்ரா',
    tagline: 'AI வேளாண் விஞ்ஞானி & வழிகாட்டி',
    greeting: "வணக்கம் விவசாய தோழர்களே! நான் GrooAgri-ன் கிருஷி மித்ரா. பயிர்கள், உரங்கள், பூச்சி மேலாண்மை, மண் பரிசோதனை அல்லது GrooAgri சேவைகள் பற்றி கேளுங்கள்!",
    inputPlaceholder: "பயிர்கள், பூச்சிகள், உரங்கள் பற்றி கேளுங்கள்...",
    chips: [
      { label: "🌾 மண் பரிசோதனை பதிவு", query: "GrooAgri-ல் மண் பரிசோதனை (Soil Test) எவ்வாறு பதிவு செய்வது?" },
      { label: "🚜 டிராக்டர் வாடகை", query: "GrooAgri மூலம் டிராக்டர் மற்றும் விவசாய கருவிகளை வாடகைக்கு எடுப்பது எப்படி?" },
      { label: "🛒 விதைகள் & உரங்கள்", query: "GrooAgri அங்காடியில் சான்றளிக்கப்பட்ட விதைகள் மற்றும் உரங்கள் வாங்குவது எப்படி?" },
      { label: "🐛 பூச்சி மற்றும் நோய் மேலாண்மை", query: "பயிர்களை தாக்கும் பூச்சிகள் மற்றும் நோய்களை கட்டுப்படுத்துவது எப்படி?" },
      { label: "💰 பி.எம் கிசான் திட்டம்", query: "பிரதம மந்திரி கிசான் சம்மான் நிதி திட்டத்தின் பலன்கள் என்ன?" }
    ]
  },
  'Kannada': {
    name: 'ಗ್ರೂಅಗ್ರಿ ಕೃಷಿ ಮಿತ್ರ',
    tagline: 'AI ಕೃಷಿ ತಜ್ಞ ಮತ್ತು ಸಹಾಯಕ',
    greeting: "ನಮಸ್ಕಾರ ರೈತ ಬಾಂಧವರೇ! ನಾನು GrooAgri ಕೃಷಿ ಮಿತ್ರ. ಬೆಳೆಗಳು, ರಸಗೊಬ್ಬರ, ಕೀಟ ನಿಯಂತ್ರಣ, ಮಣ್ಣು ಪರೀಕ್ಷೆ ಅಥವಾ GrooAgri ಸೇವೆಗಳ ಕುರಿತು ಯಾವುದೇ ಪ್ರಶ್ನೆ ಕೇಳಿ!",
    inputPlaceholder: "ಬೆಳೆಗಳು, ಗೊಬ್ಬರ ಅಥವಾ GrooAgri ಸೇವೆಗಳ ಕುರಿತು ಕೇಳಿ...",
    chips: [
      { label: "🌾 ಮಣ್ಣು ಪರೀಕ್ಷೆ ಬುಕಿಂಗ್", query: "GrooAgri ನಲ್ಲಿ ಮಣ್ಣು ಪರೀಕ್ಷೆ (Soil Test) ಹೇಗೆ ಬುಕ್ ಮಾಡುವುದು?" },
      { label: "🚜 ಟ್ರ್ಯಾಕ್ಟರ್ ಬಾಡಿಗೆ", query: "GrooAgri ಮೂಲಕ ಟ್ರ್ಯಾಕ್ಟರ್ ಅಥವಾ ಕೃಷಿ ಯಂತ್ರೋಪಕರಣಗಳನ್ನು ಬಾಡಿಗೆಗೆ ಪಡೆಯುವುದು ಹೇಗೆ?" },
      { label: "🛒 ಬೀಜ ಮತ್ತು ರಸಗೊಬ್ಬರ", query: "GrooAgri ಮಾರುಕಟ್ಟೆಯಿಂದ ಪ್ರಮಾಣೀಕೃತ ಬೀಜ ಮತ್ತು ರಸಗೊಬ್ಬರ ಖರೀದಿಸುವುದು ಹೇಗೆ?" },
      { label: "🐛 ಕೀಟ ಹಾಗೂ ರೋಗ ನಿಯಂತ್ರಣ", query: "ಬೆಳೆಗಳಲ್ಲಿ ಕೀಟ ಮತ್ತು ರೋಗಗಳ ನಿಯಂತ್ರಣಕ್ಕೆ ಉತ್ತಮ ಸಲಹೆಗಳೇನು?" },
      { label: "💰 ಪಿಎಂ ಕಿಸಾನ್ ಯೋಜನೆ", query: "ಪ್ರಧಾನ ಮಂತ್ರಿ ಕಿಸಾನ್ ಸಮ್ಮಾನ್ ನಿಧಿ ಯೋಜನೆಯ ವಿವರ ತಿಳಿಸಿ." }
    ]
  },
  'Malayalam': {
    name: 'ഗ്രൂഅഗ്രി കൃഷി മിത്ര',
    tagline: 'AI കാർഷിക ശാസ്ത്രജ്ഞൻ & സഹായി',
    greeting: "നമസ്കാരം കർഷക സുഹൃത്തുക്കളെ! ഞാൻ GrooAgri കൃഷി മിത്രയാണ്. കൃഷി, വളങ്ങൾ, മണ്ണ് പരിശോധന അല്ലെങ്കിൽ GrooAgri സേവനങ്ങളെക്കുറിച്ച് എന്തും ചോദിക്കാം!",
    inputPlaceholder: "വിളകൾ, വളങ്ങൾ, കീടബാധ എന്നിവയെക്കുറിച്ച് ചോദിക്കുക...",
    chips: [
      { label: "🌾 മണ്ണ് പരിശോധന", query: "GrooAgri-ൽ മണ്ണ് പരിശോധന (Soil Testing) എങ്ങനെ ബുക്ക് ചെയ്യാം?" },
      { label: "🚜 ട്രാക്ടർ വാടകയ്ക്ക്", query: "GrooAgri വഴി ട്രാക്ടർ അല്ലെങ്കിൽ കാർഷിക യന്ത്രങ്ങൾ എങ്ങനെ വാടകയ്ക്ക് എടുക്കാം?" },
      { label: "🛒 വിത്തുകളും വളങ്ങളും", query: "GrooAgri സ്റ്റോറിൽ നിന്ന് നല്ല വിത്തുകളും വളങ്ങളും എങ്ങനെ വാങ്ങാം?" },
      { label: "🐛 കീടനിയന്ത്രണ മാർഗ്ഗങ്ങൾ", query: "വിളകളിലെ കീടങ്ങളെയും രോഗങ്ങളെയും എങ്ങനെ നിയന്ത്രിക്കാം?" },
      { label: "💰 പിഎം കിസാൻ പദ്ധതി", query: "പിഎം കിസാൻ പദ്ധതിയുടെ ആനുകൂല്യങ്ങൾ എന്തൊക്കെയാണ്?" }
    ]
  },
  'Odia': {
    name: 'ଗ୍ରୁଏଗ୍ରି କୃଷି ମିତ୍ର',
    tagline: 'AI କୃଷି ବୈଜ୍ଞାନିକ ଓ ସହାୟକ',
    greeting: "ନମସ୍କାର କୃଷକ ଭାଇମାନେ! ମୁଁ GrooAgri ର କୃଷି ମିତ୍ର। ଫସଲ, ସାର, କୀଟନାଶକ, ମାଟି ପରୀକ୍ଷା କିମ୍ବା GrooAgri ସେବା ବିଷୟରେ ଯେକୌଣସି ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ!",
    inputPlaceholder: "ଫସଲ, ସାର, କୀଟନାଶକ ବା GrooAgri ବିଷୟରେ ପଚାରନ୍ତୁ...",
    chips: [
      { label: "🌾 ମାଟି ପରୀକ୍ଷା ବୁକିଂ", query: "GrooAgri ରେ ମାଟି ପରୀକ୍ଷା (Soil Test) କିପରି ବୁକ୍ କରିବେ?" },
      { label: "🚜 ଟ୍ରାକ୍ଟର ଓ ମେସିନ ଭଡ଼ା", query: "GrooAgri ରୁ ଟ୍ରାକ୍ଟର କିମ୍ବା ଡ୍ରୋନ ସ୍ପ୍ରେୟାର ଭଡ଼ାରେ କିପରି ନେବେ?" },
      { label: "🛒 ଉନ୍ନତ ବିହନ ଓ ସାର", query: "GrooAgri ଷ୍ଟୋରରୁ ବିହନ ଏବଂ ସାର କିପରି ଅର୍ଡର କରିବେ?" },
      { label: "🐛 ରୋଗ ଓ ପୋକ ନିୟନ୍ତ୍ରଣ", query: "ଫସଲରେ ପୋକ ଓ ରୋଗର ସଠିକ୍ ପ୍ରତିକାର କଣ?" },
      { label: "💰 ପିଏମ୍ କିଷାନ ଯୋଜନା", query: "ପ୍ରଧାନମନ୍ତ୍ରୀ କିଷାନ ସମ୍ମାନ ନିଧି ଯୋଜନାର ଲାଭ କଣ?" }
    ]
  },
  'Assamese': {
    name: 'গ্ৰুএগ্ৰি কৃষি মিত্ৰ',
    tagline: 'AI কৃষি বিজ্ঞানী আৰু সহায়ক',
    greeting: "নমস্কাৰ কৃষক বন্ধুসকল! মই GrooAgri-ৰ কৃষি মিত্ৰ। শস্যৰ যতন, সাৰ, কীট-পতঙ্গ নিয়ন্ত্ৰণ, মাটি পৰীক্ষা, চৰকাৰী আঁচনি বা GrooAgri সেৱা সম্পৰ্কে যিকোনো প্ৰশ্ন সোধক!",
    inputPlaceholder: "শস্য, সাৰ, ৰোগ বা GrooAgri সেৱা সম্পৰ্কে সোধক...",
    chips: [
      { label: "🌾 মাটি পৰীক্ষা বুকিং", query: "GrooAgri-ত মাটি পৰীক্ষা (Soil Test) কেনেকৈ বুক কৰিব আৰু ইয়াৰ কি লাভ?" },
      { label: "🚜 কৃষি যন্ত্ৰ আৰু ড্ৰোন", query: "GrooAgri-ৰ পৰা ট্ৰেক্টৰ বা ড্ৰোন স্প্ৰেয়াৰ কেনেকৈ ভাড়াত ল'ব?" },
      { label: "🛒 উন্নত বীজ আৰু সাৰ", query: "GrooAgri ষ্ট'ৰৰ পৰা বীজ আৰু সাৰ কেনেকৈ অৰ্ডাৰ কৰিব?" },
      { label: "🐛 পোক আৰু ৰোগ নিবাৰণ", query: "শস্যত কীট-পতঙ্গ আৰু ভেঁকুৰজনিত ৰোগৰ সঠিক প্ৰতিকাৰ কি?" },
      { label: "💰 পিএম কিষাণ আঁচনি", query: "প্ৰধানমন্ত୍ରী কিষাণ সন্মান নিধি আঁচনিৰ লাভ আৰু নিয়ম কি?" },
      { label: "🐄 দুগ্ধ আৰু পশুপালন", query: "গৰু-মহৰ গাখীৰ উৎপাদন বৃদ্ধি আৰু সেউজীয়া ঘাঁহৰ ব্যৱস্থাপনা কেনেকৈ কৰিব?" }
    ]
  },
  'Urdu': {
    name: 'گروایگری کرشی متر',
    tagline: 'AI زرعی سائنسدان اور معاون',
    greeting: "السلام علیکم کسان بھائی! میں GrooAgri کا کرشی متر ہوں۔ فصلوں، کھاد، بیج، کیڑے مار ادویات، مٹی کی جانچ یا GrooAgri سروسز کے بارے میں کوئی بھی سوال پوچھیں!",
    inputPlaceholder: "فصل، کھاد، کیڑے یا GrooAgri کے بارے میں لکھیں...",
    chips: [
      { label: "🌾 مٹی کا معائنہ", query: "GrooAgri پر مٹی کا ٹیسٹ (Soil Test) کیسے بک کریں اور اس کے کیا فائدے ہیں؟" },
      { label: "🚜 زرعی مشینری کرایہ", query: "GrooAgri سے ٹریکٹر یا ڈرون اسپرے مشین کرایہ پر کیسے لیں؟" },
      { label: "🛒 بیج اور کھاد خریداری", query: "GrooAgri اسٹور سے معیاری بیج اور کھاد کیسے خریدیں؟" },
      { label: "🐛 کیڑوں سے حفاظت", query: "فصلوں میں رس چوسنے والے کیڑوں اور بیماریوں کا علاج کیا ہے؟" },
      { label: "💰 پی ایم کسان اسکیم", query: "وزیر اعظم کسان سمان ندھی اسکیم کی شرائط اور فوائد کیا ہیں؟" },
      { label: "🐄 ڈیری اور لائیو اسٹاک", query: "گائے اور بھینسوں کا دودھ بڑھانے اور متوازن غذا کے طریقے بتائیں۔" }
    ]
  }
};

const ALL_LANGUAGES = [
  { key: 'Hindi', label: 'हिन्दी', flag: '🇮🇳' },
  { key: 'English', label: 'English', flag: '🇬🇧' },
  { key: 'Hinglish', label: 'Hinglish', flag: '🇮🇳' },
  { key: 'Punjabi', label: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { key: 'Marathi', label: 'मराठी', flag: '🇮🇳' },
  { key: 'Gujarati', label: 'ગુજરાતી', flag: '🇮🇳' },
  { key: 'Bengali', label: 'বাংলা', flag: '🇮🇳' },
  { key: 'Telugu', label: 'తెలుగు', flag: '🇮🇳' },
  { key: 'Tamil', label: 'தமிழ்', flag: '🇮🇳' },
  { key: 'Kannada', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { key: 'Malayalam', label: 'മലയാളം', flag: '🇮🇳' },
  { key: 'Odia', label: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
  { key: 'Assamese', label: 'অসমীয়া', flag: '🇮🇳' },
  { key: 'Urdu', label: 'اردو', flag: '🇮🇳' }
];

/**
 * Rich Text & Navigation Link Renderer
 * Converts markdown formatting, bullet lists, bold text, and clickable app route links [Text](/route)
 */
const FormattedMessage = ({ text, onNavigate }) => {
  // Parse message into paragraphs, bullet lists, and action buttons
  const renderFormattedContent = () => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements = [];

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        elements.push(<div key={`spacer-${lineIdx}`} className="h-2" />);
        return;
      }

      // Check for headings (### or ## or #)
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={`h4-${lineIdx}`} className="font-bold text-sm text-emerald-900 mt-2 mb-1">
            {renderInlineMarkdown(trimmed.replace('### ', ''), onNavigate)}
          </h4>
        );
        return;
      }

      if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
        elements.push(
          <h3 key={`h3-${lineIdx}`} className="font-bold text-base text-emerald-950 mt-3 mb-1 border-b border-emerald-100 pb-1">
            {renderInlineMarkdown(trimmed.replace(/^#+\s/, ''), onNavigate)}
          </h3>
        );
        return;
      }

      // Bullet items
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemText = trimmed.substring(2);
        elements.push(
          <div key={`li-${lineIdx}`} className="flex items-start gap-2 ml-1 my-0.5">
            <span className="text-emerald-600 font-bold text-xs mt-1">•</span>
            <div className="flex-1 text-sm leading-relaxed text-gray-800">
              {renderInlineMarkdown(itemText, onNavigate)}
            </div>
          </div>
        );
        return;
      }

      // Numbered items (e.g. 1. 2.)
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        elements.push(
          <div key={`num-${lineIdx}`} className="flex items-start gap-2 ml-1 my-0.5">
            <span className="text-emerald-700 font-semibold text-xs mt-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {numMatch[1]}
            </span>
            <div className="flex-1 text-sm leading-relaxed text-gray-800">
              {renderInlineMarkdown(numMatch[2], onNavigate)}
            </div>
          </div>
        );
        return;
      }

      // Standard text line
      elements.push(
        <p key={`p-${lineIdx}`} className="text-sm leading-relaxed text-gray-800 my-0.5">
          {renderInlineMarkdown(trimmed, onNavigate)}
        </p>
      );
    });

    return elements;
  };

  return <div className="space-y-0.5">{renderFormattedContent()}</div>;
};

/**
 * Parses bold text and clickable action links [Label](/route)
 */
const renderInlineMarkdown = (line, onNavigate) => {
  // Regex to match [Label](url) and **bold**
  const regex = /(\[[^\]]+\]\([^\)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = line.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Check for markdown link [Label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      const isInternal = url.startsWith('/') || url.startsWith('#');

      return (
        <button
          key={`link-${idx}`}
          type="button"
          onClick={() => onNavigate(url)}
          className="inline-flex items-center gap-1 my-1 px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium text-xs rounded-full shadow-sm hover:shadow transition-all duration-200 cursor-pointer active:scale-95"
        >
          <span>{label}</span>
          <FiArrowUpRight size={13} className="text-emerald-100" />
        </button>
      );
    }

    // Bold text **text**
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`b-${idx}`} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic text *text*
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={`i-${idx}`} className="italic text-gray-700">
          {part.slice(1, -1)}
        </em>
      );
    }

    return part;
  });
};

const Chatbot = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language: appLanguage, changeLanguage: setAppLanguage } = useLanguage();

  const isHomePage = ['/', '/user', '/user/', '/home', '/user/home'].includes(location.pathname);
  if (!isHomePage) return null;

  const isAuthPage = location.pathname.includes('/login') || location.pathname.includes('/signup');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(appLanguage || 'Hindi');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [autoSpeechEnabled, setAutoSpeechEnabled] = useState(false);
  const [currentlySpeakingIdx, setCurrentlySpeakingIdx] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);

  // Sync with global app language if it changes externally
  useEffect(() => {
    if (appLanguage && LOCALIZED_CONTENT[appLanguage] && selectedLanguage !== appLanguage) {
      setSelectedLanguage(appLanguage);
    }
  }, [appLanguage]);

  const activeContent = useMemo(() => {
    return LOCALIZED_CONTENT[selectedLanguage] || LOCALIZED_CONTENT['Hindi'];
  }, [selectedLanguage]);

  // Messages state
  const [messages, setMessages] = useState([
    {
      text: activeContent.greeting,
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Update greeting if user changes language on first turn
  useEffect(() => {
    if (messages.length === 1 && messages[0].sender === 'bot') {
      setMessages([
        {
          text: activeContent.greeting,
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [selectedLanguage, activeContent]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastUsedVoice, setLastUsedVoice] = useState(false);
  const messagesEndRef = useRef(null);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const handleLanguageChange = (langKey) => {
    setSelectedLanguage(langKey);
    setShowLanguagePicker(false);
    // If the global context supports this language, sync it too
    if (setAppLanguage && langKey !== 'Hinglish') {
      try {
        setAppLanguage(langKey);
      } catch (e) {
        // Silently continue if language not in global list
      }
    }
  };

  // Text-To-Speech
  const speakText = (text, msgIdx = null) => {
    if (!window.speechSynthesis) return;

    if (currentlySpeakingIdx === msgIdx && msgIdx !== null) {
      // Toggle off if currently speaking this message
      window.speechSynthesis.cancel();
      setCurrentlySpeakingIdx(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown syntax for speech
    const cleanText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // link text only
      .replace(/[*#_`]/g, '') // remove markdown symbols
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = getVoiceLocale(selectedLanguage);
    utterance.rate = 0.95; // Slightly slower for clear regional pronunciation

    utterance.onend = () => {
      setCurrentlySpeakingIdx(null);
    };

    utterance.onerror = () => {
      setCurrentlySpeakingIdx(null);
    };

    setCurrentlySpeakingIdx(msgIdx);
    window.speechSynthesis.speak(utterance);
  };

  // Speech-To-Text
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("माफ़ करें, आपका ब्राउज़र वॉइस इनपुट सपोर्ट नहीं करता है। (Voice recognition is not supported in this browser).");
      return;
    }

    if (isListening) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getVoiceLocale(selectedLanguage);
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setLastUsedVoice(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? prev + " " + transcript : transcript));
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const toggleChat = () => setIsOpen(!isOpen);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Deep Link Navigation Handler
  const handleNavigate = (url) => {
    if (!url) return;
    if (url.startsWith('/')) {
      navigate(url);
    } else if (url.startsWith('http')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Copy message to clipboard
  const handleCopyMessage = (text, idx) => {
    const cleanText = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    navigator.clipboard.writeText(cleanText);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Reset / Clear Chat
  const handleResetChat = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setCurrentlySpeakingIdx(null);
    setMessages([
      {
        text: activeContent.greeting,
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Send message
  const handleSend = async (customMessage = null) => {
    const messageToSend = typeof customMessage === 'string' ? customMessage : input;
    if (!messageToSend || !messageToSend.trim()) return;

    const userMessage = messageToSend.trim();
    setInput('');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append user message
    const updatedMessages = [
      ...messages,
      { text: userMessage, sender: 'user', timestamp: timeStr }
    ];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Build conversation history for multi-turn context
      const conversationHistory = updatedMessages
        .slice(-8)
        .map(m => ({ sender: m.sender, text: m.text }));

      const response = await axios.post(`${API_URL}/chat`, {
        message: userMessage,
        language: selectedLanguage,
        conversationHistory: conversationHistory
      });

      if (response.data && response.data.success) {
        const botReply = response.data.reply;
        if (response.data.language && response.data.language !== selectedLanguage && LOCALIZED_CONTENT[response.data.language]) {
          setSelectedLanguage(response.data.language);
        }
        const newBotMsg = {
          text: botReply,
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, newBotMsg]);

        if (autoSpeechEnabled || lastUsedVoice) {
          speakText(botReply, updatedMessages.length);
        }
      } else {
        const errorMsg = "माफ़ करें, सेवा में अस्थायी रुकावट आई है। कृपया कुछ पलों बाद पुनः प्रयास करें या हमारे हेल्पलाइन +91 91177 04450 पर संपर्क करें।";
        setMessages(prev => [
          ...prev,
          { text: errorMsg, sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
      }
    } catch (error) {
      console.error("Chatbot API error:", error);
      const errorMsg = "माफ़ करें, सर्वर से संपर्क स्थापित नहीं हो पाया। कृपया अपना इंटरनेट कनेक्शन जांचें या पुनः प्रयास करें।";
      setMessages(prev => [
        ...prev,
        { text: errorMsg, sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } finally {
      setIsLoading(false);
      setLastUsedVoice(false);
    }
  };

  const isCheckoutPage = location.pathname.includes('/checkout');
  if (isAuthPage || isCheckoutPage) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex justify-center">
      <div className="w-full sm:max-w-md h-full relative">
        {/* Floating Draggable Launcher */}
        {!isOpen && (
          <motion.div
            drag
            dragConstraints={{ left: -320, right: 0, top: -520, bottom: 0 }}
            whileDrag={{ scale: 1.08 }}
            className="absolute bottom-24 right-5 pointer-events-auto"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <div className="relative group">
              {/* Animated Glow Halo */}
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 rounded-full blur-sm opacity-70 group-hover:opacity-100 transition duration-500 animate-pulse" />
              
              <button
                onClick={toggleChat}
                className="relative bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700 text-white p-3.5 sm:p-4 rounded-full shadow-2xl flex items-center gap-2.5 focus:outline-none cursor-grab active:cursor-grabbing border-2 border-white/40 hover:scale-105 transition-all duration-200"
                style={{ boxShadow: '0 10px 30px rgba(16, 185, 129, 0.45)' }}
                aria-label="Open GrooAgri Krishi AI Assistant"
              >
                <div className="relative">
                  <BsRobot size={26} className="text-white drop-shadow" />
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                  </span>
                </div>
                <div className="hidden sm:flex flex-col text-left pr-1">
                  <span className="text-xs font-bold tracking-wide text-white leading-tight">
                    {activeContent.name}
                  </span>
                  <span className="text-[10px] text-emerald-100 flex items-center gap-1 font-medium">
                    <IoSparkles size={10} className="text-yellow-300" />
                    AI Assistant
                  </span>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {/* Chatbot Window */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute font-sans inset-0 sm:inset-auto sm:bottom-6 sm:right-6 pointer-events-auto"
            >
              <div className="bg-white w-full h-full sm:w-[410px] sm:h-[600px] sm:rounded-3xl shadow-2xl flex flex-col sm:border border-emerald-100 overflow-hidden transform transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-700 via-green-600 to-teal-700 text-white p-3.5 sm:p-4 shadow-md z-20 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative bg-white/15 p-2 rounded-2xl backdrop-blur-md border border-white/20">
                        <BsRobot size={22} className="text-white" />
                        <span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-emerald-400 border border-white rounded-full"></span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-sm sm:text-base leading-tight tracking-tight">
                            {activeContent.name}
                          </h3>
                        </div>
                        <p className="text-[11px] text-emerald-100/90 font-medium">
                          {activeContent.tagline}
                        </p>
                      </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      {/* Language Selector Button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowLanguagePicker(!showLanguagePicker)}
                          className="flex items-center gap-1 bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-full text-xs font-medium text-white backdrop-blur-sm border border-white/20 transition-all duration-200"
                          title="भाषा बदलें (Change Language)"
                        >
                          <FiGlobe size={13} />
                          <span>{ALL_LANGUAGES.find(l => l.key === selectedLanguage)?.label || selectedLanguage}</span>
                        </button>

                        {/* Language Dropdown Menu */}
                        {showLanguagePicker && (
                          <div className="absolute right-0 top-9 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 text-gray-800 text-xs max-h-60 overflow-y-auto">
                            <div className="px-3 py-1 font-semibold text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                              भाषा चुनें (Select Language)
                            </div>
                            {ALL_LANGUAGES.map(lang => (
                              <button
                                key={lang.key}
                                type="button"
                                onClick={() => handleLanguageChange(lang.key)}
                                className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-emerald-50 transition-colors ${
                                  selectedLanguage === lang.key ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-gray-700'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span>{lang.flag}</span>
                                  <span>{lang.label}</span>
                                </span>
                                {selectedLanguage === lang.key && (
                                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Auto TTS Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          if (autoSpeechEnabled && window.speechSynthesis) {
                            window.speechSynthesis.cancel();
                            setCurrentlySpeakingIdx(null);
                          }
                          setAutoSpeechEnabled(!autoSpeechEnabled);
                        }}
                        className={`p-1.5 rounded-full text-white transition-all ${
                          autoSpeechEnabled ? 'bg-emerald-500/40' : 'bg-white/10 hover:bg-white/20'
                        }`}
                        title={autoSpeechEnabled ? "आवाज़ बंद करें (Mute Audio)" : "बोलकर सुनाएं (Read Aloud)"}
                      >
                        {autoSpeechEnabled ? <IoVolumeHighOutline size={18} /> : <IoVolumeMuteOutline size={18} />}
                      </button>

                      {/* Reset Conversation */}
                      <button
                        type="button"
                        onClick={handleResetChat}
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                        title="नई बातचीत (Reset Chat)"
                      >
                        <IoRefreshOutline size={18} />
                      </button>

                      {/* Close Chat */}
                      <button
                        type="button"
                        onClick={toggleChat}
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                      >
                        <IoClose size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto bg-gradient-to-b from-gray-50 via-emerald-50/15 to-white flex flex-col gap-3">
                  {messages.map((msg, idx) => {
                    const isUser = msg.sender === 'user';
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
                      >
                        <div
                          className={`p-3.5 rounded-2xl text-sm shadow-sm transition-all ${
                            isUser
                              ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-tr-none ml-8'
                              : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none mr-4 shadow-sm'
                          }`}
                          dir={selectedLanguage === 'Urdu' ? 'rtl' : 'ltr'}
                        >
                          {isUser ? (
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                          ) : (
                            <FormattedMessage text={msg.text} onNavigate={handleNavigate} />
                          )}
                        </div>

                        {/* Message Metadata & Quick Actions */}
                        <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-gray-400">
                          <span>{msg.timestamp}</span>
                          {!isUser && (
                            <>
                              <button
                                type="button"
                                onClick={() => speakText(msg.text, idx)}
                                className={`hover:text-emerald-700 transition-colors p-0.5 ${
                                  currentlySpeakingIdx === idx ? 'text-emerald-600 animate-pulse font-bold' : ''
                                }`}
                                title="सुनें (Listen)"
                              >
                                <IoVolumeHighOutline size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(msg.text, idx)}
                                className="hover:text-emerald-700 transition-colors p-0.5"
                                title="कॉपी करें (Copy)"
                              >
                                {copiedIdx === idx ? (
                                  <IoCheckmarkOutline size={14} className="text-emerald-600" />
                                ) : (
                                  <IoCopyOutline size={14} />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Loading Typing Indicator */}
                  {isLoading && (
                    <div className="flex items-start gap-2">
                      <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                        <span className="text-xs text-emerald-800 font-medium mr-1">
                          कृषि मित्र उत्तर तैयार कर रहा है
                        </span>
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                        <div
                          className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                        <div
                          className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                          style={{ animationDelay: '0.4s' }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Quick Starter Suggestion Chips (Shown on start or few messages) */}
                  {messages.length <= 2 && (
                    <div className="mt-2 pt-2 border-t border-emerald-100/60">
                      <p className="text-[11px] font-semibold text-emerald-800 mb-2 flex items-center gap-1">
                        <IoSparkles size={12} className="text-emerald-600" />
                        सुझाए गए विषय (Suggested Topics):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeContent.chips.map((chip, chipIdx) => (
                          <button
                            key={chipIdx}
                            type="button"
                            onClick={() => handleSend(chip.query)}
                            disabled={isLoading}
                            className="bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:border-emerald-400 text-xs px-2.5 py-1.5 rounded-full shadow-xs transition-all duration-150 text-left active:scale-95 disabled:opacity-50"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Input Area */}
                <div className="p-3 bg-white border-t border-gray-100">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex items-center gap-2"
                  >
                    {/* Voice Mic Button */}
                    <button
                      type="button"
                      onClick={startListening}
                      className={`p-2.5 rounded-full transition-all duration-200 ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-100'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                      title={isListening ? "सुन रहे हैं... (Listening...)" : "बोलकर पूछें (Voice input)"}
                    >
                      {isListening ? <IoMic size={20} /> : <IoMicOutline size={20} />}
                    </button>

                    {/* Text Input */}
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        setLastUsedVoice(false);
                      }}
                      placeholder={activeContent.inputPlaceholder}
                      dir={selectedLanguage === 'Urdu' ? 'rtl' : 'ltr'}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm text-gray-800 transition-all placeholder:text-gray-400"
                    />

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className="bg-gradient-to-r from-emerald-600 to-green-600 text-white p-2.5 rounded-full hover:from-emerald-700 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-sm hover:shadow transition-all duration-200 active:scale-95"
                      title="भेजें (Send)"
                    >
                      <IoSend size={18} />
                    </button>
                  </form>

                  {/* Micro Footer Notice */}
                  <div className="text-center mt-1.5">
                    <span className="text-[10px] text-gray-400 font-medium">
                      GrooAgri Krishi Mitra • 14 भारतीय भाषाओं में 24/7 कृषि व सहायता साथी
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Chatbot;
