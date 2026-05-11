import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spawn } from "child_process";
import { access } from "fs/promises";
import { createWriteStream } from "fs";
import os from "os";
import path from "path";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CrawlConfig {
  timeout?: number;
  maxPages?: number;
  concurrency?: number;
  headless?: boolean;
  waitForNetwork?: number;
  userAgent?: string;
}

// ─── GET /api/crawls ──────────────────────────────────────────────────────────

export async function GET() {
  try {
    const crawls = await db.crawl.findMany({
      orderBy: { createdAt: "desc" },
    });

    const serialized = crawls.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      seedCount: c.seedCount,
      pageCount: c.pageCount,
      errorCount: c.errorCount,
      startedAt: c.startedAt.toISOString(),
      completedAt: c.completedAt?.toISOString() ?? null,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("[API] Failed to list crawls:", error);
    return NextResponse.json({ error: "Failed to fetch crawls" }, { status: 500 });
  }
}

// ─── POST /api/crawls ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls, config: rawConfig } = body as { urls?: string[]; config?: CrawlConfig };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "Request must include a non-empty 'urls' array" },
        { status: 400 },
      );
    }

    const validUrls: string[] = [];
    for (const url of urls) {
      try {
        const parsed = new URL(url.trim());
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          validUrls.push(url.trim());
        }
      } catch { /* skip */ }
    }

    if (validUrls.length === 0) {
      return NextResponse.json(
        { error: "No valid URLs. Only http/https allowed." },
        { status: 400 },
      );
    }

    const config = rawConfig ?? {};
    const maxPages = config.maxPages ?? 50;
    const urlsToCrawl = validUrls.slice(0, maxPages);

    const crawl = await db.crawl.create({
      data: {
        name: `Crawl ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
        status: "running",
        urls: JSON.stringify(urlsToCrawl),
        config: JSON.stringify(config),
        engine: "playwright",
        seedCount: urlsToCrawl.length,
      },
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

    try {
      await access(crawlBuildScript);
    } catch {
      command = "npx";
      args = ["--yes", "tsx", crawlTsScript];
    }

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

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdoutBuffer += text;
      stdoutLogStream.write(chunk);
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderrBuffer += text;
      stderrLogStream.write(chunk);
      console.error(`[API] Crawl ${crawlId} stderr:`, text.trim());
    });

    const timeoutMs = Math.max((config.timeout ?? 30000) * urls.length + 60000, 120000);

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

    stdoutLogStream.end();
    stderrLogStream.end();

    if (exitCode !== 0) {
      throw new Error(`Crawler exited with code ${exitCode}. ${stderrBuffer.substring(0, 500)}`);
    }

    let crawlResult: {
      status: string;
      pages: Array<Record<string, unknown>>;
      errors: string[];
      warnings: string[];
      stats: { total: number; success: number; failed: number };
    };

    try {
      crawlResult = JSON.parse(stdoutBuffer);
    } catch {
      throw new Error("Crawler process did not produce valid JSON output");
    }

    // Store pages
    for (const page of crawlResult.pages) {
      try {
        await db.page.create({
          data: {
            crawlId,
            url: String(page.url),
            finalUrl: String(page.final_url || null),
            statusCode: Number(page.status_code) || null,
            title: String(page.title || ""),
            metaDescription: String(page.meta_description || ""),
            canonical: String(page.canonical || ""),
            robotsMeta: String(page.robots_meta || ""),
            lang: String(page.lang || ""),
            dir: String(page.dir || ""),
            charset: String(page.charset || ""),
            visibleText: String(page.visible_text || ""),
            visibleTextRaw: String(page.visible_text_raw || ""),
            wordCount: Number(page.word_count) || 0,
            charCount: Number(page.char_count) || 0,
            headings: page.headings ? JSON.stringify(page.headings) : null,
            buttons: page.buttons?.length ? JSON.stringify(page.buttons) : null,
            links: page.links ? JSON.stringify(page.links) : null,
            forms: page.forms?.length ? JSON.stringify(page.forms) : null,
            images: page.images?.length ? JSON.stringify(page.images) : null,
            scripts: page.scripts?.length ? JSON.stringify(page.scripts) : null,
            stylesheets: page.stylesheets?.length
              ? JSON.stringify(page.stylesheets)
              : null,
            resources: page.resources?.length
              ? JSON.stringify(page.resources)
              : null,
            network: page.network?.length ? JSON.stringify(page.network) : null,
            structuredData: page.structured_data?.length
              ? JSON.stringify(page.structured_data)
              : null,
            bodyClasses: page.body_classes?.length
              ? JSON.stringify(page.body_classes)
              : null,
            htmlClasses: page.html_classes?.length
              ? JSON.stringify(page.html_classes)
              : null,
            techEvidence: page.tech_evidence?.length
              ? JSON.stringify(page.tech_evidence)
              : null,
            metaGenerator: String(page.meta_generator || ""),
          },
        });
      } catch (dbErr) {
        console.error(`[API] DB error storing page:`, dbErr);
        errors.push("DB store error");
      }
    }

    const allErrors = [...errors, ...(crawlResult.errors || [])];
    const allWarnings = [...warnings, ...(crawlResult.warnings || [])];

    await db.crawl.update({
      where: { id: crawlId },
      data: {
        status: crawlResult.status,
        pageCount: crawlResult.stats.success,
        errorCount: allErrors.length,
        errors: allErrors.length > 0 ? JSON.stringify(allErrors) : null,
        warnings: allWarnings.length > 0 ? JSON.stringify(allWarnings) : null,
        completedAt: new Date(),
      },
    });

    console.log(
      `[API] Crawl ${crawlId} ${crawlResult.status}: ${crawlResult.stats.success} pages, ${allErrors.length} errors`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await db.crawl.update({
      where: { id: crawlId },
      data: {
        status: "failed",
        errors: JSON.stringify([message]),
        completedAt: new Date(),
      },
    });

    console.error(`[API] Crawl ${crawlId} failed:`, message);
  }
}
