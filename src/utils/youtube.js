/**
 * YouTube Utility functions
 * Extracts video ID and generates secure embed attributes
 */

function extractYouTubeId(urlOrId) {
  if (!urlOrId || typeof urlOrId !== 'string') return null;

  const trimmed = urlOrId.trim();

  // If it's already just an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle Shorts: youtube.com/shorts/VIDEO_ID
  const shortsMatch = trimmed.match(/(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch && shortsMatch[1]) {
    return shortsMatch[1];
  }

  // Handle youtu.be/VIDEO_ID
  const shortUrlMatch = trimmed.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (shortUrlMatch && shortUrlMatch[1]) {
    return shortUrlMatch[1];
  }

  // Handle youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/i);
  if (watchMatch && watchMatch[1]) {
    return watchMatch[1];
  }

  // Handle youtube.com/embed/VIDEO_ID
  const embedMatch = trimmed.match(/(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i);
  if (embedMatch && embedMatch[1]) {
    return embedMatch[1];
  }

  // Generic fallback regex
  const genericMatch = trimmed.match(/(?:[?&]v=|\/embed\/|\/shorts\/|\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1];
  }

  return null;
}

module.exports = {
  extractYouTubeId
};
