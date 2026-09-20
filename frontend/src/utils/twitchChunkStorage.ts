/**
 * twitchChunkStorage.ts
 *
 * Local persistence for Twitch Live streams:
 * 1. Stores 5-second MP4 chunk binary Blobs in IndexedDB for instant replay / scrubbing
 *    without refetching from daemon or server.
 * 2. Stores timeline progress line (currentTime), duration, clippings (trimRange), volume,
 *    and framing settings in localStorage for immediate synchronous state restoration.
 */

const DB_NAME = 'ClipFlowTwitchDB';
const DB_VERSION = 1;
const STORE_CHUNKS = 'chunks';
const STORE_SESSIONS = 'sessions';

/** Time-to-Live (TTL): 1 week in milliseconds (all items older than 7 days are auto-deleted) */
export const TTL_ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoredChunkRecord {
  id: string; // `${channelUrl}_${offset}`
  channelUrl: string;
  offset: number;
  blob: Blob;
  size: number;
  savedAt: number;
}

export interface TwitchSessionRecord {
  channelUrl: string;
  currentTime: number;
  effectiveDuration: number;
  trimRange: [number, number];
  isTrimEnabled?: boolean;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5' | 'custom';
  fitMode?: 'crop' | 'pad';
  cropBox?: { x: number; y: number; width: number; height: number };
  volume?: number;
  isMuted?: boolean;
  cachedOffsets?: number[];
  updatedAt: number;
}

export function normalizeTwitchChannelUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

function getSessionStorageKey(channelUrl: string): string {
  return `clipflow_tw_session_${encodeURIComponent(normalizeTwitchChannelUrl(channelUrl))}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }

  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          const chunkStore = db.createObjectStore(STORE_CHUNKS, { keyPath: 'id' });
          chunkStore.createIndex('channelUrl', 'channelUrl', { unique: false });
          chunkStore.createIndex('offset', 'offset', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: 'channelUrl' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        resolve(db);
        // Automatically prune items older than 1 week in the background
        setTimeout(() => {
          cleanExpiredTwitchData().catch(() => {});
        }, 1000);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
    });
  }

  return dbPromise;
}

/**
 * Save a 5-second MP4 chunk binary Blob to IndexedDB.
 */
export async function saveTwitchChunkToStorage(
  channelUrl: string,
  offset: number,
  blob: Blob
): Promise<void> {
  const normUrl = normalizeTwitchChannelUrl(channelUrl);
  if (!normUrl || !blob || blob.size === 0) return;

  try {
    const db = await getDB();
    const id = `${normUrl}_${offset}`;
    const record: StoredChunkRecord = {
      id,
      channelUrl: normUrl,
      offset,
      blob,
      size: blob.size,
      savedAt: Date.now(),
    };

    return new Promise((resolve) => {
      const tx = db.transaction([STORE_CHUNKS], 'readwrite');
      const store = tx.objectStore(STORE_CHUNKS);
      store.put(record);
      tx.oncomplete = () => {
        console.log(`%c[Twitch Storage 💾] Stored chunk @ t=${offset}s (${(blob.size / 1024).toFixed(1)} KB)`, 'color: #10b981;');
        resolve();
      };
      tx.onerror = () => {
        resolve(); // Don't crash playback if storage fails
      };
    });
  } catch (e) {
    console.warn('[Twitch Storage] Error saving chunk:', e);
  }
}

/**
 * Retrieve a chunk Blob from IndexedDB by channel URL and offset.
 */
export async function getTwitchChunkFromStorage(
  channelUrl: string,
  offset: number
): Promise<Blob | null> {
  const normUrl = normalizeTwitchChannelUrl(channelUrl);
  if (!normUrl) return null;

  try {
    const db = await getDB();
    const id = `${normUrl}_${offset}`;

    return new Promise((resolve) => {
      const tx = db.transaction([STORE_CHUNKS], 'readonly');
      const store = tx.objectStore(STORE_CHUNKS);
      const req = store.get(id);

      req.onsuccess = () => {
        const record = req.result as StoredChunkRecord | undefined;
        if (record && record.blob && record.blob.size > 0) {
          // Check TTL (1 week = 7 days)
          if (record.savedAt && (Date.now() - record.savedAt > TTL_ONE_WEEK_MS)) {
            try {
              const delTx = db.transaction([STORE_CHUNKS], 'readwrite');
              delTx.objectStore(STORE_CHUNKS).delete(id);
            } catch {}
            resolve(null);
            return;
          }
          resolve(record.blob);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Check if a chunk exists in IndexedDB.
 */
export async function hasTwitchChunkInStorage(
  channelUrl: string,
  offset: number
): Promise<boolean> {
  const blob = await getTwitchChunkFromStorage(channelUrl, offset);
  return blob !== null;
}

/**
 * Get all cached chunk offsets for a channel URL.
 */
export async function getAllCachedTwitchOffsets(channelUrl: string): Promise<number[]> {
  const normUrl = normalizeTwitchChannelUrl(channelUrl);
  if (!normUrl) return [];

  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_CHUNKS], 'readonly');
      const store = tx.objectStore(STORE_CHUNKS);
      const index = store.index('channelUrl');
      const req = index.getAll(IDBKeyRange.only(normUrl));

      req.onsuccess = () => {
        const records = (req.result || []) as StoredChunkRecord[];
        const offsets = records.map((r) => r.offset).sort((a, b) => a - b);
        resolve(offsets);
      };

      req.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Save user progress, timeline range, and clippings to localStorage & IndexedDB.
 */
export function saveTwitchSession(
  channelUrl: string,
  state: Partial<TwitchSessionRecord>
): void {
  const normUrl = normalizeTwitchChannelUrl(channelUrl);
  if (!normUrl) return;

  const existing = getTwitchSession(normUrl);
  const updated: TwitchSessionRecord = {
    channelUrl: normUrl,
    currentTime: state.currentTime ?? existing?.currentTime ?? 0,
    effectiveDuration: state.effectiveDuration ?? existing?.effectiveDuration ?? 0,
    trimRange: state.trimRange ?? existing?.trimRange ?? [0, 60],
    isTrimEnabled: state.isTrimEnabled ?? existing?.isTrimEnabled ?? true,
    aspectRatio: state.aspectRatio ?? existing?.aspectRatio ?? '16:9',
    fitMode: state.fitMode ?? existing?.fitMode ?? 'crop',
    cropBox: state.cropBox ?? existing?.cropBox,
    volume: state.volume ?? existing?.volume,
    isMuted: state.isMuted ?? existing?.isMuted,
    cachedOffsets: state.cachedOffsets ?? existing?.cachedOffsets ?? [],
    updatedAt: Date.now(),
  };

  // 1. Synchronous localStorage for instantaneous state restoration on mount
  try {
    localStorage.setItem(getSessionStorageKey(normUrl), JSON.stringify(updated));
  } catch {}

  // 2. Asynchronous IndexedDB for persistent backup
  getDB().then((db) => {
    try {
      const tx = db.transaction([STORE_SESSIONS], 'readwrite');
      tx.objectStore(STORE_SESSIONS).put(updated);
    } catch {}
  }).catch(() => {});
}

/**
 * Retrieve saved Twitch user progress, timeline range, and clippings synchronously.
 */
export function getTwitchSession(channelUrl: string): TwitchSessionRecord | null {
  const normUrl = normalizeTwitchChannelUrl(channelUrl);
  if (!normUrl) return null;

  try {
    const raw = localStorage.getItem(getSessionStorageKey(normUrl));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.currentTime === 'number') {
        // Check TTL (1 week)
        if (parsed.updatedAt && (Date.now() - parsed.updatedAt > TTL_ONE_WEEK_MS)) {
          localStorage.removeItem(getSessionStorageKey(normUrl));
          return null;
        }
        return parsed;
      }
    }
  } catch {}

  return null;
}

/**
 * Automatically delete all Twitch chunks and session records older than 1 week (TTL)
 * from both IndexedDB and localStorage.
 */
export async function cleanExpiredTwitchData(): Promise<void> {
  const now = Date.now();
  const expireThreshold = now - TTL_ONE_WEEK_MS;

  // 1. Clean localStorage Twitch sessions older than 1 week
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('clipflow_tw_session_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.updatedAt && parsed.updatedAt < expireThreshold) {
              keysToRemove.push(key);
            }
          }
        } catch {}
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}

  // 2. Clean IndexedDB chunks and sessions older than 1 week
  try {
    const db = await getDB();
    const tx = db.transaction([STORE_CHUNKS, STORE_SESSIONS], 'readwrite');

    // Chunks
    const chunkStore = tx.objectStore(STORE_CHUNKS);
    const chunkReq = chunkStore.openCursor();
    chunkReq.onsuccess = () => {
      const cursor = chunkReq.result;
      if (cursor) {
        const record = cursor.value as StoredChunkRecord;
        if (record.savedAt && record.savedAt < expireThreshold) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    // Sessions
    const sessionStore = tx.objectStore(STORE_SESSIONS);
    const sessionReq = sessionStore.openCursor();
    sessionReq.onsuccess = () => {
      const cursor = sessionReq.result;
      if (cursor) {
        const record = cursor.value as TwitchSessionRecord;
        if (record.updatedAt && record.updatedAt < expireThreshold) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch (e) {
    console.warn('[Twitch Storage] Error cleaning expired data:', e);
  }
}

/**
 * Clear cached chunks for a channel URL or all channels.
 */
export async function clearTwitchChunks(channelUrl?: string): Promise<void> {
  try {
    const db = await getDB();
    if (channelUrl) {
      const normUrl = normalizeTwitchChannelUrl(channelUrl);
      const tx = db.transaction([STORE_CHUNKS, STORE_SESSIONS], 'readwrite');
      const store = tx.objectStore(STORE_CHUNKS);
      const index = store.index('channelUrl');
      const req = index.getAllKeys(IDBKeyRange.only(normUrl));
      req.onsuccess = () => {
        const keys = req.result || [];
        keys.forEach((k) => store.delete(k));
      };
      tx.objectStore(STORE_SESSIONS).delete(normUrl);
      localStorage.removeItem(getSessionStorageKey(normUrl));
    } else {
      const tx = db.transaction([STORE_CHUNKS, STORE_SESSIONS], 'readwrite');
      tx.objectStore(STORE_CHUNKS).clear();
      tx.objectStore(STORE_SESSIONS).clear();
      // Remove twitch session keys from localStorage
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('clipflow_tw_session_')) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (e) {
    console.warn('[Twitch Storage] Error clearing chunks:', e);
  }
}
