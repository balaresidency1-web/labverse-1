/**
 * IndexedDB storage helper for LABVERSE
 * Solves browser localStorage 5MB quota exhaustion for PDF documents and diagrams in Demo Mode.
 */

const DB_NAME = 'labverse_storage_db';
const DB_VERSION = 2;
const PDF_STORE = 'pdf_documents';
const STATE_STORE = 'app_state';

interface StoredPdfRecord {
  id: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  size: number;
  uploadedAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(PDF_STORE)) {
          db.createObjectStore(PDF_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    });
  }

  return dbPromise;
}

/**
 * Generic key-value IndexedDB helpers for large platform state
 */
export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STATE_STORE], 'readonly');
      const store = tx.objectStore(STATE_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error || new Error('Failed to read from IndexedDB'));
    });
  } catch {
    return null;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STATE_STORE], 'readwrite');
    const store = tx.objectStore(STATE_STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to write to IndexedDB'));
  });
}

export async function idbClear(): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const stores: string[] = [];
      if (db.objectStoreNames.contains(STATE_STORE)) stores.push(STATE_STORE);
      if (db.objectStoreNames.contains(PDF_STORE)) stores.push(PDF_STORE);
      if (stores.length === 0) {
        resolve();
        return;
      }
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach((s) => tx.objectStore(s).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to clear IndexedDB'));
    });
  } catch {
    // Ignore storage clear errors in constrained contexts
  }
}

/**
 * Saves a PDF File or Blob to IndexedDB
 */
export async function storePdfBlob(
  id: string,
  fileName: string,
  fileOrBlob: File | Blob
): Promise<{ id: string; objectUrl: string; size: number }> {
  const db = await getDb();
  const blob =
    fileOrBlob instanceof Blob
      ? fileOrBlob
      : new Blob([fileOrBlob], { type: 'application/pdf' });

  const record: StoredPdfRecord = {
    id,
    fileName,
    mimeType: blob.type || 'application/pdf',
    blob,
    size: blob.size,
    uploadedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([PDF_STORE], 'readwrite');
    const store = tx.objectStore(PDF_STORE);
    const req = store.put(record);

    req.onsuccess = () => {
      const objectUrl = URL.createObjectURL(blob);
      resolve({ id, objectUrl, size: blob.size });
    };

    req.onerror = () => reject(req.error || new Error('Failed to save PDF to IndexedDB'));
  });
}

/**
 * Retrieves the raw PDF Blob record from IndexedDB without allocating an unclaimed Object URL
 */
export async function getPdfBlob(id: string): Promise<Blob | null> {
  try {
    const db = await getDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([PDF_STORE], 'readonly');
      const store = tx.objectStore(PDF_STORE);
      const req = store.get(id);

      req.onsuccess = () => {
        const record = req.result as StoredPdfRecord | undefined;
        resolve(record?.blob || null);
      };
      req.onerror = () => reject(req.error || new Error('Failed to read PDF from IndexedDB'));
    });
  } catch {
    return null;
  }
}

/**
 * Retrieves a PDF Blob and returns an in-memory Object URL for preview/download
 */
export async function getPdfObjectUrl(id: string): Promise<string | null> {
  const blob = await getPdfBlob(id);
  if (!blob) return null;
  try {
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Deletes a stored PDF record from IndexedDB
 */
export async function deletePdfBlob(id: string): Promise<boolean> {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([PDF_STORE], 'readwrite');
    const store = tx.objectStore(PDF_STORE);
    const req = store.delete(id);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error || new Error('Failed to delete PDF from IndexedDB'));
  });
}

/**
 * Converts a Base64 data URI to a validated PDF Blob
 */
export function dataUriToBlob(dataUri: string): Blob {
  const commaIdx = dataUri.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('Malformed data URI');
  }
  const header = dataUri.slice(0, commaIdx);
  const payload = dataUri.slice(commaIdx + 1).replace(/\s+/g, '');
  const mimeMatch = header.match(/data:([^;,]+)/i);
  const mimeString = mimeMatch?.[1] || 'application/pdf';
  const byteString =
    typeof atob === 'function'
      ? atob(payload)
      : Buffer.from(payload, 'base64').toString('binary');
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}
