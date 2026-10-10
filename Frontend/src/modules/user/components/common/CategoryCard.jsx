import React, { useRef, memo, useEffect } from 'react';
import { gsap } from 'gsap';
import { themeColors } from '../../../../theme';
import { useLanguage } from '../../../../context/LanguageContext';

// Pre-defined agriculture colors for the mockup
const bgColors = [
  '#A0B788', // Olive green (Tractor Rental)
  '#F4C365', // Mustard Yellow (JCB Excavation)
  '#C97658', // Terracotta/Brown (Seed Sowing)
  '#D78A7A', // Salmon/Peach (Pest Control)
  '#F5C563', // Mustard Yellow (Harvester)
  '#B89B77', // Light Brown (Soil)
  '#CAE0CD', // Pale Mint Green (Irrigation)
  '#A0B788'  // Olive green (Spares)
];

const CategoryCard = memo(({ icon, title, onClick, hasSaleBadge = false, index = 0 }) => {
  const cardRef = useRef(null);
  const { t } = useLanguage();

  // Simple entrance animation
  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { y: 15, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.4,
          delay: index * 0.05,
          ease: 'power2.out',
        }
      );
    }
  }, [index]);

  const bgColor = bgColors[index % bgColors.length];

  return (
    <div
      ref={cardRef}
      className="flex flex-col items-center cursor-pointer relative group transition-all duration-300 ease-out hover:-translate-y-1.5 active:scale-95 w-[85px] h-[105px] rounded-[12px] overflow-hidden shadow-sm hover:shadow-md"
      onClick={onClick}
      style={{
        opacity: 0,
        backgroundColor: bgColor,
      }}
    >
      {/* Image Container - Maximized */}
      <div className="w-full h-[75%] relative overflow-hidden bg-white/10 group-hover:bg-white/20 transition-colors">
        {icon ? (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            {React.isValidElement(icon) && icon.type === 'img' ? (
               React.cloneElement(icon, { 
                 className: `w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${icon.props.className || ''}` 
               })
            ) : (
              <div className="w-full h-full flex items-center justify-center p-2 transform transition-transform duration-500 group-hover:scale-110">
                {icon}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {hasSaleBadge && (
          <div
            className="absolute top-1.5 right-1.5 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg z-10 border border-white/30 backdrop-blur-sm"
            style={{
              background: themeColors.gradient,
            }}
          >
            SALE
          </div>
        )}
      </div>

      {/* Title Container */}
      <div className="w-full h-[25%] flex items-center justify-center px-1.5 bg-black/5">
        <span
          className="text-[9.5px] leading-[1.1] text-center font-bold tracking-tight text-[#2c3e21] line-clamp-2"
        >
          {t(title)}
        </span>
      </div>
    </div>
  );
});

CategoryCard.displayName = 'CategoryCard';

export default CategoryCard;

