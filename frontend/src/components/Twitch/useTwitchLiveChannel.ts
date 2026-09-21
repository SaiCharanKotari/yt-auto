/**
 * useTwitchLiveChannel.ts
 *
 * Utility helpers for Twitch live channel URLs.
 * Stream resolution and HLS preview is now handled centrally by useTwitchPreview.
 */

/** Returns true if URL is a Twitch live channel (not a VOD or clip) */
export function isTwitchLiveChannelUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.trim().replace(/\/$/, '');
  return (
    /twitch\.tv\/([a-zA-Z0-9_]+)$/i.test(clean) &&
    !clean.includes('/videos') &&
    !clean.includes('/clip')
  );
}
