import { test, describe } from 'node:test';
import assert from 'node:assert';
import { formatValidationError, validateUrl } from '../ssrf-policy';

describe('validateUrl', () => {
  test('Should return valid for basic http/https URLs', () => {
    const result1 = validateUrl('https://example.com');
    assert.strictEqual(result1.isValid, true);
    assert.strictEqual(result1.url, 'https://example.com');

    const result2 = validateUrl('http://example.com');
    assert.strictEqual(result2.isValid, true);
    assert.strictEqual(result2.url, 'http://example.com');
  });

  test('Should trim whitespace from valid URLs', () => {
    const result = validateUrl('   https://example.com   ');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.url, 'https://example.com');
  });

  test('Should reject invalid URL formats', () => {
    const result1 = validateUrl('invalid-url');
    assert.strictEqual(result1.isValid, false);
    assert.strictEqual(result1.errorCode, 'INVALID_URL');

    const result2 = validateUrl('');
    assert.strictEqual(result2.isValid, false);
    assert.strictEqual(result2.errorCode, 'INVALID_URL');
  });

  test('Should reject unsupported protocols', () => {
    const result1 = validateUrl('ftp://example.com');
    assert.strictEqual(result1.isValid, false);
    assert.strictEqual(result1.errorCode, 'UNSUPPORTED_PROTOCOL');

    const result2 = validateUrl('file:///etc/passwd');
    assert.strictEqual(result2.isValid, false);
    assert.strictEqual(result2.errorCode, 'UNSUPPORTED_PROTOCOL');
  });

  test('Should reject private network addresses by default', () => {
    const addresses = [
      'http://localhost',
      'http://127.0.0.1',
      'http://192.168.1.1',
      'http://10.0.0.1',
      'http://172.16.0.1',
      'http://169.254.169.254',
      'http://0.0.0.0',
      'http://[::1]'
    ];

    for (const addr of addresses) {
      const result = validateUrl(addr);
      assert.strictEqual(
        result.isValid,
        false,
        `Expected ${addr} to be rejected`
      );
      assert.strictEqual(
        result.errorCode,
        'PRIVATE_NETWORK_BLOCKED',
        `Expected ${addr} to have PRIVATE_NETWORK_BLOCKED error`
      );
    }
  });

  test('Should allow private network addresses if allowPrivateTargets is true', () => {
    const addresses = [
      'http://localhost',
      'http://127.0.0.1',
      'http://192.168.1.1',
      'http://10.0.0.1'
    ];

    for (const addr of addresses) {
      const result = validateUrl(addr, { allowPrivateTargets: true });
      assert.strictEqual(
        result.isValid,
        true,
        `Expected ${addr} to be allowed`
      );
    }
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
