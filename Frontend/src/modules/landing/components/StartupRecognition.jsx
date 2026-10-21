import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiAward,
  FiExternalLink,
  FiCheckCircle,
  FiShield,
  FiTrendingUp,
  FiStar,
  FiUsers,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import TranslatedText from '../../../components/TranslatedText';
import api from '../../../services/api';
import defaultRecognitionImg from '../landing_images/bihar_startup_recognition.jpg';

const renderHighlightIcon = (type) => {
  switch (type) {
    case 'shield':
      return <FiShield className="text-emerald-500 text-lg md:text-xl" />;
    case 'trending':
      return <FiTrendingUp className="text-blue-500 text-lg md:text-xl" />;
    case 'check':
      return <FiCheckCircle className="text-green-500 text-lg md:text-xl" />;
    case 'star':
      return <FiStar className="text-yellow-500 text-lg md:text-xl" />;
    case 'users':
      return <FiUsers className="text-purple-500 text-lg md:text-xl" />;
    case 'award':
    default:
      return <FiAward className="text-amber-500 text-lg md:text-xl" />;
  }
};

const DEFAULT_DATA = {
  badge: 'STARTUP RECOGNITION & ECOSYSTEM SUPPORT',
  headingPrefix: 'Selected Under',
  headingHighlight: 'Bihar Startup Policy 2022',
  tagline: 'Building India’s Rural Agri Services Infrastructure.',
  description:
    'GROO Agri has been selected for seed funding consideration under the Bihar Startup Policy 2022. We are building technology-driven solutions to make agricultural services, modern farming equipment, and useful information more accessible to farmers across rural India.',
  buttonText: 'Explore Startup Bihar',
  buttonUrl: 'https://startup.bihar.gov.in/',
  portalTrustText: 'Official Government of Bihar Portal',
  imageUrl: defaultRecognitionImg,
  images: [{ url: defaultRecognitionImg, name: 'Bihar Startup Recognition' }],
  highlights: [
    {
      title: 'Seed Funding Consideration',
      subtitle: 'Bihar Startup Policy 2022',
      iconType: 'award',
    },
    {
      title: 'Dept. of Industries Initiative',
      subtitle: 'Government of Bihar',
      iconType: 'shield',
    },
    {
      title: 'Rural AgriTech Innovation',
      subtitle: 'Empowering Bharat Farmers',
      iconType: 'trending',
    },
  ],
  isActive: true,
};

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: 'spring', stiffness: 280, damping: 28 },
      opacity: { duration: 0.35 },
    },
  },
  exit: (direction) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.35, ease: 'easeInOut' },
  }),
};

const StartupRecognition = () => {
  const [data, setData] = useState(DEFAULT_DATA);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await api.get('/content/startup-recognition');
        if (res.data?.success && res.data?.data) {
          setData((prev) => ({
            ...prev,
            ...res.data.data,
            highlights:
              Array.isArray(res.data.data.highlights) && res.data.data.highlights.length > 0
                ? res.data.data.highlights
                : prev.highlights,
          }));
        }
      } catch (err) {
        // Fallback gracefully
      }
    };
    fetchContent();
  }, []);

  // Compute normalized slides array
  const activeImages =
    Array.isArray(data.images) && data.images.length > 0
      ? data.images.map((img) => (typeof img === 'string' ? img : img.url)).filter(Boolean)
      : data.imageUrl
      ? [data.imageUrl]
      : [defaultRecognitionImg];

  // Continuous auto-sliding timer (every 3 seconds)
  useEffect(() => {
    if (activeImages.length <= 1) return;

    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setDirection(1);
        setCurrentSlide((prev) => (prev + 1) % activeImages.length);
      }, 3000);
    };

    startTimer();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeImages.length]);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (activeImages.length > 1) {
      timerRef.current = setInterval(() => {
        setDirection(1);
        setCurrentSlide((prev) => (prev + 1) % activeImages.length);
      }, 3000);
    }
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    setDirection(-1);
    setCurrentSlide((prev) => (prev - 1 + activeImages.length) % activeImages.length);
    resetTimer();
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % activeImages.length);
    resetTimer();
  };

  const handleDotClick = (i, e) => {
    e.stopPropagation();
    setDirection(i > currentSlide ? 1 : -1);
    setCurrentSlide(i);
    resetTimer();
  };

  // If explicitly hidden by admin, do not render section
  if (data.isActive === false) {
    return null;
  }

  return (
    <section className="relative py-16 md:py-24 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white overflow-hidden border-y border-emerald-500/20">
      {/* Background Decorative Ambient Lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Text & Recognition Details */}
          <div className="lg:col-span-7">
            {/* Eyebrow Badge */}
            {data.badge && (
              <motion.div
                initial={{ opacity: 0, y: -15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-400 text-xs md:text-sm font-bold tracking-wider uppercase mb-5 backdrop-blur-md shadow-lg shadow-emerald-950/40"
              >
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <FiAward className="text-amber-400" />
                <span>
                  <TranslatedText>{data.badge}</TranslatedText>
                </span>
              </motion.div>
            )}

            {/* Main Heading */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4"
            >
              {data.headingPrefix && <TranslatedText>{data.headingPrefix}</TranslatedText>}{' '}
              {data.headingHighlight && (
                <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
                  <TranslatedText>{data.headingHighlight}</TranslatedText>
                </span>
              )}
            </motion.h2>

            {/* Supporting Tagline */}
            {data.tagline && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="inline-block text-base md:text-lg font-semibold text-emerald-300/90 mb-5 border-l-4 border-amber-400 pl-3 italic"
              >
                <TranslatedText>{data.tagline}</TranslatedText>
              </motion.div>
            )}

            {/* Narrative Description */}
            {data.description && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-slate-300 text-sm md:text-base leading-relaxed mb-8 max-w-2xl font-normal"
              >
                <TranslatedText>{data.description}</TranslatedText>
              </motion.p>
            )}

            {/* Impact Pillars / Micro-Highlights */}
            {Array.isArray(data.highlights) && data.highlights.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-8"
              >
                {data.highlights.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 flex items-center space-x-3 shadow-md"
                  >
                    <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex-shrink-0">
                      {renderHighlightIcon(item.iconType)}
                    </div>
                    <div>
                      <h4 className="text-xs md:text-sm font-bold text-white leading-tight">
                        <TranslatedText>{item.title}</TranslatedText>
                      </h4>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          <TranslatedText>{item.subtitle}</TranslatedText>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* CTA Button and Credibility Tag */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap items-center gap-4"
            >
              {data.buttonText && data.buttonUrl && (
                <a
                  href={data.buttonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold px-7 py-3 rounded-full text-sm shadow-xl shadow-emerald-900/40 hover:shadow-emerald-900/60 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>
                    <TranslatedText>{data.buttonText}</TranslatedText>
                  </span>
                  <FiExternalLink className="text-base" />
                </a>
              )}

              {data.portalTrustText && (
                <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
                  <FiCheckCircle className="text-emerald-400 text-sm" />
                  <span>
                    <TranslatedText>{data.portalTrustText}</TranslatedText>
                  </span>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Column: Visual Recognition Showcase Slider */}
          <div className="lg:col-span-5 flex justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative group w-full max-w-lg"
            >
              {/* Outer Glow Halo */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500/30 via-emerald-500/30 to-yellow-500/30 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition duration-700 pointer-events-none" />

              {/* Card / Slider Container */}
              <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-emerald-400/30 bg-slate-900/90 shadow-2xl backdrop-blur-md aspect-[4/3] flex items-center justify-center">
                <AnimatePresence initial={false} custom={direction}>
                  <motion.div
                    key={currentSlide}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="absolute inset-0 w-full h-full"
                  >
                    <img
                      src={activeImages[currentSlide % activeImages.length]}
                      alt={data.headingHighlight || 'Recognition - GROO Agri'}
                      className="w-full h-full object-cover select-none pointer-events-none"
                      loading="lazy"
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Left/Right Navigation Arrows if > 1 image */}
                {activeImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/85 border border-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all opacity-80 group-hover:opacity-100 hover:scale-110 z-20 cursor-pointer shadow-lg"
                      aria-label="Previous slide"
                    >
                      <FiChevronLeft className="text-xl" />
                    </button>

                    <button
                      type="button"
                      onClick={handleNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/85 border border-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all opacity-80 group-hover:opacity-100 hover:scale-110 z-20 cursor-pointer shadow-lg"
                      aria-label="Next slide"
                    >
                      <FiChevronRight className="text-xl" />
                    </button>

                    {/* Bottom Indicator Dots */}
                    <div className="absolute bottom-3 inset-x-0 flex justify-center items-center gap-1.5 z-20 pointer-events-auto">
                      {activeImages.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => handleDotClick(i, e)}
                          className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                            i === currentSlide % activeImages.length
                              ? 'w-6 bg-gradient-to-r from-yellow-400 to-emerald-400 shadow-md shadow-emerald-500/50'
                              : 'w-2 bg-white/40 hover:bg-white/70'
                          }`}
                          aria-label={`Go to slide ${i + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default StartupRecognition;
