export type ProcessingMode = 'free' | 'pro';

export const PROCESSING_MODE_STORAGE_KEY = 'clipflow_processing_mode';

export function setStoredProcessingMode(mode: ProcessingMode) {
  try {
    sessionStorage.setItem(PROCESSING_MODE_STORAGE_KEY, mode);
  } catch {}
}

export function getStoredProcessingMode(): ProcessingMode | null {
  try {
    const stored = sessionStorage.getItem(PROCESSING_MODE_STORAGE_KEY);
    if (stored === 'free' || stored === 'pro') return stored;
    return null;
  } catch {
    return null;
  }
}

export interface EditorSessionState {
  activeUrl: string;
  metadata: any;
  currentTime: number;
  trimRange: [number, number];
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | 'custom';
  cropBox: { x: number; y: number; width: number; height: number };
  fitMode: 'crop' | 'pad';
  cropPosition: 'center' | 'left' | 'right';
  downloadFormat: 'mp4' | 'mp3' | 'captions';
  captionFormat: 'srt' | 'vtt' | 'txt';
  captionLang: string;
  downloadQuality: string;
  downloadAudioBitrate: string;
  customFileName: string;
  exportMode: 'free' | 'pro';
  processingMode: ProcessingMode;
  selectedPreviewQualityUrl?: string;
  videoHeight?: number;
  rightPanelWidth?: number;
  leftSidebarWidth?: number;
  volume?: number;
  isMuted?: boolean;
  savedAt: number;
}

const SESSION_KEY = 'clipflow_active_editor_session';

function getUrlSessionKey(url: string): string {
  return `clipflow_url_session_${encodeURIComponent(url.trim().replace(/\/+$/, ''))}`;
}

/**
 * Persist editor state in localStorage and sessionStorage so that
 * user clippings, progress line, volume, and settings are never lost on reload.
 */
export function saveEditorSession(state: Partial<EditorSessionState>) {
  try {
    if (!state.activeUrl) return;
    if (state.processingMode) {
      setStoredProcessingMode(state.processingMode);
    }
    const existing = getEditorSession(state.activeUrl);
    const mode = state.processingMode || state.exportMode || existing?.processingMode || getStoredProcessingMode() || 'free';
    const merged: EditorSessionState = {
      ...(existing || {
        activeUrl: state.activeUrl,
        metadata: null,
        currentTime: 0,
        trimRange: [0, 60],
        aspectRatio: '16:9',
        cropBox: { x: 0.25, y: 0, width: 0.5, height: 1 },
        fitMode: 'crop',
        cropPosition: 'center',
        downloadFormat: 'mp4',
        captionFormat: 'srt',
        captionLang: 'en',
        downloadQuality: '1080p',
        downloadAudioBitrate: '0',
        customFileName: '',
        exportMode: mode,
        processingMode: mode,
        volume: 1,
        isMuted: false,
        savedAt: Date.now(),
      }),
      ...state,
      exportMode: mode,
      processingMode: mode,
      savedAt: Date.now(),
    };

    const serialized = JSON.stringify(merged);
    // 1. Save to active session storage
    try { sessionStorage.setItem(SESSION_KEY, serialized); } catch {}
    // 2. Save to global local storage (persists across tab closes)
    try { localStorage.setItem(SESSION_KEY, serialized); } catch {}
    // 3. Save to per-URL local storage key
    try { localStorage.setItem(getUrlSessionKey(state.activeUrl), serialized); } catch {}
  } catch (e) {
    console.warn('[Editor Session] Failed to save session:', e);
  }
}

/** Time-to-Live (TTL): 1 week in milliseconds (all editor sessions older than 7 days are auto-deleted) */
export const TTL_ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isSessionExpired(session: EditorSessionState | null): boolean {
  if (!session || !session.savedAt) return false;
  return Date.now() - session.savedAt > TTL_ONE_WEEK_MS;
}

/**
 * Automatically delete all editor sessions older than 1 week (TTL) from localStorage.
 */
export function cleanExpiredEditorSessions(): void {
  try {
    const now = Date.now();
    const expireThreshold = now - TTL_ONE_WEEK_MS;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('clipflow_url_session_') || key === SESSION_KEY)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.savedAt && parsed.savedAt < expireThreshold) {
              keysToRemove.push(key);
            }
          }
        } catch {}
      }
    }

    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

// Auto-run cleanup on module load in browser
if (typeof window !== 'undefined') {
  setTimeout(() => {
    cleanExpiredEditorSessions();
  }, 1000);
}

/**
 * Retrieve saved editor session from localStorage or sessionStorage.
 * Discards and cleans any session older than 1 week.
 */
export function getEditorSession(forUrl?: string): EditorSessionState | null {
  try {
    // 1. If specific URL requested, check URL-specific localStorage first
    if (forUrl) {
      const urlKey = getUrlSessionKey(forUrl);
      const urlData = localStorage.getItem(urlKey);
      if (urlData) {
        const parsed: EditorSessionState = JSON.parse(urlData);
        if (isSessionExpired(parsed)) {
          localStorage.removeItem(urlKey);
        } else {
          return parsed;
        }
      }
    }

    // 2. Check active sessionStorage
    const rawSession = sessionStorage.getItem(SESSION_KEY);
    if (rawSession) {
      const parsed: EditorSessionState = JSON.parse(rawSession);
      if (!forUrl || parsed.activeUrl === forUrl) {
        if (isSessionExpired(parsed)) {
          sessionStorage.removeItem(SESSION_KEY);
        } else {
          return parsed;
        }
      }
    }

    // 3. Fallback to active localStorage
    const rawLocal = localStorage.getItem(SESSION_KEY);
    if (rawLocal) {
      const parsed: EditorSessionState = JSON.parse(rawLocal);
      if (!forUrl || parsed.activeUrl === forUrl) {
        if (isSessionExpired(parsed)) {
          localStorage.removeItem(SESSION_KEY);
        } else {
          return parsed;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Clear editor session on explicit reset.
 */
export function clearEditorSession(forUrl?: string) {
  try {
    if (forUrl) {
      localStorage.removeItem(getUrlSessionKey(forUrl));
    }
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}
