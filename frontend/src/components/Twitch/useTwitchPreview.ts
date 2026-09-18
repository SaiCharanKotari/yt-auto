import { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ||
  ((typeof window !== 'undefined' && window.location.port !== '5173')
    ? window.location.origin
    : 'http://localhost:3001');

export function useTwitchPreview(
  isTwitch: boolean,
  activeUrl: string,
  metadata: any,
  _isPro: boolean = false
) {
  const [twitchHlsUrl, setTwitchHlsUrl] = useState<string>('');
  const [twitchLiveSegmentUrl, setTwitchLiveSegmentUrl] = useState<string>('');
  
  // Check if exact match for live channel (e.g. twitch.tv/channel_name)
  const isTwitchLiveChannel = Boolean(
    isTwitch &&
    /twitch\.tv\/([a-zA-Z0-9_]+)\/?$/i.test(activeUrl) &&
    !activeUrl.includes('/videos') &&
    !activeUrl.includes('/clip')
  );

  const fetchTwitchStream = useCallback(async () => {
    if (!isTwitch || !activeUrl || isTwitchLiveChannel) return;

    const targetUrl = metadata?.webpage_url || activeUrl;
    console.log('%c[Twitch Preview 📺 REQUESTING STREAM]', 'color: #a855f7; font-weight: bold;', {
      activeUrl,
      targetUrl,
      metadataWebpageUrl: metadata?.webpage_url,
    });

    try {
      const res = await fetch(`${BACKEND_URL}/api/twitch/twitch-vod-stream?url=${encodeURIComponent(targetUrl)}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      const data = await res.json();
      console.log('%c[Twitch Preview 📺 STREAM DATA RECEIVED]', 'color: #22c55e; font-weight: bold;', data);
      if (data.hlsProxyUrl) {
        console.log('%c[Twitch Preview 📺 SETTING HLS URL]', 'color: #22c55e; font-weight: bold;', data.hlsProxyUrl);
        setTwitchHlsUrl(data.hlsProxyUrl);
        setTwitchLiveSegmentUrl(data.hlsProxyUrl);
      } else {
        console.warn('[Twitch Preview ⚠️] Response missing hlsProxyUrl:', data);
      }
    } catch (err: any) {
      console.error('%c[Twitch Preview ❌ ERROR FETCHING STREAM]', 'color: #ef4444; font-weight: bold;', err);
      // If targetUrl was metadata?.webpage_url and failed, retry with activeUrl directly
      if (targetUrl !== activeUrl) {
        try {
          console.log('%c[Twitch Preview 🔄 RETRYING WITH ACTIVE URL]', 'color: #38bdf8; font-weight: bold;', { activeUrl });
          const res2 = await fetch(`${BACKEND_URL}/api/twitch/twitch-vod-stream?url=${encodeURIComponent(activeUrl)}`);
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2.hlsProxyUrl) {
              console.log('%c[Twitch Preview 📺 RETRY STREAM READY]', 'color: #22c55e; font-weight: bold;', data2.hlsProxyUrl);
              setTwitchHlsUrl(data2.hlsProxyUrl);
              setTwitchLiveSegmentUrl(data2.hlsProxyUrl);
            }
          }
        } catch (retryErr) {
          console.error('[Twitch Preview ❌ RETRY FAILED]', retryErr);
        }
      }
    }
  }, [isTwitch, activeUrl, metadata?.webpage_url, isTwitchLiveChannel]);

  useEffect(() => {
    if (!isTwitch) {
      setTwitchHlsUrl('');
      setTwitchLiveSegmentUrl('');
      return;
    }

    fetchTwitchStream();
  }, [isTwitch, activeUrl, fetchTwitchStream]);

  return {
    twitchHlsUrl,
    twitchLiveSegmentUrl,
    isTwitchLiveChannel,
    refreshLiveSegment: fetchTwitchStream
  };
}
