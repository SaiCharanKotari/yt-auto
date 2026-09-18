import express, { Request, Response } from 'express';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

// --- Binary resolution --------------------------------------------------------
function resolveYtDlpBinary(): string {
  const candidates = [
    path.join(process.cwd(), 'backend', 'yt-dlp.exe'),
    path.join(process.cwd(), 'yt-dlp.exe'),
    path.join(process.cwd(), 'backend', 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe'),
    path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe'),
    path.join(process.cwd(), 'qt-app', 'bin', 'yt-dlp.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'yt-dlp';
}

function resolveFFmpegBinary(): string {
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(process.cwd(), 'backend', 'ffmpeg.exe'),
    path.join(process.cwd(), 'ffmpeg.exe'),
    path.join(process.cwd(), 'qt-app', 'bin', 'ffmpeg.exe'),
    path.join(localAppData, 'Programs', 'ClipFlow', 'bin', 'ffmpeg.exe'),
    path.join(localAppData, 'ClipFlow', 'bin', 'ffmpeg.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffmpeg';
}

function resolveTempDir(): string {
  const candidates = [
    path.join(process.cwd(), 'temp'),
    path.join(process.cwd(), 'backend', 'temp'),
  ];
  for (const c of candidates) {
    try {
      if (!fs.existsSync(c)) fs.mkdirSync(c, { recursive: true });
      return c;
    } catch {}
  }
  const fallback = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

const YTDLP_BIN = resolveYtDlpBinary();
const FFMPEG_BIN = resolveFFmpegBinary();
const LIVE_CHUNKS_DIR = path.join(resolveTempDir(), 'live-chunks');

const execAsync = util.promisify(exec);
const router = express.Router();

// OPTIONS preflight
router.options('/live-chunk', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

// In-memory stream cache to avoid calling yt-dlp on every chunk request
interface StreamCacheEntry {
  streamUrl: string;
  sourceType: 'dvr' | 'live';
  expiresAt: number;
}
const streamCache = new Map<string, StreamCacheEntry>();

async function getLiveOrDvrStreamUrl(channelUrl: string): Promise<{ streamUrl: string; sourceType: 'dvr' | 'live' }> {
  const cached = streamCache.get(channelUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return { streamUrl: cached.streamUrl, sourceType: cached.sourceType };
  }

  const channelMatch = channelUrl.match(/twitch\.tv\/([a-zA-Z0-9_]+)(?:\/)?$/i);
  const channel = channelMatch ? channelMatch[1].toLowerCase() : '';

  let vodId: string | null = null;
  if (channel) {
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
      if (gqlRes.ok) {
        const gqlData = await gqlRes.json();
        const edges = gqlData?.data?.user?.videos?.edges || [];
        const recordingVod = edges.find((e: any) => {
          const n = e?.node;
          return n && (n.status === 'RECORDING' || n.broadcastType === 'ARCHIVE');
        })?.node;
        if (recordingVod?.id) {
          vodId = recordingVod.id;
          console.log(`[Twitch Live] Found active DVR VOD for ${channel}: https://www.twitch.tv/videos/${vodId}`);
        }
      }
    } catch (gqlErr: any) {
      console.warn(`[Twitch Live] GQL check error for ${channel}:`, gqlErr.message);
    }
  }

  const targetResolveUrl = vodId ? `https://www.twitch.tv/videos/${vodId}` : channelUrl;
  console.log(`[Twitch Live] Resolving 720p HLS stream URL via yt-dlp for: ${targetResolveUrl}`);

  const cmd = `"${YTDLP_BIN}" -g -f "best[height<=720]/bestvideo[height<=720]+bestaudio/best" --no-warnings --no-check-certificate "${targetResolveUrl}"`;
  const { stdout } = await execAsync(cmd, { timeout: 20000 });
  const streamUrl = stdout.trim().split('\n')[0].trim();

  if (!streamUrl) {
    throw new Error('Failed to resolve Twitch stream URL from yt-dlp.');
  }

  const entry: StreamCacheEntry = {
    streamUrl,
    sourceType: vodId ? 'dvr' : 'live',
    expiresAt: Date.now() + 12 * 60 * 1000, // 12 minutes TTL
  };
  streamCache.set(channelUrl, entry);
  return { streamUrl, sourceType: entry.sourceType };
}

// In-flight extraction promises to prevent multiple FFmpeg processes for the same chunk
const inFlightExtractions = new Map<string, Promise<void>>();

// Clean up cached chunks older than 15 minutes
function pruneOldChunks() {
  try {
    if (!fs.existsSync(LIVE_CHUNKS_DIR)) return;
    const now = Date.now();
    for (const f of fs.readdirSync(LIVE_CHUNKS_DIR)) {
      if (!f.endsWith('.mp4')) continue;
      const fp = path.join(LIVE_CHUNKS_DIR, f);
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

  let isAborted = false;
  req.on('close', () => {
    if (!res.writableEnded) {
      isAborted = true;
      console.log(`[Twitch Live Chunk] Client aborted request for t=${startTime}s`);
    }
  });

  if (!targetUrl) {
    return res.status(400).json({ error: 'url parameter is required' });
  }

  const isLiveChannel = /twitch\.tv\/([a-zA-Z0-9_]+)\/?$/i.test(targetUrl)
    && !targetUrl.includes('/videos')
    && !targetUrl.includes('/clip');

  if (!isLiveChannel) {
    return res.status(400).json({ error: 'Only live channel URLs are supported. Use /api/twitch for VODs and clips.' });
  }

  if (!fs.existsSync(LIVE_CHUNKS_DIR)) {
    fs.mkdirSync(LIVE_CHUNKS_DIR, { recursive: true });
  }

  const crypto = await import('crypto');
  // Hash WITHOUT timestamp so repeated seeks to the same chunk are instant cache hits!
  const hash = crypto.createHash('md5').update(`${targetUrl}-${startTime}-${chunkDuration}`).digest('hex');
  const outputPath = path.join(LIVE_CHUNKS_DIR, `chunk_${hash}.mp4`);

  // Helper to send the MP4 file
  const serveChunk = () => {
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new Error('Chunk file is missing or empty.');
    }
    const stat = fs.statSync(outputPath);
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
      'X-Chunk-Start': String(startTime),
      'X-Chunk-Duration': String(chunkDuration),
    });
    fs.createReadStream(outputPath).pipe(res);
  };

  // 1. Return immediately from disk cache if fresh
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
    console.log(`[Twitch Live Chunk] Instant cache hit @ t=${startTime}s (${Math.round(fs.statSync(outputPath).size / 1024)}KB)`);
    return serveChunk();
  }

  // 2. If another request is currently extracting this exact chunk, await it instead of running parallel FFmpegs
  if (inFlightExtractions.has(hash)) {
    console.log(`[Twitch Live Chunk] Joining existing extraction in-flight @ t=${startTime}s`);
    try {
      await inFlightExtractions.get(hash);
      return serveChunk();
    } catch (err: any) {
      // If previous failed, continue to fresh attempt
    }
  }

  console.log(`\n[Twitch Live Chunk] Request: ${targetUrl} @ t=${startTime}s (dur: ${chunkDuration}s)`);

  const extractionPromise = (async () => {
    // Get cached or fresh 720p stream URL
    let { streamUrl, sourceType } = await getLiveOrDvrStreamUrl(targetUrl);

    console.log(`[Twitch Live Chunk] Extracting ${chunkDuration}s at t=${startTime}s (${sourceType} mode)...`);
    const ffCmd = `"${FFMPEG_BIN}" -y -ss ${startTime} -i "${streamUrl}" -t ${chunkDuration} -c copy -movflags +faststart -bsf:a aac_adtstoasc "${outputPath}"`;

    const t0 = Date.now();
    try {
      await execAsync(ffCmd, { timeout: 20000 });
    } catch (ffErr: any) {
      if (isAborted) return;
      console.warn(`[Twitch Live Chunk] Fast copy failed (${ffErr.message.substring(0, 100)}). Trying with ultrafast transcode...`);
      const transcodeCmd = `"${FFMPEG_BIN}" -y -ss ${startTime} -i "${streamUrl}" -t ${chunkDuration} -c:v libx264 -preset ultrafast -crf 26 -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`;
      await execAsync(transcodeCmd, { timeout: 25000 });
    }

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new Error('FFmpeg produced no output. Stream may be offline or unavailable at this timestamp.');
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    const stat = fs.statSync(outputPath);
    console.log(`[Twitch Live Chunk] Chunk ready in ${elapsed}s: ${Math.round(stat.size / 1024)}KB`);
  })();

  inFlightExtractions.set(hash, extractionPromise);

  try {
    await extractionPromise;
    serveChunk();
  } catch (err: any) {
    console.error('[Twitch Live Chunk Error]', err.message);
    if (fs.existsSync(outputPath)) fs.unlink(outputPath, () => {});
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Failed to extract live chunk' });
    }
  } finally {
    inFlightExtractions.delete(hash);
  }
});

export default router;

