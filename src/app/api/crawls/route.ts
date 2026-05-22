import { NextRequest, NextResponse } from "next/server";
import { createCrawl, listCrawls, updateCrawl } from "@/lib/crawl-storage";
import { spawn } from "child_process";
import { access, writeFile, rm } from "fs/promises";
import { createWriteStream } from "fs";
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
    const stdoutLogFile = path.join(tmpDir, `crawl-${crawlId}-stdout.log`);
    const stderrLogFile = path.join(tmpDir, `crawl-${crawlId}-stderr.log`);

    let command = process.execPath;
    let args = [crawlBuildScript];
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
      args = [crawlTsScript];
      warnings.push(
        "Using development TypeScript fallback for crawler execution (ALLOW_TS_CRAWLER_FALLBACK=true).",
      );
    }

    // Stage: spawn - launching the crawler subprocess
    const child = spawn(command, args, {
      cwd: crawlerServiceDir,
      detached: true,
      env: {
        ...process.env,
        CRAWLER_INPUT: payload,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutLogStream = createWriteStream(stdoutLogFile, { flags: "a" });
    const stderrLogStream = createWriteStream(stderrLogFile, { flags: "a" });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let stderrLineBuffer = "";

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdoutBuffer += text;
      stdoutLogStream.write(chunk);
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderrBuffer += text;
      stderrLogStream.write(chunk);

      // Handle progress updates by buffering lines
      stderrLineBuffer += text;
      let lineEndIndex;
      while ((lineEndIndex = stderrLineBuffer.indexOf("\n")) !== -1) {
        const line = stderrLineBuffer.substring(0, lineEndIndex).trim();
        stderrLineBuffer = stderrLineBuffer.substring(lineEndIndex + 1);

        if (line.startsWith("PROGRESS_UPDATE:")) {
          try {
            const progressData = JSON.parse(line.substring("PROGRESS_UPDATE:".length));
            const progressFile = path.join(process.cwd(), "output", `${crawlId}.progress.json`);
            writeFile(progressFile, JSON.stringify({
              ...progressData,
              updatedAt: new Date().toISOString()
            })).catch(err => console.error("[API] Failed to write progress file:", err));
          } catch (e) {
            // Ignore parse errors for progress
          }
        }
      }

      console.error(`[API] Crawl ${crawlId} stderr:`, text.trim());
    });

    const timeoutMs = Math.max((config.timeout ?? 30000) * urls.length + 60000, 120000);

    // Stage: poll - waiting for subprocess to complete
    let exitCode: number;
    try {
      exitCode = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error("Crawl subprocess timed out"));
        }, timeoutMs);

        child.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        child.on("close", (code) => {
          clearTimeout(timeout);
          resolve(code ?? 1);
        });
      });
    } catch (pollError) {
      const message = pollError instanceof Error ? pollError.message : "Unknown polling error";
      logError("poll", message, pollError);
      await updateCrawlError("poll", message, "failed");
      return;
    }

    stdoutLogStream.end();
    stderrLogStream.end();

    // Cleanup progress file
    const progressFile = path.join(process.cwd(), "output", `${crawlId}.progress.json`);
    rm(progressFile).catch(() => {});

    if (exitCode !== 0) {
      const message = `Crawler exited with code ${exitCode}. ${stderrBuffer.substring(0, 500)}`;
      logError("poll", message);
      await updateCrawlError("poll", message, "failed");
      return;
    }

    // Stage: parse - parsing JSON output from crawler
    let crawlResult: {
      status: string;
      pages: Array<Record<string, unknown>>;
      errors: string[];
      warnings: string[];
      stats: { total: number; success: number; failed: number };
    };

    try {
      crawlResult = JSON.parse(stdoutBuffer);
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
      };
    });

    try {
      await updateCrawl(crawlId, {
        status: terminalStatus,
        pageCount: crawlResult.stats.success,
        errorCount: allErrors.length,
        errors: allErrors,
        warnings: allWarnings,
        completedAt: new Date().toISOString(),
        pages: transformedPages,
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
