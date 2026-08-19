import { test, describe } from 'node:test';
import assert from 'node:assert';
import { formatValidationError, validateUrl, validateUrls } from '../ssrf-policy';

describe('validateUrls', () => {
  test('Should return empty arrays for empty input', () => {
    const result = validateUrls([]);
    assert.deepStrictEqual(result.validUrls, []);
    assert.deepStrictEqual(result.rejections, []);
  });

  test('Should validate and trim all valid public URLs', () => {
    const urls = [
      '  https://example.com  ',
      'http://google.com/path?q=1',
      'https://sub.domain.org'
    ];
    const result = validateUrls(urls);
    assert.deepStrictEqual(result.validUrls, [
      'https://example.com',
      'http://google.com/path?q=1',
      'https://sub.domain.org'
    ]);
    assert.deepStrictEqual(result.rejections, []);
  });

  test('Should reject invalid formats and unsupported protocols', () => {
    const urls = [
      'not-a-url',
      'ftp://files.example.com',
      'mailto:user@example.com'
    ];
    const result = validateUrls(urls);
    assert.deepStrictEqual(result.validUrls, []);
    assert.strictEqual(result.rejections.length, 3);
    assert.strictEqual(result.rejections[0].url, 'not-a-url');
    assert.strictEqual(result.rejections[0].errorCode, 'INVALID_URL');
    assert.strictEqual(result.rejections[1].url, 'ftp://files.example.com');
    assert.strictEqual(result.rejections[1].errorCode, 'UNSUPPORTED_PROTOCOL');
    assert.strictEqual(result.rejections[2].url, 'mailto:user@example.com');
    assert.strictEqual(result.rejections[2].errorCode, 'UNSUPPORTED_PROTOCOL');
  });

  test('Should reject private/internal URLs by default', () => {
    const urls = [
      'http://localhost/api',
      'http://127.0.0.1:8080',
      'http://192.168.1.1'
    ];
    const result = validateUrls(urls, { allowPrivateTargets: false });
    assert.deepStrictEqual(result.validUrls, []);
    assert.strictEqual(result.rejections.length, 3);
    assert.strictEqual(result.rejections[0].errorCode, 'PRIVATE_NETWORK_BLOCKED');
    assert.strictEqual(result.rejections[1].errorCode, 'PRIVATE_NETWORK_BLOCKED');
    assert.strictEqual(result.rejections[2].errorCode, 'PRIVATE_NETWORK_BLOCKED');
  });

  test('Should allow private targets when option allowPrivateTargets is true', () => {
    const urls = [
      'http://localhost/api',
      'http://127.0.0.1:8080',
      'https://example.com'
    ];
    const result = validateUrls(urls, { allowPrivateTargets: true });
    assert.deepStrictEqual(result.validUrls, [
      'http://localhost/api',
      'http://127.0.0.1:8080',
      'https://example.com'
    ]);
    assert.deepStrictEqual(result.rejections, []);
  });

  test('Should handle a mixed batch of valid, invalid, and blocked URLs', () => {
    const urls = [
      ' https://valid.com ',
      'invalid-format',
      'http://10.0.0.1/admin',
      'https://another-valid.org'
    ];
    const result = validateUrls(urls, { allowPrivateTargets: false });
    assert.deepStrictEqual(result.validUrls, [
      'https://valid.com',
      'https://another-valid.org'
    ]);
    assert.strictEqual(result.rejections.length, 2);
    assert.deepStrictEqual(result.rejections[0], {
      url: 'invalid-format',
      reason: 'Invalid URL format.',
      errorCode: 'INVALID_URL'
    });
    assert.strictEqual(result.rejections[1].url, 'http://10.0.0.1/admin');
    assert.strictEqual(result.rejections[1].errorCode, 'PRIVATE_NETWORK_BLOCKED');
  });
});

describe('validateUrl', () => {
  test('Should return invalid for non-URL strings', () => {
    const result = validateUrl('not-a-url');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errorCode, 'INVALID_URL');
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
