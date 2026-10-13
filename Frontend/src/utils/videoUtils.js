/**
 * Video utility functions for extracting video IDs and handling media URLs.
 */

/**
 * Extracts YouTube video ID from various YouTube URL formats
 * (Standard, Shorts, youtu.be, embed, live, mobile, etc.)
 * @param {string} url - YouTube URL
 * @returns {string|null} - 11 character YouTube video ID or null
 */
export const getYouTubeVideoId = (url) => {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();
  
  // 1. YouTube Shorts: youtube.com/shorts/<id> or youtu.be/shorts/<id>
  const shortsMatch = cleanUrl.match(/(?:youtube\.com|youtu\.be)\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1];

  // 2. Standard watch, embed, v, live, youtu.be URLs
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/i;
  const match = cleanUrl.match(regExp);
  if (match && match[1]) return match[1];

  // 3. Fallback: match 11-char ID if domain contains youtube
  if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
    const idMatch = cleanUrl.match(/([a-zA-Z0-9_-]{11})/);
    if (idMatch && idMatch[1]) return idMatch[1];
  }

  return null;
};

/**
 * Checks if a URL points to a direct video file or Cloudinary video stream
 * @param {string} url - URL to check
 * @returns {boolean}
 */
export const isDirectVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('video/upload') ||
    /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) ||
    /^https:\/\/res\.cloudinary\.com.*\/video\//i.test(url)
  );
};
