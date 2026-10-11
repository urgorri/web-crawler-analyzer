import { NextRequest, NextResponse } from "next/server";
import { createCrawl, listCrawls, updateCrawl } from "@/lib/crawl-storage";
import path from "path";
import { validateUrls, SSRF_ERROR_MESSAGES, formatValidationError } from "@/lib/ssrf-policy";
import { getRegistrableDomainFromUrl } from "@/lib/domain-utils";
import {
  CrawlConfig,
  ErrorStage,
  RawCrawlResult,
  logError,
  resolveCrawlerCommand,
  executeCrawlerProcess,
  transformCrawlerResults,
} from "@/lib/crawler/runner";
import { defaultAnalyzerRegistry, type AnalysisContext, type AnalysisNetworkEntry } from "@/lib/analyzers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// ─── Request Validation Helper ───────────────────────────────────────────────

type ValidationResult =
  | {
      success: true;
      data: {
        urlsToCrawl: string[];
        seedDomain: string;
        name?: string;
        config: CrawlConfig;
        warnings: string[];
      };
    }
  | {
      success: false;
      error: string;
      status: number;
    };

function validateCrawlPayload(body: unknown): ValidationResult {
  const { urls, config: rawConfig, name: rawName } = (body || {}) as {
    urls?: string[];
    config?: CrawlConfig;
    name?: string;
  };

  const name = typeof rawName === "string" ? rawName.trim().slice(0, 120) : undefined;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return {
      success: false,
      error: SSRF_ERROR_MESSAGES.NO_VALID_URLS,
      status: 400,
    };
  }

  // Apply SSRF protection policy - same validation as mini-services/crawler-service/crawl.ts
  const { validUrls, rejections } = validateUrls(urls);

  // Log rejected URLs for debugging
  if (rejections.length > 0) {
    console.warn("[API] URLs rejected by SSRF policy:", rejections);
  }

  if (validUrls.length === 0) {
    const errorMessage = formatValidationError(rejections);
    return {
      success: false,
      error: errorMessage || SSRF_ERROR_MESSAGES.NO_VALID_URLS,
      status: 400,
    };
  }

  const seedDomain = getRegistrableDomainFromUrl(validUrls[0]);
  if (!seedDomain) {
    return {
      success: false,
      error: "Unable to determine the crawl domain from the first valid URL.",
      status: 400,
    };
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
    return {
      success: false,
      error: errorMessage || `No URLs matched the crawl domain ${seedDomain}.`,
      status: 400,
    };
  }

  const config = rawConfig ?? {};
  const maxPages = config.maxPages ?? 50;
  const urlsToCrawl = urlsInScope.slice(0, maxPages);
  const warnings = [
    ...rejections.map((item) => `${item.url}: ${item.reason}`),
    ...scopeRejections.map((item) => `${item.url}: ${item.reason}`),
  ];

  return {
    success: true,
    data: {
      urlsToCrawl,
      seedDomain,
      name,
      config,
      warnings,
    },
  };
}

// ─── POST /api/crawls ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateCrawlPayload(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const { urlsToCrawl, seedDomain, name, config, warnings } = validation.data;

    const crawl = await createCrawl({
      urls: urlsToCrawl,
      config: config as Record<string, unknown>,
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

  try {
    const crawlerServiceDir = path.join(process.cwd(), "mini-services/crawler-service");

    let command: string;
    let args: string[];

    try {
      const resolution = await resolveCrawlerCommand(crawlerServiceDir);
      command = resolution.command;
      args = resolution.args;
      if (resolution.warning) {
        warnings.push(resolution.warning);
      }
    } catch (commandError) {
      const message = commandError instanceof Error ? commandError.message : String(commandError);
      logError(crawlId, "spawn", message, commandError);
      await updateCrawlError("spawn", message, "failed");
      return;
    }

    let processResult;
    try {
      processResult = await executeCrawlerProcess({
        crawlId,
        urls,
        seedDomain,
        config,
        command,
        args,
        crawlerServiceDir,
      });
    } catch (pollError) {
      const message = pollError instanceof Error ? pollError.message : "Unknown polling error";
      logError(crawlId, "poll", message, pollError);
      await updateCrawlError("poll", message, "failed");
      return;
    }

    const { exitCode, stdoutBuffer, stderrBuffer } = processResult;

    if (exitCode !== 0) {
      const message = `Crawler exited with code ${exitCode}. ${stderrBuffer.substring(0, 500)}`;
      logError(crawlId, "poll", message);
      await updateCrawlError("poll", message, "failed");
      return;
    }

    let crawlResult: RawCrawlResult;
    try {
      crawlResult = JSON.parse(stdoutBuffer);
    } catch (parseError) {
      const message = "Crawler process did not produce valid JSON output";
      logError(crawlId, "parse", message, parseError);
      await updateCrawlError("parse", message, "failed");
      return;
    }

    const allErrors = [...errors, ...(crawlResult.errors || [])];
    const allWarnings = [...warnings, ...(crawlResult.warnings || [])];

    let terminalStatus: "completed" | "partial" = "completed";
    if (crawlResult.status === "partial" || crawlResult.stats.success < crawlResult.stats.total) {
      terminalStatus = "partial";
    }

    const { pages: transformedPages, stats } = transformCrawlerResults(crawlResult.pages || []);

    let analysisResults: Record<string, unknown> | undefined;
    if (transformedPages.length > 0) {
      const firstPage = transformedPages[0];
      const analysisContext: AnalysisContext = {
        crawlId,
        targetUrl: (firstPage.url as string) || urls[0],
        finalUrl: (firstPage.finalUrl as string) || (firstPage.url as string) || urls[0],
        domain: seedDomain,
        statusCode: (firstPage.statusCode as number) || 200,
        scripts: (firstPage.scripts as string[]) || [],
        stylesheets: (firstPage.stylesheets as string[]) || [],
        metaGenerator: (firstPage.metaGenerator as string) || '',
        headers: (firstPage.headers as Record<string, string>) || {},
        html: (firstPage.html as string) || (firstPage.visibleText as string) || '',
        networkRequests: (firstPage.network as unknown as AnalysisNetworkEntry[]) || [],
      };

      try {
        analysisResults = await defaultAnalyzerRegistry.executeAll(
          analysisContext,
          config.modules
        );
      } catch (analysisErr) {
        console.error(`[API] Analysis pipeline error for crawl ${crawlId}:`, analysisErr);
      }
    }

    try {
      await updateCrawl(crawlId, {
        status: terminalStatus,
        pageCount: crawlResult.stats.success,
        errorCount: allErrors.length,
        errors: allErrors,
        warnings: allWarnings,
        completedAt: new Date().toISOString(),
        pages: transformedPages,
        domainIntel: crawlResult.domainIntel ?? null,
        analysisResults,
        avgLoadTimeMs: stats.avgLoadTimeMs,
        minLoadTimeMs: stats.minLoadTimeMs,
        maxLoadTimeMs: stats.maxLoadTimeMs,
        p95LoadTimeMs: stats.p95LoadTimeMs,
      });
    } catch (writeErr) {
      logError(crawlId, "persist", "Failed to update crawl final status", writeErr);
      await updateCrawlError("persist", "Failed to finalize crawl record", "partial");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError(crawlId, "spawn", message, error);

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
