import { describe, it, expect } from 'vitest';
import { formatValidationError, validateUrl, validateUrls } from '../ssrf-policy';

describe('validateUrls', () => {
  it('Should return empty arrays for empty input', () => {
    const result = validateUrls([]);
    expect(result.validUrls).toEqual([]);
    expect(result.rejections).toEqual([]);
  });

  it('Should validate and trim all valid public URLs', () => {
    const urls = [
      '  https://example.com  ',
      'http://google.com/path?q=1',
      'https://sub.domain.org'
    ];
    const result = validateUrls(urls);
    expect(result.validUrls).toEqual([
      'https://example.com',
      'http://google.com/path?q=1',
      'https://sub.domain.org'
    ]);
    expect(result.rejections).toEqual([]);
  });

  it('Should reject invalid formats and unsupported protocols', () => {
    const urls = [
      'not-a-url',
      'ftp://files.example.com',
      'mailto:user@example.com'
    ];
    const result = validateUrls(urls);
    expect(result.validUrls).toEqual([]);
    expect(result.rejections.length).toBe(3);
    expect(result.rejections[0].url).toBe('not-a-url');
    expect(result.rejections[0].errorCode).toBe('INVALID_URL');
    expect(result.rejections[1].url).toBe('ftp://files.example.com');
    expect(result.rejections[1].errorCode).toBe('UNSUPPORTED_PROTOCOL');
    expect(result.rejections[2].url).toBe('mailto:user@example.com');
    expect(result.rejections[2].errorCode).toBe('UNSUPPORTED_PROTOCOL');
  });

  it('Should reject private/internal URLs by default', () => {
    const urls = [
      'http://localhost/api',
      'http://127.0.0.1:8080',
      'http://192.168.1.1'
    ];
    const result = validateUrls(urls, { allowPrivateTargets: false });
    expect(result.validUrls).toEqual([]);
    expect(result.rejections.length).toBe(3);
    expect(result.rejections[0].errorCode).toBe('PRIVATE_NETWORK_BLOCKED');
    expect(result.rejections[1].errorCode).toBe('PRIVATE_NETWORK_BLOCKED');
    expect(result.rejections[2].errorCode).toBe('PRIVATE_NETWORK_BLOCKED');
  });

  it('Should allow private targets when option allowPrivateTargets is true', () => {
    const urls = [
      'http://localhost/api',
      'http://127.0.0.1:8080',
      'https://example.com'
    ];
    const result = validateUrls(urls, { allowPrivateTargets: true });
    expect(result.validUrls).toEqual([
      'http://localhost/api',
      'http://127.0.0.1:8080',
      'https://example.com'
    ]);
    expect(result.rejections).toEqual([]);
  });

  it('Should handle a mixed batch of valid, invalid, and blocked URLs', () => {
    const urls = [
      ' https://valid.com ',
      'invalid-format',
      'http://10.0.0.1/admin',
      'https://another-valid.org'
    ];
    const result = validateUrls(urls, { allowPrivateTargets: false });
    expect(result.validUrls).toEqual([
      'https://valid.com',
      'https://another-valid.org'
    ]);
    expect(result.rejections.length).toBe(2);
    expect(result.rejections[0]).toEqual({
      url: 'invalid-format',
      reason: 'Invalid URL format.',
      errorCode: 'INVALID_URL'
    });
    expect(result.rejections[1].url).toBe('http://10.0.0.1/admin');
    expect(result.rejections[1].errorCode).toBe('PRIVATE_NETWORK_BLOCKED');
  });
});

describe('validateUrl', () => {
  it('Should return invalid for non-URL strings', () => {
    const result = validateUrl('not-a-url');
    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe('INVALID_URL');
  });
});

describe('formatValidationError', () => {
  it('Should return empty string for empty array', () => {
    expect(formatValidationError([])).toBe('');
  });

  it('Should format single rejection correctly', () => {
    expect(
      formatValidationError([{ url: 'http://localhost', reason: 'Blocked' }])
    ).toBe('http://localhost: Blocked (UNKNOWN)');
  });

  it('Should format multiple rejections correctly', () => {
    expect(
      formatValidationError([
        { url: 'http://127.0.0.1', reason: 'Blocked' },
        { url: 'http://192.168.1.1', reason: 'Blocked' }
      ])
    ).toBe('http://127.0.0.1: Blocked (UNKNOWN), http://192.168.1.1: Blocked (UNKNOWN)');
  });

  it('Should format more than 5 rejections correctly (no truncation)', () => {
    expect(
      formatValidationError([
        { url: 'http://1', reason: 'R1' },
        { url: 'http://2', reason: 'R2' },
        { url: 'http://3', reason: 'R3' },
        { url: 'http://4', reason: 'R4' },
        { url: 'http://5', reason: 'R5' },
        { url: 'http://6', reason: 'R6' },
        { url: 'http://7', reason: 'R7' }
      ])
    ).toBe('http://1: R1 (UNKNOWN), http://2: R2 (UNKNOWN), http://3: R3 (UNKNOWN), http://4: R4 (UNKNOWN), http://5: R5 (UNKNOWN), http://6: R6 (UNKNOWN), http://7: R7 (UNKNOWN)');
  });

  it('Should format with error code and message', () => {
    expect(
      formatValidationError([
        { url: 'http://localhost', message: 'Not allowed', code: 'E_BLOCKED' },
        { url: 'http://127.0.0.1', reason: 'Blocked', errorCode: 'PRIVATE_NETWORK_BLOCKED' }
      ])
    ).toBe('http://localhost: Not allowed (E_BLOCKED), http://127.0.0.1: Blocked (PRIVATE_NETWORK_BLOCKED)');
  });
});
