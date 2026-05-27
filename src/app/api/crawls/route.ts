import { NextRequest, NextResponse } from "next/server";
import { createCrawl, listCrawls, updateCrawl } from "@/lib/crawl-storage";
import { spawn } from "child_process";
import { access, writeFile, rm, readFile } from "fs/promises";
import os from "os";
import path from "path";
import { validateUrls, SSRF_ERROR_MESSAGES, formatValidationError } from "@/lib/ssrf-policy";

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

    const config = rawConfig ?? {};
    const maxPages = config.maxPages ?? 50;
    const urlsToCrawl = validUrls.slice(0, maxPages);

    const crawl = await createCrawl({
      urls: urlsToCrawl,
      config,
      name,
    });

    // Execute in background
    runCrawl(crawl.id, urlsToCrawl, config).catch((err) => {
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

async function runCrawl(crawlId: string, urls: string[], config: CrawlConfig) {
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

    const crawlerServiceDir = path.join(process.cwd(), "mini-services/crawler-service");
    const crawlBuildScript = path.join(crawlerServiceDir, "dist/crawl.js");
    const crawlTsScript = path.join(crawlerServiceDir, "crawl.ts");
    const tmpDir = os.tmpdir();

    const inputFilePath = path.join(tmpDir, `crawl-${crawlId}-input.json`);
    const outputFilePath = path.join(tmpDir, `crawl-${crawlId}-output.json`);

    await writeFile(inputFilePath, payload);

    let command = process.execPath;
    let scriptPath = crawlBuildScript;
    const isProduction = process.env.NODE_ENV === "production";
    const allowTsFallback = process.env.ALLOW_TS_CRAWLER_FALLBACK === "true";

    try {
      await access(crawlBuildScript);
    } catch {
      if (isProduction || !allowTsFallback) {
        const message =
          "Infrastructure error: missing required crawler build artifact at mini-services/crawler-service/dist/crawl.js. Run `npm --prefix mini-services/crawler-service run build` before starting Next.";
        logError("spawn", message);
        await updateCrawlError("spawn", message, "failed");
        return;
      }

      command = path.join(process.cwd(), "node_modules", ".bin", "tsx");
      scriptPath = crawlTsScript;
      warnings.push(
        "Using development TypeScript fallback for crawler execution (ALLOW_TS_CRAWLER_FALLBACK=true).",
      );
    }

    const crawlerArgs = ["--input", inputFilePath, "--output", outputFilePath];

    let shellCommand = "";
    let shellArgs: string[] = [];
    const platform = os.platform();

    if (platform === "win32") {
      // Windows: use 'start' to open a new cmd window
      const fullCmd = `"${command}" "${scriptPath}" ${crawlerArgs.map(a => `"${a}"`).join(" ")}`;
      shellCommand = "cmd.exe";
      shellArgs = ["/c", "start", "Crawler Progress", "cmd.exe", "/c", `${fullCmd}`];
    } else if (platform === "darwin") {
      // macOS: use 'open -a Terminal'
      const fullCmd = `"${command}" "${scriptPath}" ${crawlerArgs.map(a => `"${a}"`).join(" ")}`;
      const appleScript = `tell application "Terminal" to do script "${fullCmd.replace(/"/g, '\\"')}"`;
      shellCommand = "osascript";
      shellArgs = ["-e", appleScript];
    } else {
      // Linux: try common terminal emulators
      const fullCmd = `"${command}" "${scriptPath}" ${crawlerArgs.map(a => `"${a}"`).join(" ")}`;
      shellCommand = "x-terminal-emulator";
      shellArgs = ["-e", `bash -c '${fullCmd}'`];

      // Fallback if x-terminal-emulator is not available
      try {
        await access("/usr/bin/x-terminal-emulator");
      } catch {
        shellCommand = "gnome-terminal";
        shellArgs = ["--", "bash", "-c", `${fullCmd}`];
      }
    }

    console.log(`[API] Spawning terminal for crawl ${crawlId} on platform ${platform}`);

    // Stage: spawn - launching the crawler terminal
    const child = spawn(shellCommand, shellArgs, {
      cwd: crawlerServiceDir,
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    const timeoutMs = Math.max((config.timeout ?? 30000) * urls.length + 60000, 120000);
    const pollInterval = 2000;
    const maxPolls = Math.ceil(timeoutMs / pollInterval);

    let crawlResult: any = null;

    // Stage: poll - waiting for the output file to appear and be valid
    for (let i = 0; i < maxPolls; i++) {
      try {
        await access(outputFilePath);
        const outputData = await readFile(outputFilePath, "utf-8");
        crawlResult = JSON.parse(outputData);
        break; // Success!
      } catch (e) {
        // Not ready yet
        await new Promise(r => setTimeout(r, pollInterval));
      }
    }

    // Update progress file with final state before cleanup to ensure frontend sees results
    if (crawlResult) {
      const progressFile = path.join(process.cwd(), "output", `${crawlId}.progress.json`);
      await writeFile(progressFile, JSON.stringify({
        pageCount: crawlResult.stats.success,
        errorCount: crawlResult.stats.failed,
        status: crawlResult.status === "completed" ? "completed" : "partial",
        updatedAt: new Date().toISOString()
      })).catch(err => console.error("[API] Failed to write final progress file:", err));
    }

    // Cleanup input and output files
    rm(inputFilePath).catch(() => {});
    rm(outputFilePath).catch(() => {});

    if (!crawlResult) {
      const message = "Crawler timed out or failed to produce output file.";
      logError("poll", message);
      await updateCrawlError("poll", message, "failed");
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

    // Transform snake_case from crawler to camelCase for frontend and remove redundant fields
    const transformedPages = crawlResult.pages.map((page: any) => {
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

    // Calculate aggregate stats
    const loadTimes = transformedPages
      .map((p: any) => p.loadTimeMs)
      .filter((t: any) => typeof t === 'number') as number[];

    let avgLoadTimeMs, minLoadTimeMs, maxLoadTimeMs, p95LoadTimeMs;

    if (loadTimes.length > 0) {
      loadTimes.sort((a, b) => a - b);
      avgLoadTimeMs = Math.round(loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length);
      minLoadTimeMs = loadTimes[0];
      maxLoadTimeMs = loadTimes[loadTimes.length - 1];
      p95LoadTimeMs = loadTimes[Math.floor(loadTimes.length * 0.95)];
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
