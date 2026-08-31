import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import {
  transformCrawlerResults,
  resolveCrawlerCommand,
  RawCrawlerPage,
} from "../runner";

describe("crawler runner helpers", () => {
  describe("transformCrawlerResults", () => {
    test("transforms snake_case page properties into camelCase and computes timing statistics", () => {
      const rawPages: RawCrawlerPage[] = [
        {
          url: "https://example.com",
          final_url: "https://example.com/",
          status_code: 200,
          meta_description: "Example site",
          robots_meta: "index, follow",
          meta_generator: "Custom Engine",
          visible_text: "Hello world",
          word_count: 2,
          char_count: 11,
          structured_data: [{ "@type": "WebPage" }],
          body_classes: ["bg-main"],
          html_classes: ["no-js"],
          tech_evidence: ["React"],
          load_time_ms: 100,
          dom_content_loaded_ms: 50,
          full_content_ready_ms: 80,
        },
        {
          url: "https://example.com/about",
          final_url: "https://example.com/about",
          status_code: 200,
          load_time_ms: 300,
        },
        {
          url: "https://example.com/contact",
          final_url: "https://example.com/contact",
          status_code: 200,
          load_time_ms: 200,
        },
      ];

      const { pages, stats } = transformCrawlerResults(rawPages);

      assert.strictEqual(pages.length, 3);
      assert.strictEqual(pages[0].finalUrl, "https://example.com/");
      assert.strictEqual(pages[0].statusCode, 200);
      assert.strictEqual(pages[0].metaDescription, "Example site");
      assert.strictEqual(pages[0].robotsMeta, "index, follow");
      assert.strictEqual(pages[0].metaGenerator, "Custom Engine");
      assert.strictEqual(pages[0].visibleText, "Hello world");
      assert.strictEqual(pages[0].wordCount, 2);
      assert.strictEqual(pages[0].charCount, 11);
      assert.deepStrictEqual(pages[0].bodyClasses, ["bg-main"]);
      assert.deepStrictEqual(pages[0].htmlClasses, ["no-js"]);
      assert.deepStrictEqual(pages[0].techEvidence, ["React"]);
      assert.strictEqual(pages[0].loadTimeMs, 100);

      // Verify snake_case keys are omitted
      assert.strictEqual("final_url" in pages[0], false);
      assert.strictEqual("status_code" in pages[0], false);
      assert.strictEqual("meta_description" in pages[0], false);

      // Verify computed stats (loadTimes: 100, 200, 300)
      assert.strictEqual(stats.avgLoadTimeMs, 200);
      assert.strictEqual(stats.minLoadTimeMs, 100);
      assert.strictEqual(stats.maxLoadTimeMs, 300);
      assert.strictEqual(stats.p95LoadTimeMs, 300);
    });

    test("handles pages without load time measurements", () => {
      const rawPages: RawCrawlerPage[] = [
        {
          url: "https://example.com/error",
          status_code: 500,
        },
      ];

      const { pages, stats } = transformCrawlerResults(rawPages);

      assert.strictEqual(pages.length, 1);
      assert.strictEqual(stats.avgLoadTimeMs, undefined);
      assert.strictEqual(stats.minLoadTimeMs, undefined);
      assert.strictEqual(stats.maxLoadTimeMs, undefined);
      assert.strictEqual(stats.p95LoadTimeMs, undefined);
    });
  });

  describe("resolveCrawlerCommand", () => {
    test("throws infrastructure error when build artifact is missing and fallback is disabled", async () => {
      const fakeDir = path.join(process.cwd(), "non-existent-service-dir");
      const originalEnv = process.env.ALLOW_TS_CRAWLER_FALLBACK;
      delete process.env.ALLOW_TS_CRAWLER_FALLBACK;

      await assert.rejects(
        async () => {
          await resolveCrawlerCommand(fakeDir);
        },
        (err: Error) => {
          return err.message.includes("Infrastructure error: missing required crawler build artifact");
        }
      );

      process.env.ALLOW_TS_CRAWLER_FALLBACK = originalEnv;
    });

    test("returns tsx command fallback when build artifact is missing and fallback is allowed", async () => {
      const fakeDir = path.join(process.cwd(), "non-existent-service-dir");
      const originalEnv = process.env.ALLOW_TS_CRAWLER_FALLBACK;
      process.env.ALLOW_TS_CRAWLER_FALLBACK = "true";

      const resolution = await resolveCrawlerCommand(fakeDir);

      assert.strictEqual(resolution.command.endsWith("tsx"), true);
      assert.strictEqual(resolution.args[0], path.join(fakeDir, "crawl.ts"));
      assert.ok(resolution.warning?.includes("Using development TypeScript fallback"));

      process.env.ALLOW_TS_CRAWLER_FALLBACK = originalEnv;
    });
  });
});
