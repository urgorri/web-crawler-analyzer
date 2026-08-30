import { mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { DomainIntel } from "@/app/api/crawls/types";
import { getRegistrableDomainFromUrl } from "@/lib/domain-utils";

export interface CrawlRecord {
  id: string;
  name: string;
  status: "running" | "completed" | "failed" | "partial";
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
}

const outputDir = path.join(process.cwd(), "output");

async function ensureOutputDir() {
  await mkdir(outputDir, { recursive: true });
}

function crawlPath(id: string) {
  return path.join(outputDir, `${path.basename(id)}.json`);
}

function summaryPath(id: string) {
  return path.join(outputDir, `${id}.summary.json`);
}

function getSummary(record: CrawlRecord): Omit<CrawlRecord, "pages"> {
  const { pages, ...summary } = record;
  return summary;
}

export async function createCrawl(input: {
  urls: string[];
  config: Record<string, unknown> | null;
  name?: string;
  warnings?: string[];
  domainIntel?: DomainIntel | null;
}) {
  await ensureOutputDir();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Determine name
  let name = input.name;
  if (!name || !name.trim()) {
    name = `Crawl ${now.slice(0, 19).replace("T", " ")}`;
    if (input.urls.length > 0) {
      try {
        const domains = new Set(
          input.urls
            .map((u) => getRegistrableDomainFromUrl(u))
            .filter((value): value is string => !!value),
        );
        const timestamp = now.slice(0, 19).replace("T", " ");
        if (domains.size === 1) {
          name = `${Array.from(domains)[0]} ${timestamp}`;
        } else if (domains.size > 1) {
          name = `Multi ${timestamp}`;
        }
      } catch (e) {
        // Fallback to default name if URL parsing fails
      }
    }
  }

  const record: CrawlRecord = {
    id,
    name,
    status: "running",
    seedCount: input.urls.length,
    pageCount: 0,
    errorCount: 0,
    startedAt: now,
    completedAt: null,
    urls: input.urls,
    config: input.config,
    engine: "playwright",
    domainIntel: input.domainIntel ?? null,
    warnings: input.warnings ?? [],
    errors: [],
    lastErrorStage: null,
    pages: [],
  };

  await writeFile(crawlPath(id), JSON.stringify(record, null, 2), "utf8");
  await writeFile(summaryPath(id), JSON.stringify(getSummary(record), null, 2), "utf8");
  return record;
}

export async function getCrawl(id: string) {
  try {
    const file = await readFile(crawlPath(id), "utf8");
    return JSON.parse(file) as CrawlRecord;
  } catch {
    return null;
  }
}

export async function updateCrawl(id: string, patch: Partial<CrawlRecord>) {
  const current = await getCrawl(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await writeFile(crawlPath(id), JSON.stringify(next, null, 2), "utf8");
  await writeFile(summaryPath(id), JSON.stringify(getSummary(next), null, 2), "utf8");
  return next;
}

export async function listCrawls() {
  await ensureOutputDir();
  const entries = await readdir(outputDir);
  const files = entries.filter((name) => name.endsWith(".json") && !name.endsWith(".progress.json") && !name.endsWith(".summary.json"));

  const crawlsPromises = files.map(async (fileName) => {
    const fullPath = path.join(outputDir, fileName);
    const id = fileName.replace(".json", "");
    const sumPath = summaryPath(id);

    let parsed: Partial<CrawlRecord>;
    let fileStat;

    try {
      const [contents, stats] = await Promise.all([
        readFile(sumPath, "utf8"),
        stat(fullPath), // stat the original file for birthtime fallback
      ]);
      parsed = JSON.parse(contents);
      fileStat = stats;
    } catch {
      // Fallback: summary doesn't exist, read full file, write summary
      const [contents, stats] = await Promise.all([
        readFile(fullPath, "utf8"),
        stat(fullPath),
      ]);
      const fullParsed = JSON.parse(contents) as CrawlRecord;
      parsed = getSummary(fullParsed);
      fileStat = stats;

      // Fire and forget writing the summary for next time
      Promise.resolve(writeFile(sumPath, JSON.stringify(parsed, null, 2), "utf8")).catch(() => {});
    }

    return {
      ...parsed,
      startedAt: parsed.startedAt || fileStat.birthtime.toISOString(),
    } as CrawlRecord; // Cast because pages is intentionally omitted but the return type expects CrawlRecord structure mostly
  });

  const crawls = await Promise.all(crawlsPromises);

  return crawls.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function deleteCrawl(id: string) {
  try {
    await rm(crawlPath(id));
    await rm(summaryPath(id)).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
