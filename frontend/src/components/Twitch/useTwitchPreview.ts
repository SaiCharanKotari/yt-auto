import { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ||
  ((typeof window !== 'undefined' && window.location.port !== '5173')
    ? window.location.origin
    : 'http://localhost:3001');

export interface TwitchStreamInfo {
  twitchHlsUrl: string;
  sourceType: 'dvr' | 'live' | 'vod' | 'clip' | '';
  vodId?: string;
  channel?: string;
  isLoadingStream: boolean;
  streamError: string;
  refreshStream: () => void;
  forceRefreshStream: () => void;
  // Kept for backwards-compatibility with existing editor callers
  isTwitchLiveChannel: boolean;
  twitchLiveSegmentUrl: string;
  refreshLiveSegment: () => void;
}

export function useTwitchPreview(
  isTwitch: boolean,
  activeUrl: string,
  metadata: any,
  _isPro: boolean = false,
  quality?: string
): TwitchStreamInfo {
  const [twitchHlsUrl, setTwitchHlsUrl] = useState<string>('');
  const [sourceType, setSourceType] = useState<'dvr' | 'live' | 'vod' | 'clip' | ''>('');
  const [vodId, setVodId] = useState<string | undefined>(undefined);
  const [channel, setChannel] = useState<string | undefined>(undefined);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if exact match for live channel (e.g. twitch.tv/channel_name)
  const isTwitchLiveChannel = Boolean(
    isTwitch &&
    /twitch\.tv\/([a-zA-Z0-9_]+)\/?$/i.test(activeUrl) &&
    !activeUrl.includes('/videos') &&
    !activeUrl.includes('/clip')
  );

  const fetchTwitchStream = useCallback(async (forceRefresh = false) => {
    if (!isTwitch || !activeUrl) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const targetUrl = metadata?.webpage_url || activeUrl;
    setIsLoadingStream(true);
    setStreamError('');

    console.log('%c[Twitch HLS Preview 📺 RESOLVING STREAM INFO]', 'color: #a855f7; font-weight: bold;', {
      activeUrl,
      targetUrl,
      isTwitchLiveChannel,
      quality,
      forceRefresh,
    });

    try {
      const qualityParam = quality ? `&quality=${encodeURIComponent(quality)}` : '';
      const refreshParam = forceRefresh ? '&forceRefresh=true' : '';
      const endpoint = `${BACKEND_URL}/api/twitch-live/stream-info?url=${encodeURIComponent(targetUrl)}${qualityParam}${refreshParam}`;
      const res = await fetch(endpoint, { signal: abortController.signal });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log('%c[Twitch HLS Preview ✅ STREAM INFO RECEIVED]', 'color: #22c55e; font-weight: bold;', data);

      if (data.streamUrl) {
        setTwitchHlsUrl(data.streamUrl);
        setSourceType(data.sourceType || (isTwitchLiveChannel ? 'dvr' : 'vod'));
        setVodId(data.vodId);
        setChannel(data.channel);
        setIsLoadingStream(false);
      } else {
        throw new Error('Stream URL missing from stream-info response');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('%c[Twitch HLS Preview ❌ ERROR FETCHING STREAM INFO]', 'color: #ef4444; font-weight: bold;', err);
      setStreamError(err.message || 'Failed to resolve Twitch stream');
      setIsLoadingStream(false);
    }
  }, [isTwitch, activeUrl, metadata?.webpage_url, isTwitchLiveChannel, quality]);

  useEffect(() => {
    if (!isTwitch) {
      setTwitchHlsUrl('');
      setSourceType('');
      setVodId(undefined);
      setChannel(undefined);
      setIsLoadingStream(false);
      setStreamError('');
      return;
    }

    fetchTwitchStream();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isTwitch, activeUrl, fetchTwitchStream]);

  return {
    twitchHlsUrl,
    sourceType,
    vodId,
    channel,
    isLoadingStream,
    streamError,
    refreshStream: () => fetchTwitchStream(false),
    forceRefreshStream: () => fetchTwitchStream(true),
    isTwitchLiveChannel,
    twitchLiveSegmentUrl: twitchHlsUrl,
    refreshLiveSegment: () => fetchTwitchStream(false),
  };
}
