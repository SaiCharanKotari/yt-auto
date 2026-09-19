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
  savedAt: number;
}

const SESSION_KEY = 'clipflow_active_editor_session';

/**
 * Persist editor state in sessionStorage (persists across internal tab changes like Cloud/Settings,
 * and automatically clears when the browser tab/page is closed).
 */
export function saveEditorSession(state: Partial<EditorSessionState>) {
  try {
    if (!state.activeUrl) return;
    if (state.processingMode) {
      setStoredProcessingMode(state.processingMode);
    }
    const existing = getEditorSession();
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
        savedAt: Date.now(),
      }),
      ...state,
      exportMode: mode,
      processingMode: mode,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('[Editor Session] Failed to save session:', e);
  }
}

/**
 * Retrieve saved editor session.
 */
export function getEditorSession(forUrl?: string): EditorSessionState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data: EditorSessionState = JSON.parse(raw);
    if (forUrl && data.activeUrl !== forUrl) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Clear editor session on close or reset.
 */
export function clearEditorSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}
