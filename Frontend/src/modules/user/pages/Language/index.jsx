import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiSearch, FiGlobe } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../../../../context/LanguageContext';
import { themeColors } from '../../../../theme';

const LanguageSelectionPage = () => {
  const navigate = useNavigate();
  const { language, languages, changeLanguage, t } = useLanguage();
  const [selectedLang, setSelectedLang] = useState(language);
  const [searchQuery, setSearchQuery] = useState('');

  // Recommended languages for farmers & agriculture
  const recommendedLanguages = ['Hindi', 'Marathi', 'Gujarati', 'Punjabi', 'Telugu', 'Tamil'];

  const languageList = Object.entries(languages).map(([key, data]) => ({
    key,
    ...data,
    isRecommended: recommendedLanguages.includes(key)
  }));

  const filteredLanguages = languageList.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) ||
      item.nativeLabel.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q)
    );
  });

  const handleApply = () => {
    changeLanguage(selectedLang);
    toast.success(
      `${languages[selectedLang]?.nativeLabel || selectedLang} ${t('Language updated successfully')}`,
      {
        icon: '🌐',
        duration: 3000
      }
    );
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all text-gray-700"
              aria-label="Back"
            >
              <FiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                {t('Select Language')}
              </h1>
              <p className="text-xs text-gray-500 font-medium">
                {t('Choose your preferred language')}
              </p>
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700">
            <FiGlobe className="w-5 h-5" />
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-md mx-auto px-4 pb-3">
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search language / भाषा खोजें..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 bg-gray-200 rounded-full w-5 h-5 flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content: Language List */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-4 pb-28">
        {/* Active Selection Banner */}
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-700/15 relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-[11px] font-bold tracking-wider uppercase opacity-80">
              {t('Selected Language')}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black">
                {languages[selectedLang]?.nativeLabel || selectedLang}
              </span>
              <span className="text-sm opacity-90 font-medium">
                ({languages[selectedLang]?.label})
              </span>
            </div>
            {languages[selectedLang]?.greeting && (
              <p className="text-xs text-emerald-100 mt-1 italic">
                "{languages[selectedLang].greeting}"
              </p>
            )}
          </div>
          <div className="absolute right-2 -bottom-2 text-6xl opacity-15 select-none pointer-events-none">
            {languages[selectedLang]?.flag || '🇮🇳'}
          </div>
        </div>

        {/* Section Title */}
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            All Languages ({filteredLanguages.length})
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold">
            Instant Switch
          </span>
        </div>

        {/* Languages Grid / List */}
        <div className="space-y-2.5">
          <AnimatePresence>
            {filteredLanguages.map((item) => {
              const isSelected = selectedLang === item.key;

              return (
                <motion.div
                  key={item.key}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setSelectedLang(item.key)}
                  className={`relative p-3.5 rounded-2xl cursor-pointer transition-all border flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-500 shadow-md shadow-emerald-500/10'
                      : 'bg-white border-gray-200/80 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Flag / Icon */}
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xl shadow-xs shrink-0">
                      {item.flag}
                    </div>

                    {/* Labels */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-bold leading-tight ${isSelected ? 'text-emerald-900' : 'text-gray-900'}`}>
                          {item.nativeLabel}
                        </span>
                        {item.isRecommended && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-amber-100 text-amber-800">
                            Farmer Choice
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 font-medium">
                        {item.label}
                      </span>
                    </div>
                  </div>

                  {/* Radio / Check Circle */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'border-2 border-gray-300 bg-transparent'
                      }`}
                    >
                      {isSelected && <FiCheck className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredLanguages.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 p-6">
              <p className="text-gray-500 text-sm">No language found for "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs text-emerald-600 font-bold hover:underline"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Sticky Bottom Apply Button */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-100 p-4 shadow-lg shadow-black/5">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleApply}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-white shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base"
            style={{ background: themeColors.gradient }}
          >
            <FiCheck className="w-5 h-5 stroke-[2.5]" />
            <span>
              {t('Apply Language')} ({languages[selectedLang]?.nativeLabel || selectedLang})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelectionPage;
