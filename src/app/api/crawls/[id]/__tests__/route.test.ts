import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, DELETE } from '../route';
import * as crawlStorage from '@/lib/crawl-storage';

vi.mock('@/lib/crawl-storage', () => ({
  getCrawl: vi.fn(),
  deleteCrawl: vi.fn(),
}));

describe('GET /api/crawls/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Should return 400 when ID format is invalid', async () => {
    const request = new NextRequest('http://localhost/api/crawls/invalid%20id!');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'invalid id!' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid ID format');
  });

  it('Should return 404 when crawl is not found', async () => {
    vi.mocked(crawlStorage.getCrawl).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/crawls/non-existent-id');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'non-existent-id' }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Crawl not found');
  });

  it('Should return 200 with crawl record when found', async () => {
    const mockCrawl: crawlStorage.CrawlRecord = {
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

    vi.mocked(crawlStorage.getCrawl).mockResolvedValue(mockCrawl);

    const request = new NextRequest('http://localhost/api/crawls/valid-crawl-id');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'valid-crawl-id' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(mockCrawl);
  });

  it('Should return 500 when an unexpected error occurs during fetch', async () => {
    vi.mocked(crawlStorage.getCrawl).mockRejectedValue(new Error('Unexpected fetch error'));

    const request = new NextRequest('http://localhost/api/crawls/valid-id');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'valid-id' }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to fetch crawl');
  });
});

describe('DELETE /api/crawls/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Should return 400 when ID format is invalid', async () => {
    const request = new NextRequest('http://localhost/api/crawls/invalid%20id!', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'invalid id!' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid ID format');
  });

  it('Should return 404 when crawl to delete is not found', async () => {
    vi.mocked(crawlStorage.deleteCrawl).mockResolvedValue(false);

    const request = new NextRequest('http://localhost/api/crawls/non-existent-id', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'non-existent-id' }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Crawl not found');
  });

  it('Should return 200 with success when crawl is deleted', async () => {
    vi.mocked(crawlStorage.deleteCrawl).mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/crawls/valid-crawl-id', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'valid-crawl-id' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  it('Should return 500 when deleteCrawl throws an unexpected error', async () => {
    vi.mocked(crawlStorage.deleteCrawl).mockRejectedValue(new Error('Unexpected delete error'));

    const request = new NextRequest('http://localhost/api/crawls/valid-id', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'valid-id' }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to delete crawl');
  });
});
