import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseInputRequest,
  validateAndFilterUrls,
  sanitize,
  isPrivateIp,
  type CrawlConfig,
} from "../crawl.js";

describe("crawl helper functions", () => {
  describe("parseInputRequest", () => {
    it("should throw error when input is empty", () => {
      assert.throws(() => parseInputRequest(""), {
        message: "CRAWLER_INPUT from stdin is empty",
      });
      assert.throws(() => parseInputRequest("   "), {
        message: "CRAWLER_INPUT from stdin is empty",
      });
    });

    it("should throw error when JSON is invalid", () => {
      assert.throws(() => parseInputRequest("invalid json"), {
        message: "Invalid JSON in stdin",
      });
    });

    it("should throw error when urls array is missing or empty", () => {
      assert.throws(() => parseInputRequest(JSON.stringify({})), {
        message: "urls array required",
      });
      assert.throws(() => parseInputRequest(JSON.stringify({ urls: [] })), {
        message: "urls array required",
      });
      assert.throws(() => parseInputRequest(JSON.stringify({ urls: "not-an-array" })), {
        message: "urls array required",
      });
    });

    it("should parse valid request and apply default config values", () => {
      const input = JSON.stringify({
        crawlId: "test-crawl-123",
        urls: ["https://example.com"],
      });
      const { body, config } = parseInputRequest(input);

      assert.strictEqual(body.crawlId, "test-crawl-123");
      assert.deepStrictEqual(body.urls, ["https://example.com"]);
      assert.strictEqual(config.timeout, 30000);
      assert.strictEqual(config.maxPages, 50);
      assert.strictEqual(config.headless, true);
      assert.strictEqual(config.waitNetwork, 2000);
      assert.strictEqual(config.concurrency, 2);
    });

    it("should respect custom config and clamp concurrency to 5", () => {
      const input = JSON.stringify({
        urls: ["https://example.com"],
        config: {
          timeout: 10000,
          maxPages: 10,
          concurrency: 10, // should clamp to 5
          headless: false,
        },
      });
      const { config } = parseInputRequest(input);

      assert.strictEqual(config.timeout, 10000);
      assert.strictEqual(config.maxPages, 10);
      assert.strictEqual(config.concurrency, 5);
      assert.strictEqual(config.headless, false);
    });
  });

  describe("validateAndFilterUrls", () => {
    const defaultConfig: CrawlConfig = {
      maxPages: 50,
      concurrency: 2,
    };

    it("should allow valid public HTTP and HTTPS URLs on seed domain", () => {
      const urls = [
        "https://example.com/page1",
        "https://example.com/page2",
      ];
      const { validUrls, warnings, seedDomain } = validateAndFilterUrls(urls, defaultConfig);

      assert.strictEqual(seedDomain, "example.com");
      assert.deepStrictEqual(validUrls, urls);
      assert.strictEqual(warnings.length, 0);
    });

    it("should filter out invalid schemes and record warnings", () => {
      const urls = [
        "https://example.com/page1",
        "ftp://example.com/file",
      ];
      const { validUrls, warnings } = validateAndFilterUrls(urls, defaultConfig);

      assert.deepStrictEqual(validUrls, ["https://example.com/page1"]);
      assert.strictEqual(warnings.length, 1);
      assert.ok(warnings[0].includes("Invalid scheme"));
    });

    it("should filter out private IP addresses when private targets are disallowed", () => {
      const urls = [
        "https://example.com/page1",
        "http://127.0.0.1/admin",
        "http://localhost/api",
      ];
      const { validUrls, warnings } = validateAndFilterUrls(urls, defaultConfig);

      assert.deepStrictEqual(validUrls, ["https://example.com/page1"]);
      assert.strictEqual(warnings.length, 2);
      assert.ok(warnings[0].includes("Blocked (private network"));
      assert.ok(warnings[1].includes("Blocked (private network"));
    });

    it("should filter out out-of-scope domain URLs", () => {
      const urls = [
        "https://example.com/page1",
        "https://otherdomain.com/page2",
      ];
      const { validUrls, warnings } = validateAndFilterUrls(urls, defaultConfig);

      assert.deepStrictEqual(validUrls, ["https://example.com/page1"]);
      assert.strictEqual(warnings.length, 1);
      assert.ok(warnings[0].includes("Out of scope"));
    });

    it("should respect explicit scopeDomain argument", () => {
      const urls = [
        "https://sub.example.com/page1",
        "https://otherdomain.com/page2",
      ];
      const { validUrls, seedDomain } = validateAndFilterUrls(urls, defaultConfig, "example.com");

      assert.strictEqual(seedDomain, "example.com");
      assert.deepStrictEqual(validUrls, ["https://sub.example.com/page1"]);
    });

    it("should limit maximum URLs processed to maxPages config", () => {
      const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/page${i}`);
      const config: CrawlConfig = { maxPages: 3 };
      const { validUrls } = validateAndFilterUrls(urls, config);

      assert.strictEqual(validUrls.length, 3);
    });
  });

  describe("sanitize & isPrivateIp", () => {
    it("should sanitize sensitive patterns", () => {
      assert.strictEqual(sanitize("token=12345secret"), "[REDACTED]");
      assert.strictEqual(sanitize("api_key=mykey123"), "[REDACTED]");
    });

    it("should correctly identify private IPs and localhost", () => {
      assert.strictEqual(isPrivateIp("localhost"), true);
      assert.strictEqual(isPrivateIp("127.0.0.1"), true);
      assert.strictEqual(isPrivateIp("10.0.0.1"), true);
      assert.strictEqual(isPrivateIp("192.168.1.1"), true);
      assert.strictEqual(isPrivateIp("example.com"), false);
      assert.strictEqual(isPrivateIp("93.184.216.34"), false);
    });
  });
});
