import type { DomainIntel } from "@/app/api/crawls/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CrawlConfig {
  timeout?: number;
  maxPages?: number;
  concurrency?: number;
  headless?: boolean;
  waitForNetwork?: number;
  userAgent?: string;
}

export interface CrawlSummary {
  id: string;
  name: string | null;
  status: string;
  seedCount: number;
  pageCount: number;
  errorCount: number;
  startedAt: string;
  completedAt: string | null;
  avgLoadTimeMs?: number;
  minLoadTimeMs?: number;
  maxLoadTimeMs?: number;
  p95LoadTimeMs?: number;
}

export interface PageData {
  id: string;
  url: string;
  finalUrl: string | null;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  lang: string | null;
  dir: string | null;
  charset: string | null;
  visibleText: string | null;
  visibleTextRaw: string | null;
  wordCount: number;
  charCount: number;
  headings: { h1: string[]; h2: string[]; h3: string[] } | null;
  buttons: Array<{ text: string; type: string; aria_label?: string; href?: string }>;
  links:
    | {
        internal: Array<{ text: string; href: string; rel?: string }>;
        external: Array<{ text: string; href: string; rel?: string }>;
      }
    | null;
  forms: Array<{
    action: string;
    method: string;
    fields: Array<{ name: string; type: string; label?: string }>;
  }> | null;
  images: Array<{ src: string; alt: string; width?: number; height?: number }> | null;
  scripts: string[] | null;
  stylesheets: string[] | null;
  resources: Array<{ type: string; url: string; size?: number }> | null;
  network: Array<{
    url: string;
    method: string;
    status?: number;
    resourceType?: string;
    size?: number;
  }> | null;
  structuredData: unknown[] | null;
  bodyClasses: string[] | null;
  htmlClasses: string[] | null;
  techEvidence: string[] | null;
  metaGenerator: string | null;
  loadTimeMs?: number;
  domContentLoadedMs?: number;
  fullContentReadyMs?: number;
  error: string | null;
  scrapedAt: string;
}

export interface CrawlDetail extends CrawlSummary {
  urls: string[];
  config: Record<string, unknown> | null;
  engine: string;
  domainIntel?: DomainIntel | null;
  warnings: string[] | null;
  errors: string[] | null;
  lastErrorStage?: string | null;
  pages: PageData[];
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const API_BASE = '/api/crawls';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ─── API functions ───────────────────────────────────────────────────────────

export async function createCrawl(
  urls: string[],
  config?: CrawlConfig,
  name?: string,
): Promise<CrawlSummary> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, config: config ?? {}, name }),
  });
  return handleResponse<CrawlSummary>(res);
}

export async function getCrawls(): Promise<CrawlSummary[]> {
  const res = await fetch(API_BASE);
  return handleResponse<CrawlSummary[]>(res);
}

export async function getCrawl(id: string): Promise<CrawlDetail> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`);
  return handleResponse<CrawlDetail>(res);
}

export async function deleteCrawl(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Delete failed (${res.status})`);
  }
}

export async function exportCrawlJson(id: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/export`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Export failed (${res.status})`);
  }
  return res.blob();
}

export interface CrawlProgress {
  url?: string;
  title?: string;
  error?: string;
  pageCount: number;
  errorCount: number;
  status?: string;
  updatedAt: string;
}

export async function getCrawlProgress(id: string): Promise<CrawlProgress | null> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/progress`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Progress failed (${res.status})`);
  }
  return res.json() as Promise<CrawlProgress>;
}
