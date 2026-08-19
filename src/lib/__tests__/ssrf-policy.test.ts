import { test, describe } from 'node:test';
import assert from 'node:assert';
import { formatValidationError, validateUrl } from '../ssrf-policy';

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
