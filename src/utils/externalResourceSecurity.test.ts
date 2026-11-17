import test from 'node:test';
import assert from 'node:assert/strict';
import { assessExternalResourceUrl } from './externalResourceSecurity';

test('accepts HTTPS YouTube videos and classifies them for server-side oEmbed checks', () => {
  const result = assessExternalResourceUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  assert.equal(result.valid, true);
  assert.equal(result.provider, 'youtube');
  assert.equal(result.embeddable, false);
});

test('recognizes the existing approved simulation embed hosts', () => {
  const phet = assessExternalResourceUrl('https://phet.colorado.edu/sims/html/pendulum/latest/pendulum_en.html');
  const vlab = assessExternalResourceUrl('https://be-iitkgp.vlabs.ac.in/');

  assert.equal(phet.valid, true);
  assert.equal(phet.embeddable, true);
  assert.equal(phet.provider, 'phet');
  assert.equal(vlab.valid, true);
  assert.equal(vlab.embeddable, true);
  assert.equal(vlab.provider, 'virtual_labs');
});

test('accepts unknown HTTPS resources for external-tab use without requiring server fetch', () => {
  const result = assessExternalResourceUrl('https://example.org/lab-resource');

  // example.org is a documentation domain, not an internal hostname; it is
  // valid as a URL but intentionally not eligible for iframe embedding.
  assert.equal(result.valid, true);
  assert.equal(result.provider, 'custom');
  assert.equal(result.embeddable, false);
});

test('rejects HTTP, URL credentials, and non-standard ports', () => {
  assert.equal(assessExternalResourceUrl('http://example.org').valid, false);
  assert.equal(assessExternalResourceUrl('https://user:pass@example.org').valid, false);
  assert.equal(assessExternalResourceUrl('https://example.org:8443/resource').valid, false);
});

test('rejects IP literals and local/private hostnames', () => {
  const blocked = [
    'https://127.0.0.1/admin',
    'https://10.0.0.8/',
    'https://169.254.169.254/latest/meta-data/',
    'https://[::1]/',
    'https://localhost/',
    'https://printer.local/',
    'https://service.internal/',
    'https://app.localhost/',
  ];

  for (const url of blocked) {
    assert.equal(assessExternalResourceUrl(url).valid, false, url);
  }
});

test('rejects malformed, missing, and oversized values', () => {
  assert.equal(assessExternalResourceUrl('').valid, false);
  assert.equal(assessExternalResourceUrl(null).valid, false);
  assert.equal(assessExternalResourceUrl('not a url').valid, false);
  assert.equal(assessExternalResourceUrl('https://example.org/' + 'a'.repeat(2050)).valid, false);
});

test('does not confuse lookalike hosts with approved embed domains', () => {
  const result = assessExternalResourceUrl('https://notbenchtwin.com/resource');
  assert.equal(result.valid, true);
  assert.equal(result.embeddable, false);
  assert.equal(result.provider, 'custom');
});
