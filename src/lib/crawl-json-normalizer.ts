import { CrawlRecord } from "./crawl-storage";
import { NormalizedCrawl, NormalizedPageData, CrawlEntities, PageData } from "@/app/api/crawls/types";
import crypto from "crypto";

/**
 * Normalizes a raw CrawlRecord into a deduplicated v2 format.
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
  };

  // Helper to get or create entity ID
  function getOrAdd<T>(
    dict: Record<string, T>,
    value: T,
    hashFn: (v: T) => string = (v) => JSON.stringify(v)
  ): string {
    const hash = crypto.createHash("md5").update(hashFn(value)).digest("hex").slice(0, 12);
    if (!dict[hash]) {
      dict[hash] = value;
    }
    return hash;
  }

  const normalizedPages: NormalizedPageData[] = record.pages.map((p: any) => {
    // Explicitly cast to PageData to know what we are reading
    const page = p as PageData;

    // Process Headings
    const headingIds = {
      h1: (page.headings?.h1 || []).map((h: string) => getOrAdd(entities.headings, h)),
      h2: (page.headings?.h2 || []).map((h: string) => getOrAdd(entities.headings, h)),
      h3: (page.headings?.h3 || []).map((h: string) => getOrAdd(entities.headings, h)),
    };

    // Process Buttons
    const buttonIds = (page.buttons || []).map((b: any) => getOrAdd(entities.buttons, b));

    // Process Links
    const linkIds = {
      internal: (page.links?.internal || []).map((l: any) => getOrAdd(entities.links, l)),
      external: (page.links?.external || []).map((l: any) => getOrAdd(entities.links, l)),
    };

    // Process Scripts & Stylesheets
    const scriptIds = (page.scripts || []).map((s: string) => getOrAdd(entities.scripts, s));
    const stylesheetIds = (page.stylesheets || []).map((s: string) => getOrAdd(entities.stylesheets, s));

    // Process Tech Evidence
    const techIds = (page.tech_evidence || []).map((t: string) => getOrAdd(entities.technologies, t));

    // Process Classes
    const bodyClassIds = (page.body_classes || []).map((c: string) => getOrAdd(entities.classes, c));
    const htmlClassIds = (page.html_classes || []).map((c: string) => getOrAdd(entities.classes, c));

    // Map the rest of the fields to camelCase for the V2 output
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
      images: page.images || [],
      forms: page.forms || [],
      resources: page.resources || [],
      network: page.network || [],
      structuredData: page.structured_data || [],
    };
  });

  const rawBytesEstimate = Buffer.byteLength(JSON.stringify(record));

  const result: NormalizedCrawl = {
    schemaVersion: 2,
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
    warnings: record.warnings,
    errors: record.errors,
    pages: normalizedPages,
    entities,
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
