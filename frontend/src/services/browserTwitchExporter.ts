/**
 * browserTwitchExporter.ts
 *
 * Orchestrates browser-side Twitch exports using selective HLS segment fetching
 * and FFmpeg.wasm in a dedicated Web Worker.
 * Zero backend video traffic, zero server CPU rendering.
 */

import { fetchRequiredHlsSegments } from './hlsSegmentFetcher';

export interface BrowserTwitchExportOptions {
  manifestUrl: string;
  trimStart: number;
  trimEnd: number;
  customFileName?: string;
  format?: 'mp4' | 'mp3' | 'wav' | 'aac' | string;
  quality?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5' | 'custom' | string;
  fitMode?: 'crop' | 'pad';
  cropPosition?: 'center' | 'left' | 'right';
  cropBox?: { x: number; y: number; width: number; height: number };
  audioBitrate?: string;
  onProgress?: (phase: string, percent: number) => void;
}

export interface BrowserTwitchExportResult {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
}

/**
 * Triggers native browser download for a Blob.
 */
export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

/**
 * Exports a Twitch video/audio clip 100% inside the user's browser.
 */
export async function exportTwitchClipInBrowser(
  options: BrowserTwitchExportOptions
): Promise<BrowserTwitchExportResult> {
  const {
    manifestUrl,
    trimStart,
    trimEnd,
    customFileName = 'Twitch_Clip',
    format = 'mp4',
    quality = '1080p',
    aspectRatio = '16:9',
    fitMode = 'pad',
    cropPosition = 'center',
    cropBox,
    audioBitrate = '192k',
    onProgress,
  } = options;

  console.log('%c[Browser Twitch Exporter 🎬 INITIATED]', 'color: #a855f7; font-weight: bold; font-size: 13px;', {
    manifestUrl,
    trimStart,
    trimEnd,
    duration: trimEnd - trimStart,
    quality,
    format,
    aspectRatio,
  });

  if (onProgress) onProgress('Analyzing Twitch stream timeline...', 5);

  // ── Step 1: Selectively fetch ONLY the required HLS .ts segments ──────────────
  const segmentResult = await fetchRequiredHlsSegments(
    manifestUrl,
    trimStart,
    trimEnd,
    quality,
    (fetchProg) => {
      if (onProgress) {
        onProgress(fetchProg.message, fetchProg.percent);
      }
    }
  );

  const cleanExt = (format === 'mp3' || format === 'wav' || format === 'aac') ? format : 'mp4';
  const cleanTitle = (customFileName || 'Twitch_Clip').replace(/[/\\?%*:|"<>]/g, '_').trim();
  const outputFileName = `${cleanTitle}.${cleanExt}`;

  if (onProgress) onProgress('Starting video editing engine...', 46);

  // ── Step 2: Spawn dedicated FFmpeg Web Worker ─────────────────────────────────
  const worker = new Worker(
    new URL('../workers/ffmpeg.worker.ts', import.meta.url),
    { type: 'module' }
  );

  const jobId = Math.random().toString(36).slice(2);

  return new Promise<BrowserTwitchExportResult>((resolve, reject) => {
    let hasResolved = false;

    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = (e: MessageEvent) => {
      const { type, jobId: msgJobId, percent, message, outputData, error } = e.data;
      if (msgJobId !== jobId) return;

      if (type === 'PROGRESS') {
        if (onProgress) onProgress(message || 'Processing clip...', percent || 50);
      } else if (type === 'COMPLETE') {
        hasResolved = true;
        if (onProgress) onProgress('Complete! Preparing download...', 100);

        const mimeType = cleanExt === 'mp3' ? 'audio/mpeg' : cleanExt === 'wav' ? 'audio/wav' : 'video/mp4';
        const blob = new Blob([outputData], { type: mimeType });

        console.log('%c[Browser Twitch Exporter ✅ EXPORT COMPLETE]', 'color: #22c55e; font-weight: bold;', {
          fileName: outputFileName,
          sizeBytes: blob.size,
          sizeMB: (blob.size / (1024 * 1024)).toFixed(2),
        });

        // Trigger browser file download directly
        triggerBlobDownload(blob, outputFileName);

        cleanup();
        resolve({
          blob,
          fileName: outputFileName,
          sizeBytes: blob.size,
        });
      } else if (type === 'ERROR') {
        hasResolved = true;
        cleanup();
        reject(new Error(error || 'Failed to process clip in browser'));
      }
    };

    worker.onerror = (err) => {
      if (!hasResolved) {
        cleanup();
        reject(new Error(err.message || 'Worker execution error'));
      }
    };

    // Dispatch job to worker with transferred inputData buffer
    worker.postMessage(
      {
        type: 'PROCESS_CLIP',
        payload: {
          jobId,
          inputData: segmentResult.buffer,
          inputFileName: 'input.ts',
          outputFileName,
          trimStart: segmentResult.relativeTrimStart,
          duration: segmentResult.targetDuration,
          format: cleanExt as any,
          aspectRatio,
          fitMode,
          cropPosition,
          cropBox,
          quality,
          audioBitrate,
        },
      },
      [segmentResult.buffer.buffer]
    );
  });
}
