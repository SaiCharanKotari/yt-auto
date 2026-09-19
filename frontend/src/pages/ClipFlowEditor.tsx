import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  AlertCircle, RefreshCw, Film,
  Clock, CheckCircle2,
  RotateCcw, RotateCw,
  RectangleHorizontal, Smartphone, Square,
  RectangleVertical, Crop,
  Play, Pause,
  Volume2, VolumeX,
  Cloud, HardDrive, Check, X,
  Settings, ChevronDown, Download,
  Image as ImageIcon,
  Loader2,
  Zap
} from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import YouTube, { type YouTubePlayer } from 'react-youtube';
import Hls from 'hls.js';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { CloudStorageModal } from '../components/CloudStorageModal';
import { AuthModal } from '../components/AuthModal';
import { ExportFormatSection } from '../components/ExportFormatSection';
import { UserProfileMenu } from '../components/UserProfileMenu';
import { EditorSidebar } from '../components/EditorSidebar';
import { CropFrameOverlay, type CropBox } from '../components/CropFrameOverlay';
import { useTwitchPreview } from '../components/Twitch/useTwitchPreview';
import { useTwitchLiveChannel, isTwitchLiveChannelUrl } from '../components/Twitch/useTwitchLiveChannel';
import { getCachedMetadata, setCachedMetadata, clearCachedMetadata } from '../utils/metadataCache';
import {
  getEditorSession,
  saveEditorSession,
  clearEditorSession,
  type ProcessingMode,
  getStoredProcessingMode,
  setStoredProcessingMode,
} from '../utils/editorSession';
import { detectPlatform, extractYouTubeId } from '../utils/platforms';

// Use real server URL from env if deployed, otherwise fallback to localhost for dev
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ||
  ((typeof window !== 'undefined' && window.location.port !== '5173')
    ? window.location.origin
    : 'http://localhost:3001');

// ── Helpers ─────────────────────────────────────────────────────────────

function formatTime(seconds: number, includeDecimals: boolean = false): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);

  if (h > 0) {
    const main = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return includeDecimals ? `${main}.${ms}` : main;
  }
  const main = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return includeDecimals ? `${main}.${ms}` : main;
}

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const cleanStr = String(timeStr).trim();
  const parts = cleanStr.split(':').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return parseFloat(cleanStr) || 0;
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

export default function ClipFlowEditor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawUrl = searchParams.get('url') || '';

  // Retrieve cached editor session (persists when navigating between Studio, Cloud, Settings)
  const initialSession = useMemo(() => {
    return getEditorSession(rawUrl || undefined);
  }, [rawUrl]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      clearCachedMetadata();
      clearEditorSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const [activeUrl, setActiveUrl] = useState(rawUrl || initialSession?.activeUrl || '');
  const youtubeId = extractYouTubeId(activeUrl);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [showUrlChange, setShowUrlChange] = useState(!rawUrl && !initialSession?.activeUrl);

  // Video State
  const [metadata, setMetadata] = useState<any>(initialSession?.metadata || null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [errorMeta, setErrorMeta] = useState('');
  const { token, isAuthenticated, isPro } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCloudStorageModal, setShowCloudStorageModal] = useState(false);
  const [showCompanionModal, setShowCompanionModal] = useState(false);
  const [, setDriveSuccessLink] = useState<string | null>(null);

  const engineParam = searchParams.get('engine');
  const modeParam = searchParams.get('mode');

  // Single Authoritative Processing Mode: 'free' | 'pro'
  const initialProcessingMode: ProcessingMode = useMemo(() => {
    // 1. Explicit query param in URL (?mode=free | ?mode=pro | ?engine=local | ?engine=server)
    if (modeParam === 'pro' || engineParam === 'server') return 'pro';
    if (modeParam === 'free' || engineParam === 'local') return 'free';

    // 2. Existing editor session state for this URL
    if (initialSession?.processingMode) return initialSession.processingMode;
    if (initialSession?.exportMode) return initialSession.exportMode;

    // 3. Stored mode in sessionStorage
    const stored = getStoredProcessingMode();
    if (stored) return stored;

    // 4. Default: Pro account gets pro, free account gets free
    return isPro ? 'pro' : 'free';
  }, [modeParam, engineParam, initialSession?.processingMode, initialSession?.exportMode, isPro]);

  const [processingMode, setProcessingMode] = useState<ProcessingMode>(initialProcessingMode);
  const isProUser = processingMode === 'pro';
  const exportMode: 'free' | 'pro' = processingMode;
  const useLocalProcessing = processingMode === 'free';
  void useLocalProcessing;
  void setProcessingMode;

  // Persist processing mode immediately
  useEffect(() => {
    setStoredProcessingMode(processingMode);
    console.log(`%c[ClipFlow] Processing Mode: ${processingMode.toUpperCase()}`, 'color: #38bdf8; font-weight: bold; font-size: 12px;');
  }, [processingMode]);

  const platformInfo = useMemo(() => {
    return detectPlatform(activeUrl || metadata?.webpage_url || metadata?.url || '');
  }, [activeUrl, metadata]);

  const isYouTube = platformInfo.isYouTube;

  const isTwitter = useMemo(() => {
    return Boolean(
      platformInfo.isTwitter ||
      activeUrl.includes('twitter.com') ||
      activeUrl.includes('x.com') ||
      metadata?.extractor_key?.toLowerCase()?.includes('twitter') ||
      metadata?.extractor?.toLowerCase()?.includes('twitter')
    );
  }, [platformInfo, activeUrl, metadata]);

  const isTwitch = useMemo(() => {
    const u = (activeUrl || metadata?.webpage_url || metadata?.channel_url || '').toLowerCase();
    return Boolean(
      platformInfo.isTwitch ||
      u.includes('twitch.tv') ||
      metadata?.extractor_key?.toLowerCase()?.includes('twitch') ||
      metadata?.extractor?.toLowerCase()?.includes('twitch')
    );
  }, [platformInfo, activeUrl, metadata]);

  // Player & Timeline
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const sliderWrapRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoCanvasRef = useRef<HTMLDivElement>(null);
  const isSeekingRef = useRef<boolean>(false);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialSession?.currentTime || 0);
  const [actualDuration, setActualDuration] = useState<number>(initialSession?.metadata?.duration || 0);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInputValue, setTimeInputValue] = useState('');
  const isTrimEnabled = true;
  const [trimRange, setTrimRange] = useState<[number, number]>(initialSession?.trimRange || [0, 60]);
  // Moved up: needed by useTwitchLiveChannel hook below
  const [isHelperRunning, setIsHelperRunning] = useState<boolean>(false);

  const { twitchHlsUrl, isTwitchLiveChannel, refreshLiveSegment } = useTwitchPreview(isTwitch, activeUrl, metadata, isProUser);

  // Live channel chunk preview (twitch.tv/username only — separate from VODs/clips)
  const isLiveChannelUrl = isTwitchLiveChannelUrl(activeUrl);
  const isSeekingLiveRef = useRef<boolean>(false);
  const seekFractionalOffsetRef = useRef<number>(0);
  const liveSeekGenRef = useRef<number>(0);
  const liveSeekAbortRef = useRef<AbortController | null>(null);
  const [activeLivePlayer, setActiveLivePlayer] = useState<'A' | 'B'>('A');
  const videoAElementRef = useRef<HTMLVideoElement | null>(null);
  const videoBElementRef = useRef<HTMLVideoElement | null>(null);

  const {
    chunkUrl: liveChunkUrl,
    nextChunkUrl: liveNextChunkUrl,
    isLoadingChunk: isLiveChunkLoading,
    chunkError: liveChunkError,
    chunkStartOffset: liveChunkOffset,
    fetchChunkForSeek,
    setLiveChunkState,
    loadChunk: loadLiveChunk,
    advanceToNextChunk: advanceLiveChunk,
    notifyPlaybackProgress: notifyLivePlaybackProgress,
    retryChunk: retryLiveChunk,
  } = useTwitchLiveChannel(isLiveChannelUrl, activeUrl, processingMode, isHelperRunning);
  void liveChunkError;
  void retryLiveChunk;

  const effectiveDuration = actualDuration > 0 ? actualDuration : (metadata?.duration && metadata.duration > 0 ? metadata.duration : 0);

  const [volume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (youtubeId && youtubePlayerRef.current) {
      try {
        if (nextMute) youtubePlayerRef.current.mute();
        else youtubePlayerRef.current.unMute();
      } catch (e) { }
    } else {
      if (videoElementRef.current) videoElementRef.current.muted = nextMute;
      if (videoAElementRef.current) videoAElementRef.current.muted = nextMute;
      if (videoBElementRef.current) videoBElementRef.current.muted = nextMute;
    }
  };

  const handleMediaDurationUpdate = (dur: number) => {
    if (!dur || dur <= 0 || !Number.isFinite(dur)) return;
    setActualDuration((prev) => {
      if (prev > 0) return prev; // Fixed duration once loaded
      return dur;
    });
  };

  // Movable / Resizable Splitters
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(initialSession?.leftSidebarWidth || 230);
  const [isDraggingLSplitter, setIsDraggingLSplitter] = useState<boolean>(false);

  const [rightPanelWidth, setRightPanelWidth] = useState<number>(initialSession?.rightPanelWidth || 340);
  const [isDraggingVSplitter, setIsDraggingVSplitter] = useState<boolean>(false);

  const [videoHeight, setVideoHeight] = useState<number>(initialSession?.videoHeight || 440);
  const [isDraggingHSplitter, setIsDraggingHSplitter] = useState<boolean>(false);

  // Export Settings & Interactive Crop Box
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:5' | 'custom'>(initialSession?.aspectRatio || '16:9');
  const [cropBox, setCropBox] = useState<CropBox>(initialSession?.cropBox || { x: 0.25, y: 0, width: 0.5, height: 1 });
  const [containerDims, setContainerDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: initialSession?.metadata?.width || 1920,
    height: initialSession?.metadata?.height || 1080,
  });
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync videoDimensions if metadata arrives with width/height
  useEffect(() => {
    if (metadata?.width && metadata?.height && metadata.width > 0 && metadata.height > 0) {
      setVideoDimensions({ width: metadata.width, height: metadata.height });
    }
  }, [metadata]);

  // Source aspect ratio (from real video pixels or reliable metadata)
  const sourceAspectRatio = useMemo(() => {
    if (videoDimensions.width > 0 && videoDimensions.height > 0) {
      return videoDimensions.width / videoDimensions.height;
    }
    if (metadata?.width && metadata?.height && metadata.width > 0 && metadata.height > 0) {
      return metadata.width / metadata.height;
    }
    return 16 / 9;
  }, [videoDimensions.width, videoDimensions.height, metadata]);

  const [fitMode, setFitMode] = useState<'crop' | 'pad'>(initialSession?.fitMode || 'crop');
  void setFitMode;
  const [cropPosition, setCropPosition] = useState<'center' | 'left' | 'right'>(initialSession?.cropPosition || 'center');

  const [downloadFormat, setDownloadFormat] = useState<'mp4' | 'mp3' | 'captions'>(initialSession?.downloadFormat || 'mp4');
  const [captionFormat, setCaptionFormat] = useState<'srt' | 'vtt' | 'txt'>(initialSession?.captionFormat || 'srt');
  const [captionLang, setCaptionLang] = useState<string>(initialSession?.captionLang || 'en');
  const [downloadQuality, setDownloadQuality] = useState('1080p');
  const [downloadAudioBitrate, setDownloadAudioBitrate] = useState<'0' | '320k' | '256k' | '192k' | '128k'>((initialSession?.downloadAudioBitrate as any) || '0');
  const [customFileName, setCustomFileName] = useState(initialSession?.customFileName || '');
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([]);

  // AI Highlights State
  const [, setAiHighlights] = useState<AIHighlight[]>([]);

  // Download & Execution State
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Preview Quality State
  const [selectedPreviewQualityUrl, setSelectedPreviewQualityUrl] = useState<string>('');
  const [selectedQualityId, setSelectedQualityId] = useState<string>('');
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState<boolean>(false);
  const qualityMenuRef = useRef<HTMLDivElement | null>(null);

  // Thumbnail vs Current Frame Preview State
  const [previewImageMode, setPreviewImageMode] = useState<'thumbnail' | 'frame'>('thumbnail');
  const [isImageModeDropdownOpen, setIsImageModeDropdownOpen] = useState<boolean>(false);
  const imageModeDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isDownloadingImage, setIsDownloadingImage] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Close image mode dropdown on outside click
  useEffect(() => {
    if (!isImageModeDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (imageModeDropdownRef.current && !imageModeDropdownRef.current.contains(e.target as Node)) {
        setIsImageModeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isImageModeDropdownOpen]);

  // Close quality menu on outside click
  useEffect(() => {
    if (!isQualityMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setIsQualityMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isQualityMenuOpen]);

  // Track Video Container Dimensions for Accurate Crop Framing Math
  useEffect(() => {
    const el = videoCanvasRef.current || videoContainerRef.current;
    if (!el) return;
    const updateDims = () => {
      if (el) setContainerDims({ width: el.clientWidth, height: el.clientHeight });
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    ro.observe(el);
    return () => ro.disconnect();
  }, [metadata, videoHeight, sourceAspectRatio]);

  // Compute clean, standard preview qualities and default stream (Priority: 1080p -> 720p -> highest available)
  const { previewQualities, defaultPreviewStreamUrl } = useMemo(() => {
    if (!metadata) return { previewQualities: [], defaultPreviewStreamUrl: '' };

    // 1. Gather all valid video formats (ignoring audio-only streams)
    const videoFormats = (metadata.formats || []).filter((f: any) => {
      if (f.vcodec === 'none') return false;
      return Boolean(f.url);
    });

    // 2. Map available heights from video formats (supporting both landscape and portrait)
    const heightToUrlMap = new Map<number, string>();
    let maxDetectedHeight = 0;

    videoFormats.forEach((f: any) => {
      let h = f.height || 0;
      let w = f.width || 0;
      if ((!h || !w) && f.resolution) {
        const match = f.resolution.match(/(\d+)x(\d+)/);
        if (match) {
          w = parseInt(match[1], 10);
          h = parseInt(match[2], 10);
        }
      }
      // Standard resolution height (e.g. 1080 for 1920x1080 or 1080x1920)
      const standardH = (w > 0 && h > 0) ? Math.min(w, h) : (h || w);
      if (standardH > 0) {
        if (standardH > maxDetectedHeight) maxDetectedHeight = standardH;
        if (f.url && (!heightToUrlMap.has(standardH) || (f.acodec && f.acodec !== 'none'))) {
          heightToUrlMap.set(standardH, f.url);
        }
      }
    });

    if (maxDetectedHeight === 0) {
      maxDetectedHeight = 1080;
    }

    // Direct stream fallback prioritizing high definition
    const bestFallbackUrl =
      metadata.direct_stream_url ||
      (videoFormats.length > 0
        ? (videoFormats.filter((f: any) => f.acodec && f.acodec !== 'none').pop()?.url || videoFormats[videoFormats.length - 1]?.url)
        : '') ||
      metadata.url ||
      '';

    // 3. Priority for default stream: 1080p -> 720p -> 1440p/2160p -> bestFallbackUrl
    let defaultStream = '';
    if (heightToUrlMap.has(1080)) {
      defaultStream = heightToUrlMap.get(1080)!;
    } else if (heightToUrlMap.has(720)) {
      defaultStream = heightToUrlMap.get(720)!;
    } else if (heightToUrlMap.has(1440)) {
      defaultStream = heightToUrlMap.get(1440)!;
    } else if (heightToUrlMap.has(2160)) {
      defaultStream = heightToUrlMap.get(2160)!;
    } else {
      defaultStream = bestFallbackUrl;
    }

    // 4. Standard quality tiers (4K, 2K, 1080p, 720p, 480p, 360p, 240p)
    const standardTiers: { height: number; label: string; id: string }[] = [
      { height: 2160, label: '4K (2160p)', id: '2160p' },
      { height: 1440, label: '2K (1440p)', id: '1440p' },
      { height: 1080, label: '1080p (Full HD)', id: '1080p' },
      { height: 720, label: '720p (HD)', id: '720p' },
      { height: 480, label: '480p (SD)', id: '480p' },
      { height: 360, label: '360p', id: '360p' },
      { height: 240, label: '240p', id: '240p' },
    ];

    const getBestUrlForTier = (targetH: number): string => {
      if (heightToUrlMap.has(targetH)) return heightToUrlMap.get(targetH)!;
      if (targetH >= maxDetectedHeight && maxDetectedHeight > 0) {
        return heightToUrlMap.get(maxDetectedHeight) || bestFallbackUrl;
      }
      const availableHeights = Array.from(heightToUrlMap.keys()).sort((a, b) => b - a);
      const match = availableHeights.find(h => h <= targetH) || availableHeights[availableHeights.length - 1];
      if (match && heightToUrlMap.has(match)) return heightToUrlMap.get(match)!;
      return bestFallbackUrl;
    };

    const tiers = standardTiers.map((t) => ({
      id: t.id,
      label: t.label,
      height: t.height,
      url: getBestUrlForTier(t.height),
      isAvailable: heightToUrlMap.has(t.height),
    }));

    return {
      previewQualities: tiers,
      defaultPreviewStreamUrl: defaultStream || bestFallbackUrl,
    };
  }, [metadata]);

  // Track if direct streaming errored and needs backend streaming proxy
  const [useProxyFallback, setUseProxyFallback] = useState<boolean>(false);

  // Reset selected quality, buffering, and proxy fallback when active video URL changes
  useEffect(() => {
    setSelectedQualityId('');
    setSelectedPreviewQualityUrl('');
    setIsVideoBuffering(false);
    setUseProxyFallback(false);
  }, [activeUrl]);

  // Current active quality label
  const currentQualityLabel = useMemo(() => {
    if (selectedQualityId) {
      const match = previewQualities.find(q => q.id === selectedQualityId);
      if (match) return match.label;
    }
    if (selectedPreviewQualityUrl) {
      const match = previewQualities.find(q => q.url === selectedPreviewQualityUrl);
      if (match) return match.label;
    }
    if (defaultPreviewStreamUrl && previewQualities.length > 0) {
      const exactMatch = previewQualities.find(q => q.url === defaultPreviewStreamUrl && q.isAvailable);
      if (exactMatch) return exactMatch.label;
      const anyMatch = previewQualities.find(q => q.url === defaultPreviewStreamUrl);
      if (anyMatch) return anyMatch.label;
      return previewQualities.find(q => q.id === '1080p')?.label || previewQualities.find(q => q.id === '720p')?.label || previewQualities[0].label;
    }
    return '1080p (Full HD)';
  }, [selectedQualityId, selectedPreviewQualityUrl, previewQualities, defaultPreviewStreamUrl]);

  // Handle Quality Switch with seamless time restoration
  const handleSelectPreviewQuality = (qualityItem: { id: string; url: string; label: string }) => {
    const wasPlaying = isPlaying;
    const curTime = videoElementRef.current ? videoElementRef.current.currentTime : currentTime;

    setSelectedQualityId(qualityItem.id);
    setSelectedPreviewQualityUrl(qualityItem.url);
    setIsQualityMenuOpen(false);

    setTimeout(() => {
      if (videoElementRef.current) {
        videoElementRef.current.currentTime = curTime;
        if (wasPlaying) {
          videoElementRef.current.play().catch(() => { });
        }
      }
    }, 60);
  };

  // Synchronize download resolution selection with preview video stream
  const handleSetDownloadQuality = (quality: string) => {
    setDownloadQuality(quality);
    const cleanNum = parseInt(quality.replace(/[^\d]/g, ''), 10);
    if (cleanNum) {
      const match = previewQualities.find((q) => q.height === cleanNum);
      if (match) {
        handleSelectPreviewQuality(match);
      }
    }
  };


  const rawPreviewSrc = selectedPreviewQualityUrl || defaultPreviewStreamUrl || metadata?.direct_stream_url || metadata?.url || '';

  const isLiveStream = false;



  const isHls = useMemo(() => {
    // Live channels now use MP4 chunks — NOT HLS proxy
    if (isLiveChannelUrl) return false;
    if (isTwitch && twitchHlsUrl) return true;
    const s = (rawPreviewSrc || '').toLowerCase();
    return Boolean(
      s.includes('.m3u8') ||
      s.includes('m3u8_native')
    );
  }, [rawPreviewSrc, isTwitch, twitchHlsUrl, isLiveChannelUrl]);

  const activeVideoSrc = useMemo(() => {
    // Live channel: use the MP4 chunk blob URL
    if (isLiveChannelUrl) return liveChunkUrl;
    if (isTwitch && twitchHlsUrl) return twitchHlsUrl;
    if (!rawPreviewSrc) return '';
    if (isTwitter || useProxyFallback || rawPreviewSrc.includes('twimg.com')) {
      const proxyUrl = `${BACKEND_URL}/api/video/proxy-stream?url=${encodeURIComponent(rawPreviewSrc)}`;
      return proxyUrl;
    }
    return rawPreviewSrc;
  }, [rawPreviewSrc, isTwitter, useProxyFallback, isTwitch, twitchHlsUrl, isLiveChannelUrl, liveChunkUrl]);


  const hlsRef = useRef<Hls | null>(null);

  // Attach HLS player for direct non-YouTube .m3u8 sources and Twitch
  useEffect(() => {
    if (youtubeId) return;
    if (isLiveChannelUrl) return; // Live channels use MP4 chunks
    const video = videoElementRef.current;
    if (!video) return;

    const targetSrc = isTwitch ? twitchHlsUrl : rawPreviewSrc;
    console.log('%c[ClipFlow 🔍 HLS EFFECT TRIGGERED]', 'color: #38bdf8; font-weight: bold;', {
      targetSrc,
      isTwitch,
      twitchHlsUrl,
      rawPreviewSrc,
      isHls,
      hlsSupported: Hls.isSupported(),
    });

    if (!targetSrc) return;

    if (isHls && Hls.isSupported()) {
      if (hlsRef.current) {
        console.log('[ClipFlow HLS] Destroying previous HLS instance...');
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const DefaultLoader = Hls.DefaultConfig.loader;
      class ProxyHlsLoader extends DefaultLoader {
        override load(context: any, config: any, callbacks: any) {
          if (context.url && !isTwitch && (isTwitter || useProxyFallback) && !context.url.includes('/api/video/proxy-stream')) {
            context.url = `${BACKEND_URL}/api/video/proxy-stream?url=${encodeURIComponent(context.url)}`;
          }
          super.load(context, config, callbacks);
        }
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 300,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1000 * 1000,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        loader: ProxyHlsLoader as any,
      });

      console.log('%c[ClipFlow 📺 HLS ATTACH (TRANSPARENT PROXY)]', 'color: #a855f7; font-weight: bold;', {
        targetSrc,
        isLiveStream,
        isTwitch,
      });

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log('%c[ClipFlow 📺 HLS MEDIA ATTACHED]', 'color: #22c55e;');
      });

      hls.on(Hls.Events.MANIFEST_LOADED, (_event, data) => {
        console.log('%c[ClipFlow 📺 HLS MANIFEST LOADED]', 'color: #22c55e;', {
          levels: data.levels?.length,
          url: data.url,
        });
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        console.log('%c[ClipFlow 📺 HLS MANIFEST PARSED]', 'color: #22c55e; font-weight: bold;', {
          levels: data.levels?.length,
          firstLevel: data.firstLevel,
        });
        setIsVideoBuffering(false);
        // Attempt autoplay
        video.play().catch((playErr) => {
          console.log('[ClipFlow ℹ️] Autoplay note:', playErr.message);
        });
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        console.log('%c[ClipFlow 📺 HLS LEVEL LOADED]', 'color: #38bdf8;', {
          level: data.level,
          fragments: data.details.fragments.length,
          live: data.details.live,
          totalduration: data.details.totalduration,
        });
        if (data.details.totalduration && data.details.totalduration > 0) {
          handleMediaDurationUpdate(data.details.totalduration);
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
        console.log('%c[ClipFlow 📦 HLS FRAGMENT LOADED]', 'color: #10b981;', {
          sn: data.frag.sn,
          duration: data.frag.duration,
          url: data.frag.url.substring(0, 70),
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn(`[ClipFlow HLS ${data.fatal ? 'FATAL ERROR ❌' : 'WARNING ⚠️'}]`, {
          type: data.type,
          details: data.details,
          fatal: data.fatal,
        });
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('[ClipFlow HLS] Network error encountered. Calling startLoad()...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('[ClipFlow HLS] Media error encountered. Calling recoverMediaError()...');
              hls.recoverMediaError();
              break;
            default:
              console.error('[ClipFlow HLS] Unrecoverable fatal error, destroying hls instance');
              hls.destroy();
              break;
          }
        }
      });

      hls.loadSource(targetSrc);
      hls.attachMedia(video);
      hlsRef.current = hls;

      return () => {
        console.log('[ClipFlow HLS] Cleanup: destroying HLS instance');
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('%c[ClipFlow 📺 NATIVE HLS ATTACH]', 'color: #a855f7; font-weight: bold;', targetSrc);
      video.src = targetSrc;
    } else if (!isHls) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      console.log('%c[ClipFlow 📺 DIRECT VIDEO SRC ATTACH]', 'color: #a855f7;', activeVideoSrc);
      if (activeVideoSrc) {
        video.src = activeVideoSrc;
      } else {
        video.removeAttribute('src');
        video.load(); // Reset media element state
      }
    }
  }, [rawPreviewSrc, activeVideoSrc, isHls, isLiveStream, isTwitch, twitchHlsUrl, isTwitter, youtubeId, useProxyFallback, isLiveChannelUrl]);

  // Sync live chunk URLs to double-buffered video elements
  useEffect(() => {
    if (!isLiveChannelUrl) return;
    if (isSeekingLiveRef.current) return; // Do not let background prefetch sync interfere during an active seek
    const activeVideo = activeLivePlayer === 'A' ? videoAElementRef.current : videoBElementRef.current;
    if (activeVideo && liveChunkUrl && activeVideo.src !== liveChunkUrl) {
      activeVideo.src = liveChunkUrl;
      activeVideo.load();
      if (isPlaying) {
        activeVideo.play().catch(() => { });
      }
    }
    const standbyVideo = activeLivePlayer === 'A' ? videoBElementRef.current : videoAElementRef.current;
    if (standbyVideo && liveNextChunkUrl && standbyVideo.src !== liveNextChunkUrl) {
      standbyVideo.src = liveNextChunkUrl;
      standbyVideo.load();
    }
  }, [isLiveChannelUrl, liveChunkUrl, liveNextChunkUrl, activeLivePlayer, isPlaying]);


  // Socket.io ref for cloud download real-time progress
  const socketRef = useRef<Socket | null>(null);
  const [cloudJobId, setCloudJobId] = useState<string | null>(null);

  // Check if Desktop Helper App (port 18942) is running
  useEffect(() => {
    let isMounted = true;
    const checkHelper = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch('http://127.0.0.1:18942/status', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (isMounted) setIsHelperRunning(res.ok);
      } catch {
        if (isMounted) setIsHelperRunning(false);
      }
    };

    checkHelper();
    const interval = setInterval(checkHelper, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Auto-persist editor session into sessionStorage (persists across Studio, Cloud, Settings navigation)
  useEffect(() => {
    if (!activeUrl) return;
    saveEditorSession({
      activeUrl,
      metadata,
      currentTime,
      trimRange,
      aspectRatio,
      cropBox,
      fitMode,
      cropPosition,
      downloadFormat,
      captionFormat,
      captionLang,
      downloadQuality,
      downloadAudioBitrate,
      customFileName,
      exportMode,
      selectedPreviewQualityUrl,
      videoHeight,
      rightPanelWidth,
      leftSidebarWidth,
    });
  }, [
    activeUrl,
    metadata,
    currentTime,
    trimRange,
    aspectRatio,
    cropBox,
    fitMode,
    cropPosition,
    downloadFormat,
    captionFormat,
    captionLang,
    downloadQuality,
    downloadAudioBitrate,
    customFileName,
    exportMode,
    selectedPreviewQualityUrl,
    videoHeight,
    rightPanelWidth,
    leftSidebarWidth,
  ]);

  // Handle Left Splitter (Left Sidebar Width)
  useEffect(() => {
    if (!isDraggingLSplitter) return;
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth >= 160 && newWidth <= 420) {
        setLeftSidebarWidth(newWidth);
      }
    };
    const onMouseUp = () => {
      setIsDraggingLSplitter(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingLSplitter]);

  // Handle Right Splitter (Right Panel Width)
  useEffect(() => {
    if (!isDraggingVSplitter) return;
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 260 && newWidth <= 640) {
        setRightPanelWidth(newWidth);
      }
    };
    const onMouseUp = () => {
      setIsDraggingVSplitter(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingVSplitter]);

  // Handle Horizontal Splitter (Video Player Canvas Height)
  useEffect(() => {
    if (!isDraggingHSplitter) return;
    const onMouseMove = (e: MouseEvent) => {
      if (videoContainerRef.current) {
        const rect = videoContainerRef.current.getBoundingClientRect();
        const newHeight = e.clientY - rect.top;
        if (newHeight >= 200 && newHeight <= 750) {
          setVideoHeight(newHeight);
        }
      }
    };
    const onMouseUp = () => {
      setIsDraggingHSplitter(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingHSplitter]);

  // Socket.io — connect to backend for cloud download real-time progress
  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[ClipFlow Socket] Connected to backend:', socket.id);
    });
    socket.on('disconnect', () => {
      console.log('[ClipFlow Socket] Disconnected from backend');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Subscribe to progress events for the active cloud job
  useEffect(() => {
    if (!cloudJobId || !socketRef.current) return;
    const eventKey = `progress:${cloudJobId}`;
    const handleProgress = (data: {
      phase: string;
      percent?: number;
      speed?: string;
      message?: string;
    }) => {
      const pct = data.percent != null ? ` (${data.percent}%)` : '';
      const spd = data.speed ? ` • ${data.speed}` : '';
      setStatusMessage(`${data.phase}${pct}${spd}`);
    };

    socketRef.current.on(eventKey, handleProgress);
    return () => {
      socketRef.current?.off(eventKey, handleProgress);
    };
  }, [cloudJobId]);

  // Save to history
  const saveToHistory = (item: any) => {
    try {
      const saved = localStorage.getItem('clipflow_history');
      const existing = saved ? JSON.parse(saved) : [];
      const newItem = {
        ...item,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      localStorage.setItem('clipflow_history', JSON.stringify([newItem, ...existing.slice(0, 9)]));
    } catch (e) { }
  };

  // Fetch Video Metadata (Cached for Instant Tab Transitions)
  const fetchVideo = async (targetUrl: string, forceRefresh: boolean = false) => {
    if (!targetUrl) return;
    setErrorMeta('');
    setAiHighlights([]);
    setDownloadStatus('idle');

    // For Twitch live channels: inject synthetic metadata immediately so the video
    // player renders right away while full metadata loads in the background.
    const isTwitchLiveNow = (
      targetUrl.toLowerCase().includes('twitch.tv/') &&
      !targetUrl.toLowerCase().includes('/videos') &&
      !targetUrl.toLowerCase().includes('/clip')
    );
    if (isTwitchLiveNow) {
      const channelMatch = targetUrl.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
      const channelName = channelMatch ? channelMatch[1] : 'twitch';
      const syntheticMeta = {
        id: channelName,
        title: `${channelName} — Live`,
        uploader: channelName,
        thumbnail: '',
        duration: 0,
        duration_string: 'LIVE',
        is_live: true,
        live_status: 'is_live',
        formats: [],
        webpage_url: targetUrl,
        _synthetic: true,
      };
      setMetadata(syntheticMeta);
      setIsLoadingMeta(false); // don't show spinner; show player immediately
      console.log('[ClipFlow 🎬 Twitch] Injected synthetic metadata — video player will render immediately while stream resolves', channelName);
    }

    let data: any = null;
    let lastErrorMessage = '';

    // 0. Check instant metadata cache if not forcing refresh
    const isTargetLive =
      targetUrl.toLowerCase().includes('youtube.com/live') ||
      targetUrl.toLowerCase().includes('/live/') ||
      targetUrl.toLowerCase().includes('youtu.be/live') ||
      ((targetUrl.toLowerCase().includes('twitch.tv/') || targetUrl.toLowerCase().includes('kick.com/')) &&
        !targetUrl.toLowerCase().includes('/clip') &&
        !targetUrl.toLowerCase().includes('/video'));

    if (!forceRefresh && !isTargetLive) {
      const cached = getCachedMetadata(targetUrl);
      if (cached && !cached.is_live) {
        const isStaleDash = typeof cached.direct_stream_url === 'string' && (cached.direct_stream_url.includes('dash_r2evevp9') || cached.direct_stream_url.includes('dashinit.mp4'));
        if (!isStaleDash) {
          data = cached;
          console.log('%c[ClipFlow Web ⚡ METADATA LOADED FROM CACHE (INSTANT)]', 'color: #22c55e; font-weight: bold;', {
            targetUrl,
            title: cached.title,
            duration: cached.duration_string || cached.duration,
          });
        }
      }
    }

    if (!data) {
      // For Twitch live we already have synthetic metadata — don't reset to null
      // (which would cause the video player to disappear). Use a silent background fetch.
      if (!isTwitchLiveNow) {
        setIsLoadingMeta(true);
        setMetadata(null);
      }
      console.log('%c[ClipFlow Web 📡 METADATA NETWORK REQUEST]', 'color: #38bdf8; font-weight: bold;', { targetUrl });

      // Metadata is ALWAYS fetched server-side for both FREE and PRO
      const endpoint = `${BACKEND_URL}/api/video/metadata`;
      try {
        console.log(`[ClipFlow Web 📡 METADATA] Fetching from server: ${endpoint}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
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
            console.log('%c[ClipFlow Web METADATA SUCCESS (SERVER)]', 'color: #22c55e; font-weight: bold;', {
              endpoint,
              title: json.title,
              duration: json.duration_string || json.duration,
              formatsCount: json.formats?.length || 0,
            });
          }
        } else {
          const errJson = await res.json().catch(() => null);
          if (errJson?.error) lastErrorMessage = errJson.error;
        }
      } catch (e: any) {
        console.warn(`[ClipFlow Web 📡 METADATA] Server unreachable at ${endpoint}: ${e.message}`);
        if (!lastErrorMessage && e.name !== 'AbortError') {
          lastErrorMessage = e.message;
        }
      }

      // 2. If servers are offline but it's a YouTube video, use public oEmbed for title/thumbnail
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

      // Store in instant cache for future tab transitions
      if (data) {
        setCachedMetadata(targetUrl, data);
      }
    }

    try {
      if (!data) {
        // For Twitch live, metadata failure is OK — stream is handled by useTwitchPreview.
        // Don't throw an error; just silently continue with synthetic metadata.
        if (isTwitchLiveNow) {
          console.log('[ClipFlow 🎬 Twitch] Full metadata fetch failed, but stream is being resolved separately — keeping synthetic metadata');
          return;
        }
        throw new Error(lastErrorMessage || 'Could not fetch video details. Ensure the Desktop Helper app or backend is running.');
      }

      setMetadata(data);
      setCustomFileName(prev => prev || (data.title || ''));
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
      let videoDuration = data.duration && data.duration > 0 ? data.duration : 0;
      if (isLive) {
        if (data.release_timestamp && data.release_timestamp > 0) {
          const elapsed = Math.floor(Date.now() / 1000 - data.release_timestamp);
          if (elapsed > 0) videoDuration = Math.max(videoDuration, elapsed);
        }
        // if (videoDuration <= 0) videoDuration = 300; // 5 mins fallback commented out
      }

      if (videoDuration > 0) {
        setActualDuration(videoDuration);
        setTrimRange([0, videoDuration]);
        if (isLive) {
          setCurrentTime(videoDuration);
        }
      } else {
        setActualDuration(0);
        setTrimRange([0, 0]);
      }

      let maxDetectedHeight = 0;
      (data.formats || []).forEach((f: any) => {
        let h = f.height || 0;
        if (!h) {
          const resMatch = (f.resolution || '').match(/\d+x(\d+)/);
          if (resMatch) h = parseInt(resMatch[1], 10);
        }
        if (h > maxDetectedHeight) maxDetectedHeight = h;
      });

      if (maxDetectedHeight === 0) {
        maxDetectedHeight = 1080;
      }

      // Always provide all quality options up to 4K (2160p, 1440p, 1080p, 720p, 480p, 360p, 240p)
      const allStandardHeights = [2160, 1440, 1080, 720, 480, 360, 240];

      const opts: QualityOption[] = allStandardHeights.map(h => {
        const matching = (data.formats || []).filter((f: any) => {
          let fh = f.height || 0;
          if (!fh) {
            const match = (f.resolution || '').match(/\d+x(\d+)/);
            if (match) fh = parseInt(match[1], 10);
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
      // Always reset download quality from fresh metadata — default to 720p for live Twitch
      const isLiveTwitch = isTwitchLiveChannelUrl(targetUrl) || (data?.is_live && isTwitch);
      const preferredHeight = isLiveTwitch
        ? (opts.find(o => o.height === 720) ? 720 : opts[0]?.height || 720)
        : (opts.find(o => o.height === 1080) ? 1080
          : opts.find(o => o.height === 2160) ? 2160
            : opts.find(o => o.height === 1440) ? 1440
              : opts.find(o => o.height === 720) ? 720
                : opts[0]?.height || 1080);
      setDownloadQuality(`${preferredHeight}p`);
      clearEditorSession(); // wipe stale session so quality re-derives from fresh metadata


      setActiveUrl(targetUrl);
      try { localStorage.setItem('clipflow_active_video_url', targetUrl); } catch { }
      setSearchParams({ url: targetUrl });
      setShowUrlChange(false);
    } catch (err: any) {
      console.error('[ClipFlow Editor] Error loading video:', err);
      setErrorMeta('error');
    } finally {
      setIsLoadingMeta(false);
    }
  };

  // Sync with searchParams & localStorage
  useEffect(() => {
    if (rawUrl) {
      setActiveUrl(rawUrl);
      try { localStorage.setItem('clipflow_active_video_url', rawUrl); } catch { }
      // Clear any stale synthetic metadata when URL changes
      setMetadata(null);
      fetchVideo(rawUrl);
    } else {
      try {
        const cachedUrl = localStorage.getItem('clipflow_active_video_url');
        if (cachedUrl) {
          setActiveUrl(cachedUrl);
          setSearchParams({ url: cachedUrl }, { replace: true });
          setMetadata(null);
          fetchVideo(cachedUrl);
        }
      } catch { }
    }
  }, [rawUrl]);

  // Sync current time from HTML5 Video or YouTube Player
  useEffect(() => {
    let animationFrameId: number;
    let intervalId: any;

    const updateTime = () => {
      if (videoElementRef.current && isPlaying) {
        // Live channel time updates are driven exclusively by onTimeUpdate to prevent seek snap-backs
        if (!isLiveChannelUrl) {
          if (isSeekingRef.current) {
            if (isPlaying) {
              animationFrameId = requestAnimationFrame(updateTime);
            }
            return;
          }
          try {
            const v = videoElementRef.current;
            setCurrentTime(v.currentTime);
            const isExplicitSubClip = isTrimEnabled && (trimRange[0] > 1 || (trimRange[1] > 0 && trimRange[1] < effectiveDuration - 2));
            if (isExplicitSubClip && v.currentTime >= trimRange[1]) {
              seekToPosition(trimRange[0]);
            }
          } catch (e) { }
        }
      }
      if (isPlaying) {
        animationFrameId = requestAnimationFrame(updateTime);
      }
    };

    if (youtubeId && youtubePlayerRef.current && isPlaying) {
      intervalId = setInterval(async () => {
        try {
          if (youtubePlayerRef.current) {
            const time = await youtubePlayerRef.current.getCurrentTime();
            setCurrentTime(time);
            const isExplicitSubClip = isTrimEnabled && (trimRange[0] > 1 || (trimRange[1] > 0 && trimRange[1] < effectiveDuration - 2));
            if (isExplicitSubClip && time >= trimRange[1]) {
              youtubePlayerRef.current.seekTo(trimRange[0], true);
            }
          }
        } catch (e) { }
      }, 100);
    } else if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, trimRange, isTrimEnabled, activeUrl, effectiveDuration, youtubeId, isTwitch]);

  const seekToPosition = (newTime: number) => {
    const targetTime = Math.max(0, Math.min(newTime, effectiveDuration > 0 ? effectiveDuration : newTime));
    pendingSeekTimeRef.current = targetTime;
    isSeekingRef.current = true;
    setCurrentTime(targetTime);

    if (youtubeId && youtubePlayerRef.current) {
      try { youtubePlayerRef.current.seekTo(targetTime, true); } catch (e) { }
      isSeekingRef.current = false;
      pendingSeekTimeRef.current = null;
    } else if (isLiveChannelUrl) {
      const chunkOffset = Math.floor(targetTime / 5) * 5;
      const localTime = targetTime - chunkOffset;
      const wasPlaying = isPlaying;

      isSeekingLiveRef.current = true;
      setIsVideoBuffering(true);
      seekFractionalOffsetRef.current = localTime;

      const currentGen = ++liveSeekGenRef.current;

      // 1. Immediately pause the currently active video so the old chunk stops playing while new chunk loads
      const currentVideo = activeLivePlayer === 'A' ? videoAElementRef.current : videoBElementRef.current;
      if (currentVideo) {
        try { currentVideo.pause(); } catch (e) { }
      }

      // 2. Cancel prior in-flight seek requests
      if (liveSeekAbortRef.current) {
        liveSeekAbortRef.current.abort();
      }
      const abortCtrl = new AbortController();
      liveSeekAbortRef.current = abortCtrl;

      console.log('[Twitch LIVE 🎯 SEEK]', {
        gen: currentGen,
        targetTime,
        chunkOffset,
        localTime,
        wasPlaying,
        activeLivePlayer,
      });

      // 3. Target player for the seek is the STANDBY (inactive) player
      const targetPlayerTag = activeLivePlayer === 'A' ? 'B' : 'A';
      const targetVideo = targetPlayerTag === 'A' ? videoAElementRef.current : videoBElementRef.current;

      (async () => {
        try {
          const url = await fetchChunkForSeek(chunkOffset, abortCtrl.signal);
          if (liveSeekGenRef.current !== currentGen) {
            console.log(`[Twitch LIVE ⏭️ STALE SEEK DROPPED] Gen ${currentGen} < ${liveSeekGenRef.current}`);
            return;
          }

          if (!targetVideo) return;

          targetVideo.src = url;
          targetVideo.preload = 'auto';
          targetVideo.load();

          // Wait for metadata and seek to exact localTime
          await new Promise<void>((resolve) => {
            let resolved = false;
            const complete = () => {
              if (resolved) return;
              resolved = true;
              resolve();
            };

            const applySeek = () => {
              try {
                targetVideo.currentTime = localTime;
              } catch (e) { }

              const onSeeked = () => {
                targetVideo.removeEventListener('seeked', onSeeked);
                targetVideo.removeEventListener('canplay', onSeeked);
                complete();
              };

              if (targetVideo.readyState >= 2 && Math.abs(targetVideo.currentTime - localTime) < 0.2) {
                complete();
              } else {
                targetVideo.addEventListener('seeked', onSeeked, { once: true });
                targetVideo.addEventListener('canplay', onSeeked, { once: true });
                // Fallback timeout in case seeked event is delayed
                setTimeout(complete, 600);
              }
            };

            if (targetVideo.readyState >= 1) {
              applySeek();
            } else {
              const onMeta = () => {
                targetVideo.removeEventListener('loadedmetadata', onMeta);
                applySeek();
              };
              targetVideo.addEventListener('loadedmetadata', onMeta, { once: true });
            }
          });

          if (liveSeekGenRef.current !== currentGen) return;

          // Target frame is ready at exact localTime — perform instant switch
          if (wasPlaying) {
            targetVideo.play().catch(() => { });
          } else {
            targetVideo.pause();
          }

          setActiveLivePlayer(targetPlayerTag);
          setLiveChunkState(chunkOffset, url);

          if (currentVideo && currentVideo !== targetVideo) {
            try { currentVideo.pause(); } catch (e) { }
          }

          isSeekingLiveRef.current = false;
          pendingSeekTimeRef.current = null;
          isSeekingRef.current = false;
          setIsVideoBuffering(false);

          console.log(`[Twitch LIVE ✅ SEEK COMPLETE] Gen ${currentGen} -> Player ${targetPlayerTag} @ chunk ${chunkOffset}s + local ${localTime.toFixed(2)}s`);
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.warn('[Twitch LIVE ❌ SEEK ERROR]', err.message);
          if (liveSeekGenRef.current === currentGen) {
            isSeekingLiveRef.current = false;
            isSeekingRef.current = false;
            setIsVideoBuffering(false);
          }
        }
      })();
    } else if (videoElementRef.current) {
      if (isTwitchLiveChannel) {
        refreshLiveSegment();
      } else {
        const v = videoElementRef.current;
        try {
          v.currentTime = targetTime;
        } catch (e) {
          console.warn('[ClipFlow Seek Error]', e);
        }
      }
    }
  };

  // Play / Pause toggle
  const togglePlay = () => {
    if (youtubeId && youtubePlayerRef.current) {
      if (isPlaying) {
        try { youtubePlayerRef.current.pauseVideo(); } catch (e) { }
        setIsPlaying(false);
      } else {
        try { youtubePlayerRef.current.playVideo(); } catch (e) { }
        setIsPlaying(true);
      }
    } else {
      const activeVideo = isLiveChannelUrl
        ? (activeLivePlayer === 'A' ? videoAElementRef.current : videoBElementRef.current)
        : videoElementRef.current;
      if (activeVideo) {
        if (isPlaying) {
          activeVideo.pause();
          setIsPlaying(false);
        } else {
          activeVideo.play().catch(() => { });
          setIsPlaying(true);
        }
      }
    }
  };

  // Seamless live chunk transition handlers for zero-glitch double buffering
  const handleLiveTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>, playerTag: 'A' | 'B') => {
    const v = e.currentTarget;
    if (playerTag !== activeLivePlayer) return;

    if (isSeekingLiveRef.current) return;

    const currentTimelineTime = liveChunkOffset + v.currentTime;
    setCurrentTime(currentTimelineTime);
    notifyLivePlaybackProgress(v.currentTime);

    const actualDur = (v.duration && Number.isFinite(v.duration) && v.duration > 0) ? v.duration : 5;
    // When within 100ms of end and next preloaded chunk is ready -> seamless instant swap!
    if (v.currentTime >= actualDur - 0.1 && liveNextChunkUrl) {
      const nextPlayer = playerTag === 'A' ? 'B' : 'A';
      const nextVideoEl = nextPlayer === 'A' ? videoAElementRef.current : videoBElementRef.current;
      if (nextVideoEl && nextVideoEl.readyState >= 2) {
        console.log(`[TwitchLive ⚡ ZERO-GAP SWAP] ${playerTag} -> ${nextPlayer} @ t=${currentTimelineTime.toFixed(2)}s`);
        if (isPlaying) {
          nextVideoEl.currentTime = 0;
          nextVideoEl.play().catch(() => { });
        }
        setActiveLivePlayer(nextPlayer);
        advanceLiveChunk();
      }
    }
  };

  const handleLiveEnded = (playerTag: 'A' | 'B') => {
    if (playerTag !== activeLivePlayer) return;
    console.log(`[TwitchLive ⏹️ CHUNK ENDED] Player ${playerTag}`);
    const nextPlayer = playerTag === 'A' ? 'B' : 'A';
    const nextVideoEl = nextPlayer === 'A' ? videoAElementRef.current : videoBElementRef.current;
    if (nextVideoEl && nextVideoEl.readyState >= 2) {
      if (isPlaying) {
        nextVideoEl.currentTime = 0;
        nextVideoEl.play().catch(() => { });
      }
      setActiveLivePlayer(nextPlayer);
      advanceLiveChunk();
    } else {
      const nextOffset = liveChunkOffset + 5;
      loadLiveChunk(nextOffset, false);
    }
  };

  // Preset Aspect Ratio Framing Setter
  const applyAspectRatio = (ratio: '16:9' | '9:16' | '1:1' | '4:5' | 'custom') => {
    setAspectRatio(ratio);
    if (ratio === '16:9') {
      setCropBox({ x: 0, y: 0, width: 1, height: 1 });
    } else if (ratio === '9:16' || ratio === '1:1' || ratio === '4:5') {
      let targetRatio = 1;
      if (ratio === '9:16') targetRatio = 9 / 16;
      else if (ratio === '1:1') targetRatio = 1;
      else if (ratio === '4:5') targetRatio = 4 / 5;

      let w = 1;
      let h = 1;
      if (targetRatio < sourceAspectRatio) {
        h = 1;
        w = Math.min(1, targetRatio / sourceAspectRatio);
      } else {
        w = 1;
        h = Math.min(1, sourceAspectRatio / targetRatio);
      }
      setCropBox({
        x: Math.max(0, (1 - w) / 2),
        y: Math.max(0, (1 - h) / 2),
        width: w,
        height: h,
      });
    } else if (ratio === 'custom') {
      setCropBox((prev) => {
        if (prev.width === 1 && prev.height === 1) {
          return { x: 0.25, y: 0.1, width: 0.5, height: 0.8 };
        }
        return prev;
      });
    }
  };

  // Center Crop Box shortcut
  const centerCropBox = () => {
    setCropBox((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(1 - prev.width, (1 - prev.width) / 2)),
      y: Math.max(0, Math.min(1 - prev.height, (1 - prev.height) / 2)),
    }));
    setCropPosition('center');
  };

  // Crop Box Change with Auto-Detection of Alignment
  const handleCropBoxChange = (newBox: CropBox) => {
    setCropBox(newBox);
    const centerX = (1 - newBox.width) / 2;
    if (newBox.x <= 0.02) {
      setCropPosition('left');
    } else if (Math.abs(newBox.x - centerX) <= 0.03) {
      setCropPosition('center');
    } else if (newBox.x >= 1 - newBox.width - 0.02) {
      setCropPosition('right');
    }
  };



  // Real Output Aspect Ratio:
  // For Custom: sourceAspectRatio * (cropBox.width / cropBox.height) = (videoWidth * cropBox.width) / (videoHeight * cropBox.height)
  // For Presets: exact fixed preset ratios
  const outputAspectRatioValue = useMemo(() => {
    if (aspectRatio === '16:9') return 16 / 9;
    if (aspectRatio === '9:16') return 9 / 16;
    if (aspectRatio === '1:1') return 1;
    if (aspectRatio === '4:5') return 4 / 5;
    const h = cropBox.height > 0 ? cropBox.height : 1;
    const w = cropBox.width > 0 ? cropBox.width : 1;
    return sourceAspectRatio * (w / h);
  }, [aspectRatio, cropBox.width, cropBox.height, sourceAspectRatio]);

  // Real-time Canvas Frame Extractor & Output Preview Renderer
  const renderOutputPreview = useCallback(() => {
    const canvas = outputCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Grab frame from active video element (supports Twitch live double-buffered Player A/B and standard player)
    const activeVideo = isLiveChannelUrl
      ? (activeLivePlayer === 'A' ? videoAElementRef.current : videoBElementRef.current)
      : videoElementRef.current;

    if (
      activeVideo &&
      activeVideo.readyState >= 2 &&
      activeVideo.videoWidth > 0 &&
      activeVideo.videoHeight > 0
    ) {
      const vw = activeVideo.videoWidth;
      const vh = activeVideo.videoHeight;

      if (videoDimensions.width !== vw || videoDimensions.height !== vh) {
        setVideoDimensions({ width: vw, height: vh });
      }

      const sx = Math.max(0, Math.min(vw - 1, (cropBox.x || 0) * vw));
      const sy = Math.max(0, Math.min(vh - 1, (cropBox.y || 0) * vh));
      const sw = Math.max(1, Math.min(vw - sx, (cropBox.width || 1) * vw));
      const sh = Math.max(1, Math.min(vh - sy, (cropBox.height || 1) * vh));

      const targetW = Math.round(sw);
      const targetH = Math.round(sh);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      try {
        ctx.drawImage(activeVideo, sx, sy, sw, sh, 0, 0, targetW, targetH);
        return;
      } catch {
        // Fall through to image fallback on CORS block
      }
    }

    // Fallback: If YouTube or video element not ready yet, draw from thumbnail
    const thumbSrc = metadata?.thumbnail || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : '');
    if (thumbSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = thumbSrc;
      img.onload = () => {
        const iw = img.naturalWidth || 1920;
        const ih = img.naturalHeight || 1080;
        const sx = Math.max(0, Math.min(iw - 1, (cropBox.x || 0) * iw));
        const sy = Math.max(0, Math.min(ih - 1, (cropBox.y || 0) * ih));
        const sw = Math.max(1, Math.min(iw - sx, (cropBox.width || 1) * iw));
        const sh = Math.max(1, Math.min(ih - sy, (cropBox.height || 1) * ih));

        const targetW = Math.round(sw);
        const targetH = Math.round(sh);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        try {
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        } catch {}
      };
    }
  }, [isLiveChannelUrl, activeLivePlayer, cropBox, metadata, youtubeId, videoDimensions.width, videoDimensions.height]);

  // Synchronize canvas output preview on seek, timeupdate, crop change, or ratio change
  useEffect(() => {
    renderOutputPreview();
  }, [renderOutputPreview, currentTime, cropBox, aspectRatio]);

  // Smooth continuous canvas output preview rendering while video is playing
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    const loop = () => {
      renderOutputPreview();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, renderOutputPreview]);

  // Seek backward/forward by seconds
  const seekRelative = (seconds: number) => {
    const maxDur = metadata?.duration || 99999;
    const newTime = Math.max(0, Math.min(currentTime + seconds, maxDur));
    seekToPosition(newTime);
  };

  // Helper to convert base64 data URL to binary Blob
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(parts_safe(arr[1]));
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  function parts_safe(str: string) {
    try { return str || ''; } catch (e) { return ''; }
  }

  // Direct trigger browser download with high reliability
  const triggerNativeDownload = (blobOrUrl: Blob | string, filename: string) => {
    let url: string;
    let isObjectUrl = false;
    if (blobOrUrl instanceof Blob) {
      url = window.URL.createObjectURL(blobOrUrl);
      isObjectUrl = true;
    } else if (typeof blobOrUrl === 'string' && blobOrUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(blobOrUrl);
      url = window.URL.createObjectURL(blob);
      isObjectUrl = true;
    } else {
      url = blobOrUrl;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.setAttribute('download', filename);
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
      if (isObjectUrl) window.URL.revokeObjectURL(url);
    }, 5000);
  };

  // Helper to guarantee 100% direct browser download to user's device without navigating or opening media player
  const triggerBrowserFileDownload = async (downloadUrl: string, fileName: string) => {
    try {
      console.log(`[ClipFlow 📥] Downloading file directly to user device -> ${fileName}`);
      const res = await fetch(downloadUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const blob = await res.blob();
      triggerNativeDownload(blob, fileName);
    } catch (err) {
      console.warn('[ClipFlow 📥] Fetch fallback to direct link:', err);
      triggerNativeDownload(downloadUrl, fileName);
    }
  };

  // Download Thumbnail or Current Frame Snapshot (Max Quality)
  const handleDownloadImage = async () => {
    if (isDownloadingImage) return;
    setIsDownloadingImage(true);

    try {
      const rawTitle = customFileName || metadata?.title || 'video';
      const cleanTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, '_').trim();

      if (previewImageMode === 'thumbnail') {
        const thumbUrl = metadata?.thumbnail;
        if (thumbUrl) {
          const downloadUrl = `${BACKEND_URL}/api/video/thumbnail?url=${encodeURIComponent(thumbUrl)}&title=${encodeURIComponent(cleanTitle)}`;
          try {
            const res = await fetch(downloadUrl);
            if (res.ok) {
              const blob = await res.blob();
              triggerNativeDownload(blob, `${cleanTitle}_thumbnail.jpg`);
            } else {
              triggerNativeDownload(downloadUrl, `${cleanTitle}_thumbnail.jpg`);
            }
          } catch (e) {
            triggerNativeDownload(downloadUrl, `${cleanTitle}_thumbnail.jpg`);
          }
          setDownloadSuccess(true);
          setTimeout(() => setDownloadSuccess(false), 2000);
        }
      } else {
        // Download current frame at exact currentTime as high-definition PNG
        const targetTime = currentTime;
        const timeStr = `${Math.floor(targetTime / 60)}m${Math.floor(targetTime % 60)}s`;
        const isCropped = aspectRatio !== '16:9';
        const cropSuffix = isCropped ? `_${aspectRatio.replace(':', 'x')}` : '';
        const fileName = `${cleanTitle}_frame_${timeStr}${cropSuffix}.png`;

        // Request Maximum Source Resolution Frame from backend FrameExtractorService
        const cropParam = isCropped
          ? `&crop_x=${cropBox.x}&crop_y=${cropBox.y}&crop_w=${cropBox.width}&crop_h=${cropBox.height}`
          : '';
        const backendUrl = `${BACKEND_URL}/api/video/frame?url=${encodeURIComponent(activeUrl)}&time=${targetTime}&quality=${encodeURIComponent(downloadQuality)}&download=true&fullRes=true&format=png&title=${encodeURIComponent(cleanTitle)}${cropParam}`;

        try {
          const res = await fetch(backendUrl);
          if (res.ok) {
            const blob = await res.blob();
            triggerNativeDownload(blob, fileName);
          } else {
            triggerNativeDownload(backendUrl, fileName);
          }
        } catch (e) {
          triggerNativeDownload(backendUrl, fileName);
        }

        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2000);
      }
    } catch (err) {
      console.error('[Image Download Error]', err);
    } finally {
      setIsDownloadingImage(false);
    }
  };

  // Export Download
  const handleExportDownload = async () => {
    if (!activeUrl) return;
    if (youtubePlayerRef.current) {
      try { youtubePlayerRef.current.pauseVideo(); } catch (e) { }
      setIsPlaying(false);
    }
    setIsDownloading(true);
    setDownloadStatus('running');

    const effectiveTrimStart = isTrimEnabled ? trimRange[0] : 0;
    const effectiveTrimEnd = isTrimEnabled ? trimRange[1] : (metadata?.duration || 0);

    try {
      const effectiveFormat = downloadFormat === 'captions' ? captionFormat : downloadFormat;
      const payload: any = {
        url: activeUrl,
        format: effectiveFormat,
        quality: downloadQuality,
        audioQuality: downloadAudioBitrate,
        subtitleLang: captionLang,
        relativeTimecodes: true,
        trimStart: effectiveTrimStart,
        trimEnd: effectiveTrimEnd,
        duration: metadata?.duration || 0,
        aspectRatio: aspectRatio === '16:9' ? undefined : aspectRatio,
        cropBox: aspectRatio === '16:9' ? undefined : cropBox,
        fitMode: fitMode,
        cropPosition: cropPosition,
        customFileName: customFileName || metadata?.title || 'ClipFlow_Video',
      };

      if (exportMode === 'pro') {
        if (!isAuthenticated || !isPro) {
          console.warn('%c[ClipFlow Studio 👑 PRO AUTH REQUIRED]', 'color: #f59e0b; font-weight: bold;', 'User must be authenticated and on Pro plan to use cloud storage.');
          setShowAuthModal(true);
          setIsDownloading(false);
          setDownloadStatus('idle');
          return;
        }

        console.log('%c═══════════════════════════════════════════════════', 'color: #a855f7;');
        console.log('%c[ClipFlow Studio ☁️ PRO CLOUD EXPORT INITIATED]', 'color: #a855f7; font-weight: bold; font-size: 13px;', payload);
        console.log('%c═══════════════════════════════════════════════════', 'color: #a855f7;');

        setStatusMessage('⚡ Processing clip & syncing to Pro Cloud Storage...');
        const clientJobId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        setCloudJobId(clientJobId);

        const res = await fetch(`${BACKEND_URL}/api/drive/export`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ ...payload, clientJobId }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        console.log('%c[ClipFlow Studio ☁️ PRO CLOUD EXPORT SUCCESS]', 'color: #22c55e; font-weight: bold;', data);
        setCloudJobId(null);
        setDownloadStatus('success');
        setStatusMessage(data.message || 'Saved to Pro Cloud Storage & downloaded to your browser!');
        if (data.file?.webViewLink) {
          setDriveSuccessLink(data.file.webViewLink);
        }

        // Trigger direct browser download immediately
        const directDownloadUrl = data.downloadUrl
          ? (data.downloadUrl.startsWith('http') ? data.downloadUrl : `${BACKEND_URL}${data.downloadUrl}`)
          : (data.file?.id || data.file?._id)
            ? `${BACKEND_URL}/api/videos/${data.file.id || data.file._id}/download`
            : null;

        if (directDownloadUrl) {
          const downloadName = data.fileName || `${payload.customFileName || 'clip'}.${payload.format || 'mp4'}`;
          await triggerBrowserFileDownload(directDownloadUrl, downloadName);
        }

        // Auto-close progress and status notification in 2 seconds
        setTimeout(() => {
          setStatusMessage('');
          setDownloadStatus('idle');
          setDriveSuccessLink(null);
        }, 2000);
      } else {
        // Free Mode: Exclusively Desktop Helper App (port 18942)
        console.log('%c═══════════════════════════════════════════════════', 'color: #38bdf8;');
        console.log('%c[ClipFlow Studio 🚀 FREE LOCAL DOWNLOAD INITIATED]', 'color: #38bdf8; font-weight: bold; font-size: 13px;', payload);
        console.log('%c═══════════════════════════════════════════════════', 'color: #38bdf8;');

        setStatusMessage('Connecting to ClipFlow Desktop App...');
        let capturedByHelper = false;
        const helperEndpoints = ['http://127.0.0.1:18942/download', 'http://localhost:18942/download'];

        for (const endpoint of helperEndpoints) {
          try {
            console.log(`[ClipFlow Studio 📡] Dispatching payload to Desktop App -> ${endpoint}`);
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
              console.log('%c[ClipFlow Studio ✅ CAPTURED BY DESKTOP APP]', 'color: #22c55e; font-weight: bold; font-size: 13px;', resData);
              capturedByHelper = true;
              setIsHelperRunning(true);
              setDownloadStatus('success');
              setStatusMessage('Captured by ClipFlow Desktop App! Downloading locally...');
              setTimeout(() => {
                setStatusMessage('');
                setDownloadStatus('idle');
              }, 2000);
              break;
            }
          } catch (e: any) {
            console.log(`[ClipFlow Studio ℹ️] Desktop app unreachable on ${endpoint} (${e.message})`);
          }
        }

        if (!capturedByHelper) {
          console.warn('%c[ClipFlow Studio 💻 FREE MODE: DESKTOP APP OFFLINE]', 'color: #ef4444; font-weight: bold;');
          setIsHelperRunning(false);
          setDownloadStatus('error');
          setStatusMessage('ClipFlow Desktop App is not running. Please launch the Helper app for local processing.');
          setShowCompanionModal(true);
        }
      }

      saveToHistory({
        title: customFileName || metadata?.title || 'Untitled Clip',
        url: activeUrl,
        thumbnail: metadata?.thumbnail || '',
        duration: isTrimEnabled
          ? `${formatTime(trimRange[0])} - ${formatTime(trimRange[1])} (${formatTime(trimRange[1] - trimRange[0])})`
          : `Full Video (${formatTime(metadata?.duration || 0)})`,
        quality: downloadQuality,
        aspectRatio: aspectRatio,
      });
    } catch (err: any) {
      console.error('[Download Error]', err);
      setDownloadStatus('error');
      setStatusMessage(err.message || 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  // Accurate Size calculator
  const exportDuration = isTrimEnabled ? Math.max(0, trimRange[1] - trimRange[0]) : effectiveDuration;
  let estimatedBytes = 0;
  if (downloadFormat === 'captions') {
    estimatedBytes = 3500;
  } else if (downloadFormat === 'mp3') {
    let kbps = 192;
    if (downloadAudioBitrate === '320k') kbps = 320;
    else if (downloadAudioBitrate === '256k') kbps = 256;
    else if (downloadAudioBitrate === '192k') kbps = 192;
    else if (downloadAudioBitrate === '128k') kbps = 128;
    else if (downloadAudioBitrate === '0') kbps = 256;
    estimatedBytes = (kbps * 1000 / 8) * exportDuration;
  } else {
    const selectedQualityObj = qualityOptions.find(q => q.label === downloadQuality);
    const height = selectedQualityObj?.height || parseInt((downloadQuality || '').replace(/[^\d]/g, ''), 10) || 1080;

    let baseKbps = 3800;
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
    estimatedBytes = (effectiveKbps * 1000 / 8) * exportDuration;
  }

  // Filmstrip progress percentage
  const startPct = effectiveDuration > 0 ? (trimRange[0] / effectiveDuration) * 100 : 0;
  const widthPct = effectiveDuration > 0 ? ((trimRange[1] - trimRange[0]) / effectiveDuration) * 100 : 100;
  const currentPct = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  return (
    <div className={`flex h-screen overflow-hidden bg-black text-[#f8fafc] selection:bg-purple-500/30 ${isDraggingVSplitter ? 'select-none cursor-col-resize' : isDraggingHSplitter ? 'select-none cursor-row-resize' : ''
      }`}>

      {/* ══ PERSISTENT LEFT SIDEBAR ══════════════════════════════════════════ */}
      <EditorSidebar
        width={leftSidebarWidth}
        onWidthChange={setLeftSidebarWidth}
        showUrlChange={showUrlChange}
        newUrlInput={newUrlInput}
        setNewUrlInput={setNewUrlInput}
        onLoadVideo={(url) => fetchVideo(url)}
        isLoadingMeta={isLoadingMeta}
        currentVideoUrl={activeUrl}
      />

      {/* ══ MAIN CONTENT AREA ════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top Header Bar */}
        <header className="h-[54px] flex items-center justify-between px-4 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {isLoadingMeta && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-400 rounded-full shrink-0"
              />
            )}

            {metadata && (
              <div className="flex items-center gap-2 min-w-0">
                {metadata.uploader && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 shrink-0 max-w-[150px] truncate" title={metadata.uploader}>
                    {metadata.uploader}
                  </span>
                )}
                <h1 className="text-sm font-semibold text-gray-200 truncate" title={metadata.title}>
                  {metadata.title}
                </h1>
              </div>
            )}
            {!metadata && !isLoadingMeta && (
              <span className="text-sm text-gray-500">ClipFlow Studio</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isProUser && (
              <button
                onClick={() => setShowCompanionModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 hover:border-white/30 transition-all shadow-sm active:scale-95 group"
                title="Download ClipFlow Desktop Engine for local clipping"
              >
                <HardDrive className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white" />
                <span className="hidden sm:inline">Download Engine</span>
                <span className="sm:hidden">Engine</span>
              </button>
            )}

            <UserProfileMenu
              onOpenCloudStorage={() => setShowCloudStorageModal(true)}
              onOpenAuth={() => setShowAuthModal(true)}
            />
          </div>
        </header>

        {/* Body Row: Center video + Draggable Vertical Divider + Right panel */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* ── CENTER: Fixed Aspect Frame Container + Horizontal Line + Timeline ── */}
          <main className="flex-1 flex flex-col overflow-y-auto min-w-0 p-4 gap-0">

            {/* Loading */}
            {isLoadingMeta && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center min-h-[300px]">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-10 h-10 border-3 border-purple-500/20 border-t-purple-400 rounded-full"
                />
                <p className="text-sm text-gray-400 font-medium">Extracting video streams...</p>
              </div>
            )}

            {/* Error Black Screen (Covers entire middle section with sleek black screen, logo, and generic message) */}
            {errorMeta && !isLoadingMeta && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-8 min-h-[480px] bg-black rounded-2xl border border-white/[0.07] shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-xl">
                  <AlertCircle className="w-8 h-8 text-zinc-400 stroke-[1.5]" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h2 className="text-lg font-bold text-white tracking-tight">Something went wrong</h2>
                  <p className="text-sm text-zinc-400">
                    We couldn't load this video preview. Please verify the link or try another video.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setErrorMeta('');
                    setShowUrlChange(true);
                  }}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-semibold text-sm border border-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Try Another URL
                </button>
              </div>
            )}

            {/* No video yet */}
            {!metadata && !isLoadingMeta && !errorMeta && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-6 min-h-[350px]">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Film className="w-7 h-7 text-purple-400" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-white">No video loaded</h2>
                  <p className="text-sm text-gray-500 max-w-xs">Paste a YouTube or video URL in the sidebar to get started.</p>
                </div>
                <button
                  onClick={() => setShowUrlChange(true)}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors"
                >
                  Paste Video URL
                </button>
              </div>
            )}

            {/* ── Video Loaded ────────────────────────────────────────── */}
            {metadata && !isLoadingMeta && !errorMeta && (
              <>
                {/* Fixed Aspect Frame Viewport */}
                <div
                  ref={videoContainerRef}
                  style={{ height: `${videoHeight}px` }}
                  className="w-full flex flex-col items-center justify-center bg-black/70 rounded-2xl border border-white/[0.07] overflow-hidden relative p-3 shadow-inner shrink-0 transition-[height] duration-75 select-none"
                >
                  {/* Fixed Aspect Frame Device Box */}
                  <div
                    onClick={(e) => {
                      if (e.target === e.currentTarget && aspectRatio === '16:9') {
                        togglePlay();
                      }
                    }}
                    className={`relative w-full h-full flex items-center justify-center overflow-hidden group select-none ${aspectRatio === '16:9' ? 'cursor-pointer' : 'cursor-default'
                      }`}
                  >
                    {/* Universal HTML5 Video Canvas with Interactive Framing Overlay */}
                    <div
                      ref={videoCanvasRef}
                      style={{
                        aspectRatio: `${sourceAspectRatio}`,
                      }}
                      className="relative h-full max-h-full max-w-full w-auto bg-black rounded-xl overflow-hidden flex items-center justify-center shadow-2xl border border-white/10 select-none"
                    >
                      <div className="w-full h-full relative flex items-center justify-center overflow-hidden bg-black">
                        {youtubeId ? (
                          <div className="w-full h-full relative flex items-center justify-center overflow-hidden pointer-events-none select-none">
                            <YouTube
                              videoId={youtubeId}
                              className="w-full h-full flex items-center justify-center pointer-events-none"
                              iframeClassName="w-full h-full block border-0 pointer-events-none"
                              opts={{
                                width: '100%',
                                height: '100%',
                                playerVars: {
                                  autoplay: 0,
                                  mute: isMuted ? 1 : 0,
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
                                  start: Math.floor(trimRange[0] || 0),
                                },
                              }}
                              onReady={(e) => {
                                youtubePlayerRef.current = e.target;
                                try {
                                  if (typeof e.target.unloadModule === 'function') {
                                    e.target.unloadModule('captions');
                                    e.target.unloadModule('cc');
                                  }
                                } catch (err) { }
                                if (isMuted) {
                                  e.target.mute();
                                } else {
                                  e.target.unMute();
                                }
                                const dur = e.target.getDuration();
                                if (dur && dur > 0) {
                                  handleMediaDurationUpdate(dur);
                                }
                                if (initialSession?.currentTime && initialSession.currentTime > 0) {
                                  e.target.seekTo(initialSession.currentTime, true);
                                  setCurrentTime(initialSession.currentTime);
                                } else if (trimRange[0] > 0) {
                                  e.target.seekTo(trimRange[0], true);
                                }
                              }}
                              onPlay={() => {
                                setIsPlaying(true);
                                setIsVideoBuffering(false);
                              }}
                              onPause={() => {
                                setIsPlaying(false);
                                setIsVideoBuffering(false);
                              }}
                              onStateChange={(e) => {
                                if (e.data === 1) {
                                  setIsPlaying(true);
                                  setIsVideoBuffering(false);
                                } else if (e.data === 2) {
                                  setIsPlaying(false);
                                  setIsVideoBuffering(false);
                                } else if (e.data === 3) {
                                  setIsVideoBuffering(true);
                                } else if (e.data === 0) {
                                  setIsPlaying(false);
                                  setIsVideoBuffering(false);
                                  if (youtubePlayerRef.current) {
                                    youtubePlayerRef.current.seekTo(isTrimEnabled ? trimRange[0] : 0, true);
                                  }
                                }
                              }}
                            />
                          </div>
                        ) : isLiveChannelUrl ? (
                          <div className="w-full h-full relative flex items-center justify-center overflow-hidden bg-black">
                            {/* Video Player A (Primary / Buffer 1) */}
                            <video
                              ref={videoAElementRef}
                              preload="auto"
                              playsInline
                              muted={isMuted}
                              onLoadedMetadata={(e) => {
                                const v = e.currentTarget;
                                v.volume = volume;
                                v.muted = isMuted;
                                if (v.videoWidth > 0 && v.videoHeight > 0) {
                                  setVideoDimensions({ width: v.videoWidth, height: v.videoHeight });
                                }
                              }}
                              onTimeUpdate={(e) => handleLiveTimeUpdate(e, 'A')}
                              onEnded={() => handleLiveEnded('A')}
                              className={`w-full h-full object-contain pointer-events-none absolute inset-0 ${
                                activeLivePlayer === 'A' ? 'opacity-100 z-10' : 'opacity-0 z-0'
                              }`}
                            />

                            {/* Video Player B (Secondary / Buffer 2) */}
                            <video
                              ref={videoBElementRef}
                              preload="auto"
                              playsInline
                              muted={isMuted}
                              onLoadedMetadata={(e) => {
                                const v = e.currentTarget;
                                v.volume = volume;
                                v.muted = isMuted;
                                if (v.videoWidth > 0 && v.videoHeight > 0) {
                                  setVideoDimensions({ width: v.videoWidth, height: v.videoHeight });
                                }
                              }}
                              onTimeUpdate={(e) => handleLiveTimeUpdate(e, 'B')}
                              onEnded={() => handleLiveEnded('B')}
                              className={`w-full h-full object-contain pointer-events-none absolute inset-0 ${
                                activeLivePlayer === 'B' ? 'opacity-100 z-10' : 'opacity-0 z-0'
                              }`}
                            />
                          </div>
                        ) : (
                          <video
                            ref={videoElementRef}
                            src={isHls && Hls.isSupported() ? undefined : activeVideoSrc}
                            preload="auto"
                            playsInline
                            muted={isMuted}
                            onLoadStart={() => {
                              console.log('%c[ClipFlow ⏳ VIDEO LOAD START]', 'color: #facc15; font-weight: bold;', {
                                activeVideoSrc,
                                isHls,
                                isTwitch,
                                twitchHlsUrl
                              });
                              setIsVideoBuffering(true);
                            }}
                            onWaiting={() => {
                              console.log('%c[ClipFlow ⏳ VIDEO BUFFERING / WAITING]', 'color: #facc15;');
                              setIsVideoBuffering(true);
                            }}
                            onStalled={() => {
                              console.warn('%c[ClipFlow ⏳ VIDEO PLAYBACK STALLED]', 'color: #f97316;');
                            }}
                            onEmptied={() => {
                              console.log('%c[ClipFlow 🧹 VIDEO SRC EMPTIED]', 'color: #9ca3af;');
                            }}
                            onSeeking={() => {
                              console.log('%c[ClipFlow ⏩ VIDEO SEEKING]', 'color: #38bdf8;', { currentTime: videoElementRef.current?.currentTime });
                              isSeekingRef.current = true;
                              setIsVideoBuffering(true);
                            }}
                            onSeeked={(e) => {
                              const v = e.currentTarget;
                              console.log('%c[ClipFlow ⏩ VIDEO SEEKED]', 'color: #38bdf8;', { currentTime: v.currentTime });
                              setIsVideoBuffering(false);
                              if (!isLiveChannelUrl) {
                                setCurrentTime(v.currentTime);
                                pendingSeekTimeRef.current = null;
                                isSeekingRef.current = false;
                              }
                            }}
                            onCanPlay={() => {
                              console.log('%c[ClipFlow 🚀 VIDEO CAN PLAY]', 'color: #22c55e; font-weight: bold;', {
                                duration: videoElementRef.current?.duration,
                                videoWidth: videoElementRef.current?.videoWidth,
                                videoHeight: videoElementRef.current?.videoHeight,
                                readyState: videoElementRef.current?.readyState,
                              });
                              setIsVideoBuffering(false);
                              if (isLiveChannelUrl && isPlaying && videoElementRef.current?.paused) {
                                videoElementRef.current.play().catch(() => { });
                              }
                            }}
                            onCanPlayThrough={() => {
                              console.log('%c[ClipFlow 🚀 VIDEO CAN PLAY THROUGH]', 'color: #22c55e;', {
                                duration: videoElementRef.current?.duration,
                              });
                              setIsVideoBuffering(false);
                              if (isLiveChannelUrl && isPlaying && videoElementRef.current?.paused) {
                                videoElementRef.current.play().catch(() => { });
                              }
                            }}
                            onLoadedData={() => {
                              console.log('%c[ClipFlow 📦 VIDEO DATA LOADED (First Frame Ready)]', 'color: #22c55e; font-weight: bold;', {
                                videoWidth: videoElementRef.current?.videoWidth,
                                videoHeight: videoElementRef.current?.videoHeight,
                              });
                              setIsVideoBuffering(false);
                              if (isLiveChannelUrl && isPlaying && videoElementRef.current?.paused) {
                                videoElementRef.current.play().catch(() => { });
                              }
                            }}
                            onLoadedMetadata={(e) => {
                              const v = e.currentTarget;
                              v.volume = volume;
                              v.muted = isMuted;
                              if (v.videoWidth > 0 && v.videoHeight > 0) {
                                setVideoDimensions({ width: v.videoWidth, height: v.videoHeight });
                              }
                              setIsVideoBuffering(false);

                              if (isLiveChannelUrl) {
                                isSeekingLiveRef.current = false;
                                if (seekFractionalOffsetRef.current > 0) {
                                  try { v.currentTime = seekFractionalOffsetRef.current; } catch { }
                                  seekFractionalOffsetRef.current = 0;
                                }
                                const actualDuration = (v.duration && Number.isFinite(v.duration) && v.duration > 0) ? v.duration : 5;
                                console.log('[Twitch Timeline ⏱️]', {
                                  action: 'chunk metadata loaded',
                                  chunkStartOffset: liveChunkOffset,
                                  videoDuration: actualDuration,
                                  videoCurrentTime: v.currentTime,
                                  calculatedGlobalTime: liveChunkOffset + v.currentTime,
                                });
                                if (isPlaying && v.paused) {
                                  v.play().catch(() => { });
                                }
                              } else {
                                console.log('%c[ClipFlow ✅ VIDEO METADATA LOADED]', 'color: #22c55e; font-weight: bold;', {
                                  duration: v.duration,
                                  videoWidth: v.videoWidth,
                                  videoHeight: v.videoHeight,
                                  src: v.currentSrc,
                                });
                                if (v.duration && v.duration > 0 && Number.isFinite(v.duration)) {
                                  handleMediaDurationUpdate(v.duration);
                                }
                              }
                            }}
                            onDurationChange={(e) => {
                              const v = e.currentTarget;
                              if (!isLiveChannelUrl && v.duration && v.duration > 0 && Number.isFinite(v.duration)) {
                                handleMediaDurationUpdate(v.duration);
                              }
                            }}
                            onTimeUpdate={(e) => {
                              const v = e.currentTarget;
                              if (isLiveChannelUrl) {
                                if (isSeekingLiveRef.current) {
                                  return; // Ignore frames from old chunk during seek transition
                                }
                                const currentTimelineTime = liveChunkOffset + v.currentTime;
                                setCurrentTime(currentTimelineTime);
                                notifyLivePlaybackProgress(v.currentTime);
                              } else {
                                if (isSeekingRef.current) {
                                  return; // Ignore stale time updates while seek is pending/in-flight
                                }
                                setCurrentTime(v.currentTime);
                                const isExplicitSubClip = isTrimEnabled && (trimRange[0] > 1 || (trimRange[1] > 0 && trimRange[1] < effectiveDuration - 2));
                                if (isExplicitSubClip && v.currentTime >= trimRange[1]) {
                                  seekToPosition(trimRange[0]);
                                }
                              }
                            }}
                            onPlay={() => {
                              console.log('%c[ClipFlow ▶️ VIDEO PLAYING]', 'color: #22c55e; font-weight: bold;');
                              setIsPlaying(true);
                              setIsVideoBuffering(false);
                            }}
                            onPlaying={() => {
                              console.log('%c[ClipFlow 🎬 VIDEO PLAYBACK ACTIVE]', 'color: #22c55e;');
                              setIsPlaying(true);
                              setIsVideoBuffering(false);
                            }}
                            onPause={() => {
                              console.log('%c[ClipFlow ⏸️ VIDEO PAUSED]', 'color: #f59e0b;');
                              setIsPlaying(false);
                              setIsVideoBuffering(false);
                            }}
                            onError={(e) => {
                              const v = e.currentTarget;
                              const mediaError = v.error;
                              console.error('%c[ClipFlow ❌ VIDEO PLAYBACK ERROR]', 'color: #ef4444; font-weight: bold;', {
                                errorCode: mediaError?.code,
                                errorMessage: mediaError?.message,
                                currentSrc: v.currentSrc,
                                useProxyFallback,
                              });
                              setIsVideoBuffering(false);
                              if (!isTwitch && !useProxyFallback && rawPreviewSrc) {
                                console.log('%c[ClipFlow 🔄 AUTO-SWITCHING TO PROXY STREAM]', 'color: #38bdf8; font-weight: bold;');
                                setUseProxyFallback(true);
                              }
                            }}
                            onEnded={() => {
                              console.log('%c[ClipFlow ⏹️ VIDEO ENDED]', 'color: #6b7280;');
                              setIsPlaying(false);
                              setIsVideoBuffering(false);
                              if (videoElementRef.current) {
                                videoElementRef.current.currentTime = isTrimEnabled ? trimRange[0] : 0;
                              }
                            }}
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        )}

                        {/* Video Buffering Overlay */}
                        {(isVideoBuffering || isSeekingLiveRef.current || (isLiveChannelUrl && isLiveChunkLoading && !liveChunkUrl)) && (
                          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[1px] pointer-events-none">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                          </div>
                        )}

                        {/* Interactive Dynamic Crop Framing Box Overlay */}
                        {aspectRatio !== '16:9' && (
                          <CropFrameOverlay
                            cropBox={cropBox}
                            onChange={handleCropBoxChange}
                            containerWidth={containerDims.width || 800}
                            containerHeight={containerDims.height || 450}
                            aspectRatio={aspectRatio}
                            sourceAspectRatio={sourceAspectRatio}
                          />
                        )}
                      </div>
                    </div>

                    {/* Floating Live Broadcast Button */}
                    {isLiveStream && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const targetTime = effectiveDuration > 10 ? effectiveDuration - 5 : Math.max(0, effectiveDuration);
                          seekToPosition(targetTime);
                          setTrimRange(prev => [prev[0], Math.max(prev[1], effectiveDuration)]);
                          if (videoElementRef.current) {
                            videoElementRef.current.currentTime = targetTime;
                            if (videoElementRef.current.paused) {
                              videoElementRef.current.play().catch(() => { });
                              setIsPlaying(true);
                            }
                          }
                        }}
                        className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/90 hover:bg-red-500 active:scale-95 transition-all text-white text-[11px] font-extrabold uppercase tracking-wider shadow-lg shadow-red-600/30 border border-red-500/50 select-none cursor-pointer"
                        title="Click to jump preview to the latest live broadcast"
                      >
                        <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                        <span>LIVE BROADCAST</span>
                      </button>
                    )}

                  </div>

                  {/* ── Single Clean Play / Pause Bottom Bar with Progress Track ── */}
                  <div className="w-full mt-2 pt-2 border-t border-white/[0.08] flex flex-col gap-2 shrink-0 px-2">

                    {/* Progress Track */}
                    <div className="w-full flex flex-col items-center px-1">
                      <Slider.Root
                        className="relative w-full flex items-center h-4 cursor-pointer"
                        value={[currentTime]}
                        min={0}
                        max={effectiveDuration > 0 ? effectiveDuration : 10}
                        onValueChange={(val) => {
                          if (!isLiveChannelUrl) {
                            setCurrentTime(val[0]);
                            pendingSeekTimeRef.current = val[0];
                          } else {
                            isSeekingLiveRef.current = true;
                            setCurrentTime(val[0]);
                          }
                        }}
                        onValueCommit={(val) => {
                          seekToPosition(val[0]);
                        }}
                      >
                        <Slider.Track className="relative flex-grow h-1.5 bg-white/10 rounded-full">
                          <Slider.Range className="absolute h-full bg-white/80 rounded-full" />
                        </Slider.Track>
                        <Slider.Thumb className="block w-3 h-3 bg-white rounded-full shadow hover:scale-110 focus:outline-none transition-transform" />
                      </Slider.Root>
                    </div>

                    {/* Controls Row */}
                    <div className="w-full flex items-center justify-between pb-1 relative mt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => seekRelative(-10)}
                          className="px-2 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 hover:text-white transition-colors flex items-center gap-1 shadow-sm"
                          title="Rewind 10 seconds"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="text-[10px] font-bold font-mono">10s</span>
                        </button>

                        <button
                          onClick={togglePlay}
                          className="p-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white transition-colors flex items-center justify-center shadow-sm"
                          title={isPlaying ? 'Pause' : 'Play'}
                        >
                          {isPlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-white" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                          )}
                        </button>

                        <button
                          onClick={() => seekRelative(10)}
                          className="px-2 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 hover:text-white transition-colors flex items-center gap-1 shadow-sm"
                          title="Forward 10 seconds"
                        >
                          <span className="text-[10px] font-bold font-mono">10s</span>
                          <RotateCw className="w-3.5 h-3.5 text-zinc-400" />
                        </button>

                        <button
                          onClick={toggleMute}
                          className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 hover:text-white transition-colors flex items-center justify-center shadow-sm ml-0.5"
                          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                        >
                          {isMuted ? (
                            <VolumeX className="w-3.5 h-3.5 text-red-400" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-zinc-300" />
                          )}
                        </button>
                      </div>

                      {/* Time Indicator (Centered & Editable) */}
                      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[12px] font-mono text-gray-500 bg-black/40 border border-white/10 px-2.5 py-0.5 rounded-lg shadow-sm">
                        {isEditingTime ? (
                          <input
                            type="text"
                            autoFocus
                            value={timeInputValue}
                            onChange={(e) => setTimeInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const parsed = parseTime(timeInputValue);
                                if (!isNaN(parsed)) {
                                  const clamped = Math.max(0, Math.min(parsed, effectiveDuration > 0 ? effectiveDuration : parsed));
                                  seekToPosition(clamped);
                                }
                                setIsEditingTime(false);
                              } else if (e.key === 'Escape') {
                                setIsEditingTime(false);
                              }
                            }}
                            onBlur={() => {
                              const parsed = parseTime(timeInputValue);
                              if (!isNaN(parsed)) {
                                const clamped = Math.max(0, Math.min(parsed, effectiveDuration > 0 ? effectiveDuration : parsed));
                                seekToPosition(clamped);
                              }
                              setIsEditingTime(false);
                            }}
                            className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1 text-center font-bold text-white text-[12px] focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setTimeInputValue(formatTime(currentTime, effectiveDuration <= 15 || currentTime % 1 !== 0));
                              setIsEditingTime(true);
                            }}
                            title="Click to edit current time"
                            className="font-bold text-gray-200 hover:text-white hover:bg-white/5 cursor-text transition-colors px-1 py-0.5 rounded"
                          >
                            {formatTime(currentTime, effectiveDuration <= 15 || currentTime % 1 !== 0)}
                          </button>
                        )}
                        <span className="text-gray-600">/</span>
                        <span className="text-gray-400">
                          {formatTime(effectiveDuration, effectiveDuration <= 15 || effectiveDuration % 1 !== 0)}
                        </span>
                      </div>

                      {/* Right Controls: Preview Quality Selection (Hidden for YouTube links) */}
                      <div className="flex items-center gap-2">
                        {/* Quality Selection Dropdown (Below right to progress bar) */}
                        {!isYouTube && previewQualities.length > 0 && (
                          <div className="relative" ref={qualityMenuRef}>
                            <button
                              type="button"
                              onClick={() => setIsQualityMenuOpen(!isQualityMenuOpen)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] active:bg-white/[0.2] text-gray-200 hover:text-white transition-all text-[11px] font-semibold border border-white/15 shadow-sm cursor-pointer"
                              title="Change Video Preview Quality"
                            >
                              <Settings className="w-3.5 h-3.5 text-zinc-300" />
                              <span className="tracking-tight">{currentQualityLabel}</span>
                              <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${isQualityMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isQualityMenuOpen && (
                              <div className="absolute bottom-full right-0 mb-2 w-44 bg-black border border-white/15 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-xl">
                                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-white/[0.08] mb-1 flex items-center justify-between">
                                  <span>Preview Quality</span>
                                  <span className="text-[9px] text-zinc-300 font-mono">Stream</span>
                                </div>
                                <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar">
                                  {previewQualities.map((q) => {
                                    const isSelected =
                                      selectedQualityId === q.id ||
                                      (!selectedQualityId && selectedPreviewQualityUrl === q.url) ||
                                      (!selectedQualityId && !selectedPreviewQualityUrl && (q.url === defaultPreviewStreamUrl || q.label === currentQualityLabel));
                                    return (
                                      <button
                                        key={q.id}
                                        type="button"
                                        onClick={() => handleSelectPreviewQuality(q)}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${isSelected
                                            ? 'bg-white text-black font-bold'
                                            : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                                          }`}
                                      >
                                        <div className="flex items-center gap-1.5 truncate">
                                          <span className="truncate font-semibold">{q.label}</span>
                                          {!q.isAvailable && (
                                            <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-zinc-400 font-mono">
                                              auto-scaled
                                            </span>
                                          )}
                                        </div>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-black shrink-0 ml-1.5" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── DRAGGABLE HORIZONTAL SPLITTER LINE (Video ↕ Timeline) ── */}
                <div
                  onMouseDown={() => setIsDraggingHSplitter(true)}
                  className="relative py-2.5 z-20 cursor-row-resize group select-none w-full flex items-center"
                  title="Drag up or down to adjust video and timeline height"
                >
                  <div className={`w-full h-[2px] transition-all ${isDraggingHSplitter ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-white/10 group-hover:bg-white'
                    }`} />
                </div>

                {/* ── Filmstrip Timeline ─────────────────────────────────── */}
                <div className="space-y-2.5 p-3 rounded-2xl bg-[#080808] border border-white/[0.06] shrink-0 shadow-lg select-none">

                  {/* Filmstrip with slider overlay */}
                  <div className={`relative h-[56px] rounded-xl overflow-hidden border border-white/[0.07] transition-opacity ${!isTrimEnabled ? 'opacity-50' : 'opacity-100'}`} ref={sliderWrapRef}>
                    {/* Film background with real time-based frames */}
                    <div className="absolute inset-0 bg-black flex overflow-hidden">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const totalDur = effectiveDuration > 0 ? effectiveDuration : (metadata?.duration || 12);
                        const frameTimeSec = (totalDur / 10) * (i + 0.5);
                        const timeStr = formatTime(frameTimeSec, totalDur <= 15);

                        // YouTube snapshot slot (1=early ~25%, 2=mid ~50%, 3=late ~75%)
                        const ytSlot = i < 3 ? '1' : i < 7 ? '2' : '3';
                        const ytFallback = youtubeId
                          ? `https://img.youtube.com/vi/${youtubeId}/${ytSlot}.jpg`
                          : metadata?.thumbnail || '';
                        const frameUrl = ytFallback;

                        return (
                          <div
                            key={i}
                            className="relative h-full flex-1 border-r border-white/[0.08] bg-zinc-950/80 overflow-hidden group"
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
                            <span className="absolute bottom-0.5 right-1 text-[8px] font-mono font-bold text-white/90 bg-black/75 backdrop-blur-xs px-1 py-0.2 rounded border border-white/10 pointer-events-none select-none">
                              {timeStr}
                            </span>
                          </div>
                        );
                      })}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 36px)',
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 pointer-events-none" />
                    </div>

                    {/* Selected region highlight */}
                    {isTrimEnabled ? (
                      <div
                        className="absolute top-0 bottom-0 bg-white/20 border-x-2 border-white/80 z-10 pointer-events-none"
                        style={{
                          left: `${startPct}%`,
                          width: `${Math.max(widthPct, 0.5)}%`,
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-white/10 border-x-2 border-white/30 z-10 pointer-events-none" />
                    )}

                    {/* Synchronized Live Playhead Needle */}
                    {effectiveDuration > 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-15 pointer-events-none transition-[left] duration-75 shadow-[0_0_8px_rgba(239,68,68,0.9)]"
                        style={{ left: `${Math.min(100, Math.max(0, currentPct))}%` }}
                      >
                        <div className="w-2.5 h-2.5 -left-[4px] -top-0.5 absolute bg-red-500 rounded-full shadow-md" />
                      </div>
                    )}

                    {/* Radix Slider overlay */}
                    {isTrimEnabled && (
                      <Slider.Root
                        className="absolute inset-0 flex items-center z-20 cursor-pointer"
                        value={trimRange}
                        min={0}
                        max={effectiveDuration > 0 ? effectiveDuration : 10}
                        step={effectiveDuration <= 30 ? 0.1 : 0.5}
                        minStepsBetweenThumbs={0.1}
                        onValueChange={(val) => {
                          setTrimRange([val[0], val[1]]);
                          if (!isLiveChannelUrl) {
                            if (val[0] !== trimRange[0]) {
                              setCurrentTime(val[0]);
                              pendingSeekTimeRef.current = val[0];
                            } else if (val[1] !== trimRange[1]) {
                              setCurrentTime(val[1]);
                              pendingSeekTimeRef.current = val[1];
                            }
                          }
                        }}
                        onValueCommit={(val) => {
                          if (val[0] !== trimRange[0]) {
                            seekToPosition(val[0]);
                          } else if (val[1] !== trimRange[1]) {
                            seekToPosition(val[1]);
                          }
                        }}
                      >
                        <Slider.Track className="relative flex-grow h-full rounded-xl cursor-pointer">
                          <Slider.Range className="absolute h-full bg-transparent" />
                        </Slider.Track>
                        {/* Start handle */}
                        <Slider.Thumb
                          aria-label="Start Trim"
                          className="block w-3.5 h-[56px] bg-zinc-200 rounded-sm border-2 border-white shadow-lg shadow-black/50 cursor-ew-resize focus:outline-none hover:bg-white transition-colors"
                        />
                        {/* End handle */}
                        <Slider.Thumb
                          aria-label="End Trim"
                          className="block w-3.5 h-[56px] bg-zinc-200 rounded-sm border-2 border-white shadow-lg shadow-black/50 cursor-ew-resize focus:outline-none hover:bg-white transition-colors"
                        />
                      </Slider.Root>
                    )}
                  </div>

                  {/* Duration info and manual inputs */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="text-gray-400">Selected Duration:</span>
                      <span className="font-mono font-bold text-white">
                        {isTrimEnabled
                          ? formatTime(trimRange[1] - trimRange[0], (trimRange[1] - trimRange[0]) < 10 || (trimRange[1] - trimRange[0]) % 1 !== 0)
                          : formatTime(effectiveDuration, effectiveDuration < 10)}
                      </span>
                      <span className="text-gray-500">
                        ({(isTrimEnabled ? (trimRange[1] - trimRange[0]) : effectiveDuration).toFixed(1)}s)
                      </span>
                    </div>

                    {isTrimEnabled ? (
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        <input
                          type="text"
                          value={formatTime(trimRange[0], effectiveDuration <= 15 || trimRange[0] % 1 !== 0)}
                          onChange={(e) => {
                            const val = parseTime(e.target.value);
                            if (!isNaN(val) && val < trimRange[1]) {
                              setTrimRange([val, trimRange[1]]);
                              seekToPosition(val);
                            }
                          }}
                          className="w-16 bg-black/50 border border-white/10 rounded-lg px-1.5 py-1 text-center text-zinc-200 font-bold focus:outline-none focus:border-zinc-400 text-[11px]"
                        />
                        <span className="text-gray-500">-</span>
                        <input
                          type="text"
                          value={formatTime(trimRange[1], effectiveDuration <= 15 || trimRange[1] % 1 !== 0)}
                          onChange={(e) => {
                            const val = parseTime(e.target.value);
                            if (!isNaN(val) && val > trimRange[0]) {
                              setTrimRange([trimRange[0], Math.min(effectiveDuration > 0 ? effectiveDuration : 9999, val)]);
                            }
                          }}
                          className="w-16 bg-black/50 border border-white/10 rounded-lg px-1.5 py-1 text-center text-zinc-200 font-bold focus:outline-none focus:border-zinc-400 text-[11px]"
                        />
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-500 font-medium">Exporting Entire Video</span>
                    )}
                  </div>

                  {/* Note: Preview quality does not affect download quality */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black border border-white/10 text-white select-none shadow-sm">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-500/10 text-red-500 uppercase tracking-wide border border-red-500/20 shrink-0">
                      NOTE:
                    </span>
                    <p className="text-[11px] font-medium text-white leading-tight">
                      Preview quality does not affect download quality.
                    </p>
                  </div>
                </div>
              </>
            )}
          </main>

          {/* ── DRAGGABLE VERTICAL SPLITTER (Video Pane ↔ Right Panel) ── */}
          <div
            onMouseDown={() => setIsDraggingVSplitter(true)}
            className={`w-2.5 hover:w-2.5 -mx-1 z-30 flex items-center justify-center cursor-col-resize group transition-colors select-none ${isDraggingVSplitter ? 'bg-white/20' : 'bg-transparent hover:bg-white/10'
              }`}
            title="Drag left or right to resize right panel"
          >
            <div className={`w-[2px] h-10 rounded-full transition-all ${isDraggingVSplitter ? 'bg-white h-16 shadow-md shadow-white/50' : 'bg-white/20 group-hover:bg-white group-hover:h-16'
              }`} />
          </div>

          {/* ── RIGHT PANEL: Export Controls (Monochrome Clean UI) ──────── */}
          <aside
            style={{ width: `${rightPanelWidth}px` }}
            className="shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden bg-black select-text"
          >
            {/* Scrollable settings */}
            <div className="flex-1 overflow-y-auto">

              {/* Video Info Header / Image Preview Section */}
              {metadata && (
                <div className="flex flex-col gap-2.5 px-4 py-4 border-b border-white/[0.06] bg-black">
                  <div className="flex items-center justify-between">
                    {/* Dropdown Menu (Left to / at Title) */}
                    <div className="relative" ref={imageModeDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsImageModeDropdownOpen(!isImageModeDropdownOpen)}
                        className="flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg hover:bg-white/[0.08] text-xs font-bold text-gray-300 hover:text-white uppercase tracking-wider transition-colors cursor-pointer border border-transparent hover:border-white/10"
                        title="Switch between Video Thumbnail and Current Frame"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-zinc-300" />
                        <span>{previewImageMode === 'thumbnail' ? 'Thumbnail' : 'Current Frame'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isImageModeDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isImageModeDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1 w-44 rounded-xl bg-black border border-white/15 shadow-2xl p-1 z-30 flex flex-col gap-0.5 backdrop-blur-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewImageMode('thumbnail');
                              setIsImageModeDropdownOpen(false);
                            }}
                            className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${previewImageMode === 'thumbnail'
                                ? 'bg-white/15 text-white font-bold'
                                : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                              }`}
                          >
                            <span className="flex items-center gap-2">
                              <ImageIcon className="w-3.5 h-3.5 text-zinc-300" />
                              <span>Thumbnail</span>
                            </span>
                            {previewImageMode === 'thumbnail' && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewImageMode('frame');
                              setIsImageModeDropdownOpen(false);
                            }}
                            className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${previewImageMode === 'frame'
                                ? 'bg-white/15 text-white font-bold'
                                : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                              }`}
                          >
                            <span className="flex items-center gap-2">
                              <Film className="w-3.5 h-3.5 text-zinc-300" />
                              <span>Current Frame</span>
                            </span>
                            {previewImageMode === 'frame' && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadImage}
                      disabled={isDownloadingImage}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${downloadSuccess
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                          : isDownloadingImage
                            ? 'bg-white/10 text-gray-400 cursor-not-allowed border border-white/5'
                            : 'text-zinc-200 hover:text-white bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 active:scale-95'
                        }`}
                      title={previewImageMode === 'thumbnail' ? 'Download HD Thumbnail' : `Download Frame at ${formatTime(currentTime)}`}
                    >
                      {isDownloadingImage ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-white" />
                          <span>Downloading...</span>
                        </>
                      ) : downloadSuccess ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" />
                          <span>Saved!</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3 text-zinc-300" />
                          <span>Download</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Image Display / Current Frame Action Card */}
                  {previewImageMode === 'thumbnail' ? (
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black shadow-sm flex items-center justify-center group">
                      <img
                        src={metadata.thumbnail || ''}
                        alt="Thumbnail preview"
                        className="w-full h-full object-cover transition-all duration-300 opacity-100 scale-100"
                      />
                    </div>
                  ) : (
                    <div className="relative w-full rounded-xl p-3.5 border border-white/10 bg-black shadow-sm flex flex-col gap-2 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white">
                            <Film className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white leading-none">Current Video Frame</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">Captures exact on-screen frame</p>
                          </div>
                        </div>
                        <div className="px-2 py-1 rounded-md bg-zinc-950 border border-white/15 text-[11px] font-mono text-white font-bold flex items-center gap-1 shadow-inner">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <span>{formatTime(currentTime, true)}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-tight">
                        Click <span className="text-white font-semibold">Download</span> to instantly capture this exact frame from the video player as a full-resolution PNG.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 space-y-5 bg-black">

                {/* ── 1. Custom Framing & Aspect Ratio ────────────────── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-600 tabular-nums">1.</span>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Crop & Framing</h3>
                    </div>
                    {aspectRatio !== '16:9' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 font-semibold uppercase tracking-wider">
                        {aspectRatio}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: '16:9', label: '16:9', sub: 'Full', icon: RectangleHorizontal },
                      { id: '9:16', label: '9:16', sub: 'Shorts', icon: Smartphone },
                      { id: '1:1', label: '1:1', sub: 'Square', icon: Square },
                      { id: '4:5', label: '4:5', sub: 'Portrait', icon: RectangleVertical },
                      { id: 'custom', label: 'Custom', sub: 'Free', icon: Crop },
                    ].map((r) => {
                      const IconComp = r.icon;
                      const isSelected = aspectRatio === r.id;
                      return (
                        <button
                          key={r.id}
                          onClick={() => applyAspectRatio(r.id as any)}
                          className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 transition-all text-center cursor-pointer ${isSelected
                              ? 'bg-white text-black font-black border-white shadow-md'
                              : 'bg-zinc-950/80 border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                            }`}
                        >
                          <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-black' : 'text-zinc-400'}`} />
                          <span className="text-[10px] font-bold leading-tight">{r.label}</span>
                          <span className="text-[8px] opacity-60 leading-tight truncate w-full">{r.sub}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Interactive Crop Frame Controls & Real-Time Output Preview */}
                  {aspectRatio !== '16:9' && (
                    <div className="space-y-3 p-3 rounded-xl bg-zinc-950/90 border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5">
                          <Crop className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Output Preview</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={centerCropBox}
                            className="px-2 py-1 rounded-md text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white transition-all cursor-pointer border border-white/10"
                            title="Center the crop framing box"
                          >
                            Center
                          </button>
                          <button
                            type="button"
                            onClick={() => applyAspectRatio('16:9')}
                            className="px-2 py-1 rounded-md text-[10px] font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition-all cursor-pointer"
                            title="Reset to full 16:9 frame"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      {/* Live Cropped Output Preview Box */}
                      <div className="w-full bg-black/60 rounded-xl p-2.5 border border-white/10 flex flex-col items-center justify-center gap-2">
                        <div
                          className="relative bg-black rounded-lg overflow-hidden border border-white/20 shadow-xl flex items-center justify-center max-h-[190px] w-auto max-w-full transition-all duration-75 select-none"
                          style={{
                            aspectRatio: `${outputAspectRatioValue}`,
                          }}
                        >
                          <canvas
                            ref={outputCanvasRef}
                            className="w-full h-full object-contain pointer-events-none select-none block"
                          />
                        </div>

                        {/* Ratio & Dimension Info */}
                        <div className="flex items-center justify-between w-full px-1 text-[10px] text-zinc-400 font-mono">
                          <span className="text-purple-300 font-bold">
                            {aspectRatio === 'custom'
                              ? `Ratio: ${outputAspectRatioValue >= 1 ? `${outputAspectRatioValue.toFixed(2)}:1` : `1:${(1 / outputAspectRatioValue).toFixed(2)}`}`
                              : `Ratio: ${aspectRatio}`}
                          </span>
                          <span className="text-zinc-300">
                            {`${Math.round(cropBox.width * 100)}%w × ${Math.round(cropBox.height * 100)}%h`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-white/[0.05]" />

                {/* ── 2. Export Settings (Modular Component) ──────────────── */}
                <ExportFormatSection
                  downloadFormat={downloadFormat as any}
                  setDownloadFormat={setDownloadFormat as any}
                  downloadQuality={downloadQuality}
                  setDownloadQuality={handleSetDownloadQuality}
                  downloadAudioBitrate={downloadAudioBitrate as any}
                  setDownloadAudioBitrate={setDownloadAudioBitrate as any}
                  captionFormat={captionFormat}
                  setCaptionFormat={setCaptionFormat}
                  captionLang={captionLang}
                  setCaptionLang={setCaptionLang}
                  availableQualities={qualityOptions}
                  detectedMaxHeight={qualityOptions.length > 0 ? qualityOptions[0].height : undefined}
                />

                <div className="h-px bg-white/[0.05]" />

                {/* ── 3. Export Mode & Storage ────────────────────────── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-600 tabular-nums">3.</span>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Export Mode & Storage</h3>
                    </div>
                  </div>

                  {/* File Name input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">File Name</label>
                    <input
                      type="text"
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      placeholder={metadata?.title || 'ClipFlow_Output'}
                      className="w-full bg-black/40 border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 font-medium transition-colors"
                    />
                  </div>

                  {/* Active Processing Engine Status Indicator */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Processing Engine</label>
                    {isProUser ? (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-xs font-semibold text-purple-200">Dedicated Cloud Server</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold border border-purple-500/30">
                          PRO Active
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="text-xs font-semibold text-zinc-300">Local Companion Engine</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isHelperRunning ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'}`}>
                          {isHelperRunning ? '● Connected' : 'Local Mode'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* ── Sticky Export Button ─────────────────────────────────── */}
            <div className="border-t border-white/[0.06] p-4 space-y-2.5 shrink-0 bg-[#080808]">

              {/* Status message */}
              {statusMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`px-3 py-2 rounded-lg text-[11px] flex items-center justify-between gap-2 border ${downloadStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' :
                      downloadStatus === 'error' ? 'bg-red-500/10 border-red-500/25 text-red-300' :
                        'bg-purple-500/10 border-purple-500/25 text-purple-300'
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {downloadStatus === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> :
                      downloadStatus === 'error' ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> :
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />}
                    <span className="truncate">{statusMessage}</span>
                  </div>

                  {downloadStatus === 'success' && exportMode === 'pro' && (
                    <button
                      onClick={() => navigate('/editor/storage')}
                      className="flex items-center gap-1 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-500 px-2 py-1 rounded-md shrink-0 transition-colors"
                    >
                      <Cloud className="w-3 h-3" />
                      <span>View in Storage</span>
                    </button>
                  )}
                </motion.div>
              )}

              <button
                onClick={handleExportDownload}
                disabled={isDownloading || !metadata}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                {isDownloading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                    <span>
                      {exportMode === 'pro'
                        ? 'Saving to Pro Cloud...'
                        : 'Downloading...'}
                    </span>
                  </>
                ) : (
                  <>
                    {exportMode === 'pro' ? (
                      <Cloud className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                    ) : (
                      <HardDrive className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                    )}
                    <span>
                      {exportMode === 'pro'
                        ? (isPro ? 'Save to Cloud' : 'Upgrade to PRO')
                        : 'Download'}
                      {formatBytes(estimatedBytes) ? ` (${formatBytes(estimatedBytes)})` : ''}
                    </span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* ══ Auth Modal ═══════════════════════════════════════════════════════ */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* ══ Cloud Storage Modal ══════════════════════════════════════════════ */}
      <CloudStorageModal
        isOpen={showCloudStorageModal}
        onClose={() => setShowCloudStorageModal(false)}
      />

      {/* ══ Desktop Companion Engine Modal ═══════════════════════════════════ */}
      <AnimatePresence>
        {showCompanionModal && (
          <div
            onClick={() => setShowCompanionModal(false)}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-[#09090b] border border-white/15 rounded-xl shadow-2xl overflow-hidden text-white p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                    <HardDrive className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">ClipFlow Desktop Engine</h3>
                    <span className="text-[11px] text-zinc-400">Local Processing Companion</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowCompanionModal(false)}
                  className="p-1 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Download and run the lightweight ClipFlow Desktop Companion to enable blazing-fast, unlimited local clipping on your PC directly from your browser.
              </p>

              <div className="p-3 bg-black/60 rounded-lg border border-white/10 space-y-1.5 text-xs text-zinc-300">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Port 18942 background bridge</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Built-in local ffmpeg & yt-dlp acceleration</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>No server bandwidth limits</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <a
                  href="/download/ClipFlow-Desktop-Companion.exe"
                  download
                  onClick={() => setShowCompanionModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-white text-black hover:bg-zinc-200 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download for Windows</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
