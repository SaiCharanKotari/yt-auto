import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Sparkles, Play, Pause, PlaySquare, Volume2, VolumeX, CheckCircle, AlertCircle, Loader2, Copy, ArrowLeft, Image, Monitor, X, RefreshCw, Check, RotateCcw, RotateCw } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import YouTube, { type YouTubePlayer } from 'react-youtube';

function extractYouTubeId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/);
  return (match && match[2].length === 11) ? match[2] : null;
}
// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Estimate size from realistic resolution bitrate & trim duration */
function estimateSize(tbr: number | undefined, trimDurationSec: number, height?: number): string {
  if (trimDurationSec <= 0) return '';
  const h = height || 1080;
  let baseKbps = 3800; // 1080p
  if (h >= 2160) baseKbps = 20000;
  else if (h >= 1440) baseKbps = 10000;
  else if (h >= 1080) baseKbps = 3800;
  else if (h >= 720) baseKbps = 2200;
  else if (h >= 480) baseKbps = 1000;
  else if (h >= 360) baseKbps = 550;
  else if (h >= 240) baseKbps = 300;
  else baseKbps = 150;

  const effectiveKbps = (tbr && tbr > baseKbps) ? (tbr + 160) : baseKbps;
  const bytes = (effectiveKbps * 1000 / 8) * trimDurationSec;
  return formatBytes(bytes);
}




interface QualityOption {
  label: string;        // e.g. "1080p"
  height: number;
  format_id: string;
  tbr?: number;
  filesize?: number;
  url?: string;
  hasMuxedAudio: boolean;
}

// ─── EditableTime ────────────────────────────────────────────────────────────

const EditableTime = ({
  value, onChange, min, max,
}: { value: number; onChange: (v: number) => void; min: number; max: number }) => {
  const [editing, setEditing] = useState(false);
  const [tmp, setTmp] = useState(formatTime(value));

  useEffect(() => { setTmp(formatTime(value)); }, [value]);

  const commit = () => {
    setEditing(false);
    let v = parseTime(tmp);
    if (isNaN(v)) v = value;
    v = Math.max(min, Math.min(max, v));
    onChange(v);
  };

  if (editing) {
    return (
      <input
        type="text" value={tmp} autoFocus
        onChange={e => setTmp(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        className="font-mono bg-black/60 border border-primary px-2 py-1 rounded text-center w-20 outline-none focus:ring-1 focus:ring-primary text-xs text-white"
      />
    );
  }
  return (
    <span
      className="font-mono bg-black/30 px-2 py-1 rounded cursor-text hover:bg-white/10 transition-colors select-none"
      title="Double-click to edit"
      onDoubleClick={() => setEditing(true)}
    >
      {formatTime(value)}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VideoPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url');

  const [metadata, setMetadata]   = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState('');

  // Quality options derived from metadata
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([]);

  // Download selections
  const [downloadQuality, setDownloadQuality] = useState('');
  const [downloadFormat,  setDownloadFormat]  = useState('mp4');
  const [subtitleFormat,  setSubtitleFormat]  = useState<'srt' | 'vtt' | 'txt'>('srt');
  const [subtitleLang,    setSubtitleLang]    = useState<string>('en');
  const [customFileName,  setCustomFileName]  = useState('');

  // Download progress
  const [isDownloading,   setIsDownloading]   = useState(false);
  const [dlProgress,      setDlProgress]      = useState(0);
  const [dlStatus,        setDlStatus]        = useState<'idle' | 'downloading' | 'processing' | 'done' | 'error'>('idle');
  const [dlError,         setDlError]         = useState('');
  const [dlMessage,       setDlMessage]       = useState('');
  const [showAppDownloadModal, setShowAppDownloadModal] = useState(false);
  const [generatedCommand, setGeneratedCommand] = useState('');

  // Trim
  const [trimRange, setTrimRange] = useState([0, 60]);

  // Crop / Aspect Ratio
  const [aspectRatio, setAspectRatio] = useState('original');
  const [fitMode, setFitMode] = useState<'crop' | 'pad'>('crop');

  // player
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const sliderWrapRef  = useRef<HTMLDivElement>(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [isMuted,      setIsMuted]      = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);

  const isDraggingRange = useRef(false);
  const youtubeId = extractYouTubeId(url);

  // Seek video based on a raw clientX position over the track
  const seekFromClientX = (clientX: number) => {
    if (!sliderWrapRef.current || !youtubePlayerRef.current) return;
    const rect = sliderWrapRef.current.getBoundingClientRect();
    const pct  = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const time = pct * (metadata?.duration || 0);
    youtubePlayerRef.current.seekTo(time, true);
    setCurrentTime(time);
  };

  // Attach document-level listeners so drag works even when cursor leaves the track
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRange.current) return;
      seekFromClientX(e.clientX);
    };
    const onUp = () => { isDraggingRange.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [metadata?.duration]);

  // Sync current time from YouTube player
  useEffect(() => {
    let animationFrameId: number;
    const updateTime = async () => {
      if (youtubePlayerRef.current && isPlaying) {
        try {
          const time = await youtubePlayerRef.current.getCurrentTime();
          setCurrentTime(time);
          
          if (trimRange[1] > 0) {
            if (time >= trimRange[1]) {
              youtubePlayerRef.current.seekTo(trimRange[0], true);
            } else if (time < trimRange[0]) {
              youtubePlayerRef.current.seekTo(trimRange[0], true);
            }
          }
        } catch (e) {
          // ignore transient errors
        }
      }
      animationFrameId = requestAnimationFrame(updateTime);
    };
    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateTime);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, trimRange]);

  // ── Fetch metadata ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!url) return;

    const fetchMeta = async () => {
      let data: any = null;
      console.log('%c[ClipFlow VideoPage 📡 METADATA REQUEST]', 'color: #38bdf8; font-weight: bold;', { url });

      const endpoints = [
        'http://127.0.0.1:18942/metadata',
        'http://localhost:18942/metadata',
        'http://localhost:3001/api/video/metadata',
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`[ClipFlow VideoPage 📡] Querying metadata from: ${endpoint}`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 9000);
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const json = await res.json();
            if (json && !json.error && (json.title || json.id)) {
              data = json;
              console.log('%c[ClipFlow VideoPage 📥 METADATA SUCCESS]', 'color: #22c55e; font-weight: bold;', {
                endpoint,
                title: json.title,
                duration: json.duration_string || json.duration,
                formatsCount: json.formats?.length || 0,
              });
              break;
            }
          }
        } catch (e: any) {
          console.warn(`[ClipFlow VideoPage ⚠️] Endpoint ${endpoint} unreachable: ${e.message}`);
        }
      }

      if (!data) {
        const ytId = extractYouTubeId(url);
        if (ytId) {
          try {
            const oembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);
            if (oembedRes.ok) {
              const oembed = await oembedRes.json();
              data = {
                id: ytId,
                title: oembed.title || 'YouTube Video',
                thumbnail: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
                uploader: oembed.author_name || 'YouTube Creator',
                duration: 0,
                duration_string: '00:00',
                formats: [],
              };
            }
          } catch (e) { }

          if (!data) {
            data = {
              id: ytId,
              title: 'YouTube Video',
              thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
              uploader: 'YouTube Creator',
              duration: 0,
              duration_string: '00:00',
              formats: [],
            };
          }
        }
      }

      if (!data) return;

      try {
        setMetadata(data);
        setCustomFileName(data.title || 'video');

        // ── 1. Video ID is already extracted via state ───────────────────

        // ── 2. Build quality options ────────────────────────────────────────
        // Collect all unique heights from video-bearing formats.
        // We do NOT filter on f.url here — yt-dlp handles the actual download
        // using format strings (bestvideo[height=X]+bestaudio), so we just need
        // to know which heights are available.
        const heightSet = new Set<number>();
        (data.formats || []).forEach((f: any) => {
          if (!f.vcodec || f.vcodec === 'none') return; // audio-only, skip
          const res = f.resolution || '';
          const match = res.match(/\d+x(\d+)/);
          if (match) {
            const h = parseInt(match[1]);
            if (h >= 144) heightSet.add(h); // ignore tiny thumbnails etc.
          }
        });

        const allStandardHeights = [2160, 1440, 1080, 720, 480, 360, 240];

        const opts: QualityOption[] = allStandardHeights.map(targetH => {
          // Best candidate for size/tbr display (prefer muxed → highest tbr)
          const candidates = (data.formats || []).filter((f: any) => {
            if (!f.vcodec || f.vcodec === 'none') return false;
            const res = f.resolution || '';
            const match = res.match(/\d+x(\d+)/);
            return (match && parseInt(match[1]) === targetH) || f.height === targetH;
          });
          const muxedCand = candidates.filter((f: any) => f.acodec && f.acodec !== 'none');
          const best = (muxedCand.length > 0 ? muxedCand : candidates)
            .reduce((a: any, b: any) => (b.tbr || 0) > (a.tbr || 0) ? b : a, candidates[0]);

          return {
            label: `${targetH}p`,
            height: targetH,
            format_id: best?.format_id || 'best',
            tbr: best?.tbr,
            filesize: best?.filesize,
            url: best?.url,
            hasMuxedAudio: !!(best?.acodec && best.acodec !== 'none'),
          };
        });

        setQualityOptions(opts);
        // Default download quality = highest available
        if (opts.length > 0) setDownloadQuality(opts[0].label);

        const duration = Math.floor(data.duration || 0);
        setTrimRange([0, duration]);
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch metadata');
        setIsLoading(false);
      }
    };

    fetchMeta();
  }, [url]);

  // ── Thumbnail Download handler ─────────────────────────────────────────────
  const handleDownloadThumbnail = () => {
    if (!metadata?.thumbnail) return;
    const downloadUrl = `http://localhost:3001/api/video/thumbnail?url=${encodeURIComponent(metadata.thumbnail)}&title=${encodeURIComponent(metadata.title || 'thumbnail')}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${(metadata.title || 'thumbnail').replace(/[^a-zA-Z0-9_-]/g, '_')}_thumbnail.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Download handler ───────────────────────────────────────────────────────
  const handleDownload = async (forceServerFallback = false) => {
    if (!url) return;
    if (downloadFormat === 'jpg') {
      handleDownloadThumbnail();
      return;
    }
    setIsDownloading(true);
    setDlStatus('downloading');
    setDlProgress(0);
    setDlError('');
    setDlMessage('Connecting to ClipFlow Desktop Helper...');
    setGeneratedCommand('');

    try {
      const effectiveFormat = downloadFormat === 'captions' ? subtitleFormat : downloadFormat;
      const payload = {
        url,
        format: effectiveFormat,
        quality: downloadQuality,
        trimStart: trimRange[0],
        trimEnd: trimRange[1],
        audioBitrate: downloadQuality.replace('kbps', 'k'), // '320kbps' → '320k'
        aspectRatio: aspectRatio !== 'original' ? aspectRatio : undefined,
        fitMode: aspectRatio !== 'original' ? fitMode : undefined,
        customFileName: customFileName,
        duration: metadata?.duration || 0,
        subtitleFormat: downloadFormat === 'captions' ? subtitleFormat : undefined,
        subtitleLang: downloadFormat === 'captions' ? subtitleLang : undefined,
        relativeTimecodes: true,
      };

      console.log('%c[ClipFlow VideoPage 🚀 DOWNLOAD TRIGGERED]', 'color: #f59e0b; font-weight: bold;', payload);

      let capturedByHelper = false;
      if (!forceServerFallback) {
        // Try 127.0.0.1 first (bypasses Windows IPv6 resolution delay), then localhost
        for (const endpoint of ['http://127.0.0.1:18942/download', 'http://localhost:18942/download']) {
          try {
            console.log(`[ClipFlow VideoPage 📡 SENDING] POST payload -> ${endpoint}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            const helperRes = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (helperRes.ok) {
              const resData = await helperRes.json();
              console.log('%c[ClipFlow VideoPage ✅ CAPTURED BY DESKTOP HELPER]', 'color: #22c55e; font-weight: bold;', resData);
              capturedByHelper = true;
              setDlProgress(100);
              setDlStatus('done');
              setDlMessage('Captured by ClipFlow Desktop Helper! Downloading...');
              setShowAppDownloadModal(false);
              break;
            } else {
              console.warn(`[ClipFlow VideoPage ⚠️] Helper on ${endpoint} responded with status: ${helperRes.status}`);
            }
          } catch (e: any) {
            console.log(`[ClipFlow VideoPage ℹ️] Qt Desktop Helper not reachable on ${endpoint} (${e.message})`);
          }
        }
      }

      if (!capturedByHelper) {
        if (!forceServerFallback) {
          setShowAppDownloadModal(true);
          setDlStatus('idle');
          setDlMessage('ClipFlow Desktop App required for direct PC download.');
          setIsDownloading(false);
          return;
        }

        const res = await fetch('http://localhost:3001/api/video/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, mode: 'server' }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (data.downloadUrl) {
          const directUrl = data.downloadUrl.startsWith('http')
            ? data.downloadUrl
            : `http://localhost:3001${data.downloadUrl}`;
          const a = document.createElement('a');
          a.href = directUrl;
          a.download = data.fileName || `${customFileName || 'clipflow_clip'}.${effectiveFormat}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        setDlProgress(100);
        setDlStatus('done');
        setDlMessage(data.message || 'Download complete!');
        setShowAppDownloadModal(false);
      }
      
      // reset download progress on click anywhere
      if (dlStatus === 'done' || dlStatus === 'error') {
        setDlStatus('idle');
      }
    } catch (err: any) {
      setDlStatus('error');
      setDlError(err.message || 'An error occurred during download');
    } finally {
      setIsDownloading(false);
    }
  };



  // ── Player Controls ────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!youtubePlayerRef.current) {
      alert("Preview is not ready yet.");
      return;
    }
    
    if (!isPlaying) {
      youtubePlayerRef.current.playVideo();
    } else {
      youtubePlayerRef.current.pauseVideo();
    }
  };

  const onSliderChange = (values: number[]) => {
    if (youtubePlayerRef.current) {
      if (values[0] !== trimRange[0]) youtubePlayerRef.current.seekTo(values[0], true);
      else if (values[1] !== trimRange[1]) youtubePlayerRef.current.seekTo(values[1], true);
    }
    setTrimRange(values);
  };

  // ── Derived values ──────────────────────────────────────────────────────────
  const trimDuration = trimRange[1] - trimRange[0];


  // ── Loading / Error states ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full"
        />
        <p className="text-muted-foreground animate-pulse">Extracting metadata…</p>
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-400 font-medium">Error: {error}</div>;
  }

  return (
    <>
      <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all flex items-center gap-1.5 text-sm"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PlaySquare className="w-6 h-6 text-primary" /> ClipFlow Editor
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadThumbnail}
            disabled={!metadata?.thumbnail}
            className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl flex items-center gap-2 text-sm text-blue-400 transition-colors disabled:opacity-50"
            title="Download high quality video thumbnail image"
          >
            <Image className="w-4 h-4" /> Download Thumbnail
          </button>
          <a
            href="http://localhost:3001/api/video/tools/download-dlp"
            download
            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-sm text-emerald-400 transition-colors"
            title="Download engine binaries needed to run local processing"
          >
            <Download className="w-4 h-4" /> Download Engine
          </a>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Player + Timeline ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Player */}
          <div
            className={`${
              aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[70vh] mx-auto w-auto max-w-full' :
              aspectRatio === '1:1' ? 'aspect-square max-h-[70vh] mx-auto w-auto max-w-full' :
              aspectRatio === '4:5' ? 'aspect-[4/5] max-h-[70vh] mx-auto w-auto max-w-full' :
              'aspect-video w-full'
            } bg-black rounded-2xl overflow-hidden relative border border-white/10 shadow-2xl group cursor-pointer transition-all duration-300`}
            onClick={togglePlay}
          >
            {/* Top-right overlay: mute toggle */}
            <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setIsMuted(m => {
                    if (youtubePlayerRef.current) {
                      if (!m) youtubePlayerRef.current.mute();
                      else youtubePlayerRef.current.unMute();
                    }
                    return !m;
                  });
                }}
                className="p-1.5 bg-black/70 rounded-lg border border-white/20 text-white backdrop-blur-md hover:bg-black/90 transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted
                  ? <VolumeX className="w-4 h-4 text-red-400" />
                  : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {youtubeId ? (
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none">
                <div
                  className={`flex items-center justify-center overflow-hidden ${
                    fitMode === 'crop' && aspectRatio !== 'original' && aspectRatio !== '16:9'
                      ? 'h-full aspect-video shrink-0 max-w-none'
                      : 'w-full h-full'
                  }`}
                >
                  <YouTube
                    videoId={youtubeId}
                    className="w-full h-full flex items-center justify-center pointer-events-none"
                    iframeClassName="w-full h-full block border-0 pointer-events-none"
                    opts={{
                      width: '100%',
                      height: '100%',
                      playerVars: {
                        autoplay: 1,
                        mute: 1,
                        controls: 0,
                        disablekb: 1,
                        fs: 0,
                        modestbranding: 1,
                        rel: 0,
                        showinfo: 0,
                        iv_load_policy: 3,
                        cc_load_policy: 0,
                        playsinline: 1,
                      },
                    }}
                    onReady={e => {
                      youtubePlayerRef.current = e.target;
                      try {
                        if (typeof e.target.unloadModule === 'function') {
                          e.target.unloadModule('captions');
                          e.target.unloadModule('cc');
                        }
                      } catch (err) {}
                      e.target.mute();
                      e.target.pauseVideo();
                      if (trimRange[0] > 0) {
                        e.target.seekTo(trimRange[0], true);
                      }
                    }}
                    onStateChange={e => {
                      if (e.data === 1) setIsPlaying(true);
                      else if (e.data === 2) setIsPlaying(false);
                    }}
                  />
                </div>
              </div>
            ) : (
              <img src={metadata?.thumbnail} alt="thumb" className={`w-full h-full opacity-50 ${aspectRatio !== 'original' ? (fitMode === 'crop' ? 'object-cover' : 'object-contain') : 'object-cover'}`} />
            )}
          </div>

          {/* Timeline & Controls */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 shadow-lg space-y-4">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <EditableTime value={trimRange[0]} min={0} max={trimRange[1] - 1} onChange={v => onSliderChange([v, trimRange[1]])} />
              <span className="font-medium">Trim · {formatTime(trimDuration)}</span>
              <EditableTime value={trimRange[1]} min={trimRange[0] + 1} max={metadata?.duration || 100} onChange={v => onSliderChange([trimRange[0], v])} />
            </div>

            {/* Slider + red playhead */}
            <div className="relative" ref={sliderWrapRef}>

              <Slider.Root
                className="relative flex items-center select-none touch-none w-full h-6"
                value={trimRange}
                max={metadata?.duration || 100}
                step={1}
                minStepsBetweenThumbs={1}
                onValueChange={onSliderChange}
                onPointerDown={e => {
                  // If NOT clicking directly on a thumb → seek the red playhead,
                  // don't let Radix jump a thumb to this position.
                  const isThumb = (e.target as HTMLElement).closest('[role="slider"]');
                  if (!isThumb) {
                    e.preventDefault();   // stops Radix from moving any thumb
                    seekFromClientX(e.clientX);
                    isDraggingRange.current = true;
                  }
                  // If IS a thumb — do nothing, Radix handles the drag natively.
                }}
              >
                <Slider.Track className="bg-black/50 relative grow rounded-full h-2 cursor-pointer">
                  <Slider.Range className="absolute bg-primary rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb
                  className="block w-[6px] h-10 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] rounded focus:outline-none focus:ring-2 focus:ring-primary hover:scale-105 transition-transform"
                  style={{ cursor: 'ew-resize' }}
                />
                <Slider.Thumb
                  className="block w-[6px] h-10 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] rounded focus:outline-none focus:ring-2 focus:ring-primary hover:scale-105 transition-transform"
                  style={{ cursor: 'ew-resize' }}
                />
              </Slider.Root>

              {/* Red playhead */}
              {metadata?.duration > 0 && (() => {
                const pct = (currentTime / (metadata?.duration || 1)) * 100;
                const nearRight = pct > 85;
                return (
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-red-500 rounded-full pointer-events-none shadow-[0_0_6px_rgba(239,68,68,0.8)]"
                    style={{ left: `${pct}%`, transform: 'translateX(-50%)', zIndex: 20 }}
                  >
                    {/* Dot on top */}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,1)]" />
                    {/* Time label below */}
                    <div
                      className="absolute top-full mt-1 bg-red-500/90 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg"
                      style={nearRight
                        ? { right: 0 }
                        : { left: '50%', transform: 'translateX(-50%)' }}
                    >
                      {formatTime(currentTime)}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Play/Pause & Skip Controls Bar below video */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (youtubePlayerRef.current) {
                      const ct = await youtubePlayerRef.current.getCurrentTime();
                      youtubePlayerRef.current.seekTo(Math.max(trimRange[0], ct - 10), true);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
                  title="Rewind 10 seconds"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>10s</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/80 text-white transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-md shadow-primary/20"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-white" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                      <span>Play</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (youtubePlayerRef.current) {
                      const ct = await youtubePlayerRef.current.getCurrentTime();
                      youtubePlayerRef.current.seekTo(Math.min(trimRange[1], ct + 10), true);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
                  title="Forward 10 seconds"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>10s</span>
                </button>
              </div>

              <div className="text-xs font-mono text-white/70">
                <span>{formatTime(currentTime)}</span> / <span>{formatTime(metadata?.duration || 0)}</span>
              </div>
            </div>
          </div>

          {/* Aspect Ratio Selector */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 shadow-lg space-y-4">
            <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider flex items-center gap-2">
               Video Format (Crop)
            </h3>
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'original', label: 'Original', icon: <Image className="w-4 h-4" /> },
                { id: '9:16', label: 'Shorts (9:16)', icon: <div className="w-3 h-5 border-2 border-current rounded-sm" /> },
                { id: '1:1', label: 'Square (1:1)', icon: <div className="w-4 h-4 border-2 border-current rounded-sm" /> },
                { id: '4:5', label: 'Portrait (4:5)', icon: <div className="w-3.5 h-4.5 border-2 border-current rounded-sm" /> },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setAspectRatio(opt.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${
                    aspectRatio === opt.id
                      ? 'border-primary bg-primary/20 text-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                      : 'border-white/10 bg-black/30 text-white/70 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>

            {aspectRatio !== 'original' && (
              <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                   Resize Mode
                </h3>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 w-fit">
                  <button
                    onClick={() => setFitMode('crop')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      fitMode === 'crop'
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Fill (Crop)
                  </button>
                  <button
                    onClick={() => setFitMode('pad')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      fitMode === 'pad'
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Fit (Black Bars)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Info + Download Options ──────────────────────────────── */}
        <div className="space-y-6">
          {/* Video Info */}
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10 shadow-lg">
            <h2 className="text-base font-semibold mb-1 line-clamp-2" title={metadata?.title}>{metadata?.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mb-5 text-xs text-muted-foreground">
              <span className="bg-primary/20 text-primary px-2 py-1 rounded-md">{metadata?.uploader}</span>
              <span>•</span>
              <span>{formatTime(metadata?.duration)}</span>
            </div>

            {/* Download Quality / Audio Quality */}
            <div className="space-y-4">

              {/* Output Filename */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Output Filename</label>
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                  placeholder="Output filename..."
                />
              </div>

              {/* Format selector — always visible */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Format</label>
                <div className="grid grid-cols-4 gap-2">
                  {['mp4', 'mp3', 'captions', 'jpg'].map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => {
                        setDownloadFormat(fmt);
                        // reset quality selection when switching modes
                        if (fmt === 'mp4') {
                          setDownloadQuality(qualityOptions[0]?.label || '');
                        } else if (fmt === 'jpg') {
                          setDownloadQuality('Max Resolution');
                        } else if (fmt === 'captions') {
                          setDownloadQuality('Timeline Subtitles');
                        } else {
                          setDownloadQuality('320kbps');
                        }
                      }}
                      className={`py-2 rounded-xl border text-xs font-bold uppercase transition-all ${
                        downloadFormat === fmt
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-white/10 bg-black/30 text-white/70 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {fmt === 'jpg' ? 'JPG' : fmt === 'captions' ? 'CAPTIONS' : fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* VIDEO quality grid — shown for mp4 */}
              {downloadFormat === 'mp4' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                    Quality
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {qualityOptions.map(opt => {
                      const size = opt.filesize
                        ? formatBytes(opt.filesize * (trimDuration / (metadata?.duration || 1)))
                        : estimateSize(opt.tbr, trimDuration, opt.height);
                      return (
                        <button
                          key={opt.label}
                          onClick={() => setDownloadQuality(opt.label)}
                          className={`flex flex-col items-center py-2 px-1 rounded-xl border text-xs font-medium transition-all ${
                            downloadQuality === opt.label
                              ? 'border-primary bg-primary/20 text-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                              : 'border-white/10 bg-black/30 text-white/70 hover:border-white/30 hover:text-white'
                          }`}
                        >
                          <span className="font-bold text-sm">{opt.label}</span>
                          {size && <span className="text-[10px] mt-0.5 opacity-70">{size}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AUDIO quality grid — shown for mp3 */}
              {downloadFormat === 'mp3' && (() => {
                const audioBitrates = [
                  { label: '320kbps', kbps: 320 },
                  { label: '192kbps', kbps: 192 },
                  { label: '128kbps', kbps: 128 },
                ];
                return (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                      Audio Quality
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {audioBitrates.map(({ label, kbps }) => {
                        const bytes = (kbps * 1000 / 8) * trimDuration;
                        const size = formatBytes(bytes);
                        return (
                          <button
                            key={label}
                            onClick={() => setDownloadQuality(label)}
                            className={`flex flex-col items-center py-2 px-1 rounded-xl border text-xs font-medium transition-all ${
                              downloadQuality === label
                                ? 'border-primary bg-primary/20 text-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                                : 'border-white/10 bg-black/30 text-white/70 hover:border-white/30 hover:text-white'
                            }`}
                          >
                            <span className="font-bold text-sm">{kbps}</span>
                            <span className="text-[10px] opacity-60">kbps</span>
                            {size && <span className="text-[10px] mt-0.5 opacity-70">{size}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* CAPTIONS options — shown for captions */}
              {downloadFormat === 'captions' && (
                <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Subtitle Format
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['srt', 'vtt', 'txt'] as const).map(fmt => (
                        <button
                          key={fmt}
                          onClick={() => setSubtitleFormat(fmt)}
                          className={`py-1.5 rounded-lg border text-xs font-bold uppercase transition-all ${
                            subtitleFormat === fmt
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                              : 'border-white/10 bg-black/30 text-white/70 hover:border-white/30 hover:text-white'
                          }`}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-1 space-y-2">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground uppercase block mb-1">
                        Language
                      </label>
                      <select
                        value={subtitleLang}
                        onChange={e => setSubtitleLang(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="en">English (en)</option>
                        <option value="es">Spanish (es)</option>
                        <option value="fr">French (fr)</option>
                        <option value="de">German (de)</option>
                        <option value="ja">Japanese (ja)</option>
                        <option value="ko">Korean (ko)</option>
                        <option value="zh">Chinese (zh)</option>
                        <option value="hi">Hindi (hi)</option>
                        <option value="ar">Arabic (ar)</option>
                      </select>
                    </div>

                    <div className="text-[10px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 flex items-center gap-1.5">
                      <span>⏱️</span>
                      <span>Auto-trimmed to your timeline [{formatTime(trimRange[0])} - {formatTime(trimRange[1])}] & starts at 00:00:00.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* THUMBNAIL info — shown for jpg */}
              {downloadFormat === 'jpg' && (
                <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                    Thumbnail Image
                  </label>
                  {metadata?.thumbnail && (
                    <img src={metadata.thumbnail} alt="thumbnail preview" className="w-full h-32 object-cover rounded-lg border border-white/10" />
                  )}
                  <p className="text-xs text-muted-foreground">Downloads high-resolution thumbnail image directly to your computer.</p>
                </div>
              )}

              {/* Download Button */}
              <button
                onClick={() => handleDownload(false)}
                disabled={isDownloading || !downloadQuality}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl flex items-center justify-center gap-2 font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {downloadFormat === 'jpg' ? (
                  <><Image className="w-4 h-4" /> Download Thumbnail (JPG)</>
                ) : isDownloading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                ) : (
                  <><Download className="w-4 h-4" /> Download {downloadFormat.toUpperCase()} · {downloadQuality}</>
                )}
              </button>

              {/* Old inline command box removed - moved to modal */}

            </div>
          </div>

          {/* AI Assistant (Coming Soon) */}
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10 flex flex-col shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-purple-100">AI Clip Extractor</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Coming Soon
              </span>
            </div>

            <div className="flex flex-col items-center justify-center text-center space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Automatic AI extraction of high-retention viral segments and hooks is coming in the next update.
              </p>
              <textarea
                disabled={true}
                readOnly={true}
                value=""
                placeholder="🔒 Custom AI instructions and viral clip analysis coming soon..."
                className="w-full h-20 p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-gray-500 placeholder-gray-500 resize-none cursor-not-allowed select-none focus:outline-none"
              />
              <button
                type="button"
                disabled={true}
                className="w-full py-2.5 bg-white/5 border border-white/10 text-gray-400 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-all cursor-not-allowed opacity-60"
              >
                <Sparkles className="w-4 h-4 text-amber-400" /> Recommend Viral Clip (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>


    {/* ── Download Progress Modal ───────────────────────────────────────── */}
    <AnimatePresence>
      {isDownloading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-6"
          >
            {/* Icon */}
            <div className="flex justify-center">
              {dlStatus === 'done' && <CheckCircle className="w-16 h-16 text-green-400" />}
              {dlStatus === 'error' && <AlertCircle className="w-16 h-16 text-red-400" />}
              {(dlStatus === 'downloading' || dlStatus === 'processing') && (
                <div className="relative w-16 h-16">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                    <circle
                      cx="32" cy="32" r="28"
                      fill="none" stroke="hsl(217, 91%, 60%)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - dlProgress / 100)}`}
                      style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{dlProgress}%</span>
                </div>
              )}
            </div>

            {/* Status text */}
            <div className="text-center space-y-1">
              <p className="font-semibold text-lg">
                {dlStatus === 'done'  && 'Download Complete!'}
                {dlStatus === 'error' && 'Download Failed'}
                {dlStatus === 'downloading' && 'Downloading…'}
                {dlStatus === 'processing'  && 'Processing…'}
              </p>
              <p className="text-sm text-muted-foreground">
                {dlStatus === 'error' ? dlError : dlMessage}
              </p>
            </div>

            {/* Stage pills */}
            <div className="flex gap-2 justify-center">
              {(['downloading', 'processing', 'done'] as const).map((stage, i) => (
                <div key={stage} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  dlStatus === stage
                    ? 'border-primary bg-primary/20 text-primary'
                    : (dlStatus === 'done' || (dlStatus === 'processing' && i === 0))
                      ? 'border-green-500/50 bg-green-500/10 text-green-400'
                      : 'border-white/10 text-white/30'
                }`}>
                  {stage === 'done' ? 'Complete' : stage.charAt(0).toUpperCase() + stage.slice(1)}
                </div>
              ))}
            </div>

            {/* Generated Command Box */}
            {generatedCommand && (
              <div className="relative mt-4 p-3 bg-black/50 border border-white/10 rounded-xl">
                <p className="text-xs text-white/50 mb-2">Paste this command into the opened PowerShell:</p>
                <code className="block text-xs text-green-400 font-mono pr-8 break-all max-h-32 overflow-y-auto">
                  {generatedCommand}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedCommand)}
                  className="absolute top-8 right-2 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  title="Copy command"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Close / cancel */}
            {(dlStatus === 'done' || dlStatus === 'error') && (
              <button
                onClick={() => setIsDownloading(false)}
                className="w-full py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors"
              >
                Close
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── ClipFlow Desktop App Required Modal ──────────────────────────────── */}
    {showAppDownloadModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-[#0c0c0f] border border-purple-500/30 w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(168,85,247,0.2)] relative space-y-5">
          {/* Close Button */}
          <button
            onClick={() => setShowAppDownloadModal(false)}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header / Icon */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
              <Monitor className="w-6 h-6 text-purple-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white leading-tight">ClipFlow Desktop App Required</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                The lightweight 1:1 floating companion app must be running on your PC to download and auto-crop clips without terminal popups.
              </p>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl space-y-2 text-xs text-gray-300">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>1:1 Floating Circular Progress Widget</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Automatic 9:16 / 1:1 / 4:5 Smart Cropping</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Auto file numbering <span className="font-mono text-purple-300">(1), (2)</span> for duplicates</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            <a
              href="http://localhost:3001/api/video/tools/download-dlp"
              download
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download ClipFlow Desktop Companion</span>
            </a>

            <div className="flex gap-2">
              <button
                onClick={() => handleDownload(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                <span>I've Started App (Retry)</span>
              </button>
              <button
                onClick={() => handleDownload(true)}
                className="py-2.5 px-3 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 text-xs transition-colors"
              >
                Server Fallback
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
