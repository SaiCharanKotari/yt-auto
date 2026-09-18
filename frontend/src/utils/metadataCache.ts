// Shared Metadata Cache for instantaneous tab transitions across /editor/* routes

const memoryCache = new Map<string, any>();

function normalizeUrl(url: string): string {
  if (!url) return '';
  return url.trim().replace(/\/+$/, '');
}

export function getCachedMetadata(url: string): any | null {
  const norm = normalizeUrl(url);
  if (!norm) return null;

  // 1. Check in-memory map
  if (memoryCache.has(norm)) {
    return memoryCache.get(norm);
  }

  // 2. Check sessionStorage
  try {
    const raw = sessionStorage.getItem(`cf_meta_${encodeURIComponent(norm)}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.title || parsed.id)) {
        memoryCache.set(norm, parsed);
        return parsed;
      }
    }
  } catch { }

  return null;
}

export function setCachedMetadata(url: string, data: any): void {
  const norm = normalizeUrl(url);
  if (!norm || !data) return;

  memoryCache.set(norm, data);
  try {
    sessionStorage.setItem(`cf_meta_${encodeURIComponent(norm)}`, JSON.stringify(data));
  } catch { }
}

export function clearCachedMetadata(url?: string): void {
  if (url) {
    const norm = normalizeUrl(url);
    memoryCache.delete(norm);
    try {
      sessionStorage.removeItem(`cf_meta_${encodeURIComponent(norm)}`);
    } catch { }
  } else {
    memoryCache.clear();
    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('cf_meta_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch { }
  }
}
