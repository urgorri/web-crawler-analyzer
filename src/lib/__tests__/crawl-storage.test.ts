import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fsPromises from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import {
  createCrawl,
  getCrawl,
  updateCrawl,
  listCrawls,
  deleteCrawl,
} from '../crawl-storage';

vi.mock('fs/promises');
vi.mock('crypto');

describe('crawl-storage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createCrawl', () => {
    it('creates a new crawl record with the provided name', async () => {
      vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-1234');
      const mkdirMock = vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      const writeFileMock = vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const input = {
        urls: ['https://example.com'],
        config: null,
        name: 'My Custom Crawl',
      };

      const record = await createCrawl(input);

      expect(record.id).toBe('test-uuid-1234');
      expect(record.name).toBe('My Custom Crawl');
      expect(record.status).toBe('running');
      expect(record.seedCount).toBe(1);
      expect(record.urls).toEqual(['https://example.com']);
      expect(record.pages).toEqual([]);

      expect(mkdirMock).toHaveBeenCalledWith(path.join(process.cwd(), 'output'), { recursive: true });
      expect(writeFileMock).toHaveBeenCalledWith(
        path.join(process.cwd(), 'output', 'test-uuid-1234.json'),
        JSON.stringify(record, null, 2),
        'utf8'
      );
    });

    it('infers a single-domain name correctly from URL when name is missing', async () => {
      vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-5678');
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const input = {
        urls: ['https://example.com/some/path'],
        config: null,
      };

      const record = await createCrawl(input);

      expect(record.name).toMatch(/^example\.com \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('infers a multi-domain name correctly from multiple URLs', async () => {
      vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-9012');
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const input = {
        urls: ['https://example.com', 'https://another.com'],
        config: null,
      };

      const record = await createCrawl(input);

      expect(record.name).toMatch(/^Multi \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('getCrawl', () => {
    it('returns parsed JSON when file exists', async () => {
      const mockRecord = { id: 'test-id', name: 'Test' };
      vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify(mockRecord));

      const record = await getCrawl('test-id');

      expect(record).toEqual(mockRecord);
      expect(fsPromises.readFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'output', 'test-id.json'),
        'utf8'
      );
    });

    it('returns null when file read fails', async () => {
      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('Not found'));

      const record = await getCrawl('non-existent');

      expect(record).toBeNull();
    });
  });

  describe('updateCrawl', () => {
    it('correctly patches and writes existing crawl', async () => {
      const mockRecord = { id: 'test-id', name: 'Test', status: 'running' };
      vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify(mockRecord));
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const patch = { status: 'completed' as const };
      const updated = await updateCrawl('test-id', patch);

      expect(updated).toEqual({ ...mockRecord, status: 'completed' });
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'output', 'test-id.json'),
        JSON.stringify(updated, null, 2),
        'utf8'
      );
    });

    it('returns null if crawl does not exist', async () => {
      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('Not found'));

      const updated = await updateCrawl('test-id', { status: 'completed' });

      expect(updated).toBeNull();
      expect(fsPromises.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('listCrawls', () => {
    it('lists JSON files, excluding progress files, sorted by startedAt descending', async () => {
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const files = ['crawl1.json', 'crawl2.json', 'crawl1.progress.json', 'other.txt'];
      // @ts-ignore - mock returning string array for simplicity
      vi.mocked(fsPromises.readdir).mockResolvedValue(files);

      const statMock = vi.mocked(fsPromises.stat).mockResolvedValue({
        birthtime: new Date('2023-01-01'),
      } as any);

      vi.mocked(fsPromises.readFile).mockImplementation(async (filePath) => {
        if (filePath.toString().includes('crawl1.json')) {
          return JSON.stringify({ id: 'crawl1', startedAt: '2023-10-01T10:00:00.000Z' });
        }
        if (filePath.toString().includes('crawl2.json')) {
          return JSON.stringify({ id: 'crawl2', startedAt: '2023-10-02T10:00:00.000Z' });
        }
        return '';
      });

      const crawls = await listCrawls();

      expect(crawls).toHaveLength(2);
      expect(crawls[0].id).toBe('crawl2'); // newer
      expect(crawls[1].id).toBe('crawl1'); // older

      expect(fsPromises.readdir).toHaveBeenCalled();
    });
  });

  describe('deleteCrawl', () => {
    it('returns true and calls rm if successful', async () => {
      vi.mocked(fsPromises.rm).mockResolvedValue(undefined);

      const result = await deleteCrawl('test-id');

      expect(result).toBe(true);
      expect(fsPromises.rm).toHaveBeenCalledWith(
        path.join(process.cwd(), 'output', 'test-id.json')
      );
    });

    it('returns false if rm throws', async () => {
      vi.mocked(fsPromises.rm).mockRejectedValue(new Error('Not found'));

      const result = await deleteCrawl('non-existent');

      expect(result).toBe(false);
    });
  });
});
