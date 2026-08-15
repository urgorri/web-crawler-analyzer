import { spawn } from "child_process";
import { access, writeFile, rm } from "fs/promises";
import { createWriteStream } from "fs";
import os from "os";
import path from "path";

export interface SpawnCrawlerResult {
  exitCode: number;
  stdoutBuffer: string;
  stderrBuffer: string;
  warnings: string[];
}

export async function spawnCrawlerProcess(
  crawlId: string,
  payload: string,
  config: any,
  urls: string[],
): Promise<SpawnCrawlerResult> {
  const warnings: string[] = [];

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
      throw new Error(
        "Infrastructure error: missing required crawler build artifact at mini-services/crawler-service/dist/crawl.js. Run `npm --prefix mini-services/crawler-service run build` before starting Next.",
      );
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
          writeFile(
            progressFile,
            JSON.stringify({
              ...progressData,
              updatedAt: new Date().toISOString(),
            }),
          ).catch((err) => console.error("[API] Failed to write progress file:", err));
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

  stdoutLogStream.end();
  stderrLogStream.end();

  // Cleanup progress file
  const progressFile = path.join(process.cwd(), "output", `${crawlId}.progress.json`);
  rm(progressFile).catch(() => {});

  return { exitCode, stdoutBuffer, stderrBuffer, warnings };
}
