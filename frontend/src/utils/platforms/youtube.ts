/**
 * ============================================================================
 * YOUTUBE PLATFORM HANDLER (Frontend)
 * ============================================================================
 */

export function isYouTubeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.toLowerCase();
  return clean.includes('youtube.com') || clean.includes('youtu.be');
}

export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/);
  return match && match[2].length === 11 ? match[2] : null;
}

export const YOUTUBE_PLAYER_VARS = {
  controls: 0,
  modestbranding: 1,
  rel: 0,
  disablekb: 1,
  fs: 0,
  playsinline: 1,
  cc_load_policy: 0,
  iv_load_policy: 3,
  autohide: 1,
};
