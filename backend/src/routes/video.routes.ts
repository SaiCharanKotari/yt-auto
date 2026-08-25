import { Router, Request, Response } from 'express';
import { YtDlpService } from '../services/yt-dlp.service.js';
import { FFmpegService, scheduleCleanup } from '../services/ffmpeg.service.js';
import { AIService } from '../services/ai.service.js';
import { SocketService } from '../services/socket.service.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';

import { Readable } from 'stream';

const execAsync = promisify(exec);
const YTDLP_BIN = path.join(process.cwd(), 'yt-dlp.exe');
const router = Router();
const TEMP_DIR = path.join(process.cwd(), 'temp');

// ─── /proxy (stream video format to bypass CORS/403 referer issues) ─────────
router.get('/proxy', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).json({ error: 'URL parameter is required' });

  try {
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };
    if (req.headers.range) {
      fetchHeaders['range'] = req.headers.range as string;
    }

    const response = await fetch(targetUrl, { headers: fetchHeaders });

    if (!response.ok && response.status !== 206) {
      console.error(`[Proxy Error] Upstream returned ${response.status} for ${targetUrl.substring(0, 50)}...`);
      return res.status(response.status).json({ error: `Upstream returned ${response.status}` });
    }

    res.status(response.status);
    ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach(h => {
      const val = response.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    if (!response.body) return res.end();

    // @ts-ignore
    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);
  } catch (err: any) {
    console.error('[Proxy Error]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});




// ─── /metadata ───────────────────────────────────────────────────────────────
router.post('/metadata', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Video URL is required' });

  try {
    const metadata: any = await YtDlpService.getVideoMetadata(url);

    const response = {
      id: metadata.id,
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      duration_string: metadata.duration_string,
      uploader: metadata.uploader,
      view_count: metadata.view_count,
      upload_date: metadata.upload_date,
      formats: metadata.formats?.map((f: any) => ({
        format_id: f.format_id,
        ext: f.ext,
        resolution: f.resolution,
        filesize: f.filesize,
        vcodec: f.vcodec,
        acodec: f.acodec,
        format_note: f.format_note,
        tbr: f.tbr,
        url: f.url,
      })) || [],
    };

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── /download (Direct Terminal Execution) ──────────────────────────────────
router.post('/download', async (req: Request, res: Response) => {
  const { url, format = 'mp4', quality = '720p', trimStart = 0, trimEnd, audioBitrate = '192k', aspectRatio, customFileName } = req.body;

  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    let ytFormat: string;
    const audioFlags: string[] = [];
    
    if (format === 'mp4') {
      const height = quality.replace('p', '');
      // No [ext=mp4] on video: YouTube serves 1080p+ as VP9/webm which is fine,
      // ffmpeg will remux/encode to mp4 via --merge-output-format mp4.
      ytFormat = `bestvideo[height=${height}]+bestaudio[ext=m4a]/bestvideo[height=${height}]+bestaudio/bestvideo[height<=${height}]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`;
      audioFlags.push('--merge-output-format', 'mp4');
    } else {
      ytFormat = 'bestaudio/best';
      audioFlags.push('--extract-audio', '--audio-format', format, '--audio-quality', audioBitrate);
    }

    let downloaderArgs = '';
    if (format === 'mp4' && aspectRatio && aspectRatio !== 'original') {
      let vfFilter = '';
      const isPad = req.body.fitMode === 'pad';

      if (aspectRatio === '9:16') {
        vfFilter = isPad ? 'pad=ceil(max(iw\\,ih*9/16)/2)*2:ceil(max(ih\\,iw*16/9)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black' : 'crop=ih*9/16:ih';
      } else if (aspectRatio === '1:1') {
        vfFilter = isPad ? 'pad=ceil(max(iw\\,ih)/2)*2:ceil(max(ih\\,iw)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black' : 'crop=ih:ih';
      } else if (aspectRatio === '4:5') {
        vfFilter = isPad ? 'pad=ceil(max(iw\\,ih*4/5)/2)*2:ceil(max(ih\\,iw*5/4)/2)*2:(ow-iw)/2:(oh-ih)/2:color=black' : 'crop=ih*4/5:ih';
      }
      
      if (vfFilter) {
        downloaderArgs = `--downloader-args "ffmpeg:-vf ${vfFilter} -c:v libx264 -preset fast"`;
      }
    }

    const effectiveTrimEnd = trimEnd || 9999999;
    const outputDir  = `%USERPROFILE%\\Downloads`;
    
    let fileNameTemplate = '%(title)s';
    if (customFileName) {
      // Basic sanitize for safe filename on windows
      fileNameTemplate = customFileName.replace(/[<>:"/\\|?*]/g, '_');
    }
    const extName = format === 'mp4' ? 'mp4' : '%(ext)s';
    const outputPath = `${outputDir}\\${fileNameTemplate}.${extName}`;

    // ── Handle direct media URLs (like FastDL) ─────────────────────────────────
    if (url.includes('media.fastdl.app') || url.includes('.mp4')) {
      console.log(`[Download] Detected direct media URL. Downloading natively via fetch...`);
      const directOutputPath = `${outputDir}\\${fileNameTemplate === '%(title)s' ? 'instagram_video' : fileNameTemplate}.mp4`;
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });

      if (!response.ok) {
        throw new Error(`Failed to download direct media: ${response.statusText}`);
      }

      const fileStream = fs.createWriteStream(directOutputPath);
      pipeline(response.body as any, fileStream).then(() => {
        console.log(`[Download] Successfully downloaded direct media to ${directOutputPath}`);
      }).catch(err => {
        console.error(`[Download] Error saving direct media:`, err);
      });

      return res.json({ 
        success: true, 
        message: 'Direct media download started to your Downloads folder!',
        command: `Downloading directly via node fetch`,
      });
    }

    // ── Build a clean, copyable cmd.exe command for display ──────────────────
    let displayCmd = '';
    let execCmd = '';

    if (format === 'mp4') {
      // Create a temporary path for the full download to allow FFmpeg trimming later
      const tempPath = `${outputDir}\\${fileNameTemplate}_full_temp.mp4`;
      
      const ytDlpCmd = [
        `.\\yt-dlp.exe`,
        `-f "${ytFormat}"`,
        ...audioFlags,
        `-o "${tempPath}"`,
        downloaderArgs,
        `--restrict-filenames`,
        `--no-playlist`,
        `--js-runtimes node`,
        `--extractor-args "youtube:player_client=default,web_embedded"`,
        `"${url}"`,
      ].filter(Boolean).join(' ');

      // ffmpeg command to trim with proper timestamp handling (re-encode audio to fix AAC gaps)
      const trimCmd = `ffmpeg -i "${tempPath}" -ss ${trimStart} -to ${effectiveTrimEnd} -c:v copy -c:a aac -async 1 -y "${outputPath}"`;
      const cleanupCmd = `del "${tempPath}"`;

      // Use newlines for displayCmd so it can be pasted into PowerShell or CMD easily
      displayCmd = `${ytDlpCmd}\n${trimCmd}\n${cleanupCmd}`;
      
      // For execCmd, use the full path to YTDLP_BIN and && for single-line execution in cmd.exe
      const ytDlpExec = ytDlpCmd.replace('.\\yt-dlp.exe', `"${YTDLP_BIN}"`);
      execCmd = `${ytDlpExec} && ${trimCmd} && ${cleanupCmd}`;
    } else {
      // Audio-only or other formats, keep using --download-sections
      displayCmd = [
        `.\\yt-dlp.exe`,
        `-f "${ytFormat}"`,
        `--download-sections "*${trimStart}-${effectiveTrimEnd}"`,
        ...audioFlags,
        `-o "${outputPath}"`,
        downloaderArgs,
        `--restrict-filenames`,
        `--no-playlist`,
        `--js-runtimes node`,
        `--extractor-args "youtube:player_client=default,web_embedded"`,
        `"${url}"`,
      ].filter(Boolean).join(' ');

      execCmd = [
        `"${YTDLP_BIN}"`,
        `-f "${ytFormat}"`,
        `--download-sections "*${trimStart}-${effectiveTrimEnd}"`,
        ...audioFlags,
        `-o "${outputPath}"`,
        downloaderArgs,
        `--restrict-filenames`,
        `--no-playlist`,
        `--js-runtimes node`,
        `--extractor-args "youtube:player_client=default,web_embedded"`,
        `"${url}"`,
      ].filter(Boolean).join(' ');
    }
    
    console.log(`[Download] Opening cmd with command: \n${displayCmd}`);

    // ── Open a new cmd.exe window in the backend dir and run the command ──────
    // cmd /k keeps the window open after the command finishes so user can read output
    // We use the full YTDLP_BIN path for execution so .\yt-dlp.exe resolves correctly
    const escapedCmd = execCmd.replace(/"/g, '\\"');
    exec(`start cmd /c "${escapedCmd}"`);

    res.json({ 
      success: true, 
      message: 'A cmd terminal just opened and is running the download to your Downloads folder!',
      command: displayCmd,
    });
  } catch (err: any) {
    console.error('[Download] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ─── /file/:filename  (serve the processed file) ─────────────────────────────
router.get('/file/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename as string); // prevent path traversal
  const filePath = path.join(TEMP_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found or expired' });
  }

  const ext = path.extname(filename).slice(1);
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
  };

  res.setHeader('Content-Disposition', `attachment; filename="clipflow-clip.${ext}"`);
  res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
  res.setHeader('Content-Length', fs.statSync(filePath).size);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on('error', () => res.status(500).end());
});

// ─── /trim (legacy, keep for compat) ─────────────────────────────────────────
router.post('/trim', async (req: Request, res: Response) => {
  res.status(410).json({ error: 'Use /download instead' });
});

// ─── /ai/analyze ─────────────────────────────────────────────────────────────
router.post('/ai/analyze', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Video URL is required' });

  try {
    console.log(`[AI] Fetching metadata via yt-dlp for: ${url}`);
    
    // 1. Fetch metadata via yt-dlp
    const cmd = `"${YTDLP_BIN}" --dump-json --skip-download --js-runtimes node "${url}"`;
    const { stdout: ytStdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 50 });
    const info = JSON.parse(ytStdout);

    // 2. Fetch comments via python script
    console.log(`[AI] Fetching comments via python script...`);
    let comments = [];
    try {
      const scriptPath = path.join(process.cwd(), 'scripts', 'get_comments.py');
      const pyCmd = `python "${scriptPath}" "${url}"`;
      const { stdout: pyStdout } = await execAsync(pyCmd, { maxBuffer: 1024 * 1024 * 50 });
      comments = JSON.parse(pyStdout);
      console.log(`[AI] Fetched ${comments.length} comments successfully.`);
    } catch (err: any) {
      console.warn('[AI] Failed to fetch comments using python script:', err.message);
    }

    const aiData = {
      title: info.title || 'Unknown',
      duration: info.duration_string || '00:00',
      description: info.description || '',
      comments: comments,
      customPrompt: req.body.customPrompt || '',
    };

    const analysis = await AIService.analyzeVideo(aiData);
    res.json(analysis);
  } catch (error: any) {
    console.error('[AI] Analyze Route Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── /tools/download-dlp (serve the download dlp.zip bundle) ────────────────
router.get('/tools/download-dlp', (req: Request, res: Response) => {
  const zipPath = path.join(process.cwd(), 'download dlp.zip');
  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ error: 'download dlp.zip not found in backend folder' });
  }
  res.setHeader('Content-Disposition', 'attachment; filename="download dlp.zip"');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Length', fs.statSync(zipPath).size);
  const stream = fs.createReadStream(zipPath);
  stream.pipe(res);
  stream.on('error', () => res.status(500).end());
});

// ─── /thumbnail (download video thumbnail image) ─────────────────────────────
router.get('/thumbnail', async (req: Request, res: Response) => {
  const thumbnailUrl = req.query.url as string;
  const title = (req.query.title as string) || 'thumbnail';
  if (!thumbnailUrl) return res.status(400).json({ error: 'Thumbnail URL is required' });

  try {
    const response = await fetch(thumbnailUrl);
    if (!response.ok) throw new Error('Failed to fetch thumbnail image');

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');

    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_thumbnail.jpg"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('Thumbnail download error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
