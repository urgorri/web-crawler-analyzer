export function parseCrawlerResult(stdoutBuffer: string): {
  status: string;
  pages: Array<Record<string, unknown>>;
  errors: string[];
  warnings: string[];
  domainIntel?: Record<string, unknown> | null;
  stats: { total: number; success: number; failed: number };
} {
  try {
    return JSON.parse(stdoutBuffer);
  } catch (parseError) {
    throw new Error("Crawler process did not produce valid JSON output");
  }
}

export function transformPages(pages: Array<Record<string, any>>): any[] {
  return pages.map((page) => {
    const {
      final_url,
      status_code,
      meta_description,
      robots_meta,
      meta_generator,
      visible_text,
      word_count,
      char_count,
      structured_data,
      body_classes,
      html_classes,
      tech_evidence,
      load_time_ms,
      dom_content_loaded_ms,
      full_content_ready_ms,
      ...rest
    } = page;

    return {
      ...rest,
      finalUrl: final_url,
      statusCode: status_code,
      metaDescription: meta_description,
      robotsMeta: robots_meta,
      metaGenerator: meta_generator,
      visibleText: visible_text,
      wordCount: word_count,
      charCount: char_count,
      structuredData: structured_data,
      bodyClasses: body_classes,
      htmlClasses: html_classes,
      techEvidence: tech_evidence,
      loadTimeMs: load_time_ms,
      domContentLoadedMs: dom_content_loaded_ms,
      fullContentReadyMs: full_content_ready_ms,
    };
  });
}

export function calculateAggregateStats(transformedPages: any[]) {
  const loadTimes = transformedPages
    .map((p) => p.loadTimeMs)
    .filter((t) => typeof t === "number") as number[];

  let avgLoadTimeMs, minLoadTimeMs, maxLoadTimeMs, p95LoadTimeMs;

  if (loadTimes.length > 0) {
    loadTimes.sort((a, b) => a - b);
    avgLoadTimeMs = Math.round(loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length);
    minLoadTimeMs = loadTimes[0];
    maxLoadTimeMs = loadTimes[loadTimes.length - 1];
    p95LoadTimeMs = loadTimes[Math.floor(loadTimes.length * 0.95)];
  }

  return { avgLoadTimeMs, minLoadTimeMs, maxLoadTimeMs, p95LoadTimeMs };
}
