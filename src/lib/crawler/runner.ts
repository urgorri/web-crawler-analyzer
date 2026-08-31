import { spawn } from "child_process";
import { access, writeFile, rm } from "fs/promises";
import { createWriteStream } from "fs";
import os from "os";
import path from "path";
import type { DomainIntel } from "@/app/api/crawls/types";

export interface CrawlConfig {
  timeout?: number;
  maxPages?: number;
  concurrency?: number;
  headless?: boolean;
  waitForNetwork?: number;
  userAgent?: string;
  [key: string]: unknown;
}

export interface RawCrawlerPage {
  final_url?: string;
  status_code?: number;
  meta_description?: string;
  robots_meta?: string;
  meta_generator?: string;
  visible_text?: string;
  word_count?: number;
  char_count?: number;
  structured_data?: unknown;
  body_classes?: string[];
  html_classes?: string[];
  tech_evidence?: string[];
  load_time_ms?: number;
  dom_content_loaded_ms?: number;
  full_content_ready_ms?: number;
  [key: string]: any;
}

export interface RawCrawlResult {
  status: string;
  pages: Array<RawCrawlerPage>;
  errors: string[];
  warnings: string[];
  domainIntel?: DomainIntel | null;
  stats: { total: number; success: number; failed: number };
}

export type ErrorStage = "spawn" | "poll" | "parse" | "persist";

/**
 * Helper to log errors with structured context
 */
export function logError(crawlId: string, stage: ErrorStage, message: string, error?: unknown) {
  console.error(
    JSON.stringify({
      event: "crawl_error",
      crawlId,
      stage,
      message,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
  );
}

export interface CommandResolution {
  command: string;
  args: string[];
  warning?: string;
}

/**
 * Resolves the command and arguments to execute the crawler mini-service.
 * Checks for compiled build artifacts first, falling back to tsx in dev if allowed.
 */
export async function resolveCrawlerCommand(
  crawlerServiceDir: string
): Promise<CommandResolution> {
  const crawlBuildScript = path.join(crawlerServiceDir, "dist/crawl.js");
  const crawlTsScript = path.join(crawlerServiceDir, "crawl.ts");

  const isProduction = process.env.NODE_ENV === "production";
  const allowTsFallback = process.env.ALLOW_TS_CRAWLER_FALLBACK === "true";

  try {
    await access(crawlBuildScript);
    return {
      command: process.execPath,
      args: [crawlBuildScript],
    };
  } catch {
    if (isProduction || !allowTsFallback) {
      throw new Error(
        "Infrastructure error: missing required crawler build artifact at mini-services/crawler-service/dist/crawl.js. Run `npm --prefix mini-services/crawler-service run build` before starting Next."
      );
    }

    return {
      command: path.join(process.cwd(), "node_modules", ".bin", "tsx"),
      args: [crawlTsScript],
      warning:
        "Using development TypeScript fallback for crawler execution (ALLOW_TS_CRAWLER_FALLBACK=true).",
    };
  }
}

export interface ProcessExecutionOptions {
  crawlId: string;
  urls: string[];
  seedDomain: string;
  config: CrawlConfig;
  command: string;
  args: string[];
  crawlerServiceDir: string;
}

export interface ProcessExecutionResult {
  exitCode: number;
  stdoutBuffer: string;
  stderrBuffer: string;
}

/**
 * Spawns and manages the crawler subprocess execution.
 * Writes input payload to stdin, streams output/progress, and enforces timeouts.
 */
export async function executeCrawlerProcess(
  options: ProcessExecutionOptions
): Promise<ProcessExecutionResult> {
  const { crawlId, urls, seedDomain, config, command, args, crawlerServiceDir } = options;

  const payload = JSON.stringify({
    crawlId,
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

  const tmpDir = os.tmpdir();
  const stdoutLogFile = path.join(tmpDir, `crawl-${crawlId}-stdout.log`);
  const stderrLogFile = path.join(tmpDir, `crawl-${crawlId}-stderr.log`);

  const child = spawn(command, args, {
    cwd: crawlerServiceDir,
    detached: true,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: process.env.NODE_ENV,
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH,
      ALLOW_PRIVATE_TARGETS: process.env.ALLOW_PRIVATE_TARGETS,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (child.stdin) {
    child.stdin.write(payload);
    child.stdin.end();
  }

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
          writeFile(
            progressFile,
            JSON.stringify({
              ...progressData,
              updatedAt: new Date().toISOString(),
            })
          ).catch((err) => console.error("[API] Failed to write progress file:", err));
        } catch (e) {
          // Ignore parse errors for progress
        }
      }
    }

    console.error(`[API] Crawl ${crawlId} stderr:`, text.trim());
  });

  const timeoutMs = Math.max((config.timeout ?? 30000) * urls.length + 60000, 120000);

  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
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

    return { exitCode, stdoutBuffer, stderrBuffer };
  } finally {
    stdoutLogStream.end();
    stderrLogStream.end();

    // Cleanup progress file
    const progressFile = path.join(process.cwd(), "output", `${crawlId}.progress.json`);
    rm(progressFile).catch(() => {});
  }
}

export interface TransformedCrawlResults {
  pages: Record<string, any>[];
  stats: {
    avgLoadTimeMs?: number;
    minLoadTimeMs?: number;
    maxLoadTimeMs?: number;
    p95LoadTimeMs?: number;
  };
}

/**
 * Transforms crawler snake_case output into camelCase format for frontend
 * and computes load time statistics.
 */
export function transformCrawlerResults(
  rawPages: RawCrawlerPage[]
): TransformedCrawlResults {
  const transformedPages = rawPages.map((page: RawCrawlerPage) => {
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

  let sumLoadTimes = 0;
  const loadTimes = transformedPages.reduce((acc: number[], p) => {
    if (typeof p.loadTimeMs === "number") {
      acc.push(p.loadTimeMs);
      sumLoadTimes += p.loadTimeMs;
    }
    return acc;
  }, []);

  let avgLoadTimeMs: number | undefined;
  let minLoadTimeMs: number | undefined;
  let maxLoadTimeMs: number | undefined;
  let p95LoadTimeMs: number | undefined;

  if (loadTimes.length > 0) {
    loadTimes.sort((a, b) => a - b);
    avgLoadTimeMs = Math.round(sumLoadTimes / loadTimes.length);
    minLoadTimeMs = loadTimes[0];
    maxLoadTimeMs = loadTimes[loadTimes.length - 1];
    p95LoadTimeMs = loadTimes[Math.floor(loadTimes.length * 0.95)];
  }

  return {
    pages: transformedPages,
    stats: {
      avgLoadTimeMs,
      minLoadTimeMs,
      maxLoadTimeMs,
      p95LoadTimeMs,
    },
  };
}
