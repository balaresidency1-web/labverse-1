import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixedWindowRateLimiter } from './fixedWindowRateLimiter';

test('allows requests up to the configured limit and blocks excess requests', () => {
  const allow = createFixedWindowRateLimiter({ limit: 2, windowMs: 60_000 });
  assert.equal(allow('staff-1', 1_000), true);
  assert.equal(allow('staff-1', 1_001), true);
  assert.equal(allow('staff-1', 1_002), false);
  assert.equal(allow('staff-1', 1_003), false);
});

test('uses independent buckets for different authenticated staff users', () => {
  const allow = createFixedWindowRateLimiter({ limit: 1, windowMs: 10_000 });
  assert.equal(allow('admin-1', 1_000), true);
  assert.equal(allow('assistant-1', 1_000), true);
  assert.equal(allow('admin-1', 1_001), false);
});

test('resets a bucket after the fixed window expires', () => {
  const allow = createFixedWindowRateLimiter({ limit: 1, windowMs: 1_000 });
  assert.equal(allow('staff-1', 1_000), true);
  assert.equal(allow('staff-1', 1_999), false);
  assert.equal(allow('staff-1', 2_000), true);
});

test('fails closed when the bounded key table is full of active entries', () => {
  const allow = createFixedWindowRateLimiter({ limit: 5, windowMs: 10_000, maxKeys: 1 });
  assert.equal(allow('staff-1', 1_000), true);
  assert.equal(allow('staff-2', 1_001), false);
  assert.equal(allow('staff-2', 11_000), true);
});
