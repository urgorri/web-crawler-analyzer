import { describe, it, expect } from 'vitest';
import { validateUrl } from '../ssrf-policy';

describe('ssrf-policy', () => {
  describe('validateUrl', () => {
    it('should accept valid public URLs', () => {
      expect(validateUrl('https://example.com')).toEqual({ isValid: true, url: 'https://example.com' });
      expect(validateUrl('http://public-api.org')).toEqual({ isValid: true, url: 'http://public-api.org' });
    });

    it('should trim surrounding whitespace from valid URLs', () => {
      expect(validateUrl('  https://example.com  ')).toEqual({ isValid: true, url: 'https://example.com' });
    });

    it('should reject non-HTTP/HTTPS protocols with UNSUPPORTED_PROTOCOL', () => {
      const ftpResult = validateUrl('ftp://example.com/file.txt');
      expect(ftpResult.isValid).toBe(false);
      expect(ftpResult.errorCode).toBe('UNSUPPORTED_PROTOCOL');

      const fileResult = validateUrl('file:///etc/passwd');
      expect(fileResult.isValid).toBe(false);
      expect(fileResult.errorCode).toBe('UNSUPPORTED_PROTOCOL');

      const dataResult = validateUrl('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==');
      expect(dataResult.isValid).toBe(false);
      expect(dataResult.errorCode).toBe('UNSUPPORTED_PROTOCOL');
    });

    it('should reject invalid URL formats with INVALID_URL', () => {
      const invalidResult = validateUrl('not-a-url');
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errorCode).toBe('INVALID_URL');

      const emptyResult = validateUrl('');
      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.errorCode).toBe('INVALID_URL');
    });

    it('should reject private/internal IPs and localhost by default with PRIVATE_NETWORK_BLOCKED', () => {
      const privateTargets = [
        'http://localhost',
        'http://127.0.0.1',
        'http://0.0.0.0',
        'http://[::1]',
        'http://10.0.0.1',
        'http://172.16.0.1',
        'http://172.31.255.255',
        'http://192.168.1.1',
        'http://169.254.169.254'
      ];

      for (const target of privateTargets) {
        const result = validateUrl(target);
        expect(result.isValid).toBe(false);
        expect(result.errorCode).toBe('PRIVATE_NETWORK_BLOCKED');
      }
    });

    it('should allow private/internal IPs if allowPrivateTargets is explicitly true', () => {
      const privateTargets = [
        'http://localhost',
        'http://127.0.0.1',
        'http://10.0.0.1',
        'http://192.168.1.1'
      ];

      for (const target of privateTargets) {
        const result = validateUrl(target, { allowPrivateTargets: true });
        expect(result.isValid).toBe(true);
        expect(result.url).toBe(target);
      }
    });
  });
});
