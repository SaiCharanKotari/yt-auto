import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Sparkles, Play, Pause, PlaySquare, Volume2, VolumeX, CheckCircle, AlertCircle, Loader2, Copy, ArrowLeft, Image } from 'lucide-react';
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

/** Estimate size from tbr (total bitrate, kbps) × trim duration */
function estimateSize(tbr: number | undefined, trimDurationSec: number): string {
  if (!tbr || tbr <= 0 || trimDurationSec <= 0) return '';
  const bytes = (tbr * 1000 / 8) * trimDurationSec;
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
  const [customFileName,  setCustomFileName]  = useState('');

  // Download progress
  const [isDownloading,   setIsDownloading]   = useState(false);
  const [dlProgress,      setDlProgress]      = useState(0);
  const [dlStatus,        setDlStatus]        = useState<'idle' | 'downloading' | 'processing' | 'done' | 'error'>('idle');
  const [dlError,         setDlError]         = useState('');
  const [dlMessage,       setDlMessage]       = useState('');
  const [generatedCommand, setGeneratedCommand] = useState('');

  // AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');

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
    fetch('http://localhost:3001/api/video/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
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

        // Sort descending (highest quality first)
        const sortedHeights = Array.from(heightSet).sort((a, b) => b - a);

        const opts: QualityOption[] = sortedHeights.map(targetH => {
          // Best candidate for size/tbr display (prefer muxed → highest tbr)
          const candidates = (data.formats || []).filter((f: any) => {
            if (!f.vcodec || f.vcodec === 'none') return false;
            const res = f.resolution || '';
            const match = res.match(/\d+x(\d+)/);
            return match && parseInt(match[1]) === targetH;
          });
          const muxedCand = candidates.filter((f: any) => f.acodec && f.acodec !== 'none');
          const best = (muxedCand.length > 0 ? muxedCand : candidates)
            .reduce((a: any, b: any) => (b.tbr || 0) > (a.tbr || 0) ? b : a, candidates[0]);

          return {
            label: `${targetH}p`,
            height: targetH,
            format_id: best?.format_id || '',
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
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch metadata');
        setIsLoading(false);
      });
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
  const handleDownload = async () => {
    if (!url || isDownloading) return;

    if (downloadFormat === 'jpg') {
      handleDownloadThumbnail();
      return;
    }

    setIsDownloading(true);
    setDlProgress(50);
    setDlStatus('downloading');
    setDlError('');
    setDlMessage('Opening PowerShell…');
    setGeneratedCommand('');

    try {
      const res = await fetch('http://localhost:3001/api/video/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          format: downloadFormat,
          quality: downloadQuality,
          trimStart: trimRange[0],
          trimEnd: trimRange[1],
          audioBitrate: downloadQuality.replace('kbps', 'k'), // '320kbps' → '320k'
          aspectRatio: aspectRatio !== 'original' ? aspectRatio : undefined,
          fitMode: aspectRatio !== 'original' ? fitMode : undefined,
          customFileName: customFileName,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setDlProgress(100);
      setDlStatus('done');
      setDlMessage(data.message || 'Terminal opened!');
      if (data.command) {
        setGeneratedCommand(data.command);
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

  // ── AI handler ─────────────────────────────────────────────────────────────
  const handleAnalyzeAI = async () => {
    if (!url || isAnalyzing) return;
    setIsAnalyzing(true);
    setAiResult(null);

    try {
      const res = await fetch('http://localhost:3001/api/video/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, customPrompt: aiCustomPrompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAiResult(data);

      // Snap the trim range to the recommended clip
      if (data.recommended_clip) {
        // Convert "MM:SS" or "HH:MM:SS" to seconds
        const parseTime = (timeStr: string) => {
          if (!timeStr) return 0;
          const parts = timeStr.split(':').map(Number);
          if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
          if (parts.length === 2) return parts[0] * 60 + parts[1];
          return parseInt(timeStr, 10) || 0;
        };

        const start = parseTime(data.recommended_clip.start_time);
        const end = parseTime(data.recommended_clip.end_time);

        if (start < end && end <= (metadata?.duration || 100)) {
          setTrimRange([start, end]);
          if (youtubePlayerRef.current) {
            youtubePlayerRef.current.seekTo(start, true);
          }
        }
      }
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      alert('AI Analysis failed: ' + err.message);
    } finally {
      setIsAnalyzing(false);
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
        <p className="text-muted-foreground animate-pulse">Extracting metadata via yt-dlp…</p>
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
            title="Download yt-dlp + ffmpeg binaries needed to run downloads"
          >
            <Download className="w-4 h-4" /> Download DLP
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
              <div className="absolute inset-0 pointer-events-none">
                <YouTube
                  videoId={youtubeId}
                  className="w-full h-full"
                  iframeClassName={`w-full h-full ${aspectRatio !== 'original' ? (fitMode === 'crop' ? 'object-cover' : 'object-contain') : 'object-contain'} scale-[1.2]`}
                  opts={{
                    width: '100%',
                    height: '100%',
                    playerVars: {
                      autoplay: 0,
                      controls: 0,
                      disablekb: 1,
                      fs: 0,
                      modestbranding: 1,
                      rel: 0,
                      showinfo: 0,
                      iv_load_policy: 3,
                    },
                  }}
                  onReady={e => {
                    youtubePlayerRef.current = e.target;
                    if (isMuted) e.target.mute();
                  }}
                  onStateChange={e => {
                    if (e.data === 1) setIsPlaying(true);
                    else if (e.data === 2) setIsPlaying(false);
                  }}
                />
              </div>
            ) : (
              <img src={metadata?.thumbnail} alt="thumb" className={`w-full h-full opacity-50 ${aspectRatio !== 'original' ? (fitMode === 'crop' ? 'object-cover' : 'object-contain') : 'object-cover'}`} />
            )}

            {/* Play/Pause + Skip controls overlay */}
            <div className={`absolute inset-0 flex items-center justify-center gap-4 transition-opacity pointer-events-none ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
              {/* ← 10s back */}
              <button
                onClick={async e => {
                  e.stopPropagation();
                  if (youtubePlayerRef.current) {
                    const ct = await youtubePlayerRef.current.getCurrentTime();
                    youtubePlayerRef.current.seekTo(Math.max(trimRange[0], ct - 10), true);
                  }
                }}
                className="pointer-events-auto flex flex-col items-center gap-1 group/skip cursor-pointer"
                title="Back 10 seconds"
              >
                <div className="p-3 bg-black/50 rounded-full backdrop-blur-md hover:bg-black/70 transition-all hover:scale-110">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                    <text x="7.5" y="15" fontSize="6" fill="white" stroke="none" fontWeight="bold">10</text>
                  </svg>
                </div>
                <span className="text-[10px] text-white/60 opacity-0 group-hover/skip:opacity-100 transition-opacity">-10s</span>
              </button>

              {/* Play / Pause */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="p-4 bg-black/50 rounded-full backdrop-blur-md pointer-events-auto hover:bg-black/70 transition-all hover:scale-110 cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying
                  ? <Pause className="w-8 h-8 text-white fill-white" />
                  : <Play  className="w-8 h-8 ml-1 text-white fill-white" />}
              </button>

              {/* +10s forward */}
              <button
                onClick={async e => {
                  e.stopPropagation();
                  if (youtubePlayerRef.current) {
                    const ct = await youtubePlayerRef.current.getCurrentTime();
                    youtubePlayerRef.current.seekTo(Math.min(trimRange[1], ct + 10), true);
                  }
                }}
                className="pointer-events-auto flex flex-col items-center gap-1 group/skip"
                title="Forward 10 seconds"
              >
                <div className="p-3 bg-black/50 rounded-full backdrop-blur-md hover:bg-black/70 transition-all hover:scale-110">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <text x="7.5" y="15" fontSize="6" fill="white" stroke="none" fontWeight="bold">10</text>
                  </svg>
                </div>
                <span className="text-[10px] text-white/60 opacity-0 group-hover/skip:opacity-100 transition-opacity">+10s</span>
              </button>
            </div>

            {/* Bottom note about preview quality */}
            <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs bg-black/60 px-2 py-1 rounded-md text-white/70 backdrop-blur-sm">
                Preview: YouTube Embed
              </span>
            </div>
          </div>

          {/* Timeline */}
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
                  {['mp4', 'mp3', 'wav', 'jpg'].map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => {
                        setDownloadFormat(fmt);
                        // reset quality selection when switching modes
                        if (fmt === 'mp4') {
                          setDownloadQuality(qualityOptions[0]?.label || '');
                        } else if (fmt === 'jpg') {
                          setDownloadQuality('Max Resolution');
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
                      {fmt === 'jpg' ? 'JPG' : fmt}
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
                        : estimateSize(opt.tbr, trimDuration);
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

              {/* AUDIO quality grid — shown for mp3 / wav */}
              {(downloadFormat === 'mp3' || downloadFormat === 'wav') && (() => {
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
                onClick={handleDownload}
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

          {/* AI Assistant */}
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10 flex flex-col shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-purple-100">AI Clip Extractor</h3>
              </div>
            </div>

            {!aiResult ? (
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Use AI to automatically extract the best viral clip based on comments and subtitles.
                </p>
                <textarea
                  value={aiCustomPrompt}
                  onChange={(e) => setAiCustomPrompt(e.target.value)}
                  placeholder="Optional: Add specific instructions (e.g., 'Find the funniest moment where they talk about speed')"
                  className="w-full h-20 p-3 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 text-white resize-none"
                />
                <button
                  onClick={handleAnalyzeAI}
                  disabled={isAnalyzing}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing (this takes a moment)...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Recommend Viral Clip</>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-sm animate-in fade-in zoom-in duration-300">
                <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-xl space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="font-bold text-purple-200 leading-tight">
                      {aiResult.recommended_clip?.title || 'Recommended Clip'}
                    </h4>
                    <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded-md font-bold whitespace-nowrap">
                      {aiResult.recommended_clip?.confidence}% Match
                    </span>
                  </div>
                  <p className="text-purple-200/80 text-xs leading-relaxed">
                    {aiResult.recommended_clip?.reason}
                  </p>
                  
                  <div className="pt-2 border-t border-purple-500/20">
                    <p className="text-xs text-muted-foreground mb-1">Hashtags:</p>
                    <div className="flex flex-wrap gap-1">
                      {aiResult.recommended_clip?.hashtags?.slice(0, 5).map((tag: string) => (
                        <span key={tag} className="text-[10px] bg-black/40 text-purple-300 px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAnalyzeAI}
                    disabled={isAnalyzing}
                    className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze Again'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* ── Generated Command Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {generatedCommand && (dlStatus === 'done' || dlStatus === 'idle') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#111] border border-emerald-500/30 w-full max-w-3xl rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.15)] relative flex flex-col max-h-[90vh]"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setGeneratedCommand('');
                  setDlStatus('idle');
                }}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>

              <div className="p-8 pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-emerald-50">Download Started Successfully</h2>
                </div>
                <p className="text-emerald-100/70 ml-13">
                  {dlMessage || 'A terminal window has opened to process your video. It will close automatically when finished.'}
                </p>
              </div>

              <div className="px-8 py-4 flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Executed Command</h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCommand);
                      setDlMessage('Copied to clipboard!');
                      setTimeout(() => setDlMessage('Terminal will close automatically when done.'), 3000);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Copy className="w-4 h-4" /> Copy Command
                  </button>
                </div>
                
                <div className="bg-black/60 border border-white/10 rounded-xl p-4 overflow-y-auto max-h-[40vh] custom-scrollbar">
                  <pre className="text-emerald-400/90 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">
                    {generatedCommand}
                  </pre>
                </div>
              </div>

              <div className="p-6 pt-4 mt-auto">
                <button
                  onClick={() => {
                    setGeneratedCommand('');
                    setDlStatus('idle');
                  }}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-semibold transition-colors"
                >
                  Close & Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </>
  );
}
