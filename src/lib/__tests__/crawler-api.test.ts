import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCrawl,
  getCrawls,
  getCrawl,
  deleteCrawl,
  exportCrawlJson,
  getCrawlProgress,
} from '../crawler-api';

describe('crawler-api', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockClear();
  });

  describe('createCrawl', () => {
    it('sends correct POST request with body and headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123' }),
      });

      const result = await createCrawl(['https://example.com'], { timeout: 1000 }, 'My Crawl');

      expect(mockFetch).toHaveBeenCalledWith('/api/crawls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: ['https://example.com'],
          config: { timeout: 1000 },
          name: 'My Crawl',
        }),
      });
      expect(result).toEqual({ id: '123' });
    });

    it('uses empty config object if not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123' }),
      });

      await createCrawl(['https://example.com']);

      expect(mockFetch).toHaveBeenCalledWith('/api/crawls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: ['https://example.com'],
          config: {},
        }),
      });
    });

    it('throws error if response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request' }),
      });

      await expect(createCrawl(['https://example.com'])).rejects.toThrow('Bad request');
    });

    it('throws default error if response is not ok and error is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(createCrawl(['https://example.com'])).rejects.toThrow('Request failed (500)');
    });
  });

  describe('getCrawls', () => {
    it('fetches crawls correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: '1' }, { id: '2' }],
      });

      const result = await getCrawls();
      expect(mockFetch).toHaveBeenCalledWith('/api/crawls');
      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
    });
  });

  describe('getCrawl', () => {
    it('fetches single crawl and URI encodes id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'foo bar' }),
      });

      const result = await getCrawl('foo bar');
      expect(mockFetch).toHaveBeenCalledWith('/api/crawls/foo%20bar');
      expect(result).toEqual({ id: 'foo bar' });
    });
  });

  describe('deleteCrawl', () => {
    it('sends DELETE request correctly', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await deleteCrawl('test id');
      expect(mockFetch).toHaveBeenCalledWith('/api/crawls/test%20id', { method: 'DELETE' });
    });

    it('throws error if delete fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
      });

      await expect(deleteCrawl('test id')).rejects.toThrow('Forbidden');
    });
  });

  describe('exportCrawlJson', () => {
    it('fetches and returns a blob', async () => {
      const mockBlob = new Blob(['{"test": true}'], { type: 'application/json' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      const result = await exportCrawlJson('export-id');
      expect(mockFetch).toHaveBeenCalledWith('/api/crawls/export-id/export');
      expect(result).toBe(mockBlob);
    });

    it('throws error if export fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(exportCrawlJson('export-id')).rejects.toThrow('Export failed (404)');
    });
  });

  describe('getCrawlProgress', () => {
    it('returns null if status is 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await getCrawlProgress('prog-id');
      expect(mockFetch).toHaveBeenCalledWith('/api/crawls/prog-id/progress');
      expect(result).toBeNull();
    });

    it('returns progress data on success', async () => {
      const progressData = { pageCount: 10, errorCount: 0, status: 'running' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => progressData,
      });

      const result = await getCrawlProgress('prog-id');
      expect(result).toEqual(progressData);
    });

    it('throws error on failure other than 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server exploded' }),
      });

      await expect(getCrawlProgress('prog-id')).rejects.toThrow('Server exploded');
    });
  });
});
