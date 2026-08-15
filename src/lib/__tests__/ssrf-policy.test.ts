import { test, describe } from 'node:test';
import assert from 'node:assert';
import { formatValidationError } from '../ssrf-policy';

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
