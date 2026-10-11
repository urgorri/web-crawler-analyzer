import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getCrawl } from '@/lib/crawl-storage';
import { normalizeCrawl } from '@/lib/crawl-json-normalizer';
import type { CrawlRecord } from '@/lib/crawl-storage';
import type { NormalizedCrawl } from '@/app/api/crawls/types';

vi.mock('@/lib/crawl-storage', () => ({
  getCrawl: vi.fn(),
}));

vi.mock('@/lib/crawl-json-normalizer', () => ({
  normalizeCrawl: vi.fn(),
}));

describe('GET /api/crawls/[id]/export', () => {
  const mockGetCrawl = vi.mocked(getCrawl);
  const mockNormalizeCrawl = vi.mocked(normalizeCrawl);

  const sampleCrawl: CrawlRecord = {
    id: 'valid-id-123',
    name: 'Test Crawl',
    status: 'completed',
    seedCount: 1,
    pageCount: 1,
    errorCount: 0,
    startedAt: '2025-01-01T00:00:00.000Z',
    completedAt: '2025-01-01T00:01:00.000Z',
    urls: ['https://example.com'],
    config: null,
    engine: 'playwright',
    domainIntel: null,
    warnings: [],
    errors: [],
    lastErrorStage: null,
    pages: [],
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 when id format is invalid', async () => {
    const request = new NextRequest('http://localhost/api/crawls/invalid!id/export');
    const params = Promise.resolve({ id: 'invalid!id' });

    const response = await GET(request, { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Invalid ID format' });
    expect(mockGetCrawl).not.toHaveBeenCalled();
  });

  it('returns 404 when crawl is not found', async () => {
    mockGetCrawl.mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost/api/crawls/nonexistent-id/export');
    const params = Promise.resolve({ id: 'nonexistent-id' });

    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: 'Crawl not found' });
    expect(mockGetCrawl).toHaveBeenCalledWith('nonexistent-id');
  });

  it('returns default normalized (v2) export format and correct headers', async () => {
    const normalizedData = {
      schemaVersion: 4,
      id: 'valid-id-123',
      name: 'Test Crawl',
      pages: [],
      entities: {},
    };

    mockGetCrawl.mockResolvedValueOnce(sampleCrawl);
    mockNormalizeCrawl.mockReturnValueOnce(normalizedData as unknown as NormalizedCrawl);

    const request = new NextRequest('http://localhost/api/crawls/valid-id-123/export');
    const params = Promise.resolve({ id: 'valid-id-123' });

    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="crawl-valid-id-123-v2.json"'
    );

    const body = await response.json();
    expect(body).toEqual(normalizedData);
    expect(mockNormalizeCrawl).toHaveBeenCalledWith(sampleCrawl);
  });

  it('returns legacy export format when format=legacy query parameter is provided', async () => {
    mockGetCrawl.mockResolvedValueOnce(sampleCrawl);

    const request = new NextRequest('http://localhost/api/crawls/valid-id-123/export?format=legacy');
    const params = Promise.resolve({ id: 'valid-id-123' });

    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="crawl-valid-id-123.json"'
    );

    const body = await response.json();
    expect(body).toEqual(sampleCrawl);
    expect(mockNormalizeCrawl).not.toHaveBeenCalled();
  });

  it('returns 500 when getCrawl throws an internal error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetCrawl.mockRejectedValueOnce(new Error('Storage failure'));

    const request = new NextRequest('http://localhost/api/crawls/valid-id-123/export');
    const params = Promise.resolve({ id: 'valid-id-123' });

    const response = await GET(request, { params });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'Failed to export crawl' });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
