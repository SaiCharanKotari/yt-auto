/**
 * ============================================================================
 * TWITCH DOWNLOADER SERVICE
 * ============================================================================
 * Handles downloading Twitch Clips, VODs, and Broadcasts at source quality,
 * remuxing to MP4, and applying FFmpeg trim/crop.
 * ============================================================================
 */

import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getFFmpegAspectFilter } from '../video-crop.service.js';

function formatSecondsToTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const ms = Math.floor((seconds % 1) * 1000);
  if (ms > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const execAsync = promisify(exec);

export interface TwitchDownloadOptions {
  url: string;
  format?: string;
  quality?: string;
  audioQuality?: string | number;
  trimStart?: number;
  trimEnd?: number;
  aspectRatio?: string;
  fitMode?: 'crop' | 'pad';
  cropPosition?: string;
  cropBox?: any;
  tempRawFile: string;
  finalFile: string;
  ytDlpBin: string;
  ffmpegBin: string;
  onProgress?: (phase: string, percent?: number, speed?: string) => void;
}

export class TwitchDownloaderService {
  /**
   * Downloads Twitch clip/VOD/stream and applies trim/crop
   */
  static async downloadClip(options: TwitchDownloadOptions): Promise<string> {
    const {
      url,
      format = 'mp4',
      audioQuality = '0',
      trimStart = 0,
      trimEnd,
      aspectRatio,
      fitMode = 'pad',
      cropPosition = 'center',
      cropBox,
      tempRawFile,
      finalFile,
      ytDlpBin,
      ffmpegBin,
      onProgress,
    } = options;

    const isAudio = format === 'mp3' || format === 'wav' || format === 'm4a' || format === 'aac';
    const isTrimmed = typeof trimEnd === 'number' && trimEnd > trimStart;
    const filterString = !isAudio ? getFFmpegAspectFilter(aspectRatio as any, fitMode, cropPosition as any, cropBox) : '';
    const needsCrop = !isAudio && Boolean(filterString);

    const rawTarget = needsCrop ? tempRawFile : finalFile;

    // Resolve active recording VOD if downloading a trimmed clip from a channel URL
    let targetMediaUrl = url;
    const channelMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)(?:\/)?$/i);
    if (channelMatch && channelMatch[1] && !['videos', 'clip', 'directory'].includes(channelMatch[1].toLowerCase())) {
      try {
        const channel = channelMatch[1].toLowerCase();
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
        if (gqlRes.ok) {
          const gqlData = await gqlRes.json();
          const liveUser = gqlData?.data?.user;
          const recordingVod = liveUser?.videos?.edges?.find((e: any) => {
            const n = e?.node;
            return n?.status === 'RECORDING' || n?.broadcastType === 'ARCHIVE';
          })?.node;
          if (recordingVod?.id) {
            targetMediaUrl = `https://www.twitch.tv/videos/${recordingVod.id}`;
            console.log(`[Twitch Downloader] Resolved live channel ${channel} to active DVR VOD: ${targetMediaUrl}`);
          }
        }
      } catch (e: any) {
        console.warn('[Twitch Downloader] Could not resolve DVR VOD, using channel URL:', e.message);
      }
    }

    const ytDlpArgs: string[] = [
      `"${ytDlpBin}"`,
      `--ffmpeg-location "${path.dirname(ffmpegBin)}"`,
      '--js-runtimes node',
      '--no-warnings',
      '--no-check-certificate',
      '--no-playlist',
      '--retries 10',
      '--fragment-retries 10',
    ];

    if (isTrimmed) {
      const startStr = formatSecondsToTime(trimStart);
      const endStr = formatSecondsToTime(trimEnd!);
      ytDlpArgs.push(`--download-sections "*${startStr}-${endStr}"`, '--force-keyframes-at-cuts');
    }

    if (isAudio) {
      ytDlpArgs.push('-x', '--audio-format', format, '--audio-quality', String(audioQuality));
    } else {
      ytDlpArgs.push('-f', '"bestvideo+bestaudio/best"', '--merge-output-format', 'mp4');
    }

    ytDlpArgs.push('-o', `"${rawTarget}"`, `"${targetMediaUrl}"`);

    console.log(`[Twitch Downloader] 🚀 Fetching Twitch stream:\n${ytDlpArgs.join(' ')}`);
    if (onProgress) onProgress('⬇️ Downloading Twitch stream...', 25);

    await execAsync(ytDlpArgs.join(' '));

    if (!fs.existsSync(rawTarget) || fs.statSync(rawTarget).size === 0) {
      throw new Error('Twitch media download failed or produced an empty file.');
    }

    // ── Local FFmpeg Processing (Only if Cropping needed) ─────────────────────
    if (needsCrop) {
      if (onProgress) onProgress('✂️ Formatting clip...', 75);

      const ffmpegArgs: string[] = [
        `"${ffmpegBin}"`,
        `-i "${rawTarget}"`,
        `-vf "${filterString}"`,
        '-c:v libx264',
        '-preset fast',
        '-crf 18',
        '-c:a aac',
        '-y',
        `"${finalFile}"`,
      ];

      console.log(`[Twitch Downloader] ✂️ Processing clip with FFmpeg:\n${ffmpegArgs.join(' ')}`);
      await execAsync(ffmpegArgs.join(' '));

      if (fs.existsSync(tempRawFile)) {
        try { fs.unlinkSync(tempRawFile); } catch (_) {}
      }
    }

    if (onProgress) onProgress('✅ Complete!', 100);
    return finalFile;
  }
}
