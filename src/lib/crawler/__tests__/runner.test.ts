import { describe, it, expect } from "vitest";
import path from "path";
import {
  transformCrawlerResults,
  resolveCrawlerCommand,
  RawCrawlerPage,
} from "../runner";

describe("crawler runner helpers", () => {
  describe("transformCrawlerResults", () => {
    it("transforms snake_case page properties into camelCase and computes timing statistics", () => {
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

      expect(pages.length).toBe(3);
      expect(pages[0].finalUrl).toBe("https://example.com/");
      expect(pages[0].statusCode).toBe(200);
      expect(pages[0].metaDescription).toBe("Example site");
      expect(pages[0].robotsMeta).toBe("index, follow");
      expect(pages[0].metaGenerator).toBe("Custom Engine");
      expect(pages[0].visibleText).toBe("Hello world");
      expect(pages[0].wordCount).toBe(2);
      expect(pages[0].charCount).toBe(11);
      expect(pages[0].bodyClasses).toEqual(["bg-main"]);
      expect(pages[0].htmlClasses).toEqual(["no-js"]);
      expect(pages[0].techEvidence).toEqual(["React"]);
      expect(pages[0].loadTimeMs).toBe(100);

      // Verify snake_case keys are omitted
      expect("final_url" in pages[0]).toBe(false);
      expect("status_code" in pages[0]).toBe(false);
      expect("meta_description" in pages[0]).toBe(false);

      // Verify computed stats (loadTimes: 100, 200, 300)
      expect(stats.avgLoadTimeMs).toBe(200);
      expect(stats.minLoadTimeMs).toBe(100);
      expect(stats.maxLoadTimeMs).toBe(300);
      expect(stats.p95LoadTimeMs).toBe(300);
    });

    it("handles pages without load time measurements", () => {
      const rawPages: RawCrawlerPage[] = [
        {
          url: "https://example.com/error",
          status_code: 500,
        },
      ];

      const { pages, stats } = transformCrawlerResults(rawPages);

      expect(pages.length).toBe(1);
      expect(stats.avgLoadTimeMs).toBeUndefined();
      expect(stats.minLoadTimeMs).toBeUndefined();
      expect(stats.maxLoadTimeMs).toBeUndefined();
      expect(stats.p95LoadTimeMs).toBeUndefined();
    });
  });

  describe("resolveCrawlerCommand", () => {
    it("throws infrastructure error when build artifact is missing and fallback is disabled", async () => {
      const fakeDir = path.join(process.cwd(), "non-existent-service-dir");
      const originalEnv = process.env.ALLOW_TS_CRAWLER_FALLBACK;
      delete process.env.ALLOW_TS_CRAWLER_FALLBACK;

      await expect(resolveCrawlerCommand(fakeDir)).rejects.toThrow(
        "Infrastructure error: missing required crawler build artifact"
      );

      process.env.ALLOW_TS_CRAWLER_FALLBACK = originalEnv;
    });

    it("returns tsx command fallback when build artifact is missing and fallback is allowed", async () => {
      const fakeDir = path.join(process.cwd(), "non-existent-service-dir");
      const originalEnv = process.env.ALLOW_TS_CRAWLER_FALLBACK;
      process.env.ALLOW_TS_CRAWLER_FALLBACK = "true";

      const resolution = await resolveCrawlerCommand(fakeDir);

      expect(resolution.command.endsWith("tsx") || resolution.command.includes("tsx")).toBe(true);
      expect(resolution.args[0]).toBe(path.join(fakeDir, "crawl.ts"));
      expect(resolution.warning).toContain("Using development TypeScript fallback");

      process.env.ALLOW_TS_CRAWLER_FALLBACK = originalEnv;
    });
  });
});
