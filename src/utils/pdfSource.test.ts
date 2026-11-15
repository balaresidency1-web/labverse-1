import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeIdbUrl,
  isIdbPdfUrl,
  extractIdbKey,
  normalizePdfFileName,
  hasPdfMagicHeader,
  extractStoragePathFromUrl,
  classifyPdfSourceKind,
  resolvePdfSource,
  type ResolvePdfDeps,
} from './pdfSource';

const SAMPLE_VALID_PDF_BYTES = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
const SAMPLE_VALID_PDF_DATA_URI = `data:application/pdf;base64,${Buffer.from(
  SAMPLE_VALID_PDF_BYTES
).toString('base64')}`;

function createMockDeps(overrides: Partial<ResolvePdfDeps> = {}): ResolvePdfDeps {
  return {
    getIdbBlob: async () => null,
    createSignedUrl: async (_bucket, path) => ({
      url: `https://project.supabase.co/storage/v1/object/sign/manuals/${path}?token=fresh`,
    }),
    downloadStorage: async () => ({
      blob: new Blob([SAMPLE_VALID_PDF_BYTES], { type: 'application/pdf' }),
    }),
    fetchFn: async () =>
      new Response(SAMPLE_VALID_PDF_BYTES, {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      }),
    createObjectUrl: () => 'blob:mock-object-url-1',
    revokeObjectUrl: () => undefined,
    ...overrides,
  };
}

test('IDB URL helpers, filename normalizer, and magic header detection work reliably', () => {
  assert.equal(makeIdbUrl('doc-123'), 'idb://doc-123');
  assert.equal(makeIdbUrl('idb://doc-123'), 'idb://doc-123');
  assert.equal(isIdbPdfUrl('idb://syl-1'), true);
  assert.equal(isIdbPdfUrl('https://example.com/a.pdf'), false);
  assert.equal(extractIdbKey('idb://doc-xyz'), 'doc-xyz');
  assert.equal(extractIdbKey('blob:http://localhost:3000/abc'), null);

  assert.equal(normalizePdfFileName('manual'), 'manual.pdf');
  assert.equal(normalizePdfFileName('lab.PDF'), 'lab.PDF');

  assert.equal(hasPdfMagicHeader(SAMPLE_VALID_PDF_BYTES), true);
  assert.equal(hasPdfMagicHeader(new TextEncoder().encode('   %PDF-1.7\n...')), true);
  assert.equal(hasPdfMagicHeader(new TextEncoder().encode('<!DOCTYPE html><html>')), false);
});

test('extractStoragePathFromUrl parses signed, authenticated, public, and raw storage paths', () => {
  assert.deepEqual(
    extractStoragePathFromUrl('https://xyz.supabase.co/storage/v1/object/public/manuals/mvit/lab1/exp.pdf'),
    { bucket: 'manuals', path: 'mvit/lab1/exp.pdf' }
  );
  assert.deepEqual(
    extractStoragePathFromUrl(
      'https://xyz.supabase.co/storage/v1/object/sign/manuals/mvit/lab1/my%20manual.pdf?token=expired'
    ),
    { bucket: 'manuals', path: 'mvit/lab1/my manual.pdf' }
  );
  assert.deepEqual(extractStoragePathFromUrl('mvit/lab2/syllabus/doc.pdf'), {
    bucket: 'manuals',
    path: 'mvit/lab2/syllabus/doc.pdf',
  });
  assert.equal(extractStoragePathFromUrl('https://example.com/outside.pdf'), null);
});

test('classifyPdfSourceKind identifies source priority accurately', () => {
  assert.equal(classifyPdfSourceKind('idb://doc-1', 'idb://doc-1'), 'idb');
  assert.equal(classifyPdfSourceKind(SAMPLE_VALID_PDF_DATA_URI), 'data_uri');
  assert.equal(classifyPdfSourceKind('https://x.supabase.co/storage/v1/object/sign/manuals/a/b.pdf?t=1'), 'supabase_storage');
  assert.equal(classifyPdfSourceKind('', 'mvit/lab1/file.pdf'), 'supabase_storage');
  assert.equal(classifyPdfSourceKind('blob:http://localhost:3000/123'), 'blob');
  assert.equal(classifyPdfSourceKind('https://example.edu/manual.pdf'), 'remote_http');
  assert.equal(classifyPdfSourceKind(''), 'empty');
});

test('resolvePdfSource converts data:application/pdf URIs to Blob object URLs so Chrome/Edge never block iframes', async () => {
  const res = await resolvePdfSource(
    { pdfUrl: SAMPLE_VALID_PDF_DATA_URI, isSupabaseActive: false },
    createMockDeps({ createObjectUrl: () => 'blob:chrome-safe-preview' })
  );
  assert.equal(res.status, 'ready');
  assert.equal(res.objectUrl, 'blob:chrome-safe-preview');
  assert.equal(res.revokeRequired, true);
  assert.equal(res.externalUrl, null);
});

test('resolvePdfSource loads persisted IndexedDB uploads and reports missing when absent', async () => {
  const readyRes = await resolvePdfSource(
    { pdfUrl: 'idb://doc-999', storagePath: 'idb://doc-999', isSupabaseActive: false },
    createMockDeps({
      getIdbBlob: async (key) =>
        key === 'doc-999' ? new Blob([SAMPLE_VALID_PDF_BYTES], { type: 'application/pdf' }) : null,
      createObjectUrl: () => 'blob:idb-restored',
    })
  );
  assert.equal(readyRes.status, 'ready');
  assert.equal(readyRes.objectUrl, 'blob:idb-restored');
  assert.equal(readyRes.revokeRequired, true);

  const missingRes = await resolvePdfSource(
    { pdfUrl: 'idb://missing-doc', storagePath: 'idb://missing-doc', isSupabaseActive: false },
    createMockDeps()
  );
  assert.equal(missingRes.status, 'missing');
  assert.equal(missingRes.objectUrl, null);
});

test('resolvePdfSource recovers legacy blob: URL via docId in IndexedDB or reports missing cleanly', async () => {
  const recovered = await resolvePdfSource(
    { pdfUrl: 'blob:http://localhost:3000/stale-uuid', docId: 'doc-legacy-1', isSupabaseActive: false },
    createMockDeps({
      getIdbBlob: async (key) =>
        key === 'doc-legacy-1' ? new Blob([SAMPLE_VALID_PDF_BYTES], { type: 'application/pdf' }) : null,
      createObjectUrl: () => 'blob:recovered-from-idb',
    })
  );
  assert.equal(recovered.status, 'ready');
  assert.equal(recovered.objectUrl, 'blob:recovered-from-idb');
});

test('resolvePdfSource refreshes private Supabase storage signed URLs and handles 403 / 404 accurately', async () => {
  let refreshedPath = '';
  const ok = await resolvePdfSource(
    {
      pdfUrl: 'https://proj.supabase.co/storage/v1/object/sign/manuals/mvit/lab/manual.pdf?token=OLD_EXPIRED',
      storagePath: 'mvit/lab/manual.pdf',
      isSupabaseActive: true,
    },
    createMockDeps({
      createSignedUrl: async (_bucket, path) => {
        refreshedPath = path;
        return { url: `https://proj.supabase.co/storage/v1/object/sign/manuals/${path}?token=FRESH` };
      },
      createObjectUrl: () => 'blob:supabase-private-pdf',
    })
  );
  assert.equal(refreshedPath, 'mvit/lab/manual.pdf');
  assert.equal(ok.status, 'ready');
  assert.equal(ok.objectUrl, 'blob:supabase-private-pdf');
  assert.ok(ok.externalUrl?.includes('token=FRESH'));

  const denied = await resolvePdfSource(
    {
      pdfUrl: '',
      storagePath: 'mvit/pc-lab/secret.pdf',
      isSupabaseActive: true,
    },
    createMockDeps({
      downloadStorage: async () => ({ blob: null, status: 403, error: 'new row violates policy' }),
    })
  );
  assert.equal(denied.status, 'access_denied');
  assert.equal(denied.objectUrl, null);

  const missing = await resolvePdfSource(
    {
      pdfUrl: '',
      storagePath: 'mvit/lab/deleted.pdf',
      isSupabaseActive: true,
    },
    createMockDeps({
      downloadStorage: async () => ({ blob: null, status: 404, error: 'Object not found' }),
    })
  );
  assert.equal(missing.status, 'missing');
  assert.equal(missing.objectUrl, null);
});

test('resolvePdfSource rejects HTML error pages pretending to be PDFs and classifies CORS failures honestly', async () => {
  const htmlSpoof = await resolvePdfSource(
    { pdfUrl: 'https://example.edu/manual.pdf', isSupabaseActive: false },
    createMockDeps({
      fetchFn: async () =>
        new Response('<html><body>Error page</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    })
  );
  assert.equal(htmlSpoof.status, 'error');
  assert.equal(htmlSpoof.objectUrl, null);
  assert.equal(htmlSpoof.externalUrl, 'https://example.edu/manual.pdf');

  const corsBlocked = await resolvePdfSource(
    { pdfUrl: 'https://cors-restricted.edu/manual.pdf', isSupabaseActive: false },
    createMockDeps({
      fetchFn: async () => {
        throw new TypeError('Failed to fetch');
      },
    })
  );
  assert.equal(corsBlocked.status, 'cors_blocked');
  assert.equal(corsBlocked.objectUrl, null);
  assert.equal(corsBlocked.externalUrl, 'https://cors-restricted.edu/manual.pdf');
});
