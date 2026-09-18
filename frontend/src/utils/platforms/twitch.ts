/**
 * ============================================================================
 * TWITCH PLATFORM HANDLER (Frontend)
 * ============================================================================
 */

export function isTwitchUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().includes('twitch.tv');
}

export function isTwitchClip(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.toLowerCase();
  return clean.includes('clips.twitch.tv') || clean.includes('/clip/');
}

export function extractTwitchChannel(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)(?:[/?#]|$)/i);
  if (match && match[1] && !['directory', 'videos', 'clip', 'clips', 'p', 'settings', 'downloads', 'popout'].includes(match[1].toLowerCase())) {
    return match[1];
  }
  return null;
}

export function extractTwitchVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/twitch\.tv\/videos\/(\d+)/i);
  return match ? match[1] : null;
}

export function extractTwitchClipId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:clips\.twitch\.tv\/|twitch\.tv\/[a-zA-Z0-9_]+\/clip\/)([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

export function getTwitchEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const parent = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
  const clipId = extractTwitchClipId(url);
  if (clipId) {
    return `https://clips.twitch.tv/embed?clip=${clipId}&parent=${parent}&autoplay=true&muted=false`;
  }
  const videoId = extractTwitchVideoId(url);
  if (videoId) {
    return `https://player.twitch.tv/?video=${videoId}&parent=${parent}&autoplay=true&muted=false`;
  }
  const channel = extractTwitchChannel(url);
  if (channel) {
    return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=true&muted=false`;
  }
  return null;
}
