import type { DomainIntel } from '@/app/api/crawls/types';

export interface CrawlRecord {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  seedCount: number;
  pageCount: number;
  errorCount: number;
  startedAt: string;
  completedAt: string | null;
  urls: string[];
  config: Record<string, unknown> | null;
  engine: string;
  domainIntel?: DomainIntel | null;
  warnings: string[];
  errors: string[];
  lastErrorStage: string | null;
  avgLoadTimeMs?: number;
  minLoadTimeMs?: number;
  maxLoadTimeMs?: number;
  p95LoadTimeMs?: number;
  pages: Array<Record<string, unknown>>;
  analysisResults?: Record<string, unknown>;
}

export type CrawlSummary = Omit<CrawlRecord, 'pages'> & {
  pages?: Array<Record<string, unknown>>;
};

export interface CreateCrawlInput {
  urls: string[];
  config: Record<string, unknown> | null;
  name?: string;
  warnings?: string[];
  domainIntel?: DomainIntel | null;
}

export interface CrawlStorageProvider {
  createCrawl(input: CreateCrawlInput): Promise<CrawlRecord>;
  getCrawl(id: string): Promise<CrawlRecord | null>;
  listCrawls(): Promise<CrawlSummary[]>;
  updateCrawl(id: string, updates: Partial<CrawlRecord>): Promise<CrawlRecord | null>;
  deleteCrawl(id: string): Promise<boolean>;
  getCrawlSummary(id: string): Promise<CrawlSummary | null>;
}
