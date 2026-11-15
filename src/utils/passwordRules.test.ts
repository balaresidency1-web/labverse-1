import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePasswordStrength, validatePasswordConfirmation } from './passwordRules';

test('validatePasswordStrength identifies weak and empty passwords', () => {
  const empty = validatePasswordStrength('');
  assert.equal(empty.valid, false);
  assert.equal(empty.score, 0);
  assert.equal(empty.strengthLabel, 'Very Weak');
  assert.equal(empty.errors.length, 4);

  const short = validatePasswordStrength('Ab1');
  assert.equal(short.valid, false);
  assert.equal(short.requirements.find((r) => r.id === 'min_length')?.met, false);
});

test('validatePasswordStrength checks for all criteria', () => {
  // Missing uppercase
  const noUpper = validatePasswordStrength('strongpassword123');
  assert.equal(noUpper.valid, false);
  assert.equal(noUpper.requirements.find((r) => r.id === 'has_uppercase')?.met, false);

  // Missing lowercase
  const noLower = validatePasswordStrength('STRONGPASSWORD123');
  assert.equal(noLower.valid, false);
  assert.equal(noLower.requirements.find((r) => r.id === 'has_lowercase')?.met, false);

  // Missing number or symbol
  const noNum = validatePasswordStrength('StrongPassword');
  assert.equal(noNum.valid, false);
  assert.equal(noNum.requirements.find((r) => r.id === 'has_number_or_symbol')?.met, false);

  // Meets all requirements
  const validPass = validatePasswordStrength('Labverse2026!');
  assert.equal(validPass.valid, true);
  assert.equal(validPass.score, 4);
  assert.equal(validPass.strengthLabel, 'Strong');
  assert.equal(validPass.errors.length, 0);
});

test('validatePasswordConfirmation checks matching and mismatching passwords', () => {
  const match = validatePasswordConfirmation('Labverse2026!', 'Labverse2026!');
  assert.equal(match.matches, true);
  assert.equal(match.error, undefined);

  const mismatch = validatePasswordConfirmation('Labverse2026!', 'Labverse2025!');
  assert.equal(mismatch.matches, false);
  assert.equal(mismatch.error, 'Passwords do not match.');

  const emptyConfirm = validatePasswordConfirmation('Labverse2026!', '');
  assert.equal(emptyConfirm.matches, false);
  assert.equal(emptyConfirm.error, 'Please confirm your new password.');
});
