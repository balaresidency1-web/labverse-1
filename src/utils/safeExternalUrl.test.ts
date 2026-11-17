import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedExternalHostname,
  isPublicIpAddress,
  validateExternalHttpsUrl,
} from './safeExternalUrl';

test('allows known LABVERSE learning and simulator hosts', () => {
  assert.equal(isAllowedExternalHostname('www.youtube.com'), true);
  assert.equal(isAllowedExternalHostname('hci-iitg.vlabs.ac.in'), true);
  assert.equal(isAllowedExternalHostname('new.vlab.co.in'), true);
  assert.equal(isAllowedExternalHostname('www.dsource.in'), true);
  assert.equal(isAllowedExternalHostname('benchtwin.com'), true);
});

test('rejects arbitrary hosts and IP-literal hosts', () => {
  assert.equal(isAllowedExternalHostname('attacker.example'), false);
  assert.equal(isAllowedExternalHostname('localhost'), false);
  assert.equal(isAllowedExternalHostname('127.0.0.1'), false);
  assert.equal(isAllowedExternalHostname('[::1]'), false);
});

test('rejects non-public IPv4 and IPv6 destinations', () => {
  for (const address of [
    '10.0.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.20.1.2',
    '192.168.1.10',
    '100.64.0.1',
    '198.18.0.1',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
  ]) {
    assert.equal(isPublicIpAddress(address), false, address);
  }
});

test('accepts representative public IPv4 and IPv6 addresses', () => {
  assert.equal(isPublicIpAddress('8.8.8.8'), true);
  assert.equal(isPublicIpAddress('1.1.1.1'), true);
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true);
});

test('validates HTTPS, credentials, ports and approved domains', () => {
  assert.equal(validateExternalHttpsUrl('https://www.youtube.com/watch?v=abc123').ok, true);
  assert.equal(validateExternalHttpsUrl('http://www.youtube.com/watch?v=abc123').ok, false);
  assert.equal(validateExternalHttpsUrl('https://user:pass@youtube.com/watch?v=abc123').ok, false);
  assert.equal(validateExternalHttpsUrl('https://youtube.com:8443/watch?v=abc123').ok, false);
  assert.equal(validateExternalHttpsUrl('https://attacker.example/resource').ok, false);
  assert.equal(validateExternalHttpsUrl('https://127.0.0.1/admin').ok, false);
});
