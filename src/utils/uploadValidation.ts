/** Reject empty, oversized and mislabeled uploads before they reach Storage.
 * Storage independently enforces MIME/size/RLS; these signatures are not a malware scan.
 */
export async function validateUploadBytes(bucket: 'manuals' | 'diagrams', file: Blob): Promise<string | null> {
  const max = (bucket === 'manuals' ? 15 : 10) * 1024 * 1024;
  if (!file.size || file.size > max) return `Upload must be non-empty and at most ${max / 1024 / 1024} MB.`;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const text = new TextDecoder().decode(head);
  if (file.type === 'application/pdf') {
    const tail = new TextDecoder().decode(await file.slice(Math.max(0, file.size - 1024)).arrayBuffer());
    return /^%PDF-\d\.\d/.test(text) && tail.includes('%%EOF') ? null : 'The file does not contain a valid PDF header and end marker.';
  }
  if (bucket === 'manuals') return 'Manuals must be PDF files.';
  const matches =
    (file.type === 'image/png' && [137,80,78,71,13,10,26,10].every((b,i) => head[i] === b)) ||
    (file.type === 'image/jpeg' && head[0] === 255 && head[1] === 216 && head[2] === 255) ||
    (file.type === 'image/webp' && text.startsWith('RIFF') && text.slice(8,12) === 'WEBP') ||
    (file.type === 'image/gif' && /^(GIF87a|GIF89a)/.test(text));
  return matches ? null : 'Diagrams must contain a PNG, JPEG, WebP, GIF or PDF matching their content type.';
}
