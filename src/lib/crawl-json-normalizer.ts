import { CrawlRecord } from "./crawl-storage";
import { NormalizedCrawl, NormalizedPageData, CrawlEntities, PageData } from "@/app/api/crawls/types";
import crypto from "crypto";

/**
 * Stable stringify to ensure consistent hashing of objects regardless of key order.
 */
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((key) => {
        return JSON.stringify(key) + ":" + stableStringify((obj as Record<string, unknown>)[key]);
      })
      .join(",") +
    "}"
  );
}

/**
 * Normalizes a raw CrawlRecord into a deduplicated format.
 */
export function normalizeCrawl(record: CrawlRecord): NormalizedCrawl {
  const entities: CrawlEntities = {
    links: {},
    technologies: {},
    buttons: {},
    headings: {},
    scripts: {},
    stylesheets: {},
    classes: {},
    images: {},
    forms: {},
    resources: {},
    network: {},
    structuredData: {},
  };

  const hashMemo = new Map<string, string>();

  // Helper to get or create entity ID
  function getOrAdd<T>(
    dict: Record<string, T>,
    value: T,
    hashFn: (v: T) => string = (v) => stableStringify(v)
  ): string {
    const stringified = hashFn(value);
    let hash = hashMemo.get(stringified);
    if (!hash) {
      hash = crypto.createHash("md5").update(stringified).digest("hex").slice(0, 12);
      hashMemo.set(stringified, hash);
    }
    if (!dict[hash]) {
      dict[hash] = value;
    }
    return hash;
  }

  const normalizedPages: NormalizedPageData[] = record.pages.map((p: unknown) => {
    // Explicitly cast to PageData to know what we are reading
    const page = p as PageData;

    // Process Headings
    const headingIds = {
      h1: (page.headings?.h1 || []).map((h: string) => getOrAdd(entities.headings, h)),
      h2: (page.headings?.h2 || []).map((h: string) => getOrAdd(entities.headings, h)),
      h3: (page.headings?.h3 || []).map((h: string) => getOrAdd(entities.headings, h)),
    };

    // Process Buttons
    const buttonIds = (page.buttons || []).map((b) => getOrAdd(entities.buttons, b));

    // Process Links
    const linkIds = {
      internal: (page.links?.internal || []).map((l) => getOrAdd(entities.links, l)),
      external: (page.links?.external || []).map((l) => getOrAdd(entities.links, l)),
    };

    // Process Scripts & Stylesheets
    const scriptIds = (page.scripts || []).map((s: string) => getOrAdd(entities.scripts, s));
    const stylesheetIds = (page.stylesheets || []).map((s: string) => getOrAdd(entities.stylesheets, s));

    // Process Tech Evidence
    const techIds = (page.tech_evidence || []).map((t: string) => getOrAdd(entities.technologies, t));

    // Process Classes
    const bodyClassIds = (page.body_classes || []).map((c: string) => getOrAdd(entities.classes, c));
    const htmlClassIds = (page.html_classes || []).map((c: string) => getOrAdd(entities.classes, c));

    // Process Images
    const imageIds = (page.images || []).map((img) => getOrAdd(entities.images, img));

    // Process Forms
    const formIds = (page.forms || []).map((f) => getOrAdd(entities.forms, f));

    // Process Resources
    const resourceIds = (page.resources || []).map((r) => getOrAdd(entities.resources, r));

    // Process Network
    const networkIds = (page.network || []).map((n) => getOrAdd(entities.network, n));

    // Process Structured Data
    const structuredDataIds = (page.structured_data || []).map((sd) =>
      getOrAdd(entities.structuredData, sd)
    );

    // Map the rest of the fields to camelCase for the output
    return {
      url: page.url,
      finalUrl: page.final_url,
      statusCode: page.status_code,
      title: page.title,
      metaDescription: page.meta_description,
      canonical: page.canonical,
      robotsMeta: page.robots_meta,
      lang: page.lang,
      dir: page.dir,
      charset: page.charset,
      metaGenerator: page.meta_generator,
      visibleText: page.visible_text,
      wordCount: page.word_count || 0,
      charCount: page.char_count || 0,
      loadTimeMs: page.loadTimeMs,
      domContentLoadedMs: page.domContentLoadedMs,
      fullContentReadyMs: page.fullContentReadyMs,
      error: page.error,
      scrapedAt: page.scrapedAt,
      headingIds,
      buttonIds,
      linkIds,
      scriptIds,
      stylesheetIds,
      techIds,
      bodyClassIds,
      htmlClassIds,
      imageIds,
      formIds,
      resourceIds,
      networkIds,
      structuredDataIds,
    };
  });

  const rawBytesEstimate = Buffer.byteLength(JSON.stringify(record));

  const result: NormalizedCrawl = {
    schemaVersion: 4,
    id: record.id,
    name: record.name,
    status: record.status,
    seedCount: record.seedCount,
    pageCount: record.pageCount,
    errorCount: record.errorCount,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    urls: record.urls,
    config: record.config,
    engine: record.engine,
    domainIntel: record.domainIntel ?? null,
    warnings: record.warnings,
    errors: record.errors,
    pages: normalizedPages,
    entities,
    avgLoadTimeMs: record.avgLoadTimeMs,
    minLoadTimeMs: record.minLoadTimeMs,
    maxLoadTimeMs: record.maxLoadTimeMs,
    p95LoadTimeMs: record.p95LoadTimeMs,
    dedupStats: {
      rawBytesEstimate: 0,
      optimizedBytesEstimate: 0,
      reductionPercentage: 0,
    },
  };

  const optimizedBytesEstimate = Buffer.byteLength(JSON.stringify(result));
  const reductionPercentage = rawBytesEstimate > 0
    ? Math.round(((rawBytesEstimate - optimizedBytesEstimate) / rawBytesEstimate) * 100)
    : 0;

  result.dedupStats = {
    rawBytesEstimate,
    optimizedBytesEstimate,
    reductionPercentage,
  };

  return result;
}
