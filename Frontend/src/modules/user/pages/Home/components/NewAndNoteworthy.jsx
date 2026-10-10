import React, { useRef, useEffect } from 'react';
import { createOptimizedScrollAnimation, createOptimizedStaggerAnimation } from '../../../../../utils/optimizedScrollTrigger';
import SimpleServiceCard from '../../../components/common/SimpleServiceCard';

const NewAndNoteworthy = React.memo(({ services, onServiceClick }) => {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const cardsRef = useRef(null);


  const serviceList = services || [];

  // Defer GSAP scroll animations until after initial render for better performance
  useEffect(() => {
    // Skip animations on initial load to improve performance
    const shouldAnimate = typeof window !== 'undefined' &&
      (window.requestIdleCallback || window.setTimeout);

    if (!shouldAnimate || !sectionRef.current || !titleRef.current || !cardsRef.current) {
      // Show content immediately without animation
      if (titleRef.current) titleRef.current.style.opacity = '1';
      if (cardsRef.current) {
        Array.from(cardsRef.current.children).forEach(card => {
          card.style.opacity = '1';
          card.style.transform = 'none';
        });
      }
      return;
    }

    // Defer animation initialization until browser is idle
    const initAnimations = () => {
      const cards = Array.from(cardsRef.current?.children || []);
      if (cards.length === 0) return;

      const cleanupFunctions = [];

      // Animate title
      const titleCleanup = createOptimizedScrollAnimation(
        titleRef.current,
        {
          from: { y: 30, opacity: 0 },
          to: { y: 0, opacity: 1 },
          duration: 0.6,
          ease: 'power2.out',
        },
        { rootMargin: '100px' }
      );
      if (titleCleanup) cleanupFunctions.push(titleCleanup);

      // Stagger animate cards
      const cardsCleanup = createOptimizedStaggerAnimation(
        cards,
        {
          from: { x: 50, opacity: 0, scale: 0.9 },
          to: { x: 0, opacity: 1, scale: 1 },
          duration: 0.5,
          stagger: 0.08,
          ease: 'back.out(1.7)',
        },
        { rootMargin: '150px' }
      );
      if (cardsCleanup) cleanupFunctions.push(cardsCleanup);

      return () => {
        cleanupFunctions.forEach(cleanup => cleanup?.());
      };
    };

    let cleanupFunc = null;
    const runAnimations = () => { cleanupFunc = initAnimations(); };
    // Use requestIdleCallback if available, otherwise setTimeout
    if (window.requestIdleCallback) {
      const idleCallback = window.requestIdleCallback(runAnimations, { timeout: 2000 });
      return () => {
        if (idleCallback) window.cancelIdleCallback(idleCallback);
        if (cleanupFunc) cleanupFunc();
      };
    } else {
      const timeout = setTimeout(runAnimations, 500);
      return () => {
        clearTimeout(timeout);
        if (cleanupFunc) cleanupFunc();
      };
    }
  }, []); // Empty deps - only run once on mount

  if (serviceList.length === 0) {
    return null;
  }

  return (
    <div ref={sectionRef} className="mb-6">
      <div ref={titleRef} className="px-4 mb-5" style={{ opacity: 1 }}>
        <h2
          className="text-xl font-bold text-gray-900 tracking-tight"
        >
          New and noteworthy
        </h2>
      </div>

      <div ref={cardsRef} className="flex gap-2 overflow-x-auto px-6 pb-2 scrollbar-hide">
        {serviceList.map((service) => (
          <SimpleServiceCard
            key={service.id}
            title={service.title}
            image={service.image}
            onClick={() => onServiceClick?.(service)}
          />
        ))}
      </div>
    </div>
  );
});

NewAndNoteworthy.displayName = 'NewAndNoteworthy';

export default NewAndNoteworthy;

