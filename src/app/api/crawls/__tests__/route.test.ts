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
});
