import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fsPromises from 'node:fs/promises';
import { NextRequest } from 'next/server';
import { GET, DELETE } from '../route';

describe('GET /api/crawls/[id]', () => {
  test('Should return 400 when ID format is invalid', async () => {
    const request = new NextRequest('http://localhost/api/crawls/invalid%20id!');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'invalid id!' }),
    });

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.error, 'Invalid ID format');
  });

  test('Should return 404 when crawl is not found', async (t) => {
    t.mock.method(fsPromises, 'readFile', async () => {
      const err = new Error('File not found') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });

    const request = new NextRequest('http://localhost/api/crawls/non-existent-id');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'non-existent-id' }),
    });

    assert.strictEqual(response.status, 404);
    const body = await response.json();
    assert.strictEqual(body.error, 'Crawl not found');
  });

  test('Should return 200 with crawl record when found', async (t) => {
    const mockCrawl = {
      id: 'valid-crawl-id',
      name: 'Test Crawl',
      status: 'completed',
      seedCount: 1,
      pageCount: 5,
      errorCount: 0,
      startedAt: '2023-10-01T10:00:00.000Z',
      completedAt: '2023-10-01T10:05:00.000Z',
      urls: ['https://example.com'],
      config: null,
      engine: 'playwright',
      warnings: [],
      errors: [],
      lastErrorStage: null,
      pages: [],
    };

    t.mock.method(fsPromises, 'readFile', async () => JSON.stringify(mockCrawl));

    const request = new NextRequest('http://localhost/api/crawls/valid-crawl-id');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'valid-crawl-id' }),
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.deepStrictEqual(body, mockCrawl);
  });

  test('Should return 500 when an unexpected error occurs during fetch', async () => {
    const request = new NextRequest('http://localhost/api/crawls/valid-id');
    const response = await GET(request, {
      params: Promise.reject(new Error('Unexpected params error')),
    });

    assert.strictEqual(response.status, 500);
    const body = await response.json();
    assert.strictEqual(body.error, 'Failed to fetch crawl');
  });
});

describe('DELETE /api/crawls/[id]', () => {
  test('Should return 400 when ID format is invalid', async () => {
    const request = new NextRequest('http://localhost/api/crawls/invalid%20id!', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'invalid id!' }),
    });

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.error, 'Invalid ID format');
  });

  test('Should return 404 when crawl to delete is not found', async (t) => {
    t.mock.method(fsPromises, 'rm', async () => {
      throw new Error('File not found');
    });

    const request = new NextRequest('http://localhost/api/crawls/non-existent-id', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'non-existent-id' }),
    });

    assert.strictEqual(response.status, 404);
    const body = await response.json();
    assert.strictEqual(body.error, 'Crawl not found');
  });

  test('Should return 200 with success when crawl is deleted', async (t) => {
    t.mock.method(fsPromises, 'rm', async () => undefined);

    const request = new NextRequest('http://localhost/api/crawls/valid-crawl-id', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'valid-crawl-id' }),
    });

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.deepStrictEqual(body, { success: true });
  });

  test('Should return 500 when deleteCrawl throws an unexpected error', async () => {
    const request = new NextRequest('http://localhost/api/crawls/valid-id', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.reject(new Error('Unexpected params error')),
    });

    assert.strictEqual(response.status, 500);
    const body = await response.json();
    assert.strictEqual(body.error, 'Failed to delete crawl');
  });
});
