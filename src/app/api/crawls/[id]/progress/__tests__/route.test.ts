import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { readFile } from 'fs/promises';
import { getCrawl, CrawlRecord } from '@/lib/crawl-storage';

vi.mock('fs/promises');
vi.mock('@/lib/crawl-storage');

describe('GET /api/crawls/[id]/progress', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return 400 if ID format is invalid', async () => {
    const request = new NextRequest('http://localhost/api/crawls/invalid..id/progress');
    const params = Promise.resolve({ id: '../invalid-id!' });

    const response = await GET(request, { params });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toEqual({ error: 'Invalid ID format' });
  });

  it('should return progress data if progress file exists', async () => {
    const mockProgress = {
      pageCount: 15,
      errorCount: 2,
      status: 'running',
    };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(mockProgress));

    const request = new NextRequest('http://localhost/api/crawls/valid-id-123/progress');
    const params = Promise.resolve({ id: 'valid-id-123' });

    const response = await GET(request, { params });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual(mockProgress);
    expect(readFile).toHaveBeenCalledWith(
      expect.stringContaining('valid-id-123.progress.json'),
      'utf8'
    );
  });

  it('should fallback to crawl storage if progress file is missing and crawl is completed', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('File not found'));
    const mockCrawl: CrawlRecord = {
      id: 'valid-id-456',
      name: 'Test Crawl',
      urls: ['https://example.com'],
      startedAt: '2025-01-01T00:00:00.000Z',
      completedAt: '2025-01-01T00:05:00.000Z',
      status: 'completed',
      seedCount: 1,
      pageCount: 20,
      errorCount: 0,
      config: null,
      engine: 'playwright',
      warnings: [],
      errors: [],
      lastErrorStage: null,
      pages: [],
    };
    vi.mocked(getCrawl).mockResolvedValueOnce(mockCrawl);

    const request = new NextRequest('http://localhost/api/crawls/valid-id-456/progress');
    const params = Promise.resolve({ id: 'valid-id-456' });

    const response = await GET(request, { params });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({
      pageCount: 20,
      errorCount: 0,
      status: 'completed',
      updatedAt: '2025-01-01T00:05:00.000Z',
    });
    expect(getCrawl).toHaveBeenCalledWith('valid-id-456');
  });

  it('should fallback to crawl storage and use current timestamp if completedAt is missing', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('File not found'));
    const mockCrawl: CrawlRecord = {
      id: 'valid-id-789',
      name: 'Failed Crawl',
      urls: ['https://example.com'],
      startedAt: '2025-01-01T00:00:00.000Z',
      completedAt: null,
      status: 'failed',
      seedCount: 1,
      pageCount: 5,
      errorCount: 5,
      config: null,
      engine: 'playwright',
      warnings: [],
      errors: [],
      lastErrorStage: null,
      pages: [],
    };
    vi.mocked(getCrawl).mockResolvedValueOnce(mockCrawl);

    const request = new NextRequest('http://localhost/api/crawls/valid-id-789/progress');
    const params = Promise.resolve({ id: 'valid-id-789' });

    const response = await GET(request, { params });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.pageCount).toBe(5);
    expect(data.errorCount).toBe(5);
    expect(data.status).toBe('failed');
    expect(typeof data.updatedAt).toBe('string');
  });

  it('should return 404 if progress file is missing and crawl is still running', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('File not found'));
    const mockCrawl: CrawlRecord = {
      id: 'valid-id-running',
      name: 'Running Crawl',
      urls: ['https://example.com'],
      startedAt: '2025-01-01T00:00:00.000Z',
      completedAt: null,
      status: 'running',
      seedCount: 1,
      pageCount: 0,
      errorCount: 0,
      config: null,
      engine: 'playwright',
      warnings: [],
      errors: [],
      lastErrorStage: null,
      pages: [],
    };
    vi.mocked(getCrawl).mockResolvedValueOnce(mockCrawl);

    const request = new NextRequest('http://localhost/api/crawls/valid-id-running/progress');
    const params = Promise.resolve({ id: 'valid-id-running' });

    const response = await GET(request, { params });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toEqual({ message: 'No progress available' });
  });

  it('should return 404 if progress file is missing and crawl is not found', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('File not found'));
    vi.mocked(getCrawl).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost/api/crawls/non-existent/progress');
    const params = Promise.resolve({ id: 'non-existent' });

    const response = await GET(request, { params });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toEqual({ message: 'No progress available' });
  });

  it('should return 500 if an unexpected error occurs', async () => {
    const request = new NextRequest('http://localhost/api/crawls/valid-id-error/progress');
    const params = Promise.reject(new Error('Unexpected param error'));

    const response = await GET(request, { params });
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data).toEqual({ error: 'Failed to fetch progress' });
  });
});
