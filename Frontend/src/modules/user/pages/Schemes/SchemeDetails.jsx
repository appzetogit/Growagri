import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft,
  FiShare2,
  FiExternalLink,
  FiCheckCircle,
  FiFileText,
  FiInfo,
  FiShield
} from 'react-icons/fi';
import { FaWhatsapp, FaLandmark, FaTractor } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import schemeService from '../../../../services/schemeService';

// Custom Wheat / Grain sprout icon for PMFBY
const WheatIcon = ({ className = 'w-6 h-6' }) => (
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
  </svg>
);

// Custom Sprout with soil base icon for Soil Health Card
const SproutSoilIcon = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="5.5" y="18.5" width="13" height="2.2" rx="1.1" fill="#7e22ce" />
    <rect x="10.8" y="11" width="2.4" height="8" rx="1.2" fill="#7e22ce" />
    <path d="M11 13C6.2 13 4.2 10.2 4.2 7.8C7.5 7.2 10.5 9.2 11.5 12" fill="#9333ea" />
    <path d="M13 13C17.8 13 19.8 10.2 19.8 7.8C16.5 7.2 13.5 9.2 12.5 12" fill="#9333ea" />
  </svg>
);

export default function SchemeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [scheme, setScheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFabTooltip, setShowFabTooltip] = useState(true);

  useEffect(() => {
    let isMounted = true;

    schemeService
      .getSchemeByIdentifier(id)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setScheme(res.data);
          setError(null);
        } else {
          setError('Scheme not found');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching scheme:', err);
        setError('Unable to load scheme details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    window.scrollTo(0, 0);

    // Auto-hide tooltip after 6 seconds
    const timer = setTimeout(() => {
      if (isMounted) setShowFabTooltip(false);
    }, 6000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [id]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: scheme?.title || 'Government Scheme',
        text: `Check out ${scheme?.fullName || scheme?.title} on GrooAgri`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleOpenWhatsApp = () => {
    if (!scheme) return;
    const phone = scheme.effectiveWhatsapp || scheme.whatsappNumber || '+91 91177 04450';
    const cleanNumber = phone.replace(/\D/g, '');
    const message =
      scheme.whatsappMessage ||
      `Namaste GrooAgri Team, I would like to inquire about the ${scheme.title} (${scheme.fullName}) scheme. Please guide me regarding the application process.`;

    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const renderIcon = (iconType, sizeClass = 'w-6 h-6') => {
    switch (iconType) {
      case 'tractor':
        return <FaTractor className={`${sizeClass} text-[#166534]`} />;
      case 'wheat':
        return <WheatIcon className={sizeClass} />;
      case 'rupee':
        return (
          <div className="w-7 h-7 rounded-full bg-[#2563eb] text-white flex items-center justify-center font-bold text-sm shadow-xs">
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-700">Loading Scheme Details...</p>
        <p className="text-xs text-slate-400 mt-1">Connecting to Government Scheme Database</p>
      </div>
    );
  }

  if (error || !scheme) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-2xl mb-4">
          <FiInfo />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Scheme Information Unavailable</h2>
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-6">
          {error || "The government scheme you requested could not be located."}
        </p>
        <button
          onClick={() => navigate('/user')}
          className="px-5 py-2.5 bg-[#166534] text-white rounded-xl text-xs font-bold shadow-md hover:bg-[#14532d] transition-all"
        >
          Return to Home
        </button>
      </div>
    );
  }

  // Fallback agricultural banner if none provided
  const bannerUrl =
    scheme.bannerImage ||
    'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?q=80&w=1200&auto=format&fit=crop';

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-28 select-none">
      {/* Sticky App Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors active:scale-95"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              {scheme.title}
            </h1>
            <p className="text-[11px] text-slate-500 truncate max-w-[200px] sm:max-w-xs">
              {scheme.category || 'Official Government Scheme'}
            </p>
          </div>
        </div>

        <button
          onClick={handleShare}
          title="Share Scheme"
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors active:scale-95"
        >
          <FiShare2 className="w-4 h-4" />
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Hero Banner Section */}
        <div className="relative rounded-[26px] overflow-hidden shadow-md border border-slate-200/70 bg-slate-900 min-h-[190px] sm:min-h-[240px]">
          <img
            src={bannerUrl}
            alt={scheme.title}
            className="w-full h-full object-cover max-h-[260px] opacity-95 transition-transform duration-700 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Banner Overlays */}
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/95 backdrop-blur-md text-emerald-800 shadow-md">
              <FiShield className="text-emerald-600" />
              Verified Govt Scheme
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h2 className="text-xl sm:text-2xl font-black drop-shadow-md leading-tight">
              {scheme.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 drop-shadow-sm mt-1 line-clamp-1">
              {scheme.fullName}
            </p>
          </div>
        </div>

        {/* Title & Badge Overview Card */}
        <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl ${
                  scheme.badgeBg || 'bg-[#dcfce7]'
                } flex items-center justify-center shadow-xs flex-shrink-0`}
              >
                {renderIcon(scheme.iconType, 'w-6 h-6')}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {scheme.category || 'Central Government'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 leading-snug">
                  {scheme.fullName}
                </h3>
              </div>
            </div>
          </div>

          {scheme.shortDescription && (
            <p className="text-xs sm:text-[13px] text-slate-600 font-medium leading-relaxed pt-1 border-t border-slate-100">
              {scheme.shortDescription}
            </p>
          )}
        </div>

        {/* Key Benefits Card */}
        <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/50 rounded-[24px] p-5 border border-emerald-100/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shadow-xs">
              <FiCheckCircle />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">Key Benefits & Financial Assistance</h4>
              <p className="text-[11px] text-emerald-700">What farmers receive under this program</p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {Array.isArray(scheme.benefits) && scheme.benefits.length > 0 ? (
              scheme.benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-2.5 text-xs text-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                  <p className="leading-relaxed font-medium">{benefit}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Direct financial and agricultural support provided to registered farmers.
              </p>
            )}
          </div>
        </div>

        {/* Detailed Description / About Scheme */}
        {scheme.detailedDescription && (
          <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-2">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FiInfo className="text-emerald-700" /> About the Scheme
            </h4>
            <p className="text-xs sm:text-[13px] text-slate-700 font-normal leading-relaxed whitespace-pre-line pt-1">
              {scheme.detailedDescription}
            </p>
          </div>
        )}

        {/* Eligibility Criteria */}
        <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
              <FiCheckCircle />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Eligibility Criteria</h4>
              <p className="text-[11px] text-slate-500">Who can apply for this scheme</p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {Array.isArray(scheme.eligibility) && scheme.eligibility.length > 0 ? (
              scheme.eligibility.map((item, index) => (
                <div key={index} className="flex items-start gap-2.5 text-xs text-slate-700">
                  <FiCheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <p className="leading-relaxed font-medium">{item}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-600">All registered farmers across India holding cultivable land.</p>
            )}
          </div>
        </div>

        {/* Required Documents Checklist */}
        {Array.isArray(scheme.documentsRequired) && scheme.documentsRequired.length > 0 && (
          <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm">
                <FiFileText />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Required Documents</h4>
                <p className="text-[11px] text-slate-500">Keep these ready before applying</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {scheme.documentsRequired.map((doc, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200/60"
                >
                  <FiCheckCircle className="text-purple-600 text-[11px]" />
                  {doc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Direct Connect With Admin Support Card */}
        <div className="bg-gradient-to-r from-emerald-900 to-teal-950 rounded-[24px] p-5 text-white shadow-lg space-y-3 relative overflow-hidden">
          <div className="absolute right-[-15px] bottom-[-15px] opacity-10 text-white text-9xl pointer-events-none">
            <FaWhatsapp />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-2xl text-green-400">
              <FaWhatsapp />
            </div>
            <div>
              <h4 className="text-sm font-bold leading-tight">Need Help With {scheme.title}?</h4>
              <p className="text-[11px] text-emerald-200 mt-0.5">
                Connect directly with GrooAgri Admin team on WhatsApp
              </p>
            </div>
          </div>

          <p className="text-xs text-emerald-100 leading-relaxed font-normal">
            Have questions about eligibility, application status, or documentation? Our team is available on WhatsApp to guide you.
          </p>

          <button
            onClick={handleOpenWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <FaWhatsapp className="text-base text-slate-950" />
            Chat with Admin on WhatsApp
          </button>
        </div>

        {/* Primary Official Portal CTA Button */}
        <div className="pt-2">
          <a
            href={scheme.officialPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl bg-[#166534] hover:bg-[#14532d] text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-950/15 hover:shadow-xl transition-all active:scale-95 group text-center cursor-pointer"
          >
            <span>Visit Official Portal</span>
            <FiExternalLink className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
          <p className="text-[11px] text-center text-slate-400 mt-2">
            Opens the official government portal ({scheme.officialPortalUrl?.replace(/^https?:\/\//, '').split('/')[0]}) in a new window
          </p>
        </div>
      </main>

      {/* Floating Dynamic WhatsApp Icon (FAB) */}
      <div className="fixed bottom-6 right-5 z-50 flex items-center gap-2">
        {/* Tooltip bubble */}
        <AnimatePresence>
          {showFabTooltip && (
            <Motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleOpenWhatsApp}
              className="bg-slate-900 text-white text-xs font-semibold py-1.5 px-3 rounded-full shadow-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5 border border-slate-700"
            >
              <span>Chat with Admin</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFabTooltip(false);
                }}
                className="text-slate-400 hover:text-white text-xs ml-0.5"
              >
                ×
              </button>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* WhatsApp Floating Button */}
        <Motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleOpenWhatsApp}
          title={`Inquire about ${scheme.title} on WhatsApp`}
          className="relative w-14 h-14 rounded-full bg-[#25D366] text-white shadow-2xl flex items-center justify-center text-3xl hover:bg-[#20ba59] transition-colors focus:outline-none focus:ring-4 focus:ring-green-400/40 cursor-pointer"
        >
          {/* Subtle pulse ripple ring */}
          <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-30 animate-ping pointer-events-none" />
          <FaWhatsapp className="relative z-10" />
        </Motion.button>
      </div>
    </div>
  );
}
