import assert from 'node:assert/strict';
import test from 'node:test';
import { isActiveStaffStatus } from './staffAuthRules';

test('only activated staff profiles can use the live staff portal', () => {
  assert.equal(isActiveStaffStatus('active'), true);
  assert.equal(isActiveStaffStatus('invited'), false);
  assert.equal(isActiveStaffStatus('suspended'), false);
  assert.equal(isActiveStaffStatus(null), false);
  assert.equal(isActiveStaffStatus(undefined), false);
  assert.equal(isActiveStaffStatus(''), false);
});
