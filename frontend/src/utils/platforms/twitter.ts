/**
 * ============================================================================
 * TWITTER / X PLATFORM HANDLER (Frontend)
 * ============================================================================
 */

export function isTwitterUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.toLowerCase();
  return clean.includes('twitter.com') || clean.includes('x.com');
}

export function extractTweetId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:status|statuses)\/(\d+)/i);
  return match && match[1] ? match[1] : null;
}
