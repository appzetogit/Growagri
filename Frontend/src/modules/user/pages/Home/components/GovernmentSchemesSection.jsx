import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaLandmark, FaTractor } from 'react-icons/fa';
import { FiChevronRight, FiShield } from 'react-icons/fi';
import schemeService from '../../../../../services/schemeService';
import { useLanguage } from '../../../../../context/LanguageContext';

// Custom Wheat / Grain sprout icon for PMFBY matching the reference design
const WheatIcon = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 21V10" stroke="#78350f" strokeWidth="1.8" strokeLinecap="round" />
    <path
      d="M12 2.5C10.6 4.5 10.6 6.8 12 8.5C13.4 6.8 13.4 4.5 12 2.5Z"
      fill="#d97706"
      stroke="#78350f"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M7.2 6.5C7.5 9 9.3 10.8 11.8 11.2C11.8 8.8 10.2 7 7.2 6.5Z"
      fill="#d97706"
      stroke="#78350f"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M16.8 6.5C13.8 7 12.2 8.8 12.2 11.2C14.7 10.8 16.5 9 16.8 6.5Z"
      fill="#d97706"
      stroke="#78350f"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M7.8 12C8.3 14.2 9.8 15.8 11.8 16.2C11.8 13.8 10.2 12.2 7.8 12Z"
      fill="#d97706"
      stroke="#78350f"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M16.2 12C13.8 12.2 12.2 13.8 12.2 16.2C14.2 15.8 15.7 14.2 16.2 12Z"
      fill="#d97706"
      stroke="#78350f"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

// Custom Sprout with soil base icon for Soil Health Card matching the reference design
const SproutSoilIcon = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="5.5" y="18.5" width="13" height="2.2" rx="1.1" fill="#7e22ce" />
    <rect x="10.8" y="11" width="2.4" height="8" rx="1.2" fill="#7e22ce" />
    <path
      d="M11 13C6.2 13 4.2 10.2 4.2 7.8C7.5 7.2 10.5 9.2 11.5 12"
      fill="#9333ea"
    />
    <path
      d="M13 13C17.8 13 19.8 10.2 19.8 7.8C16.5 7.2 13.5 9.2 12.5 12"
      fill="#9333ea"
    />
  </svg>
);

// Fallback initial schemes for instant rendering
const FALLBACK_SCHEMES = [
  {
    id: 'pm-kisan',
    slug: 'pm-kisan',
    title: 'PM-Kisan',
    fullName: 'Pradhan Mantri Kisan Samman Nidhi',
    subtitleLine1: 'Farmer income',
    subtitleLine2: 'support',
    badgeBg: 'bg-[#dcfce7]',
    iconColor: 'text-[#166534]',
    iconType: 'tractor',
  },
  {
    id: 'pmfby',
    slug: 'pmfby',
    title: 'PMFBY',
    fullName: 'Pradhan Mantri Fasal Bima Yojana',
    subtitleLine1: 'Crop insurance',
    subtitleLine2: 'scheme',
    badgeBg: 'bg-[#fef3c7]',
    iconColor: 'text-[#b45309]',
    iconType: 'wheat',
  },
  {
    id: 'kcc',
    slug: 'kisan-credit-card',
    title: 'Kisan Credit Card',
    fullName: 'Kisan Credit Card (KCC) Scheme',
    subtitleLine1: 'Easy credit',
    subtitleLine2: 'for farmers',
    badgeBg: 'bg-[#e0f2fe]',
    iconColor: 'text-[#2563eb]',
    iconType: 'rupee',
  },
  {
    id: 'soil-health',
    slug: 'soil-health-card',
    title: 'Soil Health Card',
    fullName: 'Soil Health Card Scheme',
    subtitleLine1: 'Better soil,',
    subtitleLine2: 'better yield',
    badgeBg: 'bg-[#f3e8ff]',
    iconColor: 'text-[#9333ea]',
    iconType: 'sprout',
  }
];

export default function GovernmentSchemesSection() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [schemes, setSchemes] = useState(FALLBACK_SCHEMES);

  useEffect(() => {
    let isMounted = true;
    schemeService
      .getPublicSchemes()
      .then((res) => {
        if (isMounted && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setSchemes(res.data);
        }
      })
      .catch((error) => {
        console.warn('Could not load dynamic schemes, using default fallback:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSchemeClick = (scheme) => {
    const targetIdentifier = scheme.slug || scheme._id || scheme.id;
    navigate(`/user/schemes/${targetIdentifier}`);
  };

  const renderIcon = (scheme, sizeClass = "w-5.5 h-5.5 sm:w-6 sm:h-6") => {
    switch (scheme.iconType) {
      case 'tractor':
        return <FaTractor className={`${sizeClass} text-[#166534]`} />;
      case 'wheat':
        return <WheatIcon className={sizeClass} />;
      case 'rupee':
        return (
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#2563eb] text-white flex items-center justify-center font-bold text-[12px] sm:text-[14px] shadow-xs">
            ₹
          </div>
        );
      case 'sprout':
        return <SproutSoilIcon className={sizeClass} />;
      case 'shield':
        return <FiShield className={`${sizeClass} text-indigo-600`} />;
      case 'landmark':
      default:
        return <FaLandmark className={`${sizeClass} text-[#166534]`} />;
    }
  };

  return (
    <section className="px-3 sm:px-5">
      <div className="bg-white rounded-[26px] sm:rounded-[28px] p-4 sm:p-5 border border-slate-100/90 shadow-[0_2px_14px_rgba(0,0,0,0.03)] transition-all">
        {/* Header Row */}
        <div
          onClick={() => schemes[0] && handleSchemeClick(schemes[0])}
          className="flex items-center justify-between mb-4 sm:mb-5 cursor-pointer group select-none"
        >
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            {/* Freestanding Landmark Icon */}
            <FaLandmark className="w-8 h-8 sm:w-9 sm:h-9 text-[#166534] flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-[17px] sm:text-[19px] font-bold text-[#0f172a] leading-tight tracking-tight">
                {t('Government Schemes')}
              </h3>
              <p className="text-[11.5px] sm:text-[12.5px] text-[#475569] font-normal leading-snug mt-0.5">
                Get benefits and support from central & state government schemes
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Schemes Grid (Displays all schemes with multi-row wrap) */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3.5 gap-y-3 sm:gap-y-4">
          {schemes.map((scheme) => (
            <div
              key={scheme._id || scheme.slug || scheme.id}
              onClick={() => handleSchemeClick(scheme)}
              className="bg-white border border-slate-200/80 rounded-[18px] sm:rounded-[22px] pt-3 pb-2.5 px-1 sm:px-2 text-center flex flex-col items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.02)] hover:shadow-md transition-all active:scale-95 cursor-pointer min-h-[145px] sm:min-h-[160px] group"
            >
              {/* Circular Icon Badge */}
              <div
                className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full ${scheme.badgeBg || 'bg-[#dcfce7]'} flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 flex-shrink-0`}
              >
                {renderIcon(scheme)}
              </div>

              {/* Scheme Title & Subtitle */}
              <div className="w-full flex-1 flex flex-col justify-center my-0.5">
                <p className="text-[11.5px] min-[380px]:text-[12px] sm:text-[13px] font-bold text-[#0f172a] leading-tight tracking-tight line-clamp-1">
                  {scheme.title}
                </p>
                <p className="text-[9px] min-[380px]:text-[9.5px] sm:text-[10.5px] text-[#64748b] font-normal leading-tight mt-1">
                  <span className="block truncate">{scheme.subtitleLine1 || 'Official Govt'}</span>
                  <span className="block truncate">{scheme.subtitleLine2 || 'Scheme'}</span>
                </p>
              </div>

              {/* Bottom Chevron Arrow */}
              <div className="mt-1 text-slate-700 flex items-center justify-center">
                <FiChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
