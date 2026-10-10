/**
 * Language Utilities
 * Handles normalization and mapping of language codes and voice locales
 */

export const languageCodeMap = {
  'English': 'en',
  'Hindi': 'hi',
  'Marathi': 'mr',
  'Gujarati': 'gu',
  'Punjabi': 'pa',
  'Tamil': 'ta',
  'Telugu': 'te',
  'Kannada': 'kn',
  'Malayalam': 'ml',
  'Bengali': 'bn',
  'Odia': 'or',
  'Assamese': 'as',
  'Urdu': 'ur',
  'Hinglish': 'hi'
};

/**
 * Standard BCP-47 Speech Recognition & Synthesis Locales for Indian Languages
 */
export const voiceLocaleMap = {
  'English': 'en-IN',
  'Hindi': 'hi-IN',
  'Marathi': 'mr-IN',
  'Gujarati': 'gu-IN',
  'Punjabi': 'pa-IN',
  'Tamil': 'ta-IN',
  'Telugu': 'te-IN',
  'Kannada': 'kn-IN',
  'Malayalam': 'ml-IN',
  'Bengali': 'bn-IN',
  'Odia': 'or-IN',
  'Assamese': 'as-IN',
  'Urdu': 'ur-IN',
  'Hinglish': 'hi-IN'
};

export const rtlLanguages = ["ar", "he", "ur", "fa"];

/**
 * Normalizes language codes for API use
 */
export const normalizeLanguageCode = (code) => {
  if (!code) return 'en';
  if (languageCodeMap[code]) return languageCodeMap[code];
  return code?.toLowerCase() || 'en';
};

/**
 * Get BCP-47 voice locale for SpeechRecognition and SpeechSynthesis
 */
export const getVoiceLocale = (lang) => {
  if (voiceLocaleMap[lang]) return voiceLocaleMap[lang];
  const code = normalizeLanguageCode(lang);
  return `${code}-IN`;
};

/**
 * Checks if a language is RTL
 */
export const isRTLLanguage = (code) => {
  const normalized = normalizeLanguageCode(code);
  return rtlLanguages.includes(normalized);
};
