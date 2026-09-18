import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    Twitch?: {
      Player: any;
    };
  }
}

interface TwitchPlayerProps {
  channel?: string | null;
  videoId?: string | null;
  clipId?: string | null;
  currentTime?: number;
  isPlaying?: boolean;
  isMuted?: boolean;
  onReady?: (player: any) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}

export function TwitchPlayer({
  channel,
  videoId,
  clipId,
  currentTime,
  isPlaying,
  isMuted,
  onReady,
  onPlay,
  onPause,
  onTimeUpdate,
  onDurationChange,
}: TwitchPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const containerId = useRef(`twitch-player-${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    let isMounted = true;

    // Load Twitch Embed Script if not present
    const loadScript = () => {
      return new Promise<void>((resolve) => {
        if (window.Twitch && window.Twitch.Player) {
          resolve();
          return;
        }
        const existing = document.querySelector('script[src="https://player.twitch.tv/js/embed/v1.js"]');
        if (existing) {
          existing.addEventListener('load', () => resolve());
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://player.twitch.tv/js/embed/v1.js';
        script.async = true;
        script.onload = () => resolve();
        document.body.appendChild(script);
      });
    };

    loadScript().then(() => {
      if (!isMounted || !containerRef.current) return;

      const parentHost = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';

      // Clean up previous player
      if (playerRef.current) {
        try {
          if (containerRef.current) containerRef.current.innerHTML = '';
        } catch {}
      }

      // If it's a clip, render clip iframe
      if (clipId) {
        return;
      }

      const hosts = Array.from(new Set(['localhost', '127.0.0.1', parentHost].filter(Boolean)));

      const options: any = {
        width: '100%',
        height: '100%',
        parent: hosts,
        autoplay: true,
        muted: Boolean(isMuted),
        controls: false, // We use custom ClipFlow timeline controls
      };

      if (videoId) {
        options.video = videoId;
        if (currentTime && currentTime > 0) {
          options.time = `${Math.floor(currentTime)}s`;
        }
      } else if (channel) {
        options.channel = channel;
      }

      try {
        const player = new window.Twitch!.Player(containerRef.current, options);
        playerRef.current = player;

        player.addEventListener(window.Twitch!.Player.READY, () => {
          if (!isMounted) return;
          if (onReady) onReady(player);

          const dur = player.getDuration ? player.getDuration() : 0;
          if (dur > 0 && onDurationChange) {
            onDurationChange(dur);
          }

          if (currentTime && currentTime > 0 && player.seek) {
            player.seek(currentTime);
          }
        });

        player.addEventListener(window.Twitch!.Player.PLAY, () => {
          if (onPlay) onPlay();
        });

        player.addEventListener(window.Twitch!.Player.PAUSE, () => {
          if (onPause) onPause();
        });

        // Time polling
        intervalRef.current = setInterval(() => {
          if (playerRef.current && onTimeUpdate) {
            try {
              const cur = playerRef.current.getCurrentTime();
              if (cur != null && cur >= 0) {
                onTimeUpdate(cur);
              }
              const dur = playerRef.current.getDuration();
              if (dur && dur > 0 && onDurationChange) {
                onDurationChange(dur);
              }
            } catch {}
          }
        }, 500);
      } catch (err) {
        console.warn('[TwitchPlayer] Error initializing Twitch.Player:', err);
      }
    });

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (containerRef.current) containerRef.current.innerHTML = '';
      playerRef.current = null;
    };
  }, [channel, videoId, clipId]);

  // Sync isMuted
  useEffect(() => {
    if (playerRef.current && playerRef.current.setMuted) {
      playerRef.current.setMuted(Boolean(isMuted));
    }
  }, [isMuted]);

  // Sync isPlaying
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying && playerRef.current.play) {
        playerRef.current.play();
      } else if (!isPlaying && playerRef.current.pause) {
        playerRef.current.pause();
      }
    } catch {}
  }, [isPlaying]);

  if (clipId) {
    const parentHost = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
    return (
      <div className="w-full h-full flex items-center justify-center bg-black pointer-events-auto">
        <iframe
          src={`https://clips.twitch.tv/embed?clip=${clipId}&parent=${parentHost}&autoplay=true&muted=${Boolean(isMuted)}`}
          title="Twitch Clip Preview"
          className="w-full h-full border-0 pointer-events-auto"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div
      id={containerId.current}
      ref={containerRef}
      className="w-full h-full flex items-center justify-center bg-black pointer-events-auto"
    />
  );
}
