import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs, existsSync, unlinkSync } from 'node:fs';
import { getSeedDomain, getObservedDomain, gatherDomainIntel } from '../domain-intel.ts';

describe('getSeedDomain', () => {
  it('extracts the domain from a simple URL', () => {
    assert.strictEqual(getSeedDomain('https://example.com'), 'example.com');
  });

  it('extracts the domain from a URL with a path and query', () => {
    assert.strictEqual(getSeedDomain('https://example.com/path?query=1'), 'example.com');
  });

  it('extracts the registrable domain from a subdomain', () => {
    assert.strictEqual(getSeedDomain('https://sub.example.com'), 'example.com');
  });

  it('extracts the registrable domain from a nested subdomain', () => {
    assert.strictEqual(getSeedDomain('https://a.b.c.example.com'), 'example.com');
  });

  it('handles country code TLDs', () => {
    assert.strictEqual(getSeedDomain('https://example.co.uk'), 'example.co.uk');
  });

  it('handles subdomains on country code TLDs', () => {
    assert.strictEqual(getSeedDomain('https://sub.example.co.uk'), 'example.co.uk');
  });

  it('handles http protocol', () => {
    assert.strictEqual(getSeedDomain('http://example.com'), 'example.com');
  });

  it('handles ports in the URL', () => {
    assert.strictEqual(getSeedDomain('https://example.com:8080'), 'example.com');
  });

  it('throws an error for invalid URLs', () => {
    assert.throws(() => getSeedDomain('not-a-url'), {
      name: 'TypeError'
    });
  });

  it('handles localhost or internal ips', () => {
    assert.strictEqual(getSeedDomain('http://localhost:3000'), 'localhost');
    assert.strictEqual(getSeedDomain('http://127.0.0.1:8080'), '127.0.0.1');
  });
});

describe('getObservedDomain', () => {
  it('returns the most observed domain', () => {
    const urls = [
      'https://example.com/page1',
      'https://example.com/page2',
      'https://other.com/page1'
    ];
    assert.strictEqual(getObservedDomain(urls, 'fallback.com'), 'example.com');
  });

  it('handles ties in domain frequency by returning the first winner', () => {
    const urls = [
      'https://other.com/page1',
      'https://example.com/page1',
      'https://example.com/page2',
      'https://other.com/page2'
    ];
    // other.com appears first in the iteration order, so it wins the tie if scores are strictly > max
    assert.strictEqual(getObservedDomain(urls, 'fallback.com'), 'other.com');
  });

  it('ignores malformed URLs', () => {
    const urls = [
      'not-a-url',
      'https://example.com/page1',
      'invalid-url',
      'https://example.com/page2'
    ];
    assert.strictEqual(getObservedDomain(urls, 'fallback.com'), 'example.com');
  });

  it('falls back to the fallback value when all URLs are invalid', () => {
    const urls = ['not-a-url', 'invalid-url'];
    assert.strictEqual(getObservedDomain(urls, 'fallback.com'), 'fallback.com');
  });

  it('falls back to the fallback value when the urls array is empty', () => {
    assert.strictEqual(getObservedDomain([], 'fallback.com'), 'fallback.com');
  });
});

describe('gatherDomainIntel', () => {
  it('returns a valid DomainIntel structure', async () => {
    const result = await gatherDomainIntel('example.com', 'example.com', 'https://example.com', { portScanPorts: [] });
    assert.strictEqual(result.seedDomain, 'example.com');
    assert.strictEqual(result.seedUrl, 'https://example.com');
    assert.ok(Array.isArray(result.resolvedIps));
    assert.ok(Array.isArray(result.traceroute));
    assert.ok(Array.isArray(result.ports));
  });

  it('writes debug file asynchronously when DEBUG environment variable is set', async () => {
    const debugFilePath = 'intel-debug.json';
    if (existsSync(debugFilePath)) {
      unlinkSync(debugFilePath);
    }

    process.env.DEBUG = 'true';
    try {
      const start = performance.now();
      const result = await gatherDomainIntel('localhost', 'localhost', 'http://localhost:3000', { portScanPorts: [] });
      const duration = performance.now() - start;

      assert.ok(duration < 5000, `Execution took ${duration}ms`);
      assert.strictEqual(result.seedDomain, 'localhost');
      assert.ok(existsSync(debugFilePath), 'intel-debug.json should be created when DEBUG=true');

      const content = await fs.readFile(debugFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      assert.strictEqual(parsed.seedDomain, 'localhost');
    } finally {
      delete process.env.DEBUG;
      if (existsSync(debugFilePath)) {
        unlinkSync(debugFilePath);
      }
    }
  });
});
