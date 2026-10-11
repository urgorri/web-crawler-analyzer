import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { SSRF_ERROR_MESSAGES } from '@/lib/ssrf-policy';
import * as crawlStorage from '@/lib/crawl-storage';

vi.mock('@/lib/crawl-storage', () => ({
  createCrawl: vi.fn(),
  listCrawls: vi.fn(),
  updateCrawl: vi.fn(),
}));

// Mock runner to prevent background subprocess spawn during tests
vi.mock('@/lib/crawler/runner', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crawler/runner')>('@/lib/crawler/runner');
  return {
    ...actual,
    resolveCrawlerCommand: vi.fn(() => ({ command: 'node', args: ['crawl.js'] })),
    executeCrawlerProcess: vi.fn(async () => ({
      exitCode: 0,
      stdoutBuffer: JSON.stringify({
        status: 'completed',
        pages: [],
        errors: [],
        warnings: [],
        stats: { total: 0, success: 0, failed: 0 },
      }),
      stderrBuffer: '',
    })),
  };
});

describe('POST /api/crawls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Should return 400 when urls array is missing', async () => {
    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(SSRF_ERROR_MESSAGES.NO_VALID_URLS);
  });

  it('Should return 400 when urls is not an array', async () => {
    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({ urls: "http://example.com" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(SSRF_ERROR_MESSAGES.NO_VALID_URLS);
  });

  it('Should return 400 when urls array is empty', async () => {
    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({ urls: [] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(SSRF_ERROR_MESSAGES.NO_VALID_URLS);
  });

  it('Should return 400 when all URLs are rejected by SSRF policy', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const request = new NextRequest('http://localhost/api/crawls', {
        method: 'POST',
        body: JSON.stringify({ urls: ['http://127.0.0.1', 'http://localhost'] }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(typeof body.error).toBe('string');
      expect(body.error.length).toBeGreaterThan(0);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('Should return 400 when all valid URLs fail scope check against seed domain', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const request = new NextRequest('http://localhost/api/crawls', {
        method: 'POST',
        body: JSON.stringify({ urls: ['invalid-url-schema'] }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(typeof body.error).toBe('string');
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('Should filter out-of-scope URLs and proceed with in-scope URLs', async () => {
    vi.mocked(crawlStorage.createCrawl).mockResolvedValueOnce({
      id: 'mock-id-1',
      name: 'Test Crawl',
      status: 'running',
      seedCount: 1,
      pageCount: 0,
      errorCount: 0,
      startedAt: '2026-08-31T12:00:00.000Z',
      completedAt: null,
      urls: ['https://example.com/page1'],
      config: {},
      engine: 'playwright',
      warnings: [],
      errors: [],
      lastErrorStage: null,
      pages: [],
    });

    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Crawl',
        urls: ['https://example.com/page1', 'https://differentdomain.com/page2'],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('mock-id-1');
    expect(body.name).toBe('Test Crawl');
    expect(body.status).toBe('running');
    expect(body.seedCount).toBe(1);
  });

  it('Should return 200 and create crawl when valid URLs are provided', async () => {
    vi.mocked(crawlStorage.createCrawl).mockResolvedValueOnce({
      id: 'mock-id-2',
      name: 'Test Crawl',
      status: 'running',
      seedCount: 2,
      pageCount: 0,
      errorCount: 0,
      startedAt: '2026-08-31T12:00:00.000Z',
      completedAt: null,
      urls: ['https://example.com/page1', 'https://example.com/page2'],
      config: {},
      engine: 'playwright',
      warnings: [],
      errors: [],
      lastErrorStage: null,
      pages: [],
    });

    const request = new NextRequest('http://localhost/api/crawls', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Crawl',
        urls: ['https://example.com/page1', 'https://example.com/page2'],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('mock-id-2');
    expect(body.name).toBe('Test Crawl');
    expect(body.status).toBe('running');
    expect(body.seedCount).toBe(2);
  });
});

describe('GET /api/crawls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Should return 200 with list of crawls', async () => {
    vi.mocked(crawlStorage.listCrawls).mockResolvedValueOnce([
      {
        id: 'crawl-1',
        name: 'Crawl 1',
        status: 'completed',
        seedCount: 1,
        pageCount: 5,
        errorCount: 0,
        startedAt: '2026-08-31T10:00:00.000Z',
        completedAt: '2026-08-31T10:05:00.000Z',
        urls: ['https://example.com'],
        config: null,
        engine: 'playwright',
        warnings: [],
        errors: [],
        lastErrorStage: null,
        pages: [],
      },
    ]);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].id).toBe('crawl-1');
  });

  it('Should return 500 when listCrawls throws an unexpected error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.mocked(crawlStorage.listCrawls).mockRejectedValueOnce(new Error('Storage failure'));

      const response = await GET();
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Failed to fetch crawls');
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
