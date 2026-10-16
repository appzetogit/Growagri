import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import api from '../../../services/api';
import TranslatedText from '../../../components/TranslatedText';

// Fallback high-quality agricultural banners when none uploaded by admin yet
const DEFAULT_BANNERS = [
  {
    _id: 'default-1',
    imageUrl: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=1200&q=80',
    title: ''
  },
  {
    _id: 'default-2',
    imageUrl: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80',
    title: ''
  },
  {
    _id: 'default-3',
    imageUrl: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=1200&q=80',
    title: ''
  }
];

const HeroBannerSlider = () => {
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef(null);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await api.get('/public/website/banners');
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setBanners(res.data.data);
        } else {
          setBanners(DEFAULT_BANNERS);
        }
      } catch (err) {
        setBanners(DEFAULT_BANNERS);
      }
    };
    fetchBanners();
  }, []);

  const activeBanners = banners.length > 0 ? banners : DEFAULT_BANNERS;

  // Auto-play timer (5 seconds)
  useEffect(() => {
    if (activeBanners.length <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
    }, 5000);

    return () => clearInterval(timerRef.current);
  }, [activeBanners.length, isPaused]);

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);
  };

  const currentBanner = activeBanners[currentIndex] || activeBanners[0];

  const slideVariants = {
    enter: (dir) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.35 }
      }
    },
    exit: (dir) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
      transition: { duration: 0.3 }
    })
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
      className="relative w-full max-w-xl mx-auto lg:max-w-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Ambient Gradient Glow Backdrop */}
      <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/25 via-yellow-500/20 to-teal-500/25 rounded-[2.5rem] blur-xl opacity-75 animate-pulse pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative rounded-[2rem] overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl group">
        {/* Banner Aspect Box */}
        <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentBanner._id || currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 w-full h-full"
            >
              {/* Background Banner Image */}
              <img
                src={currentBanner.imageUrl}
                alt={currentBanner.title || 'GrooAgri Banner'}
                className="w-full h-full object-cover"
                loading="eager"
              />

              {/* Optional Text Overlay (only if custom title is set) */}
              {currentBanner.title && currentBanner.title !== 'Banner' && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 z-10">
                    <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
                      <TranslatedText>{currentBanner.title}</TranslatedText>
                    </h3>
                    {currentBanner.subtitle && (
                      <p className="text-xs sm:text-sm text-gray-200 mt-1">
                        <TranslatedText>{currentBanner.subtitle}</TranslatedText>
                      </p>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Prev / Next Manual Arrows (Shown on Hover) */}
          {activeBanners.length > 1 && (
            <div className="absolute inset-y-0 left-2 right-2 flex items-center justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="w-9 h-9 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center pointer-events-auto backdrop-blur-md shadow-lg transition-transform active:scale-90"
                aria-label="Previous Banner"
              >
                <FiChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="w-9 h-9 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center pointer-events-auto backdrop-blur-md shadow-lg transition-transform active:scale-90"
                aria-label="Next Banner"
              >
                <FiChevronRight size={22} />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Slide Indicators */}
        {activeBanners.length > 1 && (
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 border-t border-white/10 flex items-center justify-center gap-2">
            {activeBanners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setDirection(idx > currentIndex ? 1 : -1);
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentIndex === idx 
                    ? 'w-7 bg-gradient-to-r from-yellow-400 to-emerald-400' 
                    : 'w-2 bg-white/30 hover:bg-white/50'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default HeroBannerSlider;
