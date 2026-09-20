import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import {
  TwitchLiveFrameService,
  TwitchLiveFrameValidationError,
} from '../services/twitch/twitch-live-frame.service.js';
import { cleanUnicodeFileName, getSafeContentDisposition } from '../utils/i18n-filename.util.js';

const router = express.Router();

// OPTIONS preflight for live chunk and live frame endpoints
router.options(['/live-chunk', '/live-frame'], (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

// Clean up cached chunks older than 15 minutes
function pruneOldChunks() {
  try {
    const chunkDir = TwitchLiveFrameService.LIVE_CHUNKS_DIR;
    if (!fs.existsSync(chunkDir)) return;
    const now = Date.now();
    for (const f of fs.readdirSync(chunkDir)) {
      if (!f.endsWith('.mp4')) continue;
      const fp = path.join(chunkDir, f);
      try {
        if (now - fs.statSync(fp).mtimeMs > 15 * 60 * 1000) {
          fs.unlinkSync(fp);
        }
      } catch {}
    }
  } catch {}
}
setInterval(pruneOldChunks, 2 * 60 * 1000);

/**
 * GET /api/twitch-live/live-chunk
 *
 * Extracts a fast 5s–10s 720p MP4 preview chunk from a Twitch live channel or its active DVR recording.
 *
 * Query params:
 *   url  — full Twitch channel URL (e.g. https://www.twitch.tv/noticed_dota2)
 *   t    — start offset in seconds (default: 0)
 *   dur  — chunk duration in seconds (default: 5)
 */
router.get('/live-chunk', async (req: Request, res: Response) => {
  const targetUrl = (req.query.url as string || '').trim();
  const startTime = Math.max(0, parseInt((req.query.t as string) || '0', 10));
  const chunkDuration = Math.min(20, Math.max(2, parseInt((req.query.dur as string) || '5', 10)));

  if (!targetUrl) {
    return res.status(400).json({ error: 'url parameter is required' });
  }

  if (!TwitchLiveFrameService.isLiveChannelUrl(targetUrl)) {
    return res.status(400).json({ error: 'Only live channel URLs are supported. Use /api/twitch for VODs and clips.' });
  }

  try {
    const { chunkPath } = await TwitchLiveFrameService.getOrExtractChunk(
      targetUrl,
      startTime,
      chunkDuration,
      '720p'
    );

    const stat = fs.statSync(chunkPath);
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
      'X-Chunk-Start': String(startTime),
      'X-Chunk-Duration': String(chunkDuration),
    });
    fs.createReadStream(chunkPath).pipe(res);
  } catch (err: any) {
    console.error('[Twitch Live Chunk Error]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Failed to extract live chunk' });
    }
  }
});

/**
 * GET /api/twitch-live/live-frame
 *
 * Extracts a frame from the exact 5-second live chunk corresponding to the requested timeline position.
 *
 * Query params:
 *   url         — Twitch channel URL
 *   chunkOffset — start offset of the 5s chunk (e.g. 7435)
 *   localTime   — time offset inside that chunk in seconds (e.g. 3.25)
 *   globalTime  — global timestamp in seconds (optional alternative/validation)
 *   time        — alias for globalTime
 *   quality     — stream quality (default: 720p)
 *   format      — png (default) or jpg
 *   crop_x, crop_y, crop_w, crop_h — optional normalized crop bounds
 *   download    — 'true' or '1' to set attachment Content-Disposition
 *   title       — filename title for download
 */
router.get('/live-frame', async (req: Request, res: Response) => {
  const {
    url,
    chunkOffset,
    localTime,
    globalTime,
    time,
    quality = '720p',
    format = 'png',
    crop_x,
    crop_y,
    crop_w,
    crop_h,
    download,
    title,
  } = req.query;

  const targetUrl = (url as string || '').trim();
  const isDownload = download === 'true' || download === '1';

  try {
    const result = await TwitchLiveFrameService.extractLiveFrame({
      url: targetUrl,
      chunkOffset: chunkOffset as string,
      localTime: localTime as string,
      globalTime: globalTime as string,
      time: time as string,
      quality: quality as string,
      format: (format as string) || 'png',
      crop: {
        crop_x: crop_x as string,
        crop_y: crop_y as string,
        crop_w: crop_w as string,
        crop_h: crop_h as string,
      },
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Content-Type', result.isPng ? 'image/png' : 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Chunk-Offset', String(result.chunkOffset));
    res.setHeader('X-Local-Time', String(result.localTime));
    res.setHeader('X-Global-Time', String(result.globalTime));
    res.setHeader('X-Chunk-Duration', String(result.chunkDuration));
    res.setHeader('X-From-Cache', String(result.fromCache));

    if (isDownload) {
      const safeTitle = cleanUnicodeFileName((title as string) || 'twitch_live', 'frame');
      const timeStr = `${Math.floor(result.globalTime / 60)}m${Math.floor(result.globalTime % 60)}s`;
      res.setHeader(
        'Content-Disposition',
        getSafeContentDisposition(`${safeTitle}_frame_${timeStr}.${result.ext}`)
      );
    }

    return fs.createReadStream(result.filePath).pipe(res);
  } catch (err: any) {
    console.error('[Twitch Live Frame Error]', err.message);
    const statusCode =
      err instanceof TwitchLiveFrameValidationError || err.statusCode === 400 ? 400 : 500;
    if (!res.headersSent) {
      res.status(statusCode).json({ error: err.message || 'Failed to extract Twitch live frame' });
    }
  }
});

export default router;
