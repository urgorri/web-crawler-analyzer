import { NextRequest, NextResponse } from "next/server";
import { createCrawl, listCrawls, updateCrawl } from "@/lib/crawl-storage";
import { validateUrls, SSRF_ERROR_MESSAGES, formatValidationError } from "@/lib/ssrf-policy";
import { getRegistrableDomainFromUrl } from "@/lib/domain-utils";
import { spawnCrawlerProcess } from "@/lib/crawler/process-manager";
import { parseCrawlerResult, transformPages, calculateAggregateStats } from "@/lib/crawler/result-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


// ─── Types ─────────────────────────────────────────────────────────────────────

interface CrawlConfig {
  timeout?: number;
  maxPages?: number;
  concurrency?: number;
  headless?: boolean;
  waitForNetwork?: number;
  userAgent?: string;
}

// ─── Error Stages ──────────────────────────────────────────────────────────────
// Stages for tracking where errors occur in the crawl lifecycle
type ErrorStage = "spawn" | "poll" | "parse" | "persist";

// ─── Terminal States ───────────────────────────────────────────────────────────
// - completed: All pages crawled successfully (status from crawler = "completed")
// - partial: Some pages crawled but not all (status = "partial" or success < total)
// - failed: Crawl failed before completing any meaningful work (timeout, crash, etc.)

// ─── GET /api/crawls ──────────────────────────────────────────────────────────

export async function GET() {
  try {
    const crawls = await listCrawls();

    const serialized = crawls.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      seedCount: c.seedCount,
      pageCount: c.pageCount,
      errorCount: c.errorCount,
      startedAt: c.startedAt,
      completedAt: c.completedAt,
      avgLoadTimeMs: c.avgLoadTimeMs,
      minLoadTimeMs: c.minLoadTimeMs,
      maxLoadTimeMs: c.maxLoadTimeMs,
      p95LoadTimeMs: c.p95LoadTimeMs,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[API] Failed to list crawls:", error);

    const errorMessage =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);

    return NextResponse.json(
      {
        error: "Failed to fetch crawls",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}

// ─── POST /api/crawls ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls, config: rawConfig, name: rawName } = body as { urls?: string[]; config?: CrawlConfig; name?: string };

    const name = typeof rawName === 'string' ? rawName.trim().slice(0, 120) : undefined;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: SSRF_ERROR_MESSAGES.NO_VALID_URLS },
        { status: 400 },
      );
    }

    // Apply SSRF protection policy - same validation as mini-services/crawler-service/crawl.ts
    const { validUrls, rejections } = validateUrls(urls);

    if (validUrls.length === 0) {
      const errorMessage = formatValidationError(rejections);
      return NextResponse.json(
        { error: errorMessage || SSRF_ERROR_MESSAGES.NO_VALID_URLS },
        { status: 400 },
      );
    }

    // Log rejected URLs for debugging
    if (rejections.length > 0) {
      console.warn("[API] URLs rejected by SSRF policy:", rejections);
    }

    const seedDomain = getRegistrableDomainFromUrl(validUrls[0]);
    if (!seedDomain) {
      return NextResponse.json(
        { error: "Unable to determine the crawl domain from the first valid URL." },
        { status: 400 },
      );
    }

    const scopeRejections: Array<{ url: string; reason: string }> = [];
    const urlsInScope: string[] = [];
    for (const url of validUrls) {
      const urlDomain = getRegistrableDomainFromUrl(url);
      if (!urlDomain || urlDomain !== seedDomain) {
        scopeRejections.push({
          url,
          reason: `Out of scope. This crawl only accepts URLs under ${seedDomain}.`,
        });
        continue;
      }
      urlsInScope.push(url);
    }

    if (urlsInScope.length === 0) {
      const errorMessage = formatValidationError(scopeRejections);
      return NextResponse.json(
        { error: errorMessage || `No URLs matched the crawl domain ${seedDomain}.` },
        { status: 400 },
      );
    }

    const config = rawConfig ?? {};
    const maxPages = config.maxPages ?? 50;
    const urlsToCrawl = urlsInScope.slice(0, maxPages);
    const warnings = [
      ...rejections.map((item) => `${item.url}: ${item.reason}`),
      ...scopeRejections.map((item) => `${item.url}: ${item.reason}`),
    ];

    const crawl = await createCrawl({
      urls: urlsToCrawl,
      config,
      name,
      warnings,
      domainIntel: {
        seedDomain,
        observedDomain: null,
        seedUrl: urlsToCrawl[0],
        resolvedIps: [],
        dns: {
          a: [],
          aaaa: [],
          ns: [],
          mx: [],
          cname: [],
          txt: [],
        },
        whoisDomain: null,
        whoisIp: null,
        rdapIp: null,
        traceroute: [],
        ports: [],
        warnings,
        errors: [],
      },
    });

    // Execute in background
    runCrawl(crawl.id, urlsToCrawl, config, seedDomain).catch((err) => {
      console.error("[API] Background crawl error:", err);
    });

    return NextResponse.json({
      id: crawl.id,
      name: crawl.name,
      status: "running",
      seedCount: crawl.seedCount,
      pageCount: 0,
      errorCount: 0,
      startedAt: crawl.startedAt,
      completedAt: null,
    });
  } catch (error) {
    console.error("[API] Failed to create crawl:", error);
    return NextResponse.json({ error: "Failed to create crawl" }, { status: 500 });
  }
}

// ─── Background crawl ─────────────────────────────────────────────────────────

async function runCrawl(crawlId: string, urls: string[], config: CrawlConfig, seedDomain: string) {
  const errors: string[] = [];
  const warnings: string[] = [];

  /**
   * Helper to update crawl status with structured error context
   */
  async function updateCrawlError(stage: ErrorStage, message: string, terminalStatus: "failed" | "partial") {
    try {
      await updateCrawl(crawlId, {
        status: terminalStatus,
        errors: [message],
        lastErrorStage: stage,
        completedAt: new Date().toISOString(),
      });
    } catch (writeErr) {
      console.error(`[API] Failed to update crawl error state (stage=${stage}):`, writeErr);
    }
  }

  /**
   * Helper to log errors with structured context
   */
  function logError(stage: ErrorStage, message: string, error?: unknown) {
    console.error(JSON.stringify({
      event: "crawl_error",
      crawlId,
      stage,
      message,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
  }

  try {
    const payload = JSON.stringify({
      urls,
      scopeDomain: seedDomain,
      config: {
        timeout: config.timeout ?? 30000,
        maxPages: urls.length,
        headless: config.headless ?? true,
        waitNetwork: config.waitForNetwork ?? 2000,
        concurrency: Math.min(config.concurrency ?? 2, 5),
        ...(config.userAgent ? { userAgent: config.userAgent } : {}),
      },
    });

    console.log(`[API] Starting crawl ${crawlId} for ${urls.length} URL(s)`);

    // Stage: spawn & poll - launching the crawler subprocess and waiting
    let spawnResult;
    try {
      spawnResult = await spawnCrawlerProcess(crawlId, payload, config, urls);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error spawning crawler";
      logError("spawn", message, err);
      await updateCrawlError("spawn", message, "failed");
      return;
    }

    const { exitCode, stdoutBuffer, stderrBuffer, warnings: processWarnings } = spawnResult;
    warnings.push(...processWarnings);

    if (exitCode !== 0) {
      const message = `Crawler exited with code ${exitCode}. ${stderrBuffer.substring(0, 500)}`;
      logError("poll", message);
      await updateCrawlError("poll", message, "failed");
      return;
    }

    // Stage: parse - parsing JSON output from crawler
    let crawlResult;
    try {
      crawlResult = parseCrawlerResult(stdoutBuffer);
    } catch (parseError) {
      const message = "Crawler process did not produce valid JSON output";
      logError("parse", message, parseError);
      await updateCrawlError("parse", message, "failed");
      return;
    }

    // Stage: persist - storing pages in JSON output
    const allErrors = [...errors, ...(crawlResult.errors || [])];
    const allWarnings = [...warnings, ...(crawlResult.warnings || [])];

    // Determine terminal status based on results
    let terminalStatus: "completed" | "partial" = "completed";
    if (crawlResult.status === "partial" || crawlResult.stats.success < crawlResult.stats.total) {
      terminalStatus = "partial";
    }

    const transformedPages = transformPages(crawlResult.pages);
    const { avgLoadTimeMs, minLoadTimeMs, maxLoadTimeMs, p95LoadTimeMs } = calculateAggregateStats(transformedPages);

    try {
      await updateCrawl(crawlId, {
        status: terminalStatus,
        pageCount: crawlResult.stats.success,
        errorCount: allErrors.length,
        errors: allErrors,
        warnings: allWarnings,
        completedAt: new Date().toISOString(),
        pages: transformedPages,
        domainIntel: (crawlResult.domainIntel as any) ?? null,
        avgLoadTimeMs,
        minLoadTimeMs,
        maxLoadTimeMs,
        p95LoadTimeMs,
      });
    } catch (writeErr) {
      logError("persist", "Failed to update crawl final status", writeErr);
      // Best effort: already have partial data, mark as partial
      await updateCrawlError("persist", "Failed to finalize crawl record", "partial");
    }

    console.log(
      `[API] Crawl ${crawlId} ${terminalStatus}: ${crawlResult.stats.success} pages, ${allErrors.length} errors`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("spawn", message, error);
    
    // Wrap updateCrawl in try/catch to prevent unhandled rejections
    try {
      await updateCrawl(crawlId, {
        status: "failed",
        errors: [message],
        lastErrorStage: "spawn",
        completedAt: new Date().toISOString(),
      });
    } catch (writeErr) {
      console.error(`[API] Failed to update crawl status after error:`, writeErr);
    }

    console.error(`[API] Crawl ${crawlId} failed:`, message);
  }
}
