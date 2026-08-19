import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCrawl } from '../crawl-storage';
import { readFile } from 'fs/promises';
import path from 'path';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  rm: vi.fn(),
}));

describe('crawl-storage', () => {
  describe('getCrawl', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should return the parsed JSON when file exists and is valid', async () => {
      const mockRecord = { id: 'test-id', name: 'Test Crawl' };
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(mockRecord));

      const result = await getCrawl('test-id');

      expect(readFile).toHaveBeenCalledTimes(1);
      // Construct the expected path manually since crawlPath is internal
      const expectedPath = path.join(process.cwd(), 'output', 'test-id.json');
      expect(readFile).toHaveBeenCalledWith(expectedPath, 'utf8');
      expect(result).toEqual(mockRecord);
    });

    it('should return null when file does not exist (read fails)', async () => {
      vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

      const result = await getCrawl('missing-id');

      expect(readFile).toHaveBeenCalledTimes(1);
      const expectedPath = path.join(process.cwd(), 'output', 'missing-id.json');
      expect(readFile).toHaveBeenCalledWith(expectedPath, 'utf8');
      expect(result).toBeNull();
    });

    it('should return null when file exists but contains invalid JSON', async () => {
      vi.mocked(readFile).mockResolvedValueOnce('invalid json {[');

      const result = await getCrawl('invalid-json-id');

      expect(readFile).toHaveBeenCalledTimes(1);
      const expectedPath = path.join(process.cwd(), 'output', 'invalid-json-id.json');
      expect(readFile).toHaveBeenCalledWith(expectedPath, 'utf8');
      expect(result).toBeNull();
    });
  });
});
