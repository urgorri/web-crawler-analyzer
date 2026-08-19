import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSeedDomain, flattenPageDomains } from '../domain-intel.ts';

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

describe('flattenPageDomains', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(flattenPageDomains([]), []);
  });

  it('extracts unique registrable domains', () => {
    assert.deepEqual(
      flattenPageDomains([
        'https://example.com/page1',
        'https://sub.example.com/page2',
        'http://example.org'
      ]),
      ['example.com', 'example.org']
    );
  });

  it('ignores malformed URLs', () => {
    assert.deepEqual(
      flattenPageDomains([
        'https://example.com',
        'not a url',
        'http://example.org'
      ]),
      ['example.com', 'example.org']
    );
  });

  it('handles country code TLDs', () => {
    assert.deepEqual(
      flattenPageDomains([
        'https://example.co.uk',
        'https://sub.example.co.uk'
      ]),
      ['example.co.uk']
    );
  });
});
