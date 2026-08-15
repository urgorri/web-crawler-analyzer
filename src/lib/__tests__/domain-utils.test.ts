import { describe, it, expect } from 'vitest';
import {
  getHostnameFromUrl,
  getRegistrableDomainFromHostname,
  getRegistrableDomainFromUrl,
  isSameRegistrableDomain,
} from '../domain-utils';

describe('domain-utils', () => {
  describe('getHostnameFromUrl', () => {
    it('should extract the hostname from standard URLs', () => {
      expect(getHostnameFromUrl('https://example.com')).toBe('example.com');
      expect(getHostnameFromUrl('http://sub.example.com/path?query=1#hash')).toBe('sub.example.com');
      expect(getHostnameFromUrl('https://EXAMPLE.COM')).toBe('example.com');
    });

    it('should ignore ports in the URL', () => {
      expect(getHostnameFromUrl('http://localhost:3000')).toBe('localhost');
      expect(getHostnameFromUrl('https://example.com:8080/path')).toBe('example.com');
    });

    it('should return null for invalid URLs', () => {
      expect(getHostnameFromUrl('not a url')).toBeNull();
      expect(getHostnameFromUrl('')).toBeNull();
      expect(getHostnameFromUrl('example.com')).toBeNull(); // Missing protocol
    });
  });

  describe('getRegistrableDomainFromHostname', () => {
    it('should handle falsy values', () => {
      expect(getRegistrableDomainFromHostname(null)).toBeNull();
      expect(getRegistrableDomainFromHostname(undefined)).toBeNull();
      expect(getRegistrableDomainFromHostname('')).toBeNull();
    });

    it('should return the registrable domain for standard hostnames', () => {
      expect(getRegistrableDomainFromHostname('example.com')).toBe('example.com');
      expect(getRegistrableDomainFromHostname('sub.example.com')).toBe('example.com');
      expect(getRegistrableDomainFromHostname('a.b.c.example.com')).toBe('example.com');
    });

    it('should handle ccTLDs correctly', () => {
      expect(getRegistrableDomainFromHostname('example.co.uk')).toBe('example.co.uk');
      expect(getRegistrableDomainFromHostname('sub.example.co.uk')).toBe('example.co.uk');
      expect(getRegistrableDomainFromHostname('my.domain.com.au')).toBe('domain.com.au');
    });

    it('should return the original hostname if no registrable domain is found (e.g., localhost, IP)', () => {
      expect(getRegistrableDomainFromHostname('localhost')).toBe('localhost');
      expect(getRegistrableDomainFromHostname('1.2.3.4')).toBe('1.2.3.4');
    });

    it('should normalize domains to lowercase', () => {
      expect(getRegistrableDomainFromHostname('SUB.EXAMPLE.COM')).toBe('example.com');
    });
  });

  describe('getRegistrableDomainFromUrl', () => {
    it('should return the registrable domain from a valid URL', () => {
      expect(getRegistrableDomainFromUrl('https://sub.example.com/path')).toBe('example.com');
      expect(getRegistrableDomainFromUrl('http://localhost:3000')).toBe('localhost');
      expect(getRegistrableDomainFromUrl('https://1.2.3.4:8080')).toBe('1.2.3.4');
    });

    it('should return null for invalid URLs', () => {
      expect(getRegistrableDomainFromUrl('not a url')).toBeNull();
    });
  });

  describe('isSameRegistrableDomain', () => {
    it('should return true if both URLs share the same registrable domain', () => {
      expect(isSameRegistrableDomain('https://example.com', 'http://example.com')).toBe(true);
      expect(isSameRegistrableDomain('https://a.example.com', 'https://b.example.com')).toBe(true);
      expect(isSameRegistrableDomain('https://example.co.uk', 'http://sub.example.co.uk/path')).toBe(true);
    });

    it('should return false if the URLs have different registrable domains', () => {
      expect(isSameRegistrableDomain('https://example.com', 'https://example.org')).toBe(false);
      expect(isSameRegistrableDomain('https://google.com', 'https://youtube.com')).toBe(false);
      expect(isSameRegistrableDomain('https://example.co.uk', 'https://example.com')).toBe(false);
    });

    it('should return false if one or both URLs are invalid', () => {
      expect(isSameRegistrableDomain('not a url', 'https://example.com')).toBe(false);
      expect(isSameRegistrableDomain('https://example.com', 'not a url')).toBe(false);
      expect(isSameRegistrableDomain('not a url', 'also not a url')).toBe(false);
    });
  });
});
