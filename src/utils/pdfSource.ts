import { dataUriToBlob, getPdfBlob } from './indexedDbStorage';
import { createSignedFileUrl, downloadStorageBlob } from '../services/supabaseClient';

export const IDB_URL_PREFIX = 'idb://';

export type PdfSourceKind =
  | 'idb'
  | 'data_uri'
  | 'supabase_storage'
  | 'blob'
  | 'remote_http'
  | 'empty';

export type PdfResolveStatus =
  | 'ready'
  | 'missing'
  | 'access_denied'
  | 'cors_blocked'
  | 'error';

export interface ResolvedPdfResult {
  status: PdfResolveStatus;
  objectUrl: string | null;
  externalUrl: string | null;
  revokeRequired: boolean;
  errorMessage?: string;
}

export interface ResolvePdfParams {
  pdfUrl?: string | null;
  storagePath?: string | null;
  docId?: string | null;
  isSupabaseActive?: boolean;
}

export interface ResolvePdfDeps {
  getIdbBlob: (key: string) => Promise<Blob | null>;
  createSignedUrl: (
    bucket: 'manuals' | 'diagrams',
    path: string,
    expiresInSeconds?: number
  ) => Promise<{ url: string | null; error?: string }>;
  downloadStorage: (
    bucket: 'manuals' | 'diagrams',
    path: string
  ) => Promise<{ blob: Blob | null; error?: string; status?: number }>;
  fetchFn: typeof fetch;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
}

const defaultDeps: ResolvePdfDeps = {
  getIdbBlob: getPdfBlob,
  createSignedUrl: createSignedFileUrl,
  downloadStorage: downloadStorageBlob,
  fetchFn: (...args) => fetch(...args),
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
};

export function makeIdbUrl(key: string): string {
  return `${IDB_URL_PREFIX}${key.replace(/^idb:\/\//i, '')}`;
}

export function isIdbPdfUrl(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith(IDB_URL_PREFIX);
}

export function extractIdbKey(value?: string | null): string | null {
  if (!isIdbPdfUrl(value)) return null;
  const key = value!.trim().slice(IDB_URL_PREFIX.length).trim();
  return key || null;
}

export function normalizePdfFileName(fileName?: string): string {
  const clean = (fileName || 'manual.pdf').trim() || 'manual.pdf';
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}

/**
 * Checks whether raw bytes carry the standard `%PDF-` signature header
 * (allowing minor leading whitespace or UTF-8 BOM).
 */
export function hasPdfMagicHeader(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 5) return false;
  const limit = Math.min(bytes.length - 4, 32);
  for (let i = 0; i <= limit; i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts Supabase storage bucket + relative path from public, signed, or authenticated URLs,
 * or raw relative `mvit/...` paths.
 */
export function extractStoragePathFromUrl(
  pdfUrl?: string | null
): { bucket: 'manuals' | 'diagrams'; path: string } | null {
  if (!pdfUrl || typeof pdfUrl !== 'string') return null;
  const trimmed = pdfUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('mvit/')) {
    return { bucket: 'manuals', path: trimmed };
  }

  const match = trimmed.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/(manuals|diagrams)\/([^?#]+)/i
  );
  if (match) {
    return {
      bucket: match[1].toLowerCase() as 'manuals' | 'diagrams',
      path: decodeURIComponent(match[2]),
    };
  }
  return null;
}

export function classifyPdfSourceKind(
  pdfUrl?: string | null,
  storagePath?: string | null
): PdfSourceKind {
  if (isIdbPdfUrl(storagePath) || isIdbPdfUrl(pdfUrl)) {
    return 'idb';
  }
  const url = (pdfUrl || '').trim();
  if (url.startsWith('data:')) {
    return 'data_uri';
  }
  if ((storagePath && !isIdbPdfUrl(storagePath)) || extractStoragePathFromUrl(url)) {
    return 'supabase_storage';
  }
  if (url.startsWith('blob:')) {
    return 'blob';
  }
  if (/^https?:\/\//i.test(url)) {
    return 'remote_http';
  }
  return 'empty';
}

async function readAndValidatePdfBlob(blob: Blob): Promise<Blob | null> {
  if (!blob || blob.size < 5) return null;
  const headBuf = await blob.slice(0, 64).arrayBuffer();
  const bytes = new Uint8Array(headBuf);
  if (!hasPdfMagicHeader(bytes)) return null;
  return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
}

/**
 * Resolves any LABVERSE PDF source (`idb://`, `data:application/pdf`, Supabase Storage `storage_path`,
 * temporary `blob:`, or external HTTPS PDF URL) into a Chrome/Edge-safe `blob:` URL after
 * validating status and `%PDF-` signature.
 */
export async function resolvePdfSource(
  params: ResolvePdfParams,
  overrides?: Partial<ResolvePdfDeps>
): Promise<ResolvedPdfResult> {
  const deps: ResolvePdfDeps = { ...defaultDeps, ...overrides };
  const rawUrl = (params.pdfUrl || '').trim();
  const rawStoragePath = (params.storagePath || '').trim();
  const kind = classifyPdfSourceKind(rawUrl, rawStoragePath);

  // 1. IndexedDB Persistent Local Storage (`idb://...` or fallback lookup by docId when stale blob:)
  const idbKey = extractIdbKey(rawStoragePath) || extractIdbKey(rawUrl);
  if (kind === 'idb' && idbKey) {
    const rawBlob = await deps.getIdbBlob(idbKey);
    if (!rawBlob) {
      return {
        status: 'missing',
        objectUrl: null,
        externalUrl: null,
        revokeRequired: false,
        errorMessage:
          'This locally stored PDF was not found in browser IndexedDB storage. Re-upload the PDF from Manual Management.',
      };
    }
    const validBlob = await readAndValidatePdfBlob(rawBlob);
    if (!validBlob) {
      return {
        status: 'error',
        objectUrl: null,
        externalUrl: null,
        revokeRequired: false,
        errorMessage: 'The stored local file does not have a valid %PDF header signature.',
      };
    }
    const objectUrl = deps.createObjectUrl(validBlob);
    return {
      status: 'ready',
      objectUrl,
      externalUrl: null,
      revokeRequired: true,
    };
  }

  // Fallback recovery if a legacy persisted state still holds an expired `blob:` URL alongside docId
  if (kind === 'blob' && params.docId) {
    const legacyBlob = await deps.getIdbBlob(params.docId);
    if (legacyBlob) {
      const validBlob = await readAndValidatePdfBlob(legacyBlob);
      if (validBlob) {
        return {
          status: 'ready',
          objectUrl: deps.createObjectUrl(validBlob),
          externalUrl: null,
          revokeRequired: true,
        };
      }
    }
  }

  // 2. Embedded Base64 Data URI -> Convert to Blob URL (prevents Chrome/Edge iframe block!)
  if (kind === 'data_uri') {
    try {
      const blob = dataUriToBlob(rawUrl);
      const validBlob = await readAndValidatePdfBlob(blob);
      if (!validBlob) {
        return {
          status: 'error',
          objectUrl: null,
          externalUrl: null,
          revokeRequired: false,
          errorMessage: 'Embedded PDF data URI failed %PDF header validation.',
        };
      }
      return {
        status: 'ready',
        objectUrl: deps.createObjectUrl(validBlob),
        externalUrl: null,
        revokeRequired: true,
      };
    } catch (err: any) {
      return {
        status: 'error',
        objectUrl: null,
        externalUrl: null,
        revokeRequired: false,
        errorMessage: err?.message || 'Failed to decode embedded PDF document.',
      };
    }
  }

  // 3. Supabase Private Storage (`storage_path` refreshed on open — never rely on expired signed URLs)
  if (kind === 'supabase_storage') {
    const parsed = rawStoragePath
      ? { bucket: 'manuals' as const, path: rawStoragePath }
      : extractStoragePathFromUrl(rawUrl);

    if (parsed && params.isSupabaseActive !== false) {
      const signed = await deps.createSignedUrl(parsed.bucket, parsed.path, 3600);
      const freshExternalUrl = signed.url || (/^https?:\/\//i.test(rawUrl) ? rawUrl : null);

      const dl = await deps.downloadStorage(parsed.bucket, parsed.path);
      if (dl.blob) {
        const validBlob = await readAndValidatePdfBlob(dl.blob);
        if (!validBlob) {
          return {
            status: 'error',
            objectUrl: null,
            externalUrl: freshExternalUrl,
            revokeRequired: false,
            errorMessage: 'Downloaded Supabase Storage object is not a valid PDF document.',
          };
        }
        return {
          status: 'ready',
          objectUrl: deps.createObjectUrl(validBlob),
          externalUrl: freshExternalUrl,
          revokeRequired: true,
        };
      }

      if (dl.status === 401 || dl.status === 403 || /403|denied|unauthorized/i.test(dl.error || '')) {
        return {
          status: 'access_denied',
          objectUrl: null,
          externalUrl: freshExternalUrl,
          revokeRequired: false,
          errorMessage:
            dl.error || 'Access denied: your account or session is not authorized to view this PDF.',
        };
      }
      if (dl.status === 404 || /404|not found/i.test(dl.error || '')) {
        return {
          status: 'missing',
          objectUrl: null,
          externalUrl: freshExternalUrl,
          revokeRequired: false,
          errorMessage: 'The PDF file could not be found in Supabase Storage.',
        };
      }

      // If SDK download failed transiently but signed URL exists, try fetching signed URL directly
      if (freshExternalUrl) {
        return await fetchRemotePdf(freshExternalUrl, deps);
      }

      return {
        status: 'error',
        objectUrl: null,
        externalUrl: null,
        revokeRequired: false,
        errorMessage: dl.error || signed.error || 'Failed to load PDF from Supabase Storage.',
      };
    }

    if (/^https?:\/\//i.test(rawUrl)) {
      return await fetchRemotePdf(rawUrl, deps);
    }

    return {
      status: 'missing',
      objectUrl: null,
      externalUrl: null,
      revokeRequired: false,
      errorMessage: 'Supabase Storage is inactive and no offline copy of this PDF is available.',
    };
  }

  // 4. Existing In-Memory Blob URL -> verify it is still live
  if (kind === 'blob') {
    try {
      const res = await deps.fetchFn(rawUrl);
      if (!res.ok) {
        return {
          status: 'missing',
          objectUrl: null,
          externalUrl: null,
          revokeRequired: false,
          errorMessage: 'This temporary PDF link has expired.',
        };
      }
      const blob = await res.blob();
      const validBlob = await readAndValidatePdfBlob(blob);
      if (!validBlob) {
        return {
          status: 'error',
          objectUrl: null,
          externalUrl: null,
          revokeRequired: false,
          errorMessage: 'Invalid PDF content.',
        };
      }
      return {
        status: 'ready',
        objectUrl: deps.createObjectUrl(validBlob),
        externalUrl: null,
        revokeRequired: true,
      };
    } catch {
      return {
        status: 'missing',
        objectUrl: null,
        externalUrl: null,
        revokeRequired: false,
        errorMessage: 'This temporary browser Blob URL expired after reload. Re-upload the PDF.',
      };
    }
  }

  // 5. Remote HTTP / HTTPS PDF URL -> Fetch + validate status & `%PDF-` signature
  if (kind === 'remote_http') {
    return await fetchRemotePdf(rawUrl, deps);
  }

  return {
    status: 'missing',
    objectUrl: null,
    externalUrl: null,
    revokeRequired: false,
    errorMessage: 'No PDF document source is linked to this item yet.',
  };
}

async function fetchRemotePdf(
  url: string,
  deps: ResolvePdfDeps
): Promise<ResolvedPdfResult> {
  try {
    const res = await deps.fetchFn(url, { method: 'GET' });
    if (res.status === 401 || res.status === 403) {
      return {
        status: 'access_denied',
        objectUrl: null,
        externalUrl: url,
        revokeRequired: false,
        errorMessage: `Access denied (HTTP ${res.status}) while loading PDF resource.`,
      };
    }
    if (res.status === 404 || res.status === 410) {
      return {
        status: 'missing',
        objectUrl: null,
        externalUrl: url,
        revokeRequired: false,
        errorMessage: `PDF file not found on remote server (HTTP ${res.status}).`,
      };
    }
    if (!res.ok) {
      return {
        status: 'error',
        objectUrl: null,
        externalUrl: url,
        revokeRequired: false,
        errorMessage: `Remote server returned HTTP ${res.status} while fetching PDF.`,
      };
    }

    const blob = await res.blob();
    const validBlob = await readAndValidatePdfBlob(blob);
    if (!validBlob) {
      return {
        status: 'error',
        objectUrl: null,
        externalUrl: url,
        revokeRequired: false,
        errorMessage:
          'Remote response did not contain a valid PDF binary signature (%PDF-). Open in a new tab to inspect directly.',
      };
    }

    return {
      status: 'ready',
      objectUrl: deps.createObjectUrl(validBlob),
      externalUrl: url,
      revokeRequired: true,
    };
  } catch (err: any) {
    // Browsers throw TypeError on cross-origin fetch blocked by CORS headers.
    const isCorsOrNetwork = err instanceof TypeError || /cors|failed to fetch|network/i.test(err?.message || '');
    if (isCorsOrNetwork) {
      return {
        status: 'cors_blocked',
        objectUrl: null,
        externalUrl: url,
        revokeRequired: false,
        errorMessage:
          'Inline PDF preview is blocked by cross-origin (CORS) or framing security policies on the external host. Use "Open PDF in New Tab" or "Download PDF" below.',
      };
    }
    return {
      status: 'error',
      objectUrl: null,
      externalUrl: url,
      revokeRequired: false,
      errorMessage: err?.message || 'Unable to load remote PDF document.',
    };
  }
}

/**
 * Resolves and triggers a clean download of any PDF (`idb://`, `data:`, Supabase `storage_path`, or HTTP URL),
 * safely revoking temporary Blob URLs after triggering the browser download.
 */
export async function downloadResolvedPdf(
  params: ResolvePdfParams & { fileName: string; resolvedObjectUrl?: string | null }
): Promise<{ success: boolean; error?: string }> {
  if (typeof document === 'undefined') {
    return { success: false, error: 'Browser download requires a DOM environment.' };
  }

  const downloadName = normalizePdfFileName(params.fileName);

  const triggerAnchorDownload = (href: string, externalFallback = false) => {
    const link = document.createElement('a');
    link.href = href;
    if (!externalFallback) {
      link.download = downloadName;
    } else {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (params.resolvedObjectUrl) {
    triggerAnchorDownload(params.resolvedObjectUrl);
    return { success: true };
  }

  const resolved = await resolvePdfSource(params);
  if (resolved.status === 'ready' && resolved.objectUrl) {
    triggerAnchorDownload(resolved.objectUrl);
    if (resolved.revokeRequired) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(resolved.objectUrl!);
        } catch {
          // ignore
        }
      }, 2000);
    }
    return { success: true };
  }

  if (resolved.externalUrl && resolved.status === 'cors_blocked') {
    triggerAnchorDownload(resolved.externalUrl, true);
    return { success: true };
  }

  return {
    success: false,
    error: resolved.errorMessage || 'Unable to download this PDF document.',
  };
}
