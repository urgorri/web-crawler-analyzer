import { test, describe } from 'node:test';
import assert from 'node:assert';
import { formatValidationError, isPrivateIp, isPrivateHost, validateUrl, validateUrls } from '../ssrf-policy';

describe('isPrivateIp', () => {
  test('Should detect IPv4 private and loopback addresses', () => {
    assert.strictEqual(isPrivateIp('127.0.0.1'), true);
    assert.strictEqual(isPrivateIp('10.0.0.1'), true);
    assert.strictEqual(isPrivateIp('172.16.0.1'), true);
    assert.strictEqual(isPrivateIp('172.31.255.255'), true);
    assert.strictEqual(isPrivateIp('192.168.1.1'), true);
    assert.strictEqual(isPrivateIp('169.254.169.254'), true);
    assert.strictEqual(isPrivateIp('0.0.0.0'), true);
    assert.strictEqual(isPrivateIp('100.64.0.1'), true);
  });

  test('Should allow public IPv4 addresses', () => {
    assert.strictEqual(isPrivateIp('8.8.8.8'), false);
    assert.strictEqual(isPrivateIp('1.1.1.1'), false);
    assert.strictEqual(isPrivateIp('93.184.216.34'), false);
  });

  test('Should detect IPv6 private, loopback, and mapped addresses', () => {
    assert.strictEqual(isPrivateIp('::1'), true);
    assert.strictEqual(isPrivateIp('[::1]'), true);
    assert.strictEqual(isPrivateIp('localhost'), true);
    assert.strictEqual(isPrivateIp('::ffff:127.0.0.1'), true);
    assert.strictEqual(isPrivateIp('fd00::1'), true);
    assert.strictEqual(isPrivateIp('fe80::1'), true);
  });

  test('Should allow public IPv6 addresses', () => {
    assert.strictEqual(isPrivateIp('2607:f8b0:4001:c70::64'), false);
    assert.strictEqual(isPrivateIp('::ffff:8.8.8.8'), false);
  });
});

describe('isPrivateHost', () => {
  test('Should resolve hostnames pointing to loopback/private IPs', async () => {
    const resLocalhost = await isPrivateHost('localhost');
    assert.strictEqual(resLocalhost.isPrivate, true);

    const resNip = await isPrivateHost('127.0.0.1.nip.io');
    assert.strictEqual(resNip.isPrivate, true);
  });

  test('Should resolve public hostnames to non-private', async () => {
    const resGoogle = await isPrivateHost('google.com');
    assert.strictEqual(resGoogle.isPrivate, false);
  });
});

describe('validateUrl', () => {
  test('Should return invalid for non-URL strings', async () => {
    const result = await validateUrl('not-a-url');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errorCode, 'INVALID_URL');
  });

  test('Should block private/internal IP targets', async () => {
    const result1 = await validateUrl('http://127.0.0.1');
    assert.strictEqual(result1.isValid, false);
    assert.strictEqual(result1.errorCode, 'PRIVATE_NETWORK_BLOCKED');

    const result2 = await validateUrl('http://169.254.169.254/latest/meta-data/');
    assert.strictEqual(result2.isValid, false);
    assert.strictEqual(result2.errorCode, 'PRIVATE_NETWORK_BLOCKED');

    const result3 = await validateUrl('http://127.0.0.1.nip.io');
    assert.strictEqual(result3.isValid, false);
    assert.strictEqual(result3.errorCode, 'PRIVATE_NETWORK_BLOCKED');
  });

  test('Should allow private targets when allowPrivateTargets is true', async () => {
    const result = await validateUrl('http://127.0.0.1', { allowPrivateTargets: true });
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.url, 'http://127.0.0.1');
  });

  test('Should block unsupported protocols', async () => {
    const result = await validateUrl('ftp://example.com');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errorCode, 'UNSUPPORTED_PROTOCOL');
  });

  test('Should allow valid public URLs', async () => {
    const result = await validateUrl('https://example.com');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.url, 'https://example.com');
  });
});

describe('validateUrls', () => {
  test('Should filter out invalid/private URLs and return rejections', async () => {
    const { validUrls, rejections } = await validateUrls([
      'https://example.com',
      'http://127.0.0.1',
      'ftp://invalid.com',
    ]);

    assert.deepStrictEqual(validUrls, ['https://example.com']);
    assert.strictEqual(rejections.length, 2);
    assert.strictEqual(rejections[0].url, 'http://127.0.0.1');
    assert.strictEqual(rejections[0].errorCode, 'PRIVATE_NETWORK_BLOCKED');
    assert.strictEqual(rejections[1].url, 'ftp://invalid.com');
    assert.strictEqual(rejections[1].errorCode, 'UNSUPPORTED_PROTOCOL');
  });
});

describe('formatValidationError', () => {
  test('Should return empty string for empty array', () => {
    assert.strictEqual(formatValidationError([]), '');
  });

  test('Should format single rejection correctly', () => {
    assert.strictEqual(
      formatValidationError([{ url: 'http://localhost', reason: 'Blocked' }]),
      'http://localhost: Blocked (UNKNOWN)'
    );
  });

  test('Should format multiple rejections correctly', () => {
    assert.strictEqual(
      formatValidationError([
        { url: 'http://127.0.0.1', reason: 'Blocked' },
        { url: 'http://192.168.1.1', reason: 'Blocked' }
      ]),
      'http://127.0.0.1: Blocked (UNKNOWN), http://192.168.1.1: Blocked (UNKNOWN)'
    );
  });

  test('Should format more than 5 rejections correctly (no truncation)', () => {
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
      'http://1: R1 (UNKNOWN), http://2: R2 (UNKNOWN), http://3: R3 (UNKNOWN), http://4: R4 (UNKNOWN), http://5: R5 (UNKNOWN), http://6: R6 (UNKNOWN), http://7: R7 (UNKNOWN)'
    );
  });

  test('Should format with error code and message', () => {
    assert.strictEqual(
      formatValidationError([
        { url: 'http://localhost', message: 'Not allowed', code: 'E_BLOCKED' },
        { url: 'http://127.0.0.1', reason: 'Blocked', errorCode: 'PRIVATE_NETWORK_BLOCKED' }
      ]),
      'http://localhost: Not allowed (E_BLOCKED), http://127.0.0.1: Blocked (PRIVATE_NETWORK_BLOCKED)'
    );
  });
});
