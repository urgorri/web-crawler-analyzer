import { describe, it, expect } from 'vitest';
import { getObservedDomain } from './domain-intel';

describe('getObservedDomain', () => {
  it('returns the most frequent domain (happy path)', () => {
    const urls = [
      'https://example.com/page1',
      'https://example.com/page2',
      'https://anotherexample.com/page1'
    ];
    expect(getObservedDomain(urls, 'fallback.com')).toBe('example.com');
  });

  it('correctly handles tie-breakers (returns the first encountered domain)', () => {
    const urls = [
      'https://first.com/page',
      'https://second.com/page',
      'https://second.com/page2',
      'https://first.com/page2'
    ];
    // Both first.com and second.com have 2 occurrences, but first.com was seen first
    expect(getObservedDomain(urls, 'fallback.com')).toBe('first.com');
  });

  it('ignores malformed URLs', () => {
    const urls = [
      'not a url',
      'https://example.com',
      '://badurl',
      'https://example.com/2'
    ];
    expect(getObservedDomain(urls, 'fallback.com')).toBe('example.com');
  });

  it('returns the fallback if the list is empty', () => {
    expect(getObservedDomain([], 'fallback.com')).toBe('fallback.com');
  });

  it('returns the fallback if all URLs are malformed', () => {
    const urls = ['invalid', 'also invalid'];
    expect(getObservedDomain(urls, 'fallback.com')).toBe('fallback.com');
  });

});
