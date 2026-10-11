import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type {
  CrawlRecord,
  CrawlStorageProvider,
  CrawlSummary,
  CreateCrawlInput,
} from './types';
import { getRegistrableDomainFromUrl } from '@/lib/domain-utils';

export class FileSystemStorageProvider implements CrawlStorageProvider {
  private outputDir: string;

  constructor(customOutputDir?: string) {
    this.outputDir = customOutputDir || path.join(process.cwd(), 'output');
  }

  private async ensureOutputDir(): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });
  }

  private crawlPath(id: string): string {
    return path.join(this.outputDir, `${path.basename(id)}.json`);
  }

  private summaryPath(id: string): string {
    return path.join(this.outputDir, `${id}.summary.json`);
  }

  private getSummary(record: CrawlRecord): CrawlSummary {
    const { pages: _pages, ...summary } = record;
    return summary;
  }

  public async createCrawl(input: CreateCrawlInput): Promise<CrawlRecord> {
    await this.ensureOutputDir();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    let name = input.name;
    if (!name || !name.trim()) {
      name = `Crawl ${now.slice(0, 19).replace('T', ' ')}`;
      if (input.urls.length > 0) {
        try {
          const domains = new Set(
            input.urls
              .map((u) => getRegistrableDomainFromUrl(u))
              .filter((value): value is string => !!value)
          );
          const timestamp = now.slice(0, 19).replace('T', ' ');
          if (domains.size === 1) {
            name = `${Array.from(domains)[0]} ${timestamp}`;
          } else if (domains.size > 1) {
            name = `Multi ${timestamp}`;
          }
        } catch (_e) {
          // Fallback to default name if URL parsing fails
        }
      }
    }

    const record: CrawlRecord = {
      id,
      name,
      status: 'running',
      seedCount: input.urls.length,
      pageCount: 0,
      errorCount: 0,
      startedAt: now,
      completedAt: null,
      urls: input.urls,
      config: input.config,
      engine: 'playwright',
      domainIntel: input.domainIntel ?? null,
      warnings: input.warnings ?? [],
      errors: [],
      lastErrorStage: null,
      pages: [],
    };

    await writeFile(this.crawlPath(id), JSON.stringify(record, null, 2), 'utf8');
    await writeFile(this.summaryPath(id), JSON.stringify(this.getSummary(record), null, 2), 'utf8');
    return record;
  }

  public async getCrawl(id: string): Promise<CrawlRecord | null> {
    try {
      const file = await readFile(this.crawlPath(id), 'utf8');
      return JSON.parse(file) as CrawlRecord;
    } catch {
      return null;
    }
  }

  public async getCrawlSummary(id: string): Promise<CrawlSummary | null> {
    try {
      const file = await readFile(this.summaryPath(id), 'utf8');
      return JSON.parse(file) as CrawlSummary;
    } catch {
      const full = await this.getCrawl(id);
      if (!full) return null;
      const summary = this.getSummary(full);
      try {
        await writeFile(this.summaryPath(id), JSON.stringify(summary, null, 2), 'utf8');
      } catch {}
      return summary;
    }
  }

  public async updateCrawl(
    id: string,
    updates: Partial<CrawlRecord>
  ): Promise<CrawlRecord | null> {
    const current = await this.getCrawl(id);
    if (!current) return null;
    const next: CrawlRecord = { ...current, ...updates };
    await writeFile(this.crawlPath(id), JSON.stringify(next, null, 2), 'utf8');
    await writeFile(this.summaryPath(id), JSON.stringify(this.getSummary(next), null, 2), 'utf8');
    return next;
  }

  public async deleteCrawl(id: string): Promise<boolean> {
    try {
      await rm(this.crawlPath(id));
      await rm(this.summaryPath(id)).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  public async listCrawls(): Promise<CrawlSummary[]> {
    await this.ensureOutputDir();
    const entries = await readdir(this.outputDir);
    const files = entries.filter(
      (name) =>
        name.endsWith('.json') &&
        !name.endsWith('.progress.json') &&
        !name.endsWith('.summary.json')
    );

    const crawlsPromises = files.map(async (fileName) => {
      const fullPath = path.join(this.outputDir, fileName);
      const id = fileName.replace('.json', '');
      const sumPath = this.summaryPath(id);

      try {
        let parsed: Partial<CrawlRecord>;
        let fileStat;

        try {
          const [contents, stats] = await Promise.all([
            readFile(sumPath, 'utf8'),
            stat(fullPath),
          ]);
          parsed = JSON.parse(contents);
          fileStat = stats;
        } catch {
          const [contents, stats] = await Promise.all([
            readFile(fullPath, 'utf8'),
            stat(fullPath),
          ]);
          const fullParsed = JSON.parse(contents) as CrawlRecord;
          parsed = this.getSummary(fullParsed);
          fileStat = stats;

          const writePromise = writeFile(sumPath, JSON.stringify(parsed, null, 2), 'utf8');
          if (writePromise && typeof writePromise.catch === 'function') {
            writePromise.catch(() => {});
          }
        }

        return {
          ...parsed,
          startedAt: parsed.startedAt || fileStat.birthtime.toISOString(),
        } as CrawlRecord;
      } catch {
        return null;
      }
    });

    const resolved = await Promise.all(crawlsPromises);
    const crawls = resolved.filter((c): c is CrawlRecord => c !== null);

    return crawls.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  }
}
