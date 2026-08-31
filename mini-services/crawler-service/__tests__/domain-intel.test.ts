import { describe, it, expect } from 'vitest';
import { getSeedDomain, getObservedDomain } from '../domain-intel';

describe('getSeedDomain', () => {
  it('extracts the domain from a simple URL', () => {
    expect(getSeedDomain('https://example.com')).toBe('example.com');
  });

  it('extracts the domain from a URL with a path and query', () => {
    expect(getSeedDomain('https://example.com/path?query=1')).toBe('example.com');
  });

  it('extracts the registrable domain from a subdomain', () => {
    expect(getSeedDomain('https://sub.example.com')).toBe('example.com');
  });

  it('extracts the registrable domain from a nested subdomain', () => {
    expect(getSeedDomain('https://a.b.c.example.com')).toBe('example.com');
  });

  it('handles country code TLDs', () => {
    expect(getSeedDomain('https://example.co.uk')).toBe('example.co.uk');
  });

  it('handles subdomains on country code TLDs', () => {
    expect(getSeedDomain('https://sub.example.co.uk')).toBe('example.co.uk');
  });

  it('handles http protocol', () => {
    expect(getSeedDomain('http://example.com')).toBe('example.com');
  });

  it('handles ports in the URL', () => {
    expect(getSeedDomain('https://example.com:8080')).toBe('example.com');
  });

  it('throws an error for invalid URLs', () => {
    expect(() => getSeedDomain('not-a-url')).toThrow();
  });

  it('handles localhost or internal ips', () => {
    expect(getSeedDomain('http://localhost:3000')).toBe('localhost');
    expect(getSeedDomain('http://127.0.0.1:8080')).toBe('127.0.0.1');
  });
});

describe('getObservedDomain', () => {
  it('returns the most observed domain', () => {
    const urls = [
      'https://example.com/page1',
      'https://example.com/page2',
      'https://other.com/page1'
    ];
    expect(getObservedDomain(urls, 'fallback.com')).toBe('example.com');
  });

  it('handles ties in domain frequency by returning the first winner', () => {
    const urls = [
      'https://other.com/page1',
      'https://example.com/page1',
      'https://example.com/page2',
      'https://other.com/page2'
    ];
    // other.com appears first in the iteration order, so it wins the tie if scores are strictly > max
    expect(getObservedDomain(urls, 'fallback.com')).toBe('other.com');
  });

  it('ignores malformed URLs', () => {
    const urls = [
      'not-a-url',
      'https://example.com/page1',
      'invalid-url',
      'https://example.com/page2'
    ];
    expect(getObservedDomain(urls, 'fallback.com')).toBe('example.com');
  });

  it('falls back to the fallback value when all URLs are invalid', () => {
    const urls = ['not-a-url', 'invalid-url'];
    expect(getObservedDomain(urls, 'fallback.com')).toBe('fallback.com');
  });

  it('falls back to the fallback value when the urls array is empty', () => {
    expect(getObservedDomain([], 'fallback.com')).toBe('fallback.com');
  });
});
