/**
 * ============================================================================
 * UNIFIED PLATFORM DETECTOR & UTILITIES (Frontend)
 * ============================================================================
 */

import { isYouTubeUrl, extractYouTubeId } from './youtube';
import { isInstagramUrl, isInstagramReel } from './instagram';
import { isTwitterUrl } from './twitter';
import { isTwitchUrl, isTwitchClip } from './twitch';

export * from './youtube';
export * from './instagram';
export * from './twitter';
export * from './twitch';

export type VideoPlatform = 'youtube' | 'instagram' | 'twitter' | 'twitch' | 'generic';

export interface PlatformInfo {
  platform: VideoPlatform;
  displayName: string;
  isYouTube: boolean;
  isInstagram: boolean;
  isTwitter: boolean;
  isTwitch: boolean;
  youtubeId: string | null;
}

export function detectPlatform(url: string | null | undefined): PlatformInfo {
  const safeUrl = url || '';
  const isYT = isYouTubeUrl(safeUrl);
  const isIG = isInstagramUrl(safeUrl);
  const isTW = isTwitterUrl(safeUrl);
  const isTV = isTwitchUrl(safeUrl);

  let platform: VideoPlatform = 'generic';
  let displayName = 'Direct Video';

  if (isYT) {
    platform = 'youtube';
    displayName = 'YouTube';
  } else if (isIG) {
    platform = 'instagram';
    displayName = isInstagramReel(safeUrl) ? 'Instagram Reel' : 'Instagram';
  } else if (isTW) {
    platform = 'twitter';
    displayName = 'Twitter / X';
  } else if (isTV) {
    platform = 'twitch';
    displayName = isTwitchClip(safeUrl) ? 'Twitch Clip' : 'Twitch Stream';
  }

  return {
    platform,
    displayName,
    isYouTube: isYT,
    isInstagram: isIG,
    isTwitter: isTW,
    isTwitch: isTV,
    youtubeId: isYT ? extractYouTubeId(safeUrl) : null,
  };
}
