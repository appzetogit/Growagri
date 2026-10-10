import React from 'react';
import { themeColors } from '../../../../../theme';
import { useLanguage } from '../../../../../context/LanguageContext';

const ReferEarnSection = ({ onReferClick }) => {
  const { t } = useLanguage();
  return (
    <div className="px-3 sm:px-5">
      <div
        className="rounded-[24px] sm:rounded-[26px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] bg-white border border-slate-100"
        style={{
          background: `linear-gradient(135deg, ${themeColors?.brand?.teal || '#347989'}14 0%, ${themeColors?.brand?.yellow || '#D68F35'}14 100%)`,
          border: `1.5px solid ${themeColors?.brand?.teal || '#347989'}33`
        }}
      >
        <div className="p-4 sm:p-5 flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-[17px] sm:text-[19px] font-black mb-1 text-slate-900 tracking-tight">
              {t('Refer and get free services')}
            </h3>
            <p className="text-sm font-semibold text-slate-600">
              {t('Invite and get ₹100*')}
            </p>
          </div>

          {/* Gift Boxes Illustration */}
          <div className="flex items-center gap-1 ml-4 flex-shrink-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center transform rotate-12 shadow-sm"
              style={{
                backgroundColor: `${themeColors?.brand?.teal || '#347989'}1F`,
                border: `2px solid ${themeColors?.brand?.teal || '#347989'}33`
              }}
            >
              <span className="text-2xl">🎁</span>
            </div>
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center transform -rotate-6 -ml-2 shadow-sm"
              style={{
                backgroundColor: `${themeColors?.brand?.yellow || '#D68F35'}1F`,
                border: `2px solid ${themeColors?.brand?.yellow || '#D68F35'}33`
              }}
            >
              <span className="text-xl">🎁</span>
            </div>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center transform rotate-12 -ml-2 shadow-sm"
              style={{
                backgroundColor: `${themeColors?.brand?.orange || '#BB5F36'}1F`,
                border: `2px solid ${themeColors?.brand?.orange || '#BB5F36'}33`
              }}
            >
              <span className="text-lg">🎁</span>
            </div>
          </div>
        </div>
        <button
          onClick={onReferClick}
          className="w-full text-white font-black py-3.5 active:scale-98 transition-all shadow-md hover:shadow-lg cursor-pointer"
          style={{
            backgroundColor: themeColors?.button || '#2d6a4f',
            boxShadow: `0 4px 12px -2px ${themeColors?.brand?.teal || '#347989'}4D`
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = themeColors?.brand?.teal || '#347989';
            e.target.style.transform = 'scale(0.99)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = themeColors?.button || '#2d6a4f';
            e.target.style.transform = 'scale(1)';
          }}
        >
          {t('Refer Now')}
        </button>
      </div>
    </div>
  );
};

export default ReferEarnSection;
