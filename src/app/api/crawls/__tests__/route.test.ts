import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { SSRF_ERROR_MESSAGES } from '@/lib/ssrf-policy';

describe('POST /api/crawls', () => {
  test('Should return 400 when urls array is missing', async () => {
    // Create a mock NextRequest that returns a body without urls
    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.error, SSRF_ERROR_MESSAGES.NO_VALID_URLS);
  });

  test('Should return 400 when urls is not an array', async () => {
    // Create a mock NextRequest that returns a body with invalid urls type
    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({ urls: "http://example.com" }),
    });

    const response = await POST(request);

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.error, SSRF_ERROR_MESSAGES.NO_VALID_URLS);
  });

  test('Should return 400 when urls array is empty', async () => {
    // Create a mock NextRequest that returns a body with empty urls array
    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({ urls: [] }),
    });

    const response = await POST(request);

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.error, SSRF_ERROR_MESSAGES.NO_VALID_URLS);
  });

  test('Should return 400 when all URLs are rejected by SSRF policy', async () => {
    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({ urls: ['http://127.0.0.1', 'http://localhost'] }),
    });

    const response = await POST(request);

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.ok(typeof body.error === 'string');
    assert.ok(body.error.length > 0);
  });

  test('Should return 400 when all valid URLs fail scope check against seed domain', async () => {
    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({ urls: ['invalid-url-schema'] }),
    });

    const response = await POST(request);

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.ok(typeof body.error === 'string');
  });

  test('Should filter out-of-scope URLs and proceed with in-scope URLs', async () => {
    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Crawl',
        urls: ['https://example.com/page1', 'https://differentdomain.com/page2'],
      }),
    });

    const response = await POST(request);

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.ok(body.id);
    assert.strictEqual(body.name, 'Test Crawl');
    assert.strictEqual(body.status, 'running');
    // Only 1 in-scope URL remains
    assert.strictEqual(body.seedCount, 1);
  });

  test('Should return 200 and create crawl when valid URLs are provided', async () => {
    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Crawl',
        urls: ['https://example.com/page1', 'https://example.com/page2'],
      }),
    });

    const response = await POST(request);

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.ok(body.id);
    assert.strictEqual(body.name, 'Test Crawl');
    assert.strictEqual(body.status, 'running');
    assert.strictEqual(body.seedCount, 2);
  });
});
