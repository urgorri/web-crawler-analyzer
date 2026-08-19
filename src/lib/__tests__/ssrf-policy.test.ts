import { test, describe } from 'node:test';
import assert from 'node:assert';
import { formatValidationError, isPrivateIp } from '../ssrf-policy';

describe('isPrivateIp', () => {
  test('Should return true for localhost aliases', () => {
    assert.strictEqual(isPrivateIp('localhost'), true);
    assert.strictEqual(isPrivateIp('0.0.0.0'), true);
    assert.strictEqual(isPrivateIp('127.0.0.1'), true);
    assert.strictEqual(isPrivateIp('[::1]'), true);
  });

  test('Should return true for private IPv4 addresses', () => {
    // 10.0.0.0/8
    assert.strictEqual(isPrivateIp('10.0.0.1'), true);
    assert.strictEqual(isPrivateIp('10.255.255.255'), true);

    // 127.0.0.0/8 (loopback)
    assert.strictEqual(isPrivateIp('127.0.1.1'), true);
    assert.strictEqual(isPrivateIp('127.255.255.255'), true);

    // 0.0.0.0/8
    assert.strictEqual(isPrivateIp('0.255.255.255'), true);

    // 172.16.0.0/12
    assert.strictEqual(isPrivateIp('172.16.0.1'), true);
    assert.strictEqual(isPrivateIp('172.31.255.255'), true);

    // 192.168.0.0/16
    assert.strictEqual(isPrivateIp('192.168.0.1'), true);
    assert.strictEqual(isPrivateIp('192.168.255.255'), true);

    // 169.254.0.0/16 (link-local)
    assert.strictEqual(isPrivateIp('169.254.169.254'), true);
  });

  test('Should return false for public IPv4 addresses', () => {
    assert.strictEqual(isPrivateIp('8.8.8.8'), false);
    assert.strictEqual(isPrivateIp('1.1.1.1'), false);
    assert.strictEqual(isPrivateIp('172.15.255.255'), false); // Just outside 172.16.0.0/12
    assert.strictEqual(isPrivateIp('172.32.0.0'), false); // Just outside 172.16.0.0/12
    assert.strictEqual(isPrivateIp('192.169.0.1'), false); // Outside 192.168.0.0/16
    assert.strictEqual(isPrivateIp('11.0.0.0'), false); // Outside 10.0.0.0/8
  });

  test('Should return false for valid domain names', () => {
    assert.strictEqual(isPrivateIp('example.com'), false);
    assert.strictEqual(isPrivateIp('google.com'), false);
    assert.strictEqual(isPrivateIp('github.com'), false);
    assert.strictEqual(isPrivateIp('api.my-domain.org'), false);
  });

  test('Should handle edge cases', () => {
    // Invalid IP formats
    assert.strictEqual(isPrivateIp('192.168.1'), false);
    assert.strictEqual(isPrivateIp('10.0.0.1.5'), false);
    assert.strictEqual(isPrivateIp('not-an-ip'), false);

    // Valid IP but outside range with tricky numbers
    assert.strictEqual(isPrivateIp('192.167.255.255'), false);
    assert.strictEqual(isPrivateIp('169.253.255.255'), false);
  });
});

describe('formatValidationError', () => {
  test('Should return empty string for empty array', () => {
    assert.strictEqual(formatValidationError([]), '');
  });

  test('Should format single rejection correctly', () => {
    assert.strictEqual(
      formatValidationError([{ url: 'http://localhost', reason: 'Blocked' }]),
      'URL rejected: http://localhost - Blocked'
    );
  });

  test('Should format multiple rejections correctly', () => {
    assert.strictEqual(
      formatValidationError([
        { url: 'http://127.0.0.1', reason: 'Blocked' },
        { url: 'http://192.168.1.1', reason: 'Blocked' }
      ]),
      '2 URL(s) were rejected:\n  • http://127.0.0.1: Blocked\n  • http://192.168.1.1: Blocked'
    );
  });

  test('Should truncate and format more than 5 rejections correctly', () => {
    assert.strictEqual(
      formatValidationError([
        { url: 'http://1', reason: 'R1' },
        { url: 'http://2', reason: 'R2' },
        { url: 'http://3', reason: 'R3' },
        { url: 'http://4', reason: 'R4' },
        { url: 'http://5', reason: 'R5' },
        { url: 'http://6', reason: 'R6' },
        { url: 'http://7', reason: 'R7' }
      ]),
      '7 URL(s) were rejected:\n  • http://1: R1\n  • http://2: R2\n  • http://3: R3\n  • http://4: R4\n  • http://5: R5\n  ... and 2 more'
    );
  });
});
