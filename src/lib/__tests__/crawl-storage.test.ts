import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCrawl } from '../crawl-storage';
import { mkdir, writeFile } from 'fs/promises';
import crypto from 'crypto';
import path from 'path';

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(),
  }
}));

vi.mock('@/lib/domain-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain-utils')>();
  return {
    ...actual,
    getRegistrableDomainFromUrl: vi.fn((url: string) => {
      if (url === 'error') throw new Error('Parsing failed');
      return actual.getRegistrableDomainFromUrl(url);
    }),
  };
});

describe('createCrawl', () => {
  const MOCK_DATE_STR = '2023-10-27T10:00:00.000Z';
  const MOCK_DATE = new Date(MOCK_DATE_STR);
  const MOCK_UUID = '12345678-1234-1234-1234-1234567890ab';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_DATE);
    vi.mocked(crypto.randomUUID).mockReturnValue(MOCK_UUID);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should create a crawl with provided name', async () => {
    const input = {
      urls: ['https://example.com'],
      config: { maxPages: 10 },
      name: 'Custom Crawl Name',
    };

    const record = await createCrawl(input);

    expect(mkdir).toHaveBeenCalledWith(path.join(process.cwd(), 'output'), { recursive: true });

    expect(record).toMatchObject({
      id: MOCK_UUID,
      name: 'Custom Crawl Name',
      status: 'running',
      seedCount: 1,
      pageCount: 0,
      errorCount: 0,
      startedAt: MOCK_DATE_STR,
      completedAt: null,
      urls: input.urls,
      config: input.config,
      engine: 'playwright',
      domainIntel: null,
      warnings: [],
      errors: [],
      lastErrorStage: null,
      pages: [],
    });

    expect(writeFile).toHaveBeenCalledWith(
      path.join(process.cwd(), 'output', `${MOCK_UUID}.json`),
      JSON.stringify(record, null, 2),
      'utf8'
    );
  });

  it('should fallback to single domain name format when no name provided and 1 domain', async () => {
    const input = {
      urls: ['https://example.com/page1', 'https://example.com/page2'],
      config: null,
    };

    const record = await createCrawl(input);
    expect(record.name).toBe('example.com 2023-10-27 10:00:00');
  });

  it('should fallback to multi domain name format when no name provided and >1 domains', async () => {
    const input = {
      urls: ['https://example.com', 'https://test.com'],
      config: null,
    };

    const record = await createCrawl(input);
    expect(record.name).toBe('Multi 2023-10-27 10:00:00');
  });

  it('should fallback to Crawl date format when urls are empty', async () => {
    const input = {
      urls: [],
      config: null,
    };

    const record = await createCrawl(input);
    expect(record.name).toBe('Crawl 2023-10-27 10:00:00');
  });

  it('should use default fallback when domain parsing throws error', async () => {
    const input = {
      urls: ['error'], // the mocked function will throw when it sees this url
      config: null,
    };

    const record = await createCrawl(input);
    expect(record.name).toBe('Crawl 2023-10-27 10:00:00');
  });
});
