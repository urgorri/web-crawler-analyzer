import { describe, it, expect } from 'vitest';
import { validateUrls } from '../ssrf-policy';

describe('validateUrls', () => {
  it('should return empty arrays when given an empty array of URLs', () => {
    const result = validateUrls([]);
    expect(result.validUrls).toEqual([]);
    expect(result.rejections).toEqual([]);
  });

  it('should accept an array of valid URLs', () => {
    const urls = ['https://google.com', 'http://example.com'];
    const result = validateUrls(urls);
    expect(result.validUrls).toEqual(urls);
    expect(result.rejections).toEqual([]);
  });

  it('should reject an array of invalid URLs', () => {
    const urls = ['ftp://example.com', 'not-a-url', 'http://localhost'];
    const result = validateUrls(urls, { allowPrivateTargets: false });
    expect(result.validUrls).toEqual([]);
    expect(result.rejections).toHaveLength(3);

    // Check specific rejection reasons or error codes
    expect(result.rejections[0].errorCode).toBe('UNSUPPORTED_PROTOCOL');
    expect(result.rejections[1].errorCode).toBe('INVALID_URL');
    expect(result.rejections[2].errorCode).toBe('PRIVATE_NETWORK_BLOCKED');
  });

  it('should separate valid and invalid URLs correctly', () => {
    const urls = [
      'https://google.com',
      'ftp://example.com',
      'http://127.0.0.1',
      'https://example.com',
      'invalid-url'
    ];

    const result = validateUrls(urls, { allowPrivateTargets: false });

    expect(result.validUrls).toEqual([
      'https://google.com',
      'https://example.com'
    ]);

    expect(result.rejections).toHaveLength(3);
    expect(result.rejections.map(r => r.url)).toEqual([
      'ftp://example.com',
      'http://127.0.0.1',
      'invalid-url'
    ]);
  });

  it('should pass options properly to validateUrl', () => {
    const urls = ['http://localhost', 'http://192.168.1.1', 'http://10.0.0.1'];

    // Test with allowPrivateTargets: true
    const resultAllowed = validateUrls(urls, { allowPrivateTargets: true });
    expect(resultAllowed.validUrls).toEqual(urls);
    expect(resultAllowed.rejections).toEqual([]);

    // Test with allowPrivateTargets: false
    const resultBlocked = validateUrls(urls, { allowPrivateTargets: false });
    expect(resultBlocked.validUrls).toEqual([]);
    expect(resultBlocked.rejections).toHaveLength(3);
  });
});
