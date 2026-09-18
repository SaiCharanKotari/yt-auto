/**
 * ============================================================================
 * INSTAGRAM PLATFORM HANDLER (Frontend)
 * ============================================================================
 */

export function isInstagramUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().includes('instagram.com');
}

export function isInstagramReel(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().includes('/reel/') || url.toLowerCase().includes('/reels/');
}
