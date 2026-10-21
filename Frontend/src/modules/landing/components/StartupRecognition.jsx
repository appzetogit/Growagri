import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiAward,
  FiFileText,
  FiCheck,
  FiCheckCircle,
  FiArrowRight,
  FiExternalLink,
  FiDownload,
  FiX,
  FiShield,
  FiTrendingUp,
  FiStar,
  FiUsers,
} from 'react-icons/fi';
import { FaSeedling, FaHandshake } from 'react-icons/fa6';
import TranslatedText from '../../../components/TranslatedText';
import api from '../../../services/api';
import defaultRecognitionImg from '../landing_images/bihar_startup_recognition.jpg';

// Corner leaf decoration for bottom-left
const BottomLeftLeaves = () => (
  <svg
    className="absolute -bottom-2 -left-2 w-14 h-14 sm:w-18 sm:h-18 pointer-events-none z-10 drop-shadow-sm select-none"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M2 98C12 65 35 40 78 30C66 55 48 80 2 98Z"
      fill="url(#leaf-grad-left-main)"
    />
    <path
      d="M18 95C32 78 52 62 78 30"
      stroke="#15803d"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.8"
    />
    <path
      d="M4 85C8 58 22 42 50 32C42 52 28 72 4 85Z"
      fill="url(#leaf-grad-left-sec)"
      opacity="0.95"
    />
    <defs>
      <linearGradient id="leaf-grad-left-main" x1="0" y1="100" x2="80" y2="25" gradientUnits="userSpaceOnUse">
        <stop stopColor="#15803d" />
        <stop offset="0.45" stopColor="#22c55e" />
        <stop offset="0.85" stopColor="#4ade80" />
        <stop offset="1" stopColor="#86efac" />
      </linearGradient>
      <linearGradient id="leaf-grad-left-sec" x1="0" y1="85" x2="55" y2="30" gradientUnits="userSpaceOnUse">
        <stop stopColor="#166534" />
        <stop offset="0.5" stopColor="#16a34a" />
        <stop offset="1" stopColor="#34d399" />
      </linearGradient>
    </defs>
  </svg>
);

// Corner leaf decoration for bottom-right
const BottomRightLeaves = () => (
  <svg
    className="absolute -bottom-2 -right-2 w-14 h-14 sm:w-18 sm:h-18 pointer-events-none z-10 drop-shadow-sm select-none"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M98 98C88 65 65 40 22 30C34 55 52 80 98 98Z"
      fill="url(#leaf-grad-right-main)"
    />
    <path
      d="M82 95C68 78 48 62 22 30"
      stroke="#15803d"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.8"
    />
    <path
      d="M96 85C92 58 78 42 50 32C58 52 72 72 96 85Z"
      fill="url(#leaf-grad-right-sec)"
      opacity="0.95"
    />
    <defs>
      <linearGradient id="leaf-grad-right-main" x1="100" y1="100" x2="20" y2="25" gradientUnits="userSpaceOnUse">
        <stop stopColor="#15803d" />
        <stop offset="0.45" stopColor="#22c55e" />
        <stop offset="0.85" stopColor="#4ade80" />
        <stop offset="1" stopColor="#86efac" />
      </linearGradient>
      <linearGradient id="leaf-grad-right-sec" x1="100" y1="85" x2="45" y2="30" gradientUnits="userSpaceOnUse">
        <stop stopColor="#166534" />
        <stop offset="0.5" stopColor="#16a34a" />
        <stop offset="1" stopColor="#34d399" />
      </linearGradient>
    </defs>
  </svg>
);

const renderHighlightIcon = (type) => {
  switch (type) {
    case 'leaf':
    case 'sprout':
      return <FaSeedling className="text-[#15803d] text-base" />;
    case 'file':
    case 'certificate':
    case 'document':
      return <FiFileText className="text-[#15803d] text-base" />;
    case 'handshake':
      return <FaHandshake className="text-[#15803d] text-base" />;
    case 'shield':
      return <FiShield className="text-[#15803d] text-base" />;
    case 'trending':
      return <FiTrendingUp className="text-[#15803d] text-base" />;
    case 'check':
      return <FiCheckCircle className="text-[#15803d] text-base" />;
    case 'star':
      return <FiStar className="text-[#15803d] text-base" />;
    case 'users':
      return <FiUsers className="text-[#15803d] text-base" />;
    case 'award':
    default:
      return <FiAward className="text-[#15803d] text-base" />;
  }
};

const DEFAULT_DATA = {
  badge: '',
  headingPrefix: '',
  headingHighlight: '',
  tagline: '',
  taglineSub: '',
  description: '',
  detailsLinkText: 'View Recognition Details',
  buttonText: '',
  buttonUrl: '',
  emblemUrl: '/bihar-seal-green.svg',
  certificateUrl: '',
  imageUrl: '',
  highlights: [],
  isActive: true,
};

const StartupRecognition = () => {
  const [data, setData] = useState(DEFAULT_DATA);
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await api.get('/content/startup-recognition');
        if (res.data?.success && res.data?.data) {
          const apiData = res.data.data;
          setData((prev) => ({
            ...prev,
            ...apiData,
            highlights:
              Array.isArray(apiData.highlights) ? apiData.highlights : [],
          }));
        }
      } catch (err) {
        // Fallback gracefully
      }
    };
    fetchContent();
  }, []);

  const isValidUrl = (url) => {
    return Boolean(
      url &&
        typeof url === 'string' &&
        (url.startsWith('http://') ||
          url.startsWith('https://') ||
          url.startsWith('data:image/') ||
          url.startsWith('/uploads/'))
    );
  };

  const certificateImage =
    (isValidUrl(data.certificateUrl) && data.certificateUrl) ||
    (isValidUrl(data.imageUrl) && data.imageUrl) ||
    (Array.isArray(data.images) &&
      isValidUrl(data.images[0]?.url) &&
      data.images[0].url) ||
    defaultRecognitionImg;

  const emblemImage = data.emblemUrl || '/bihar-seal-green.svg';

  if (data.isActive === false) {
    return null;
  }

  return (
    <section className="relative w-full py-5 md:py-8 bg-gradient-to-b from-white via-emerald-50/20 to-white overflow-hidden">
      <div className="w-full max-w-[96%] xl:max-w-[1520px] 2xl:max-w-[1620px] mx-auto px-2 sm:px-4 lg:px-6">
        
        {/* Main Recognition Card Container (No Arrow Buttons) */}
        <div className="relative rounded-3xl border border-[#bbf7d0] bg-gradient-to-r from-[#f4fcf6] via-[#ffffff] to-[#f0fbf4] shadow-[0_2px_16px_rgba(34,197,94,0.06)] hover:shadow-[0_4px_22px_rgba(34,197,94,0.1)] transition-all duration-300 overflow-hidden p-4 sm:p-5 lg:p-6 xl:p-7">
          
          {/* Corner Leaves Accents */}
          <BottomLeftLeaves />
          <BottomRightLeaves />

          {/* Content Layout */}
          <div className="relative z-10 px-2 sm:px-4 lg:px-5 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-5 xl:gap-7">
            
            {/* 1. Leftmost: Bihar Government Emblem */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center">
              <div
                className="p-1 rounded-2xl select-none"
                title="बिहार सरकार - Government of Bihar"
              >
                <img
                  src={emblemImage}
                  alt="बिहार सरकार - Government of Bihar"
                  className="w-22 sm:w-24 md:w-26 lg:w-28 h-auto object-contain select-none"
                  loading="lazy"
                />
              </div>
            </div>

            {/* 2. Left-Center: Recognition Heading & Narrative */}
            <div className="flex-1 min-w-0 text-center lg:text-left">
              {/* Badge */}
              {data.badge && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#15803d] text-white text-[12px] font-semibold shadow-2xs mb-2.5 select-none">
                  <FiCheck className="text-white text-xs stroke-[3]" />
                  <span>
                    <TranslatedText>{data.badge}</TranslatedText>
                  </span>
                </div>
              )}

              {/* Main Headline */}
              <h2 className="text-xl sm:text-2xl lg:text-[23px] xl:text-[25px] font-extrabold text-[#0f172a] tracking-tight leading-snug mb-2 whitespace-normal xl:whitespace-nowrap">
                {data.headingPrefix && (
                  <span>
                    <TranslatedText>{data.headingPrefix}</TranslatedText>{' '}
                  </span>
                )}
                {data.headingHighlight && (
                  <span>
                    <TranslatedText>{data.headingHighlight}</TranslatedText>
                  </span>
                )}
              </h2>

              {/* Description */}
              {data.description && (
                <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed font-normal max-w-xl mx-auto lg:mx-0">
                  <TranslatedText>{data.description}</TranslatedText>
                </p>
              )}

              {/* Action Link: View Recognition Details (ONLY trigger for certificate modal) */}
              <div className="mt-3.5">
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(true)}
                  className="inline-flex items-center gap-2 text-[#15803d] hover:text-[#166534] font-bold text-xs sm:text-[13px] group cursor-pointer transition-colors"
                >
                  <span className="w-4 h-4 rounded-full bg-[#eaf8ef] text-[#15803d] border border-[#bbf7d0] flex items-center justify-center text-[10px] font-extrabold">
                    i
                  </span>
                  <span className="group-hover:underline underline-offset-4">
                    <TranslatedText>{data.detailsLinkText || 'View Recognition Details'}</TranslatedText>
                  </span>
                  <FiArrowRight className="text-sm transform group-hover:translate-x-1 transition-transform text-[#15803d]" />
                </button>
              </div>
            </div>

            {/* Subtle Vertical Divider (Desktop) */}
            {Array.isArray(data.highlights) && data.highlights.length > 0 && (
              <div className="hidden lg:block w-[1.5px] h-28 bg-[#bbf7d0]/80 self-center mx-1 flex-shrink-0" />
            )}

            {/* 3. Middle-Right: Key Recognition Highlights */}
            {Array.isArray(data.highlights) && data.highlights.length > 0 && (
              <div className="flex flex-col gap-2.5 w-full sm:w-auto min-w-[240px] lg:w-64 xl:w-72 shrink-0">
                {data.highlights.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white hover:bg-emerald-50/20 border border-[#e2f4e9] hover:border-emerald-300 rounded-2xl px-4 py-2 sm:py-2.5 flex items-center gap-3.5 shadow-2xs transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#eaf8ef] border border-[#bbf7d0] flex items-center justify-center shrink-0">
                      {renderHighlightIcon(item.iconType || (idx === 1 ? 'leaf' : idx === 2 ? 'file' : 'award'))}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <h4 className="text-xs sm:text-[13px] font-bold text-slate-800 leading-tight">
                        <TranslatedText>{item.title}</TranslatedText>
                      </h4>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                          <TranslatedText>{item.subtitle}</TranslatedText>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 4. Rightmost: Supporting Farmers Callout Box */}
            {(data.tagline || data.buttonText) && (
              <div className="w-full sm:w-auto lg:w-56 xl:w-60 shrink-0">
                <div className="bg-[#e8f7ee] border border-[#bbf0cb] rounded-2xl p-4 sm:p-4.5 flex flex-col justify-between shadow-2xs h-full">
                  
                  {/* Header with Handshake Icon */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-white border border-[#86efac] text-[#15803d] flex items-center justify-center shrink-0 shadow-2xs">
                      <FaHandshake className="text-lg text-[#15803d]" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      {data.tagline && (
                        <h3 className="font-bold text-[#0f172a] text-xs sm:text-sm leading-tight">
                          <TranslatedText>{data.tagline}</TranslatedText>
                        </h3>
                      )}
                      {data.taglineSub && (
                        <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                          <TranslatedText>{data.taglineSub}</TranslatedText>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Explore More Button */}
                  {data.buttonText && (
                    <div className="mt-3.5">
                      <a
                        href={data.buttonUrl || 'https://startup.bihar.gov.in/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-[#064e3b] hover:bg-[#022c22] text-white font-semibold text-xs sm:text-sm py-2.5 px-4 rounded-full inline-flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow hover:-translate-y-0.5 cursor-pointer"
                      >
                        <span>
                          <TranslatedText>{data.buttonText}</TranslatedText>
                        </span>
                        <FiArrowRight className="text-sm" />
                      </a>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Interactive Official Certificate Modal */}
      <AnimatePresence>
        {showCertificateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCertificateModal(false)}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm transition-opacity"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden z-10 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <FiAward className="text-base" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">
                      Bihar Startup Recognition Certificate
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Official Government of Bihar Document • Department of Industries
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCertificateModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              {/* Certificate Image View */}
              <div className="p-4 sm:p-6 bg-slate-950/5 flex items-center justify-center">
                <div className="relative rounded-2xl overflow-hidden border border-emerald-200/80 shadow-lg max-h-[65vh] bg-white">
                  <img
                    src={certificateImage}
                    alt="Bihar Startup Recognition Certificate - GROO Agri"
                    className="w-full h-auto max-h-[65vh] object-contain select-none"
                  />
                </div>
              </div>

              {/* Footer with Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <FiCheckCircle className="text-emerald-600 text-sm" />
                  <span className="font-semibold">Verified Recognition:</span>
                  <span className="text-slate-500">BSPS/GROO/2023/045</span>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={certificateImage}
                    download="GrooAgri_Bihar_Startup_Recognition_Certificate.jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 hover:border-emerald-600 bg-white text-slate-700 hover:text-emerald-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <FiDownload className="text-sm" />
                    <span>Download Certificate</span>
                  </a>

                  <a
                    href={data.buttonUrl || 'https://startup.bihar.gov.in/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <span>Visit Startup Bihar</span>
                    <FiExternalLink className="text-sm" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default StartupRecognition;
