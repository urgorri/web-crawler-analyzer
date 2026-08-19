import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCrawls } from '../crawler-api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('crawler-api', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('getCrawls', () => {
    it('should return a list of crawls on success', async () => {
      const mockCrawls = [
        { id: '1', name: 'Crawl 1', status: 'completed' },
        { id: '2', name: 'Crawl 2', status: 'running' }
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCrawls
      });

      const result = await getCrawls();

      expect(mockFetch).toHaveBeenCalledWith('/api/crawls');
      expect(result).toEqual(mockCrawls);
    });

    it('should throw an error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' })
      });

      await expect(getCrawls()).rejects.toThrow('Internal Server Error');
    });

    it('should throw a generic error if API fails without an error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({})
      });

      await expect(getCrawls()).rejects.toThrow('Request failed (404)');
    });
  });
});
