import {
  getStorageProvider,
  type CrawlRecord,
  type CrawlSummary,
  type CreateCrawlInput,
} from './storage';

export type { CrawlRecord, CrawlSummary, CreateCrawlInput };

export async function createCrawl(input: CreateCrawlInput): Promise<CrawlRecord> {
  return getStorageProvider().createCrawl(input);
}

export async function getCrawl(id: string): Promise<CrawlRecord | null> {
  return getStorageProvider().getCrawl(id);
}

export async function getCrawlSummary(id: string): Promise<CrawlSummary | null> {
  return getStorageProvider().getCrawlSummary(id);
}

export async function updateCrawl(
  id: string,
  updates: Partial<CrawlRecord>
): Promise<CrawlRecord | null> {
  return getStorageProvider().updateCrawl(id, updates);
}

export async function deleteCrawl(id: string): Promise<boolean> {
  return getStorageProvider().deleteCrawl(id);
}

export async function listCrawls(): Promise<CrawlSummary[]> {
  return getStorageProvider().listCrawls();
}
