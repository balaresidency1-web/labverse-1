import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUploadBytes } from './uploadValidation.ts';

test('upload checks reject HTML renamed as PDF, empty files and missing EOF', async () => {
  for (const bytes of ['', '<script>alert(1)</script>', '%PDF-1.4\ntruncated']) {
    assert.ok(await validateUploadBytes('manuals', new Blob([bytes], { type: 'application/pdf' })));
  }
  assert.equal(await validateUploadBytes('manuals', new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' })), null);
});
test('upload checks enforce bucket-specific sizes and prohibit SVG/HTML diagrams', async () => {
  assert.ok(await validateUploadBytes('manuals', new Blob([new Uint8Array(15 * 1024 * 1024 + 1)], {type:'application/pdf'})));
  assert.ok(await validateUploadBytes('diagrams', new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], {type:'image/png'})));
  assert.ok(await validateUploadBytes('diagrams', new Blob(['<svg/>'], {type:'image/svg+xml'})));
  assert.ok(await validateUploadBytes('diagrams', new Blob(['<html/>'], {type:'image/png'})));
  assert.equal(await validateUploadBytes('diagrams', new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], {type:'image/png'})), null);
});
