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

export interface TwitchLiveChannelState {
  /** The blob/object URL of the current MP4 chunk, ready to assign to <video src> */
  chunkUrl: string;
  /** Whether a chunk is currently being fetched from server/daemon */
  isLoadingChunk: boolean;
  /** Error message if the last chunk fetch failed */
  chunkError: string;
  /** The global time offset (seconds) this chunk starts at */
  chunkStartOffset: number;
  /** Call this to request the next chunk starting at a given offset */
  loadChunk: (startOffset: number, isManualSeek?: boolean) => void;
  /** Notify the hook of current playback seconds within chunk to trigger look-ahead prefetch */
  notifyPlaybackProgress: (localSeconds: number) => void;
  /** Reload the current chunk (e.g. on user retry) */
  retryChunk: () => void;
}

export function useTwitchLiveChannel(
  isActive: boolean,
  channelUrl: string,
  _isPro: boolean,
  isDaemonRunning: boolean
): TwitchLiveChannelState {
  const [chunkUrl, setChunkUrl] = useState('');
  const [isLoadingChunk, setIsLoadingChunk] = useState(false);
  const [chunkError, setChunkError] = useState('');
  const [chunkStartOffset, setChunkStartOffset] = useState(0);

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

  // Helper to fetch a specific 5-second chunk blob
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
      const encodedUrl = encodeURIComponent(channelUrl);
      const serverEndpoint = `${BACKEND_URL}/api/twitch-live/live-chunk?url=${encodedUrl}&t=${targetOffset}&dur=${CHUNK_DURATION}`;
      const daemonEndpoint = `${LOCAL_DAEMON_URL}/twitch/live-segment?url=${encodedUrl}&t=${targetOffset}&dur=${CHUNK_DURATION}`;

      let res: Response | null = null;
      try {
        res = await fetch(serverEndpoint, { signal });
      } catch (netErr: any) {
        if (netErr.name === 'AbortError') throw netErr;
        if (isDaemonRunning) {
          res = await fetch(daemonEndpoint, { signal });
        } else {
          throw netErr;
        }
      }

      if (!res.ok && isDaemonRunning && res.status >= 500) {
        try {
          res = await fetch(daemonEndpoint, { signal });
        } catch {}
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => String(res.status));
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 100)}`);
      }

      const blob = await res.blob();
      if (blob.size === 0) throw new Error('Received empty chunk');

      const objectUrl = URL.createObjectURL(blob);
      chunkCacheRef.current.set(targetOffset, objectUrl);

      // Limit cache size to 8 chunks (40 seconds of video), evicting oldest non-active
      if (chunkCacheRef.current.size > 8) {
        const oldestKey = Array.from(chunkCacheRef.current.keys())[0];
        if (oldestKey !== currentOffsetRef.current && oldestKey !== targetOffset) {
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
  }, [channelUrl, isDaemonRunning]);

  // Background Prefetching: immediately fetch next 1-2 chunks ahead
  const prefetchUpcomingChunks = useCallback((fromOffset: number) => {
    if (!isActive || !channelUrl) return;

    const next1 = fromOffset + CHUNK_DURATION;
    const next2 = fromOffset + CHUNK_DURATION * 2;

    if (!chunkCacheRef.current.has(next1) && !inFlightRequestsRef.current.has(next1)) {
      console.log(`[TwitchLive ⚡ PREFETCH] Queuing next chunk at t=${next1}s`);
      fetchSingleChunk(next1).catch(() => {});
    }

    if (!chunkCacheRef.current.has(next2) && !inFlightRequestsRef.current.has(next2)) {
      fetchSingleChunk(next2).catch(() => {});
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

    // 1. If chunk is already ready in prefetch cache -> Instant 0ms switch!
    const cachedUrl = chunkCacheRef.current.get(startOffset);
    if (cachedUrl) {
      console.log(`[TwitchLive ⚡ ZERO-LATENCY SWAP] Instant transition to t=${startOffset}s!`);
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

  const notifyPlaybackProgress = useCallback((localSeconds: number) => {
    if (localSeconds >= 1.5) {
      prefetchUpcomingChunks(currentOffsetRef.current);
    }
  }, [prefetchUpcomingChunks]);

  // Initial load
  useEffect(() => {
    if (!isActive || !channelUrl) {
      clearCache();
      setChunkUrl('');
      setChunkStartOffset(0);
      setChunkError('');
      return;
    }
    loadChunk(0);
  }, [isActive, channelUrl, loadChunk, clearCache]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      clearCache();
    };
  }, [clearCache]);

  return {
    chunkUrl,
    isLoadingChunk,
    chunkError,
    chunkStartOffset,
    loadChunk,
    notifyPlaybackProgress,
    retryChunk: () => loadChunk(chunkStartOffset, true),
  };
}
