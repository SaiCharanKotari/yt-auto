/**
 * ============================================================================
 * TWITCH STREAM RESOLVER SERVICE
 * ============================================================================
 * Resolves Twitch Channels, Active Live DVR VODs, Standard VODs, and Clips
 * to their direct HLS stream / media URLs using Twitch GQL and yt-dlp.
 * ============================================================================
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface StreamResolutionResult {
  streamUrl: string;
  sourceType: 'dvr' | 'live' | 'vod' | 'clip';
  vodId?: string;
  channel?: string;
}

interface CacheEntry {
  result: StreamResolutionResult;
  expiresAt: number;
}

const streamCache = new Map<string, CacheEntry>();

export class TwitchStreamResolverService {
  /**
   * Resolves the active recording DVR VOD ID for a live Twitch channel via GQL
   */
  static async resolveActiveDvrVod(channelName: string): Promise<string | null> {
    const channel = channelName.toLowerCase().trim();
    if (!channel || ['videos', 'clip', 'directory', 'p', 'settings'].includes(channel)) {
      return null;
    }

    try {
      const gqlRes = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: {
          'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `query { user(login: "${channel}") { stream { id createdAt } videos(first: 3, sort: TIME) { edges { node { id status broadcastType createdAt } } } } }`,
        }),
      });

      if (!gqlRes.ok) return null;

      const gqlData = await gqlRes.json();
      const userObj = gqlData?.data?.user;
      const streamObj = userObj?.stream;
      const edges = userObj?.videos?.edges || [];

      // 1. Explicit RECORDING status is the active DVR VOD of the live stream
      let recordingVod = edges.find((e: any) => e?.node?.status === 'RECORDING')?.node;

      // 2. If broadcaster's stream is active and the latest video is an ARCHIVE broadcast
      if (!recordingVod && streamObj?.id && edges.length > 0) {
        const topNode = edges[0]?.node;
        if (topNode?.broadcastType === 'ARCHIVE') {
          recordingVod = topNode;
        }
      }

      if (recordingVod?.id) {
        return String(recordingVod.id);
      }
    } catch (err: any) {
      console.warn(`[Twitch Stream Resolver] GQL DVR check error for ${channel}:`, err.message);
    }
    return null;
  }

  /**
   * Resolves direct HLS stream URL for any Twitch URL (Channel, DVR VOD, regular VOD, Clip)
   */
  static async resolveStreamUrl(
    targetUrl: string,
    ytDlpBin: string,
    quality?: string,
    forceRefresh = false
  ): Promise<StreamResolutionResult> {
    const cacheKey = `${targetUrl.trim()}_${quality || 'best'}`;

    if (!forceRefresh) {
      const cached = streamCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
      }
    }

    const cleanUrl = targetUrl.split('?')[0].replace(/\/$/, '');
    const channelMatch = cleanUrl.match(/twitch\.tv\/([a-zA-Z0-9_]+)$/i);
    const isChannel = Boolean(channelMatch && channelMatch[1] && !['videos', 'clip', 'directory', 'p', 'settings'].includes(channelMatch[1].toLowerCase()));
    const channel = isChannel ? channelMatch![1].toLowerCase() : undefined;

    let targetResolveUrl = targetUrl;
    let vodId: string | undefined;
    let sourceType: 'dvr' | 'live' | 'vod' | 'clip' = 'vod';

    if (targetUrl.includes('/clip/') || targetUrl.includes('clips.twitch.tv')) {
      sourceType = 'clip';
    } else if (isChannel && channel) {
      const dvrVodId = await this.resolveActiveDvrVod(channel);
      if (dvrVodId) {
        vodId = dvrVodId;
        sourceType = 'dvr';
        targetResolveUrl = `https://www.twitch.tv/videos/${dvrVodId}`;
        console.log(`[Twitch Stream Resolver] 🎯 Resolved live channel "${channel}" to active DVR VOD: ${targetResolveUrl}`);
      } else {
        sourceType = 'live';
        console.log(`[Twitch Stream Resolver] 📡 Live DVR VOD not found, using live channel stream: ${targetResolveUrl}`);
      }
    } else if (targetUrl.includes('/videos/')) {
      sourceType = 'vod';
      const match = targetUrl.match(/videos\/(\d+)/);
      if (match) vodId = match[1];
    }

    // Determine format string based on requested quality
    let formatFilter = 'best/bestvideo+bestaudio';
    if (quality && quality !== 'source' && quality !== 'best') {
      const height = parseInt(quality.replace('p', ''), 10);
      if (!isNaN(height) && height > 0) {
        formatFilter = `best[height<=${height}]/bestvideo[height<=${height}]+bestaudio/best`;
      }
    }

    console.log(`[Twitch Stream Resolver] 🔗 Resolving HLS stream URL via yt-dlp (-g, format: ${formatFilter}) for: ${targetResolveUrl}`);

    const cmd = `"${ytDlpBin}" -g -f "${formatFilter}" --no-warnings --no-check-certificate "${targetResolveUrl}"`;
    const { stdout } = await execAsync(cmd, { timeout: 25000 });
    const streamUrl = stdout.trim().split('\n')[0].trim();

    if (!streamUrl || !streamUrl.startsWith('http')) {
      throw new Error(`Failed to resolve direct HLS stream URL from Twitch URL: ${targetUrl}`);
    }

    const result: StreamResolutionResult = {
      streamUrl,
      sourceType,
      vodId,
      channel,
    };

    // Cache valid URL for 10 minutes
    streamCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return result;
  }
}
