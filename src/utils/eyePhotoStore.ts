/**
 * IndexedDB-backed store for the compressed ocular photo of each child.
 *
 * Rationale: a diagnostic-clarity JPEG is ~80–150 KB. Storing that as a data URL
 * inside `localStorage` would blow past the 5 MB quota of the records key and break
 * the 100% offline-first guarantee. IndexedDB stores the raw `Blob` (binary, no
 * base64 inflation) keyed by the study `Child_ID`, so the record payload in
 * localStorage stays small while the photo survives a reload and can still be
 * uploaded to Supabase Storage during the next cloud sync.
 */

const DB_NAME = 'albasar_eye_photos';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

interface PhotoRecord {
  childId: string;
  blob: Blob;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Opens the photo database and guarantees that the `photos` object store exists.
 *
 * Self-healing: if a database file already exists at the current version but
 * without the expected store (e.g. it was created by an older build or by
 * another tool that opened the name first), the connection is closed and the
 * database is reopened one version higher so the upgrade handler can create
 * the store. Without this, the photo store would be permanently unusable.
 */
const openDatabase = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    const tryOpen = (version: number) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, version);
      } catch {
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'childId' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.close();
          if (version < DB_VERSION + 8) {
            tryOpen(version + 1);
            return;
          }
          resolve(null);
          return;
        }
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    };

    tryOpen(DB_VERSION);
  });

  return dbPromise;
};

/** Stores (or replaces) the compressed ocular photo for one child. */
export async function saveEyePhoto(childId: string, blob: Blob): Promise<boolean> {
  const key = childId.trim();
  if (!key || !blob) return false;
  const db = await openDatabase();
  if (!db) return false;

  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ childId: key, blob, updatedAt: Date.now() } satisfies PhotoRecord);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Reads the compressed ocular photo for one child (null when missing). */
export async function getEyePhoto(childId: string): Promise<Blob | null> {
  const key = childId.trim();
  if (!key) return null;
  const db = await openDatabase();
  if (!db) return null;

  return new Promise<Blob | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => {
        const value = request.result as PhotoRecord | undefined;
        resolve(value?.blob ?? null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Removes the stored photo for one child (used when a record is discarded). */
export async function deleteEyePhoto(childId: string): Promise<void> {
  const key = childId.trim();
  if (!key) return;
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
  } catch {
    // Non-fatal: the photo simply stays in the store.
  }
}

/** True when the browser exposes IndexedDB (Safari private mode may not). */
export function isEyePhotoStoreAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
