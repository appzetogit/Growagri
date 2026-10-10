/**
 * Translation Service
 * Powered by google-translate-api-x (Free, Keyless Google Translate)
 * Features:
 * - 24-hour in-memory cache
 * - Native array batch translation
 * - Object key translation support
 * - Graceful fallback to original text
 */
const { translate } = require('google-translate-api-x');
const { languageCodeMap } = require('../config/googleCloud');

// 24h TTL Cache
const translationCache = new Map();
const TTL = 24 * 60 * 60 * 1000; // 24 Hours

/**
 * Cleanup expired cache entries periodically
 */
const cleanupCache = () => {
    const now = Date.now();
    for (const [key, value] of translationCache.entries()) {
        if (now - value.timestamp > TTL) {
            translationCache.delete(key);
        }
    }
};

// Cleanup every hour
setInterval(cleanupCache, 60 * 60 * 1000);

/**
 * Normalize language code (e.g. 'hi-IN' -> 'hi', 'Hindi' -> 'hi')
 */
const normalizeCode = (lang) => {
    if (!lang) return 'en';
    if (languageCodeMap && languageCodeMap[lang]) return languageCodeMap[lang];
    const lower = String(lang).toLowerCase().trim();
    if (lower.includes('-')) return lower.split('-')[0];
    return lower;
};

/**
 * Core Translation Function for Single Text
 */
const translateText = async (text, targetLang, sourceLang = 'en') => {
    if (!text || typeof text !== 'string' || text.trim() === '') return text;
    
    const target = normalizeCode(targetLang);
    const source = normalizeCode(sourceLang);
    if (target === source) return text;

    const cacheKey = `${source}_${target}_${Buffer.from(text.trim()).toString('base64')}`;
    const cached = translationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < TTL)) {
        return cached.translation;
    }

    try {
        const res = await translate(text, {
            to: target,
            from: source,
            forceBatch: false
        });

        const translatedText = res && res.text ? res.text : text;

        if (translatedText && translatedText !== text) {
            translationCache.set(cacheKey, {
                translation: translatedText,
                timestamp: Date.now()
            });
        }

        return translatedText;
    } catch (error) {
        console.error('[TranslationService] translateText Error:', error?.message || error);
        return text; // Graceful fallback
    }
};

/**
 * Batch Translation (Fast native array translation)
 */
const translateBatch = async (texts, targetLang, sourceLang = 'en') => {
    if (!Array.isArray(texts) || texts.length === 0) return [];
    
    const target = normalizeCode(targetLang);
    const source = normalizeCode(sourceLang);
    if (target === source) return texts;

    // Check which texts are already in cache
    const resultsMap = new Map();
    const uncachedTexts = [];

    for (const text of texts) {
        if (!text || typeof text !== 'string' || text.trim() === '') {
            resultsMap.set(text, text);
            continue;
        }

        const cacheKey = `${source}_${target}_${Buffer.from(text.trim()).toString('base64')}`;
        const cached = translationCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < TTL)) {
            resultsMap.set(text, cached.translation);
        } else if (!uncachedTexts.includes(text)) {
            uncachedTexts.push(text);
        }
    }

    // Translate uncached in one batch call if any
    if (uncachedTexts.length > 0) {
        try {
            const batchRes = await translate(uncachedTexts, {
                to: target,
                from: source,
                forceBatch: true
            });

            const resArray = Array.isArray(batchRes) ? batchRes : [batchRes];

            uncachedTexts.forEach((originalText, idx) => {
                const translated = resArray[idx]?.text || originalText;
                resultsMap.set(originalText, translated);

                // Save to cache
                const cacheKey = `${source}_${target}_${Buffer.from(originalText.trim()).toString('base64')}`;
                translationCache.set(cacheKey, {
                    translation: translated,
                    timestamp: Date.now()
                });
            });
        } catch (error) {
            console.error('[TranslationService] translateBatch Error:', error?.message || error);
            // Fallback uncached to original text
            uncachedTexts.forEach((originalText) => {
                resultsMap.set(originalText, originalText);
            });
        }
    }

    // Return in original order
    return texts.map(text => resultsMap.get(text) || text);
};

/**
 * Object Property Translation
 */
const translateObject = async (obj, targetLang, sourceLang = 'en', keysToTranslate = []) => {
    if (!obj || typeof obj !== 'object') return obj;

    const target = normalizeCode(targetLang);
    const source = normalizeCode(sourceLang);
    if (target === source) return obj;

    const result = Array.isArray(obj) ? [...obj] : { ...obj };
    const items = Array.isArray(result) ? result : [result];

    // Collect all string values that need translation
    const textsToTranslate = [];
    const mapping = [];

    items.forEach((item, itemIdx) => {
        if (!item || typeof item !== 'object') return;
        keysToTranslate.forEach((key) => {
            if (item[key] && typeof item[key] === 'string' && item[key].trim()) {
                textsToTranslate.push(item[key]);
                mapping.push({ itemIdx, key });
            }
        });
    });

    if (textsToTranslate.length === 0) return result;

    const translatedTexts = await translateBatch(textsToTranslate, target, source);

    mapping.forEach((m, idx) => {
        items[m.itemIdx][m.key] = translatedTexts[idx] || items[m.itemIdx][m.key];
    });

    return result;
};

module.exports = {
    translateText,
    translateBatch,
    translateObject
};
