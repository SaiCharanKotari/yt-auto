/**
 * useTwitchLiveChannel
 *
 * Hook exclusively for Twitch live channel URLs (twitch.tv/username).
 * Loads preview as 10-second 720p MP4 chunks for fast scrubbing and playback.
 * When user seeks to any position, cancels previous in-flight request and requests
 * the next 10-second chunk starting from the user's selected point.
 *
 * Server endpoint: /api/twitch-live/live-chunk
 * Local daemon:    http://127.0.0.1:18942/twitch/live-segment
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  saveTwitchChunkToStorage,
  getTwitchChunkFromStorage,
  getAllCachedTwitchOffsets,
  getTwitchSession,
} from '../../utils/twitchChunkStorage';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ||
  ((typeof window !== 'undefined' && window.location.port !== '5173')
    ? window.location.origin
    : 'http://localhost:3001');

const LOCAL_DAEMON_URL = 'http://127.0.0.1:18942';
export const CHUNK_DURATION = 5; // 5 seconds per chunk for ~4.5s fast response time

/** Returns true if URL is a Twitch live channel (not a VOD or clip) */
export function isTwitchLiveChannelUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.trim().replace(/\/$/, '');
  return (
    /twitch\.tv\/([a-zA-Z0-9_]+)$/i.test(clean) &&
    !clean.includes('/videos') &&
    !clean.includes('/clip')
  );
}

export interface ChunkItem {
  offset: number;
  url: string;
  isReady: boolean;
}

export interface TwitchLiveChannelState {
  /** The blob/object URL of the current MP4 chunk */
  chunkUrl: string;
  /** The blob/object URL of the next MP4 chunk */
  nextChunkUrl: string;
  /** Whether the required active chunk is currently being fetched */
  isLoadingChunk: boolean;
  /** Error message if chunk fetch failed */
  chunkError: string;
  /** The global time offset (seconds) the current chunk starts at */
  chunkStartOffset: number;
  /** Array of chunk offsets stored locally in IndexedDB */
  cachedOffsets: number[];
  /** Get a chunk URL by explicit offset (from cache or network) */
  getChunk: (targetOffset: number, signal?: AbortSignal) => Promise<string>;
  /** Check if a chunk is already cached */
  hasChunk: (targetOffset: number) => boolean;
  /** Get cached URL directly if available */
  getCachedChunk: (targetOffset: number) => string | undefined;
  /** Background prefetch for a specific offset */
  prefetchChunk: (targetOffset: number) => void;
  /** Fetch a specific chunk on-demand for manual seek */
  fetchChunkForSeek: (targetOffset: number, signal?: AbortSignal) => Promise<string>;
  /** Update active chunk offset and url after seek completes */
  setLiveChunkState: (offset: number, url: string) => void;
  /** Call this to request the next chunk starting at a given offset */
  loadChunk: (startOffset: number, isManualSeek?: boolean) => void;
  /** Seamlessly advance state to the next chunk */
  advanceToNextChunk: () => void;
  /** Notify the hook of current playback seconds within chunk to trigger look-ahead prefetch */
  notifyPlaybackProgress: (localSeconds: number) => void;
  /** Reload the current chunk */
  retryChunk: () => void;
}

export function useTwitchLiveChannel(
  isActive: boolean,
  channelUrl: string,
  processingMode: 'free' | 'pro' | boolean,
  _isDaemonRunning?: boolean
): TwitchLiveChannelState {
  const isPro = processingMode === 'pro' || processingMode === true;
  const [chunkUrl, setChunkUrl] = useState('');
  const [nextChunkUrl, setNextChunkUrl] = useState('');
  const [isLoadingChunk, setIsLoadingChunk] = useState(false);
  const [chunkError, setChunkError] = useState('');
  const [chunkStartOffset, setChunkStartOffset] = useState(0);
  const [cachedOffsets, setCachedOffsets] = useState<number[]>([]);

  // Cache of prefetched chunks keyed by start timestamp in seconds: Map<offset, blobUrl>
  const chunkCacheRef = useRef<Map<number, string>>(new Map());
  // Track in-flight promises to prevent duplicate requests and allow joining
  const inFlightRequestsRef = useRef<Map<number, Promise<string>>>(new Map());
  // Active main abort controller for user seeks
  const currentSeekAbortRef = useRef<AbortController | null>(null);
  // Store the active offset being played/displayed
  const currentOffsetRef = useRef<number>(0);
  // Track transition locks to avoid double loading
  const isTransitioningRef = useRef<boolean>(false);

  // Helper to safely clean up all cached blob URLs
  const clearCache = useCallback(() => {
    chunkCacheRef.current.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch {}
    });
    chunkCacheRef.current.clear();
  }, []);

  // Helper to fetch a specific 5-second chunk blob (with IndexedDB persistent caching)
  const fetchSingleChunk = useCallback(async (
    targetOffset: number,
    signal?: AbortSignal
  ): Promise<string> => {
    // 1. Check in-memory cache
    const existing = chunkCacheRef.current.get(targetOffset);
    if (existing) {
      return existing;
    }

    // 2. Check if already being fetched in-flight
    const existingInFlight = inFlightRequestsRef.current.get(targetOffset);
    if (existingInFlight) {
      return existingInFlight;
    }

    const promise = (async () => {
      // 3. Check persistent IndexedDB local storage before making any network/daemon call
      try {
        const storedBlob = await getTwitchChunkFromStorage(channelUrl, targetOffset);
        if (storedBlob && storedBlob.size > 0) {
          const localUrl = URL.createObjectURL(storedBlob);
          chunkCacheRef.current.set(targetOffset, localUrl);
          setCachedOffsets((prev) => Array.from(new Set([...prev, targetOffset])).sort((a, b) => a - b));
          console.log(`%c[ClipFlow ⚡ INSTANT LOCAL CHUNK] Loaded chunk @ t=${targetOffset}s from IndexedDB (${(storedBlob.size / 1024).toFixed(1)} KB)`, 'color: #10b981; font-weight: bold;');
          return localUrl;
        }
      } catch (e) {
        console.warn('[Twitch Live] IndexedDB lookup error:', e);
      }

      const encodedUrl = encodeURIComponent(channelUrl);

      let res: Response;
      if (isPro) {
        // PRO USER: Browser → ClipFlow backend → Twitch → yt-dlp/Twitch resolver → FFmpeg → chunk → Browser
        const serverEndpoint = `${BACKEND_URL}/api/twitch-live/live-chunk?url=${encodedUrl}&t=${targetOffset}&dur=${CHUNK_DURATION}`;
        console.log('%c[ClipFlow] Twitch Processing Mode: PRO', 'color: #a855f7; font-weight: bold;');
        console.log('%c[ClipFlow] Twitch Chunk Source: SERVER', 'color: #a855f7; font-weight: bold;');
        console.log(`%c[ClipFlow] Requesting server chunk @ t=${targetOffset}s`, 'color: #a855f7;', serverEndpoint);
        res = await fetch(serverEndpoint, { signal });
        if (!res.ok) {
          const errText = await res.text().catch(() => String(res.status));
          throw new Error(`Server Error (${res.status}): ${errText.substring(0, 100)}`);
        }
      } else {
        // FREE USER: Browser → Desktop Helper App (127.0.0.1:18942) → Twitch → yt-dlp/Twitch resolver → FFmpeg → chunk → Browser
        const daemonEndpoint = `${LOCAL_DAEMON_URL}/twitch/live-segment?url=${encodedUrl}&t=${targetOffset}&dur=${CHUNK_DURATION}`;
        console.log('%c[ClipFlow] Twitch Processing Mode: FREE', 'color: #22c55e; font-weight: bold;');
        console.log('%c[ClipFlow] Twitch Chunk Source: LOCAL_HELPER', 'color: #22c55e; font-weight: bold;');
        console.log(`%c[ClipFlow] Requesting local chunk @ t=${targetOffset}s`, 'color: #22c55e;', daemonEndpoint);
        try {
          res = await fetch(daemonEndpoint, { signal });
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError') throw fetchErr;
          throw new Error('Desktop Helper App (port 18942) is required for free live Twitch preview. Please launch the Desktop Helper.');
        }
        if (!res.ok) {
          const errText = await res.text().catch(() => String(res.status));
          throw new Error(`Desktop Helper Error (${res.status}): ${errText.substring(0, 100)}`);
        }
      }

      const blob = await res.blob();
      if (blob.size === 0) throw new Error('Received empty chunk');

      const objectUrl = URL.createObjectURL(blob);
      chunkCacheRef.current.set(targetOffset, objectUrl);

      // Persist chunk to IndexedDB so user can scrub back or reload without refetching!
      saveTwitchChunkToStorage(channelUrl, targetOffset, blob).then(() => {
        setCachedOffsets((prev) => Array.from(new Set([...prev, targetOffset])).sort((a, b) => a - b));
      }).catch(() => {});

      // Limit memory cache size to 32 chunks, evicting oldest non-active object URLs
      if (chunkCacheRef.current.size > 32) {
        const oldestKey = Array.from(chunkCacheRef.current.keys())[0];
        if (oldestKey !== currentOffsetRef.current && oldestKey !== targetOffset && oldestKey !== currentOffsetRef.current + CHUNK_DURATION) {
          const oldUrl = chunkCacheRef.current.get(oldestKey);
          if (oldUrl) {
            try { URL.revokeObjectURL(oldUrl); } catch {}
          }
          chunkCacheRef.current.delete(oldestKey);
        }
      }

      return objectUrl;
    })();

    inFlightRequestsRef.current.set(targetOffset, promise);

    try {
      const url = await promise;
      return url;
    } finally {
      inFlightRequestsRef.current.delete(targetOffset);
    }
  }, [channelUrl, isPro]);

  const hasChunk = useCallback((targetOffset: number): boolean => {
    return chunkCacheRef.current.has(targetOffset);
  }, []);

  const getCachedChunk = useCallback((targetOffset: number): string | undefined => {
    return chunkCacheRef.current.get(targetOffset);
  }, []);

  const prefetchChunk = useCallback((targetOffset: number) => {
    if (!isActive || !channelUrl) return;
    if (chunkCacheRef.current.has(targetOffset) || inFlightRequestsRef.current.has(targetOffset)) return;
    fetchSingleChunk(targetOffset).catch(() => {});
  }, [isActive, channelUrl, fetchSingleChunk]);

  // Pipeline Prefetching: proactively fetch next1 (offset + 5) and next2 (offset + 10) in parallel
  const prefetchUpcomingChunks = useCallback((fromOffset: number) => {
    if (!isActive || !channelUrl) return;

    const next1 = fromOffset + CHUNK_DURATION;
    const next2 = fromOffset + CHUNK_DURATION * 2;
    const next3 = fromOffset + CHUNK_DURATION * 3;

    // Start fetching next1 immediately
    const cachedNext1 = chunkCacheRef.current.get(next1);
    if (cachedNext1) {
      if (currentOffsetRef.current === fromOffset) {
        setNextChunkUrl(cachedNext1);
      }
      // If next1 is already ready, make sure next2 is being fetched
      if (!chunkCacheRef.current.has(next2) && !inFlightRequestsRef.current.has(next2)) {
        fetchSingleChunk(next2).catch(() => {});
      }
    } else {
      fetchSingleChunk(next1)
        .then((url) => {
          if (currentOffsetRef.current === fromOffset) {
            setNextChunkUrl(url);
          }
          // After next1 completes, trigger next3 to keep buffer deep
          if (!chunkCacheRef.current.has(next3) && !inFlightRequestsRef.current.has(next3)) {
            fetchSingleChunk(next3).catch(() => {});
          }
        })
        .catch(() => {});

      // Concurrently fetch next2 so that when next1 finishes playing, next2 is ALREADY decoded!
      if (!chunkCacheRef.current.has(next2) && !inFlightRequestsRef.current.has(next2)) {
        fetchSingleChunk(next2).catch(() => {});
      }
    }
  }, [isActive, channelUrl, fetchSingleChunk]);

  // Main loader: user seeks or chunk transition
  const loadChunk = useCallback(async (startOffset: number, isManualSeek: boolean = false) => {
    if (!isActive || !channelUrl) return;

    if (isManualSeek) {
      isTransitioningRef.current = false;
      console.log('[TwitchLive 🎯 MANUAL SEEK]', { targetOffset: startOffset });
    } else if (isTransitioningRef.current && currentOffsetRef.current === startOffset) {
      return;
    }

    isTransitioningRef.current = true;
    currentOffsetRef.current = startOffset;
    setNextChunkUrl('');

    // 1. If chunk is already ready in prefetch cache -> Instant switch!
    const cachedUrl = chunkCacheRef.current.get(startOffset);
    if (cachedUrl) {
      console.log(`[TwitchLive ⚡ INSTANT SWAP] Transition to t=${startOffset}s`);
      setChunkUrl(cachedUrl);
      setChunkStartOffset(startOffset);
      setIsLoadingChunk(false);
      setChunkError('');
      isTransitioningRef.current = false;
      prefetchUpcomingChunks(startOffset);
      return;
    }

    // 2. Otherwise cancel previous seek controller
    if (currentSeekAbortRef.current) {
      currentSeekAbortRef.current.abort();
    }
    const controller = new AbortController();
    currentSeekAbortRef.current = controller;

    setIsLoadingChunk(true);
    setChunkError('');

    try {
      console.log(`[TwitchLive] Loading chunk at t=${startOffset}s...`);
      const urlPromise = fetchSingleChunk(startOffset, controller.signal);
      prefetchUpcomingChunks(startOffset);

      const url = await urlPromise;
      if (currentOffsetRef.current === startOffset) {
        setChunkUrl(url);
        setChunkStartOffset(startOffset);
        setIsLoadingChunk(false);
        setChunkError('');
        console.log(`[TwitchLive ✅] Chunk ready at t=${startOffset}s`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[TwitchLive Error]', err.message);
      if (currentOffsetRef.current === startOffset) {
        setChunkError(err.message || 'Failed to load live preview chunk');
        setIsLoadingChunk(false);
      }
    } finally {
      isTransitioningRef.current = false;
    }
  }, [isActive, channelUrl, fetchSingleChunk, prefetchUpcomingChunks]);

  const fetchChunkForSeek = useCallback(async (targetOffset: number, signal?: AbortSignal): Promise<string> => {
    const cached = chunkCacheRef.current.get(targetOffset);
    if (cached) return cached;
    return await fetchSingleChunk(targetOffset, signal);
  }, [fetchSingleChunk]);

  const setLiveChunkState = useCallback((offset: number, url: string) => {
    currentOffsetRef.current = offset;
    setChunkStartOffset(offset);
    setChunkUrl(url);
    setNextChunkUrl('');
    prefetchUpcomingChunks(offset);
  }, [prefetchUpcomingChunks]);

  const advanceToNextChunk = useCallback(() => {
    const nextOffset = currentOffsetRef.current + CHUNK_DURATION;
    currentOffsetRef.current = nextOffset;
    setChunkStartOffset(nextOffset);

    const cachedNext = chunkCacheRef.current.get(nextOffset);
    if (cachedNext) {
      setChunkUrl(cachedNext);
    }

    setNextChunkUrl('');
    prefetchUpcomingChunks(nextOffset);
  }, [prefetchUpcomingChunks]);

  const notifyPlaybackProgress = useCallback((localSeconds: number) => {
    if (localSeconds >= 0.5) {
      prefetchUpcomingChunks(currentOffsetRef.current);
    }
  }, [prefetchUpcomingChunks]);

  // Initial load: restore saved progress position and load cached offsets from IndexedDB
  useEffect(() => {
    if (!isActive || !channelUrl) {
      clearCache();
      setChunkUrl('');
      setNextChunkUrl('');
      setChunkStartOffset(0);
      setChunkError('');
      setCachedOffsets([]);
      return;
    }

    // Retrieve saved progress line offset from local storage
    const saved = getTwitchSession(channelUrl);
    const initialOffset = (saved && saved.currentTime > 0)
      ? Math.floor(saved.currentTime / CHUNK_DURATION) * CHUNK_DURATION
      : 0;

    // Load list of all cached chunk offsets in IndexedDB for visual progress line indicators
    getAllCachedTwitchOffsets(channelUrl).then((offsets) => {
      setCachedOffsets(offsets);
    }).catch(() => {});

    loadChunk(initialOffset);
  }, [isActive, channelUrl, loadChunk, clearCache]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      clearCache();
    };
  }, [clearCache]);

  return {
    chunkUrl,
    nextChunkUrl,
    isLoadingChunk,
    chunkError,
    chunkStartOffset,
    cachedOffsets,
    getChunk: fetchSingleChunk,
    hasChunk,
    getCachedChunk,
    prefetchChunk,
    fetchChunkForSeek,
    setLiveChunkState,
    loadChunk,
    advanceToNextChunk,
    notifyPlaybackProgress,
    retryChunk: () => loadChunk(chunkStartOffset, true),
  };
}

