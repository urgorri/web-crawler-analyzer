import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCrawls } from '../crawler-api';

describe('crawler-api', () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleResponse (via getCrawls)', () => {
    it('returns parsed json on successful response', async () => {
      const mockData = [{ id: '1', name: 'Test Crawl' }];
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

      const result = await getCrawls();
      expect(result).toEqual(mockData);
    });

    it('throws an error with status code when response is not ok and json parsing fails', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValueOnce(new Error('SyntaxError: Unexpected token')),
      });

      await expect(getCrawls()).rejects.toThrow('Request failed (500)');
    });

    it('throws an error with the parsed error message when response is not ok and json contains an error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValueOnce({ error: 'Custom API error message' }),
      });

      await expect(getCrawls()).rejects.toThrow('Custom API error message');
    });
  });
});
