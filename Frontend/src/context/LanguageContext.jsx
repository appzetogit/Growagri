import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { normalizeLanguageCode, isRTLLanguage } from '../utils/languageUtils';
import { coreTranslations } from '../utils/languageDictionary';
import * as translationService from '../services/translationService';
import { getFromCache, saveToCache } from '../utils/translationCache';

const LanguageContext = createContext();

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within LanguageProvider');
    return context;
};

export const LanguageProvider = ({ children }) => {
    // Current Language State (Default English)
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('userLanguage') || 'English';
    });
    const [isChangingLanguage, setIsChangingLanguage] = useState(false);
    const [dynamicCache, setDynamicCache] = useState({});

    // List of Supported Languages for GrooAgri with native script, code & metadata
    const languages = {
        'English': { label: 'English', nativeLabel: 'English', code: 'en', flag: '🇬🇧', greeting: 'Welcome to GrooAgri' },
        'Hindi': { label: 'Hindi', nativeLabel: 'हिन्दी', code: 'hi', flag: '🇮🇳', greeting: 'ग्रू एग्री में आपका स्वागत है' },
        'Marathi': { label: 'Marathi', nativeLabel: 'मराठी', code: 'mr', flag: '🇮🇳', greeting: 'ग्रू अ‍ॅग्रीमध्ये आपले स्वागत आहे' },
        'Gujarati': { label: 'Gujarati', nativeLabel: 'ગુજરાતી', code: 'gu', flag: '🇮🇳', greeting: 'ગ્રો એગ્રીમાં આપનું સ્વાગત છે' },
        'Punjabi': { label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', code: 'pa', flag: '🇮🇳', greeting: 'ਗਰੂ ਐਗਰੀ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ' },
        'Tamil': { label: 'Tamil', nativeLabel: 'தமிழ்', code: 'ta', flag: '🇮🇳', greeting: 'க்ரூ அக்ரிக்கு உங்களை வரவேற்கிறோம்' },
        'Telugu': { label: 'Telugu', nativeLabel: 'తెలుగు', code: 'te', flag: '🇮🇳', greeting: 'గ్రూ అగ్రికి స్వాగతం' },
        'Kannada': { label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', code: 'kn', flag: '🇮🇳', greeting: 'ಗ್ರೂ ಅಗ್ರಿಗೆ ಸುಸ್ವಾಗತ' },
        'Malayalam': { label: 'Malayalam', nativeLabel: 'മലയാളം', code: 'ml', flag: '🇮🇳', greeting: 'ഗ്രൂ അഗ്രിയിലേക്ക് സ്വാഗതം' },
        'Bengali': { label: 'Bengali', nativeLabel: 'বাংলা', code: 'bn', flag: '🇮🇳', greeting: 'গ্রু এগ্রিতে আপনাকে স্বাগতম' },
        'Odia': { label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ', code: 'or', flag: '🇮🇳', greeting: 'ଗ୍ରୁ ଏଗ୍ରିକୁ ସ୍ୱାଗତ' },
        'Assamese': { label: 'Assamese', nativeLabel: 'অসমীয়া', code: 'as', flag: '🇮🇳', greeting: 'গ্ৰু এগ্ৰিত আপোনাক স্বাগতম' },
        'Urdu': { label: 'Urdu', nativeLabel: 'اردو', code: 'ur', flag: '🇮🇳', greeting: 'گرو ایگری میں خوش آمدید' }
    };

    const currentCode = normalizeLanguageCode(language);

    /**
     * Change Current Language
     */
    const changeLanguage = (newLang) => {
        // Handle input being either language name or code
        let targetLang = newLang;
        if (!languages[targetLang]) {
            const foundKey = Object.keys(languages).find(
                key => languages[key].code === newLang || key.toLowerCase() === String(newLang).toLowerCase()
            );
            if (foundKey) targetLang = foundKey;
            else return;
        }

        setIsChangingLanguage(true);
        setLanguage(targetLang);
        localStorage.setItem('userLanguage', targetLang);

        // Async sync with backend profile if user is logged in
        try {
            const token = localStorage.getItem('accessToken');
            if (token) {
                import('../services/authService').then(({ userAuthService }) => {
                    userAuthService.updateProfile({
                        settings: { language: targetLang }
                    }).catch(() => {});
                });
            }
        } catch (_) {}

        setTimeout(() => setIsChangingLanguage(false), 200);
    };

    /**
     * Sync HTML document direction and language code
     */
    useEffect(() => {
        const code = normalizeLanguageCode(language);
        document.documentElement.lang = code;
        document.documentElement.dir = isRTLLanguage(code) ? 'rtl' : 'ltr';
    }, [language]);

    /**
     * Synchronous translation helper `t(text, fallback)`:
     * 1. If English, returns text directly.
     * 2. Checks core pre-translated dictionary (instant 0ms response).
     * 3. Checks dynamic memory/IndexedDB cache.
     * 4. If not found, requests translation asynchronously via google-translate-api-x backend
     *    and returns fallback/original until loaded.
     */
    const t = useCallback((text, fallback = null) => {
        if (!text || typeof text !== 'string') return text;
        const trimmed = text.trim();
        if (!trimmed) return text;
        if (currentCode === 'en') return text;

        // 1. Core Dictionary check (instant 0ms)
        const dict = coreTranslations[currentCode];
        if (dict && dict[trimmed]) {
            return dict[trimmed];
        }

        // 2. Dynamic in-memory cache check
        const memKey = `${currentCode}_${trimmed}`;
        if (dynamicCache[memKey]) {
            return dynamicCache[memKey];
        }

        // 3. Trigger async fetch in background from IndexedDB / API if not already queued
        getFromCache('en', currentCode, trimmed).then(cached => {
            if (cached) {
                setDynamicCache(prev => ({ ...prev, [memKey]: cached }));
            } else {
                translationService.translateText(trimmed, currentCode, 'en').then(translated => {
                    if (translated && translated !== trimmed) {
                        saveToCache('en', currentCode, trimmed, translated);
                        setDynamicCache(prev => ({ ...prev, [memKey]: translated }));
                    }
                }).catch(() => {});
            }
        }).catch(() => {});

        return fallback || text;
    }, [currentCode, dynamicCache]);

    /**
     * Asynchronous translation helper for dynamic content/objects
     */
    const translateAsync = useCallback(async (text, sourceLang = 'en') => {
        if (!text || currentCode === sourceLang) return text;
        return await translationService.translateText(text, currentCode, sourceLang);
    }, [currentCode]);

    const value = {
        language,
        languages,
        changeLanguage,
        isChangingLanguage,
        currentCode,
        t,
        translateAsync
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};
