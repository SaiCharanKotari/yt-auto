import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scissors, Sparkles, Download, 
  Copy, Check, AlertCircle, RefreshCw, Film, 
  Clock, CheckCircle2, ChevronRight, Layers, 
  Sliders, ShieldCheck, History,
  ArrowLeft, FileVideo, Lock,
  Monitor, X
} from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import YouTube, { type YouTubePlayer } from 'react-youtube';
import { getCachedMetadata, setCachedMetadata } from '../utils/metadataCache';

// ─── Custom Icons ────────────────────────────────────────────────────────────
function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function extractYouTubeId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/);
  return (match && match[2].length === 11) ? match[2] : null;
}

function formatTime(seconds: number): string {
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

interface QualityOption {
  label: string;
  height: number;
  format_id: string;
  tbr?: number;
}

interface AIHighlight {
  title: string;
  start: number;
  end: number;
  hookScore: number;
  reason: string;
  tag: string;
}

interface ClipHistoryItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  timestamp: string;
  quality: string;
  aspectRatio: string;
}

const SAMPLE_VIDEOS = [
  {
    name: 'Me at the zoo (Classic 4K)',
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  },
  {
    name: 'Rick Astley — Never Gonna Give You Up',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  {
    name: 'Big Buck Bunny (Animation HD)',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  }
];

export default function ClipFlowStudio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUrl = searchParams.get('url') || '';

  // Studio Inputs
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [activeUrl, setActiveUrl] = useState(initialUrl);
  const [quickInstaUrl, setQuickInstaUrl] = useState('');
  const [isQuickInstaLoading, setIsQuickInstaLoading] = useState(false);
  const [instaSuccessMsg, setInstaSuccessMsg] = useState('');

  // Video State
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [errorMeta, setErrorMeta] = useState('');

  // Player & Timeline
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const sliderWrapRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 60]);

  // Export Settings
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:5'>('16:9');
  const [fitMode, setFitMode] = useState<'crop' | 'pad'>('crop');
  const [downloadFormat, setDownloadFormat] = useState<'mp4' | 'mp3' | 'captions'>('mp4');
  const [captionFormat, setCaptionFormat] = useState<'srt' | 'vtt' | 'txt'>('srt');
  const [captionLang, setCaptionLang] = useState<string>('en');
  const [downloadQuality, setDownloadQuality] = useState('1080p');
  const [customFileName, setCustomFileName] = useState('');
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([]);

  // AI Highlights State
  const [aiHighlights, setAiHighlights] = useState<AIHighlight[]>([]);

  // Download & Execution State
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [showAppDownloadModal, setShowAppDownloadModal] = useState(false);

  // History State
  const [clipHistory, setClipHistory] = useState<ClipHistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Backend Health
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clipflow_history');
      if (saved) setClipHistory(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load clip history from localStorage');
    }
  }, []);

  // Save history
  const saveToHistory = (item: Omit<ClipHistoryItem, 'id' | 'timestamp'>) => {
    const newItem: ClipHistoryItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updated = [newItem, ...clipHistory.slice(0, 9)];
    setClipHistory(updated);
    try {
      localStorage.setItem('clipflow_history', JSON.stringify(updated));
    } catch (e) {}
  };

  // Check Backend Health
  useEffect(() => {
    fetch('http://localhost:3001/api/video/proxy?url=test')
      .then(res => setBackendOnline(res.status === 400 || res.status === 200))
      .catch(() => setBackendOnline(false));
  }, []);

  // Fetch Video Metadata (Cached for Instant Tab Transitions)
  const fetchVideo = async (targetUrl: string, forceRefresh: boolean = false) => {
    if (!targetUrl) return;
    setErrorMeta('');
    setAiHighlights([]);
    setDownloadStatus('idle');

    let data: any = null;

    // 0. Check instant cache if not forcing refresh
    if (!forceRefresh) {
      const cached = getCachedMetadata(targetUrl);
      if (cached) {
        data = cached;
        console.log('%c[ClipFlow Studio ⚡ METADATA LOADED FROM CACHE (INSTANT)]', 'color: #22c55e; font-weight: bold;', {
          targetUrl,
          title: cached.title,
          duration: cached.duration_string || cached.duration,
        });
      }
    }

    let lastErrorMessage = '';
    if (!data) {
      setIsLoadingMeta(true);
      setMetadata(null);
      console.log('%c[ClipFlow Studio 📡 METADATA REQUEST]', 'color: #38bdf8; font-weight: bold;', { targetUrl });

      // 1. Try Desktop Helper App (port 18942) or backend (port 3001)
      const endpoints = [
        'http://localhost:3001/api/video/metadata',
        'http://127.0.0.1:18942/metadata',
      ];
      for (const endpoint of endpoints) {
        try {
          console.log(`[ClipFlow Studio 📡] Querying metadata from: ${endpoint}`);
          const controller = new AbortController();
          const isHelper = endpoint.includes('18942');
          const timeoutId = setTimeout(() => controller.abort(), isHelper ? 1500 : 25000);
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const json = await res.json();
            if (json && !json.error && (json.title || json.id)) {
              data = json;
              console.log('%c[ClipFlow Studio 📥 METADATA SUCCESS]', 'color: #22c55e; font-weight: bold;', {
                endpoint,
                title: json.title,
                duration: json.duration_string || json.duration,
                formatsCount: json.formats?.length || 0,
              });
              break;
            }
          } else {
            const errJson = await res.json().catch(() => null);
            if (errJson?.error) {
              lastErrorMessage = errJson.error;
            }
          }
        } catch (e: any) {
          console.warn(`[ClipFlow Studio ⚠️] Endpoint ${endpoint} unreachable: ${e.message}`);
          if (!lastErrorMessage && e.name !== 'AbortError') {
            lastErrorMessage = e.message;
          }
        }
      }

      // 2. If servers are offline but it's a YouTube video, use public oEmbed
      if (!data) {
        const ytId = extractYouTubeId(targetUrl);
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

      // Save into cache for future instant transitions
      if (data) {
        setCachedMetadata(targetUrl, data);
      }
    }

    try {
      if (!data) {
        throw new Error(lastErrorMessage || 'Could not fetch video details. Ensure the Desktop Helper app or backend is running.');
      }

      setMetadata(data);
      const isLive = Boolean(
        data.is_live === true ||
        data.live_status === 'is_live' ||
        targetUrl.toLowerCase().includes('youtube.com/live') ||
        targetUrl.toLowerCase().includes('/live/') ||
        targetUrl.toLowerCase().includes('youtu.be/live') ||
        ((targetUrl.toLowerCase().includes('twitch.tv/') || targetUrl.toLowerCase().includes('kick.com/')) &&
          !targetUrl.toLowerCase().includes('/clip') &&
          !targetUrl.toLowerCase().includes('/video') &&
          !targetUrl.toLowerCase().includes('/videos'))
      );
      let totalDur = data.duration && data.duration > 0 ? data.duration : 0;
      if (isLive && totalDur <= 0) {
        if (data.release_timestamp && data.release_timestamp > 0) {
          const elapsed = Math.floor(Date.now() / 1000 - data.release_timestamp);
          if (elapsed > 0) totalDur = elapsed;
        }
        // if (totalDur <= 0) totalDur = 300; // 5 mins fallback commented out
      }
      setTrimRange([0, totalDur]);
      setCustomFileName((data.title || 'ClipFlow_Video').replace(/[^\w\s-]/gi, '').trim());

      // Parse qualities
      const heightSet = new Set<number>();
      (data.formats || []).forEach((f: any) => {
        if (!f.vcodec || f.vcodec === 'none') return;
        let h = f.height || 0;
        if (!h) {
          const resMatch = (f.resolution || '').match(/\d+x(\d+)/);
          if (resMatch) h = parseInt(resMatch[1]);
        }
        if (h >= 144) heightSet.add(h);
      });

      const allStandardHeights = [2160, 1440, 1080, 720, 480, 360, 240];
      const opts: QualityOption[] = allStandardHeights.map(h => {
        const matching = (data.formats || []).filter((f: any) => {
          let fh = f.height || 0;
          if (!fh) {
            const match = (f.resolution || '').match(/\d+x(\d+)/);
            if (match) fh = parseInt(match[1]);
          }
          return fh === h;
        });
        const best = matching.reduce((a: any, b: any) => (b.tbr || 0) > (a.tbr || 0) ? b : a, matching[0]);
        const label = `${h}p`;
        return {
          label,
          height: h,
          format_id: best?.format_id || 'best',
          tbr: best?.tbr,
          isNative: true,
        };
      });

      setQualityOptions(opts);
      if (opts.find(o => o.height === 1080)) {
        setDownloadQuality('1080p');
      } else if (opts.length > 0) {
        setDownloadQuality(opts[0].label);
      }

      setActiveUrl(targetUrl);
      setSearchParams({ url: targetUrl });
    } catch (err: any) {
      console.error('[ClipFlow] Metadata fetch error:', err);
      setErrorMeta(err.message || 'Failed to fetch video information. Ensure the URL is valid.');
    } finally {
      setIsLoadingMeta(false);
    }
  };

  // Sync initial URL
  useEffect(() => {
    if (initialUrl && initialUrl !== activeUrl) {
      setUrlInput(initialUrl);
      fetchVideo(initialUrl);
    }
  }, [initialUrl]);

  // Sync current time from YouTube Player
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
        } catch (e) {}
      }
      if (isPlaying) {
        animationFrameId = requestAnimationFrame(updateTime);
      }
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateTime);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, trimRange]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    fetchVideo(urlInput.trim());
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text.trim());
        fetchVideo(text.trim());
      }
    } catch (e) {
      console.warn('Clipboard read permission denied');
    }
  };

  // YouTube ID
  const youtubeId = extractYouTubeId(activeUrl);

  // Quick preset handlers
  const handleQuickPreset = (durationSeconds: number) => {
    const total = metadata?.duration || 120;
    const start = currentTime;
    const end = Math.min(total, start + durationSeconds);
    setTrimRange([start, end]);
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(start, true);
    }
  };

  const handleNudge = (handle: 'start' | 'end', delta: number) => {
    const total = metadata?.duration || 120;
    if (handle === 'start') {
      const next = Math.max(0, Math.min(trimRange[1] - 1, trimRange[0] + delta));
      setTrimRange([next, trimRange[1]]);
      if (youtubePlayerRef.current) youtubePlayerRef.current.seekTo(next, true);
    } else {
      const next = Math.max(trimRange[0] + 1, Math.min(total, trimRange[1] + delta));
      setTrimRange([trimRange[0], next]);
    }
  };
  const applyHighlight = (hl: AIHighlight) => {
    setTrimRange([hl.start, hl.end]);
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(hl.start, true);
    }
    if (aspectRatio === '16:9') {
      setAspectRatio('9:16');
    }
  };

  // Export Download
  const handleExportDownload = async (forceServerFallback = false) => {
    if (!activeUrl) return;
    setIsDownloading(true);
    setDownloadStatus('running');
    setStatusMessage('Connecting to ClipFlow Desktop Helper...');

    try {
      const effectiveFormat = downloadFormat === 'captions' ? captionFormat : downloadFormat;
      const payload = {
        url: activeUrl,
        format: effectiveFormat,
        quality: downloadQuality,
        subtitleLang: captionLang,
        relativeTimecodes: true,
        trimStart: trimRange[0],
        trimEnd: trimRange[1],
        aspectRatio: aspectRatio === '16:9' ? undefined : aspectRatio,
        fitMode: fitMode,
        duration: metadata?.duration || 0,
        customFileName: customFileName || metadata?.title || 'ClipFlow_Video',
      };

      console.log('%c[ClipFlow Studio 🚀 DOWNLOAD TRIGGERED]', 'color: #f59e0b; font-weight: bold;', payload);

      let capturedByHelper = false;
      if (!forceServerFallback) {
        // Try 127.0.0.1 first (bypasses Windows IPv6 resolution delay), then localhost
        for (const endpoint of ['http://127.0.0.1:18942/download', 'http://localhost:18942/download']) {
          try {
            console.log(`[ClipFlow Studio 📡 SENDING] POST payload -> ${endpoint}`);
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
              console.log('%c[ClipFlow Studio ✅ CAPTURED BY DESKTOP HELPER]', 'color: #22c55e; font-weight: bold;', resData);
              capturedByHelper = true;
              setDownloadStatus('success');
              setStatusMessage('Captured by ClipFlow Desktop Helper! Downloading...');
              setShowAppDownloadModal(false);
              break;
            } else {
              console.warn(`[ClipFlow Studio ⚠️] Helper on ${endpoint} responded with status: ${helperRes.status}`);
            }
          } catch (e: any) {
            console.log(`[ClipFlow Studio ℹ️] Qt Desktop Helper not reachable on ${endpoint} (${e.message})`);
          }
        }
      }

      if (!capturedByHelper) {
        if (!forceServerFallback) {
          setShowAppDownloadModal(true);
          setDownloadStatus('idle');
          setStatusMessage('ClipFlow Desktop App required for direct PC download.');
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
          const downloadName = data.fileName || `${customFileName || 'clipflow_clip'}.${effectiveFormat}`;
          
          try {
            const fileRes = await fetch(directUrl, { credentials: 'include' });
            if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
            const blob = await fileRes.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = downloadName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              if (document.body.contains(a)) document.body.removeChild(a);
              window.URL.revokeObjectURL(blobUrl);
            }, 3000);
          } catch {
            const a = document.createElement('a');
            a.href = directUrl;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }

        setDownloadStatus('success');
        setStatusMessage('Downloaded directly to your device!');
        setShowAppDownloadModal(false);
      }

      // Save to recent history
      saveToHistory({
        title: customFileName || metadata?.title || 'Untitled Clip',
        url: activeUrl,
        thumbnail: metadata?.thumbnail || '',
        duration: `${formatTime(trimRange[0])} - ${formatTime(trimRange[1])} (${formatTime(trimRange[1] - trimRange[0])})`,
        quality: downloadQuality,
        aspectRatio: aspectRatio,
      });
    } catch (err: any) {
      console.error('[ClipFlow] Download error:', err);
      setDownloadStatus('error');
      setStatusMessage(err.message || 'Export error. Verify processing service.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Instagram quick grab
  const handleQuickInstaDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInstaUrl) return;
    setIsQuickInstaLoading(true);
    setInstaSuccessMsg('');
    try {
      const res = await fetch('http://localhost:3001/api/video/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: quickInstaUrl,
          format: 'mp4',
          quality: '1080p',
          customFileName: 'Instagram_ClipFlow_Video',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInstaSuccessMsg('Instagram video queued for download to your Downloads folder!');
      setQuickInstaUrl('');
    } catch (e: any) {
      setInstaSuccessMsg(`Error: ${e.message || 'Failed to download'}`);
    } finally {
      setIsQuickInstaLoading(false);
    }
  };

  // Accurate Size calculator
  const trimDuration = Math.max(0, trimRange[1] - trimRange[0]);
  let estimatedBytes = 0;
  if (downloadFormat === 'captions') {
    // Caption / Transcript text file (~2-8 KB)
    estimatedBytes = 3500;
  } else if (downloadFormat === 'mp3') {
    const kbps = 256; // Standard high-quality MP3 bitrate
    estimatedBytes = (kbps * 1000 / 8) * trimDuration;
  } else {
    // MP4 Video download (bestvideo + bestaudio)
    const selectedQualityObj = qualityOptions.find(q => q.label === downloadQuality);
    const height = selectedQualityObj?.height || parseInt((downloadQuality || '').replace(/[^\d]/g, ''), 10) || 1080;
    
    let baseKbps = 3800; // default 1080p realistic combined bitrate
    if (height >= 2160) baseKbps = 20000;
    else if (height >= 1440) baseKbps = 10000;
    else if (height >= 1080) baseKbps = 3800;
    else if (height >= 720) baseKbps = 2200;
    else if (height >= 480) baseKbps = 1000;
    else if (height >= 360) baseKbps = 550;
    else if (height >= 240) baseKbps = 300;
    else baseKbps = 150;

    const rawTbr = selectedQualityObj?.tbr;
    const effectiveKbps = (rawTbr && rawTbr > baseKbps) ? (rawTbr + 160) : baseKbps;
    estimatedBytes = (effectiveKbps * 1000 / 8) * trimDuration;
  }

  return (
    <div className="min-h-screen bg-black text-[#f8fafc] flex flex-col selection:bg-purple-500/30 selection:text-purple-200">
      
      {/* ── Top Navigation / Brand Header ───────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-xl px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo & Slogan */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setActiveUrl(''); setMetadata(null); }}>
            <img src="/logo.ico" alt="ClipFlow" style={{ width: 40, height: 40, objectFit: 'contain' }} />
            <span className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-purple-400">
              ClipFlow
            </span>
          </div>

          {/* Right Header Status & Tools */}
          <div className="flex items-center gap-3">
            {backendOnline !== null && (
              <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                backendOnline 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                <div className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{backendOnline ? 'Engine Online' : 'Connecting Engine...'}</span>
              </div>
            )}

            {clipHistory.length > 0 && (
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 hover:text-white border border-white/10 transition-colors"
              >
                <History className="w-3.5 h-3.5 text-purple-400" />
                <span>Recent ({clipHistory.length})</span>
              </button>
            )}

            <a
              href="http://localhost:3001/api/video/tools/download-dlp"
              download
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '161px',
                minWidth: '161px',
                height: '51px',
                minHeight: '51px',
                background: 'linear-gradient(0deg, #FFFFFF 5.29%, #FDDF1F 54.33%)',
                borderRadius: '4px',
                fontFamily: "'Iosevka Charon', 'Courier New', monospace",
                fontWeight: 400,
                fontSize: '20px',
                lineHeight: '1',
                color: '#000000',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
              }}
              title="Download ClipFlow Processing Engine"
            >
              Download Engine
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* ── Hero / URL Importer ───────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="text-center max-w-3xl mx-auto pt-2 pb-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/25 text-xs font-semibold text-purple-300 mb-3"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Convert Any Long Video into Viral Shorts in Seconds</span>
            </motion.div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Clip, Repurpose & Publish with <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">ClipFlow</span>
            </h1>
            <p className="text-gray-400 mt-2 text-sm sm:text-base">
              Paste a YouTube, Shorts, Twitch, or Instagram URL to trim, reframe (9:16), extract AI viral hooks, and download in full 4K/1080p quality with zero watermark.
            </p>
          </div>

          {/* Smart Input Form */}
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleUrlSubmit} className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-300" />
              <div className="relative flex items-center bg-[#09090b] border border-white/15 rounded-2xl p-2 shadow-2xl">
                <div className="pl-3 pr-2 text-gray-400">
                  <YoutubeIcon className="w-6 h-6 text-red-500" />
                </div>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste YouTube, Shorts, Twitch, or Instagram URL..."
                  className="flex-1 bg-transparent py-3 px-2 text-white placeholder-gray-500 focus:outline-none text-sm sm:text-base font-medium"
                />
                
                {/* Paste from Clipboard Button */}
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors mr-2"
                  title="Paste from clipboard"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Paste
                </button>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isLoadingMeta || !urlInput.trim()}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {isLoadingMeta ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <span>Import Studio</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Demo Video Pills */}
            <div className="flex items-center justify-center flex-wrap gap-2 mt-3 text-xs text-gray-400">
              <span className="font-medium text-gray-500">Quick Demo:</span>
              {SAMPLE_VIDEOS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setUrlInput(sample.url);
                    fetchVideo(sample.url);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 transition-colors flex items-center gap-1"
                >
                  <span>{sample.name}</span>
                </button>
              ))}
            </div>

            {errorMeta && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Unable to fetch video details</p>
                  <p className="text-red-300/80 mt-0.5">{errorMeta}</p>
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* ── Studio Workspace (When video is loaded) ────────────────────────── */}
        {metadata ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Video Header Card */}
            <div className="glass-panel rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <img
                  src={metadata.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'}
                  alt={metadata.title}
                  className="w-24 sm:w-32 aspect-video rounded-xl object-cover border border-white/10 shadow-md shrink-0"
                />
                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-bold text-white line-clamp-1" title={metadata.title}>
                    {metadata.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-400">
                    <span className="text-purple-400 font-medium">{metadata.uploader || 'Creator'}</span>
                    <span>•</span>
                    <span>{metadata.duration_string || formatTime(metadata.duration || 0)} Total</span>
                    <span>•</span>
                    <span>{Number(metadata.view_count || 0).toLocaleString()} Views</span>
                  </div>
                  <div className="pt-1 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[11px] font-semibold border border-purple-500/30">
                      Trim Selection: {formatTime(trimRange[1] - trimRange[0])}
                    </span>
                    <span className="text-gray-500 text-xs">
                      ({formatTime(trimRange[0])} &rarr; {formatTime(trimRange[1])})
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 self-end md:self-auto">
                <a
                  href={`http://localhost:3001/api/video/thumbnail?url=${encodeURIComponent(metadata.thumbnail || '')}&title=${encodeURIComponent(metadata.title || 'thumbnail')}`}
                  download
                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Download HD Thumbnail"
                >
                  HD Thumbnail
                </a>
                <button
                  onClick={() => {
                    setActiveUrl('');
                    setMetadata(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-400 hover:text-white border border-white/10 transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>New URL</span>
                </button>
              </div>
            </div>

            {/* Main Studio Grid: Player & Timeline on Left, Settings & AI on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Player + Interactive Scrubber (7 Cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Embedded Video Player with Aspect Ratio Frame Preview */}
                <div className="glass-panel rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between text-xs text-gray-400 font-medium px-1">
                    <span className="flex items-center gap-1.5 text-white font-semibold">
                      <Film className="w-4 h-4 text-purple-400" />
                      Live Canvas Preview
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px]">
                      Aspect: <strong className="text-purple-300">{aspectRatio}</strong> ({fitMode})
                    </span>
                  </div>

                  {/* Player Canvas Wrapper */}
                  <div className="bg-black/60 rounded-2xl p-2 border border-white/10 flex items-center justify-center overflow-hidden min-h-[300px]">
                    <div 
                      className={`relative bg-black rounded-xl overflow-hidden flex items-center justify-center border border-white/15 shadow-2xl transition-all duration-300 ${
                        aspectRatio === '9:16'
                          ? 'aspect-[9/16] h-[460px] max-w-[258px] w-full mx-auto'
                          : aspectRatio === '1:1'
                          ? 'aspect-square h-[380px] max-w-[380px] w-full mx-auto'
                          : aspectRatio === '4:5'
                          ? 'aspect-[4/5] h-[420px] max-w-[336px] w-full mx-auto'
                          : 'aspect-video w-full'
                      }`}
                    >
                      {youtubeId ? (
                        <div 
                          className={`flex items-center justify-center transition-all overflow-hidden ${
                            fitMode === 'crop' && aspectRatio !== '16:9'
                              ? 'h-full w-full'
                              : 'aspect-video w-full my-auto'
                          }`}
                        >
                          <div
                            className={`flex items-center justify-center ${
                              fitMode === 'crop' && aspectRatio !== '16:9'
                                ? 'h-full aspect-video shrink-0 max-w-none'
                                : 'w-full h-full'
                            }`}
                          >
                            <div className="w-full h-full relative flex items-center justify-center overflow-hidden pointer-events-none select-none">
                              <YouTube
                                videoId={youtubeId}
                                opts={{
                                  width: '100%',
                                  height: '100%',
                                  playerVars: {
                                    autoplay: 0,
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
                                    enablejsapi: 1,
                                    start: trimRange[0],
                                  },
                                }}
                                onReady={(e) => {
                                  youtubePlayerRef.current = e.target;
                                  try {
                                    if (typeof e.target.unloadModule === 'function') {
                                      e.target.unloadModule('captions');
                                      e.target.unloadModule('cc');
                                    }
                                  } catch (err) {}
                                  e.target.mute();
                                  if (trimRange[0] > 0) {
                                    e.target.seekTo(trimRange[0], true);
                                  }
                                }}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onStateChange={(e) => {
                                  if (e.data === 1) {
                                    setIsPlaying(true);
                                  } else if (e.data === 2) {
                                    setIsPlaying(false);
                                  }
                                }}
                                className="w-full h-full flex items-center justify-center pointer-events-none"
                                iframeClassName="w-full h-full block border-0 pointer-events-none"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-8 text-gray-400">
                          <FileVideo className="w-12 h-12 mx-auto mb-2 text-purple-400 opacity-60" />
                          <p className="text-sm font-semibold text-white">Direct / Social Media Stream</p>
                          <p className="text-xs text-gray-500 mt-1">Ready for high-speed conversion & trimming</p>
                        </div>
                      )}

                      {/* Aspect Ratio Badge Overlay */}
                      {aspectRatio !== '16:9' && (
                        <div className="absolute top-2 left-2 z-10 pointer-events-none">
                          <span className="bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-purple-300 border border-purple-500/30">
                            {aspectRatio} {fitMode === 'pad' ? 'Letterbox (Top & Bottom Black)' : 'Full Crop'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Precision Multi-Track Scrubber */}
                  <div className="space-y-4 pt-2">
                    
                    {/* Timestamp Badges */}
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Start:</span>
                        <input
                          type="text"
                          value={formatTime(trimRange[0])}
                          onChange={(e) => {
                            const val = parseTime(e.target.value);
                            if (!isNaN(val) && val < trimRange[1]) setTrimRange([val, trimRange[1]]);
                          }}
                          className="w-16 bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-center text-zinc-200 font-bold focus:outline-none focus:border-zinc-400"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-300">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-semibold text-white">{formatTime(trimRange[1] - trimRange[0])} Selected</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">End:</span>
                        <input
                          type="text"
                          value={formatTime(trimRange[1])}
                          onChange={(e) => {
                            const val = parseTime(e.target.value);
                            if (!isNaN(val) && val > trimRange[0]) setTrimRange([trimRange[0], Math.min(metadata.duration || 9999, val)]);
                          }}
                          className="w-16 bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-center text-zinc-200 font-bold focus:outline-none focus:border-zinc-400"
                        />
                      </div>
                    </div>

                    {/* Dual Range Scrubber Slider with Time-Based Frames */}
                    <div className="relative py-2 px-1" ref={sliderWrapRef}>
                      {/* Filmstrip frame strip background */}
                      <div className="mb-2 h-12 rounded-lg overflow-hidden border border-white/10 bg-black/60 flex relative shadow-inner">
                        {Array.from({ length: 8 }).map((_, i) => {
                          const totalDur = metadata.duration || 120;
                          const frameTimeSec = Math.round((totalDur / 8) * (i + 0.5));
                          const timeStr = formatTime(frameTimeSec);

                          const ytSlot = i < 2 ? '1' : i < 6 ? '2' : '3';
                          const ytFallback = youtubeId
                            ? `https://img.youtube.com/vi/${youtubeId}/${ytSlot}.jpg`
                            : metadata.thumbnail || '';
                          const frameUrl = ytFallback;

                          return (
                            <div
                              key={i}
                              className="relative h-full flex-1 border-r border-white/5 bg-zinc-950/80 overflow-hidden group"
                            >
                              <img
                                src={frameUrl}
                                onError={(e) => {
                                  if (e.currentTarget.src !== ytFallback && ytFallback) {
                                    e.currentTarget.src = ytFallback;
                                  }
                                }}
                                className="h-full w-full object-cover opacity-50 group-hover:opacity-80 transition-opacity"
                                alt={`Frame at ${timeStr}`}
                              />
                              <span className="absolute bottom-0.5 right-1 text-[7.5px] font-mono font-bold text-white/80 bg-black/75 backdrop-blur-xs px-1 py-0.2 rounded border border-white/10 pointer-events-none select-none">
                                {timeStr}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <Slider.Root
                        className="slider-root"
                        value={trimRange}
                        min={0}
                        max={metadata.duration || 120}
                        step={1}
                        minStepsBetweenThumbs={1}
                        onValueChange={(val) => {
                          setTrimRange([val[0], val[1]]);
                          if (youtubePlayerRef.current && (val[0] !== trimRange[0])) {
                            youtubePlayerRef.current.seekTo(val[0], true);
                          }
                        }}
                      >
                        <Slider.Track className="slider-track">
                          <Slider.Range className="slider-range" />
                        </Slider.Track>
                        <Slider.Thumb className="slider-thumb" aria-label="Start Trim" />
                        <Slider.Thumb className="slider-thumb" aria-label="End Trim" />
                      </Slider.Root>
                    </div>

                    {/* Nudge & Trim Adjustment Tools */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
                      {/* Left Nudge Tools */}
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500 text-[11px] mr-1">Start:</span>
                        <button
                          onClick={() => handleNudge('start', -5)}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        >
                          -5s
                        </button>
                        <button
                          onClick={() => handleNudge('start', -1)}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        >
                          -1s
                        </button>
                        <button
                          onClick={() => handleNudge('start', 1)}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        >
                          +1s
                        </button>
                        <button
                          onClick={() => {
                            if (currentTime < trimRange[1]) setTrimRange([currentTime, trimRange[1]]);
                          }}
                          className="px-2 py-1 rounded bg-white/10 text-zinc-200 hover:bg-white/20 transition-colors font-medium"
                          title="Set Start to current playhead"
                        >
                          [ Set In
                        </button>
                      </div>

                      {/* Right Nudge Tools */}
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500 text-[11px] mr-1">End:</span>
                        <button
                          onClick={() => {
                            if (currentTime > trimRange[0]) setTrimRange([trimRange[0], currentTime]);
                          }}
                          className="px-2 py-1 rounded bg-white/10 text-zinc-200 hover:bg-white/20 transition-colors font-medium"
                          title="Set End to current playhead"
                        >
                          Set Out ]
                        </button>
                        <button
                          onClick={() => handleNudge('end', -1)}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        >
                          -1s
                        </button>
                        <button
                          onClick={() => handleNudge('end', 1)}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        >
                          +1s
                        </button>
                        <button
                          onClick={() => handleNudge('end', 5)}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        >
                          +5s
                        </button>
                      </div>
                    </div>

                    {/* Quick Duration Shortcuts */}
                    <div className="flex items-center gap-2 pt-2 text-xs flex-wrap">
                      <span className="text-gray-400 font-medium">Quick Preset:</span>
                      <button
                        onClick={() => handleQuickPreset(15)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 transition-colors"
                      >
                        ⚡ 15s Shorts
                      </button>
                      <button
                        onClick={() => handleQuickPreset(30)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 transition-colors"
                      >
                        🎬 30s Reel
                      </button>
                      <button
                        onClick={() => handleQuickPreset(60)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 transition-colors"
                      >
                        📱 60s TikTok
                      </button>
                      <button
                        onClick={() => setTrimRange([0, metadata.duration || 120])}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-auto"
                      >
                        Reset Full
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── AI Viral Highlights & Moments Engine ─────────────────── */}
                <div className="glass-panel rounded-2xl p-6 space-y-4 relative overflow-hidden border border-purple-500/20 bg-gradient-to-br from-purple-900/10 via-black/40 to-black/60">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-500/10 via-pink-500/5 to-transparent pointer-events-none rounded-full blur-2xl" />
                  
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/25">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base">AI Viral Clips & Hook Scanner</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Coming Soon
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">Scan video transcript & audio for high-retention viral segments</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={true}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-semibold text-xs shadow-none cursor-not-allowed opacity-60"
                      title="Coming Soon in next update"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Find Viral Clips</span>
                    </button>
                  </div>

                  {/* Disabled Custom AI Prompt Box */}
                  <div className="relative">
                    <input
                      type="text"
                      disabled={true}
                      readOnly={true}
                      value=""
                      placeholder="🔒 AI transcript & viral moment scanner is coming soon in the next update..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-500 placeholder-gray-500 cursor-not-allowed select-none focus:outline-none"
                    />
                  </div>

                  {/* Highlights List */}
                  {aiHighlights.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Detected Moments ({aiHighlights.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {aiHighlights.map((hl, i) => (
                          <div
                            key={i}
                            className="p-3.5 rounded-xl bg-black/40 border border-white/10 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-3 group"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  {hl.tag || 'Viral Hook'}
                                </span>
                                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                  🔥 {hl.hookScore}% Score
                                </span>
                              </div>
                              <h4 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-purple-300 transition-colors">
                                {hl.title}
                              </h4>
                              <p className="text-xs text-gray-400 line-clamp-2">{hl.reason}</p>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                              <span className="text-xs font-mono text-gray-400">
                                {formatTime(hl.start)} - {formatTime(hl.end)} ({formatTime(hl.end - hl.start)})
                              </span>
                              <button
                                onClick={() => applyHighlight(hl)}
                                className="px-3 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-1"
                              >
                                <span>Apply Clip</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Export, Aspect Ratio & Production Hub (5 Cols) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* ── Framing & Aspect Ratio Studio ────────────────────────── */}
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold text-white text-base">Format & Aspect Ratio</h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: '16:9', label: '16:9', sub: 'YouTube', icon: '📺' },
                      { id: '9:16', label: '9:16', sub: 'Shorts/TikTok', icon: '📱' },
                      { id: '1:1', label: '1:1', sub: 'Instagram', icon: '📷' },
                      { id: '4:5', label: '4:5', sub: 'Portrait', icon: '🖼️' },
                    ].map((ratio) => (
                      <button
                        key={ratio.id}
                        onClick={() => setAspectRatio(ratio.id as any)}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                          aspectRatio === ratio.id
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                            : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className="text-lg">{ratio.icon}</span>
                        <span className="text-xs font-bold mt-1">{ratio.label}</span>
                        <span className="text-[10px] opacity-70">{ratio.sub}</span>
                      </button>
                    ))}
                  </div>

                  {aspectRatio !== '16:9' && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/10 text-xs">
                      <div>
                        <span className="text-white font-medium block">Framing Mode</span>
                        <span className="text-gray-400 text-[11px]">
                          {fitMode === 'crop' ? 'Smart Center Cropping (Recommended)' : 'Black/Blur Letterbox Padding'}
                        </span>
                      </div>
                      <div className="flex gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                        <button
                          onClick={() => setFitMode('crop')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                            fitMode === 'crop' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Crop
                        </button>
                        <button
                          onClick={() => setFitMode('pad')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                            fitMode === 'pad' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Pad
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Export & Production Hub ──────────────────────────────── */}
                <div className="glass-panel rounded-2xl p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-purple-400" />
                      <h3 className="font-bold text-white text-base">Export Quality</h3>
                    </div>
                    <span className="text-xs font-mono text-gray-400">
                      Est. Size: <strong className="text-white">{formatBytes(estimatedBytes) || 'Calculating...'}</strong>
                    </span>
                  </div>

                  {/* Format & Resolution Pickers */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {[
                        { id: 'mp4', label: '🎬 MP4 Video' },
                        { id: 'mp3', label: '🎵 MP3 Audio' },
                        { id: 'captions', label: '💬 Captions' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setDownloadFormat(f.id as any)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                            downloadFormat === f.id
                              ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
                              : 'bg-black/30 border-white/10 text-gray-400 hover:text-white'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {downloadFormat === 'mp4' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400">Resolution</label>
                        <div className="grid grid-cols-3 gap-2">
                          {qualityOptions.slice(0, 6).map((q) => (
                            <button
                              key={q.label}
                              onClick={() => setDownloadQuality(q.label)}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                downloadQuality === q.label
                                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-md'
                                  : 'bg-black/30 border-white/10 text-gray-400 hover:text-white'
                              }`}
                            >
                              {q.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {downloadFormat === 'captions' && (
                      <div className="space-y-3 bg-purple-950/20 border border-purple-500/20 rounded-xl p-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-300">Subtitle Format</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'srt', label: 'SRT (SubRip)', desc: 'CapCut / Premiere' },
                              { id: 'vtt', label: 'VTT (WebVTT)', desc: 'Web Players' },
                              { id: 'txt', label: 'TXT (Text)', desc: 'Plain Transcript' },
                            ].map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setCaptionFormat(s.id as any)}
                                className={`py-2 px-1.5 rounded-xl border text-center transition-all ${
                                  captionFormat === s.id
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-md'
                                    : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                                }`}
                              >
                                <div className="text-xs font-bold uppercase">{s.id}</div>
                                <div className="text-[9px] text-purple-200/70 font-medium truncate">{s.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="pt-1 space-y-2">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-gray-400">Language</label>
                            <select
                              value={captionLang}
                              onChange={(e) => setCaptionLang(e.target.value)}
                              className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                            >
                              <option value="en">English (Default)</option>
                              <option value="auto">Auto-Generated</option>
                              <option value="ko">Korean (한국어)</option>
                              <option value="es">Spanish (Español)</option>
                              <option value="ja">Japanese (日本語)</option>
                              <option value="zh">Chinese (中文)</option>
                              <option value="hi">Hindi (हिन्दी)</option>
                              <option value="fr">French (Français)</option>
                              <option value="de">German (Deutsch)</option>
                            </select>
                          </div>
                          <div className="text-[10px] text-purple-300/80 bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 flex items-center gap-1.5">
                            <span>⏱️</span>
                            <span>Auto-trimmed to your timeline [{formatTime(trimRange[0])} - {formatTime(trimRange[1])}] & starts at 00:00:00.</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Custom File Name */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-semibold text-gray-400">File Name</label>
                      <input
                        type="text"
                        value={customFileName}
                        onChange={(e) => setCustomFileName(e.target.value)}
                        placeholder="ClipFlow_Output"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-medium"
                      />
                    </div>
                  </div>

                  {/* Primary Download / Export Action */}
                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => handleExportDownload(false)}
                      disabled={isDownloading}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      {isDownloading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          />
                          <span>Processing & Exporting Clip...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                          <span>Download</span>
                        </>
                      )}
                    </button>

                    {/* Status Message */}
                    {statusMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                          downloadStatus === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : downloadStatus === 'error'
                            ? 'bg-red-500/10 border-red-500/30 text-red-300'
                            : 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                        }`}
                      >
                        {downloadStatus === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : downloadStatus === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        ) : (
                          <RefreshCw className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
                        )}
                        <span>{statusMessage}</span>
                      </motion.div>
                    )}

                    {/* End Download actions */}
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        ) : (
          /* ── Feature Highlights & Social Grabber (When no video is imported) ─── */
          <div className="space-y-8 pt-4">
            
            {/* Quick Instagram Grabber Card */}
            <div className="glass-panel rounded-2xl p-6 max-w-3xl mx-auto border-pink-500/20 bg-gradient-to-br from-pink-500/5 via-purple-500/5 to-transparent">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
                  <InstagramIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Instant Instagram Reel Grabber</h3>
                  <p className="text-xs text-gray-400">Paste any Instagram reel, video, or post URL to download directly</p>
                </div>
              </div>

              <form onSubmit={handleQuickInstaDownload} className="flex gap-2">
                <input
                  type="url"
                  value={quickInstaUrl}
                  onChange={(e) => setQuickInstaUrl(e.target.value)}
                  placeholder="https://www.instagram.com/reel/..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 font-medium"
                />
                <button
                  type="submit"
                  disabled={isQuickInstaLoading || !quickInstaUrl.trim()}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-semibold text-xs sm:text-sm transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-pink-500/20"
                >
                  {isQuickInstaLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Grab Video</span>
                    </>
                  )}
                </button>
              </form>

              {instaSuccessMsg && (
                <p className="mt-3 text-xs font-semibold text-pink-300">{instaSuccessMsg}</p>
              )}
            </div>

            {/* ── Feature Highlights Grid ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              {[
                {
                  icon: Sparkles,
                  title: 'Exact Sub-Second Trimming',
                  desc: 'Cut directly from any start time to end time with instant browser preview. No bloated downloads or unwanted video sections.',
                  color: 'from-purple-500 to-indigo-500',
                  badge: 'Interactive'
                },
                {
                  icon: Layers,
                  title: '9:16 Auto-Reframing',
                  desc: 'Effortlessly convert widescreen 16:9 videos into vertical 9:16 Shorts & Reels with precision center cropping.',
                  color: 'from-pink-500 to-rose-500',
                  badge: 'One-Click'
                },
                {
                  icon: ShieldCheck,
                  title: 'Lossless Local Speed',
                  desc: 'Powered by high-performance hardware acceleration. No server compression limits, zero watermarks, and full 4K output.',
                  color: 'from-cyan-500 to-blue-500',
                  badge: '100% Free & Local'
                }
              ].map((feat, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feat.color} flex items-center justify-center text-white shadow-lg`}>
                    <feat.icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-base">{feat.title}</h3>
                    <span className="text-[10px] font-semibold text-purple-300 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                      {feat.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{feat.desc}</p>
                </motion.div>
              ))}
            </div>

          </div>
        )}

      </main>

      {/* ── Recent History Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-white text-lg">Recent Export History</h3>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {clipHistory.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-sm">No recent clips found.</p>
                ) : (
                  clipHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 hover:border-purple-500/40 transition-colors"
                    >
                      <img
                        src={item.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100'}
                        alt={item.title}
                        className="w-16 aspect-video rounded-lg object-cover border border-white/10 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-white truncate">{item.title}</h4>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{item.duration}</p>
                        <span className="text-[10px] text-purple-300 font-medium">{item.quality} • {item.aspectRatio}</span>
                      </div>
                      <button
                        onClick={() => {
                          setUrlInput(item.url);
                          fetchVideo(item.url);
                          setShowHistoryModal(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white text-xs font-semibold transition-all shrink-0"
                      >
                        Load
                      </button>
                    </div>
                  ))
                )}
              </div>

              {clipHistory.length > 0 && (
                <div className="pt-2 border-t border-white/10 flex justify-between items-center text-xs">
                  <button
                    onClick={() => {
                      setClipHistory([]);
                      localStorage.removeItem('clipflow_history');
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    Clear History
                  </button>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-black/95 py-6 px-6 text-center text-xs text-gray-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center">
              <Scissors className="w-3 h-3 text-purple-400" />
            </div>
            <span className="font-bold text-gray-300">ClipFlow Studio</span>
            <span>— Free & Open Video Repurposing</span>
          </div>
          <p className="text-gray-600 text-[11px]">
            Direct High-Speed Engine • Local Processing • Zero Watermarks
          </p>
        </div>
      </footer>

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
                  onClick={() => handleExportDownload(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                  <span>I've Started App (Retry)</span>
                </button>
                <button
                  onClick={() => handleExportDownload(true)}
                  className="py-2.5 px-3 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 text-xs transition-colors"
                >
                  Server Fallback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
