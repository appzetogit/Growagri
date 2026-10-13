import React, { memo, useRef, useEffect } from 'react';
import { themeColors } from '../../../../theme';
import OptimizedImage from '../../../../components/common/OptimizedImage';
import OptimizedVideo from '../../../../components/common/OptimizedVideo';
import { getYouTubeVideoId, isDirectVideoUrl } from '../../../../utils/videoUtils';

const ServiceCard = memo(({ image, title, onClick, gif, youtubeUrl }) => {
  const cardRef = useRef(null);
  const iframeRef = useRef(null);

  // Check if either youtubeUrl or gif contains a YouTube link
  const ytCandidate = youtubeUrl || (typeof gif === 'string' && (gif.includes('youtube') || gif.includes('youtu.be')) ? gif : null);
  const videoId = getYouTubeVideoId(ytCandidate);

  // Note: Omit &playlist to avoid playlist next/prev buttons (|<<, >>|)
  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1`
    : null;

  // Auto-loop seamlessly using postMessage API without playlist UI
  useEffect(() => {
    if (!videoId) return;

    const handleMessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.event === 'onStateChange' && data.info === 0) {
          if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }),
              '*'
            );
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
              '*'
            );
          }
        }
      } catch (e) {
        // Ignore non-JSON postMessage
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [videoId]);

  const onIframeLoad = () => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'listening' }),
          '*'
        );
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'mute', args: '' }),
          '*'
        );
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
          '*'
        );
      }
    } catch (e) {}
  };

  const renderMedia = () => {
    if (videoId && embedUrl) {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      return (
        <div className="relative w-full h-full bg-black overflow-hidden">
          {/* Instant poster image so preview is immediately visible */}
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover absolute inset-0"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/0.jpg`;
            }}
          />
          {/* Scaled iframe: hides YouTube channel header & bottom watermark outside overflow */}
          <iframe
            ref={iframeRef}
            src={embedUrl}
            onLoad={onIframeLoad}
            className="absolute pointer-events-none select-none"
            style={{
              width: '124%',
              height: '124%',
              top: '-12%',
              left: '-12%',
              border: 0,
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            title={title}
          />
          {/* Full-coverage transparent overlay: intercepts all touch/click events so YouTube iframe never pauses or displays buttons */}
          <div className="absolute inset-0 z-10 w-full h-full" />
        </div>
      );
    }

    const mediaUrl = gif || image;
    const directVideo = isDirectVideoUrl(mediaUrl) ? mediaUrl : (isDirectVideoUrl(youtubeUrl) ? youtubeUrl : null);

    if (directVideo) {
      return (
        <OptimizedVideo
          src={directVideo}
          className="w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      );
    }

    if (mediaUrl) {
      return (
        <OptimizedImage
          src={mediaUrl}
          alt={title}
          className="w-full h-full object-cover"
          width={480}
        />
      );
    }

    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
        <svg
          className="w-16 h-16 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    );
  };

  return (
    <div
      ref={cardRef}
      className="relative min-w-[200px] md:min-w-[240px] h-[350px] md:h-[420px] rounded-2xl overflow-hidden cursor-pointer transition-transform duration-300 ease-out hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98] select-none"
      style={{
        boxShadow: themeColors.cardShadow,
        border: themeColors.cardBorder,
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
      onClick={onClick}
    >
      {renderMedia()}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 z-20 pointer-events-none">
        <h3 className="text-white font-semibold text-base line-clamp-2">{title}</h3>
      </div>
    </div>
  );
});

ServiceCard.displayName = 'ServiceCard';
export default ServiceCard;
