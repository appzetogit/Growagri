import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { coreTranslations } from '../../utils/languageDictionary';
import * as translationService from '../../services/translationService';
import { getFromCache, saveToCache } from '../../utils/translationCache';

// Node tracking storage
const nodeOriginalMap = new WeakMap();
const placeholderOriginalMap = new WeakMap();

// In-memory translation session cache for maximum speed
const memoryTranslationCache = new Map();

// Tags to exclude from translation
const EXCLUDED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'CODE', 'PRE', 'SVG', 'NOSCRIPT', 'TEXTAREA', 'INPUT'
]);

/**
 * Checks if a string contains meaningful English text
 */
const hasEnglishText = (str) => {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (trimmed.length < 2) return false;
  // Ignore currency numbers, pure digits, single symbols
  if (/^[\d\s₹,.\-+%/:@#]+$/.test(trimmed)) return false;
  return /[a-zA-Z]{2,}/.test(trimmed);
};

const AutoTranslator = () => {
  const { currentCode } = useLanguage();
  const observerRef = useRef(null);
  const pendingBatchRef = useRef(new Set());
  const batchTimeoutRef = useRef(null);
  const activeLangRef = useRef(currentCode);

  activeLangRef.current = currentCode;

  useEffect(() => {
    const targetCode = currentCode;

    // ─── IF ENGLISH: RESTORE ALL ORIGINAL TEXTS ───
    if (targetCode === 'en') {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      // Restore text nodes
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (nodeOriginalMap.has(node)) {
          const original = nodeOriginalMap.get(node);
          if (node.nodeValue !== original) {
            node.nodeValue = original;
          }
        }
      }

      // Restore placeholders
      const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
      inputs.forEach((input) => {
        if (placeholderOriginalMap.has(input)) {
          input.placeholder = placeholderOriginalMap.get(input);
        }
      });

      return;
    }

    // ─── IF REGIONAL LANGUAGE: TRANSLATE DOM ───
    const dispatchBatch = async () => {
      const textsToTranslate = Array.from(pendingBatchRef.current);
      pendingBatchRef.current.clear();

      if (textsToTranslate.length === 0) return;

      try {
        const results = await translationService.translateBatch(textsToTranslate, targetCode, 'en');

        textsToTranslate.forEach((original, idx) => {
          const translated = results[idx] || original;
          const cacheKey = `${targetCode}_${original}`;
          memoryTranslationCache.set(cacheKey, translated);
          saveToCache('en', targetCode, original, translated);
        });

        // Re-scan and apply the newly fetched translations
        scanAndTranslate(document.body);
      } catch (err) {
        console.warn('[AutoTranslator] Batch fetch error:', err);
      }
    };

    const queueForTranslation = (text) => {
      if (!text || !hasEnglishText(text)) return;
      pendingBatchRef.current.add(text.trim());

      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = setTimeout(dispatchBatch, 70);
    };

    /**
     * Translate a single text node
     */
    const translateNode = (node) => {
      if (!node || !node.nodeValue) return;

      const parent = node.parentElement;
      if (!parent) return;

      const tagName = parent.tagName;
      if (EXCLUDED_TAGS.has(tagName)) return;
      if (parent.closest('.notranslate') || parent.closest('[data-no-translate]')) return;

      const raw = node.nodeValue;
      if (!hasEnglishText(raw)) return;

      // Save original English
      if (!nodeOriginalMap.has(node)) {
        nodeOriginalMap.set(node, raw);
      }

      const trimmed = raw.trim();
      const leadingSpace = raw.match(/^\s*/)?.[0] || '';
      const trailingSpace = raw.match(/\s*$/)?.[0] || '';

      // 1. Core Dictionary (Instant)
      const dict = coreTranslations[targetCode];
      if (dict && dict[trimmed]) {
        node.nodeValue = `${leadingSpace}${dict[trimmed]}${trailingSpace}`;
        return;
      }

      // 2. In-Memory Session Cache
      const cacheKey = `${targetCode}_${trimmed}`;
      if (memoryTranslationCache.has(cacheKey)) {
        node.nodeValue = `${leadingSpace}${memoryTranslationCache.get(cacheKey)}${trailingSpace}`;
        return;
      }

      // 3. Local IndexedDB Cache Lookup
      getFromCache('en', targetCode, trimmed).then((cached) => {
        if (cached) {
          memoryTranslationCache.set(cacheKey, cached);
          if (activeLangRef.current === targetCode && node.nodeValue) {
            node.nodeValue = `${leadingSpace}${cached}${trailingSpace}`;
          }
        } else {
          // 4. Queue for API Batch Translation
          queueForTranslation(trimmed);
        }
      }).catch(() => {
        queueForTranslation(trimmed);
      });
    };

    /**
     * Translate placeholders
     */
    const translatePlaceholders = (root) => {
      const inputs = root.querySelectorAll ? root.querySelectorAll('input[placeholder], textarea[placeholder]') : [];
      inputs.forEach((input) => {
        const ph = input.placeholder;
        if (!hasEnglishText(ph)) return;

        if (!placeholderOriginalMap.has(input)) {
          placeholderOriginalMap.set(input, ph);
        }

        const trimmed = ph.trim();
        const dict = coreTranslations[targetCode];
        if (dict && dict[trimmed]) {
          input.placeholder = dict[trimmed];
          return;
        }

        const cacheKey = `${targetCode}_${trimmed}`;
        if (memoryTranslationCache.has(cacheKey)) {
          input.placeholder = memoryTranslationCache.get(cacheKey);
          return;
        }

        getFromCache('en', targetCode, trimmed).then((cached) => {
          if (cached) {
            memoryTranslationCache.set(cacheKey, cached);
            input.placeholder = cached;
          } else {
            queueForTranslation(trimmed);
          }
        }).catch(() => {
          queueForTranslation(trimmed);
        });
      });
    };

    /**
     * Walk through DOM and translate all text nodes
     */
    const scanAndTranslate = (root) => {
      if (!root || targetCode === 'en') return;

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (n) => {
            if (!n || !n.parentElement) return NodeFilter.FILTER_REJECT;
            if (EXCLUDED_TAGS.has(n.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
            if (n.parentElement.closest('.notranslate')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let textNode;
      while ((textNode = walker.nextNode())) {
        translateNode(textNode);
      }

      translatePlaceholders(root);
    };

    // Initial Full Scan
    scanAndTranslate(document.body);

    // MutationObserver to translate dynamic elements as user scrolls/navigates
    const observer = new MutationObserver((mutations) => {
      if (activeLangRef.current === 'en') return;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const addedNode of mutation.addedNodes) {
            if (addedNode.nodeType === Node.TEXT_NODE) {
              translateNode(addedNode);
            } else if (addedNode.nodeType === Node.ELEMENT_NODE) {
              scanAndTranslate(addedNode);
            }
          }
        } else if (mutation.type === 'characterData') {
          const target = mutation.target;
          if (target.nodeType === Node.TEXT_NODE) {
            const raw = target.nodeValue;
            // Only translate if newly set value is English (not our already translated text)
            if (hasEnglishText(raw) && !nodeOriginalMap.has(target)) {
              translateNode(target);
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    observerRef.current = observer;

    return () => {
      if (observer) observer.disconnect();
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    };
  }, [currentCode]);

  return null;
};

export default AutoTranslator;
