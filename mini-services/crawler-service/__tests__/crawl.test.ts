import { describe, it, expect } from "vitest";
import {
  parseInputRequest,
  validateAndFilterUrls,
  sanitize,
  isPrivateIp,
  type CrawlConfig,
} from "../crawl";

describe("crawl helper functions", () => {
  describe("parseInputRequest", () => {
    it("should throw error when input is empty", () => {
      expect(() => parseInputRequest("")).toThrow("CRAWLER_INPUT from stdin is empty");
      expect(() => parseInputRequest("   ")).toThrow("CRAWLER_INPUT from stdin is empty");
    });

    it("should throw error when JSON is invalid", () => {
      expect(() => parseInputRequest("invalid json")).toThrow("Invalid JSON in stdin");
    });

    it("should throw error when urls array is missing or empty", () => {
      expect(() => parseInputRequest(JSON.stringify({}))).toThrow("urls array required");
      expect(() => parseInputRequest(JSON.stringify({ urls: [] }))).toThrow("urls array required");
      expect(() => parseInputRequest(JSON.stringify({ urls: "not-an-array" }))).toThrow("urls array required");
    });

    it("should parse valid request and apply default config values", () => {
      const input = JSON.stringify({
        crawlId: "test-crawl-123",
        urls: ["https://example.com"],
      });
      const { body, config } = parseInputRequest(input);

      expect(body.crawlId).toBe("test-crawl-123");
      expect(body.urls).toEqual(["https://example.com"]);
      expect(config.timeout).toBe(30000);
      expect(config.maxPages).toBe(50);
      expect(config.headless).toBe(true);
      expect(config.waitNetwork).toBe(2000);
      expect(config.concurrency).toBe(2);
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

      expect(config.timeout).toBe(10000);
      expect(config.maxPages).toBe(10);
      expect(config.concurrency).toBe(5);
      expect(config.headless).toBe(false);
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

      expect(seedDomain).toBe("example.com");
      expect(validUrls).toEqual(urls);
      expect(warnings.length).toBe(0);
    });

    it("should filter out invalid schemes and record warnings", () => {
      const urls = [
        "https://example.com/page1",
        "ftp://example.com/file",
      ];
      const { validUrls, warnings } = validateAndFilterUrls(urls, defaultConfig);

      expect(validUrls).toEqual(["https://example.com/page1"]);
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("Invalid scheme");
    });

    it("should filter out private IP addresses when private targets are disallowed", () => {
      const urls = [
        "https://example.com/page1",
        "http://127.0.0.1/admin",
        "http://localhost/api",
      ];
      const { validUrls, warnings } = validateAndFilterUrls(urls, defaultConfig);

      expect(validUrls).toEqual(["https://example.com/page1"]);
      expect(warnings.length).toBe(2);
      expect(warnings[0]).toContain("Blocked (private network");
      expect(warnings[1]).toContain("Blocked (private network");
    });

    it("should filter out out-of-scope domain URLs", () => {
      const urls = [
        "https://example.com/page1",
        "https://otherdomain.com/page2",
      ];
      const { validUrls, warnings } = validateAndFilterUrls(urls, defaultConfig);

      expect(validUrls).toEqual(["https://example.com/page1"]);
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("Out of scope");
    });

    it("should respect explicit scopeDomain argument", () => {
      const urls = [
        "https://sub.example.com/page1",
        "https://otherdomain.com/page2",
      ];
      const { validUrls, seedDomain } = validateAndFilterUrls(urls, defaultConfig, "example.com");

      expect(seedDomain).toBe("example.com");
      expect(validUrls).toEqual(["https://sub.example.com/page1"]);
    });

    it("should limit maximum URLs processed to maxPages config", () => {
      const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/page${i}`);
      const config: CrawlConfig = { maxPages: 3 };
      const { validUrls } = validateAndFilterUrls(urls, config);

      expect(validUrls.length).toBe(3);
    });
  });

  describe("sanitize & isPrivateIp", () => {
    it("should sanitize sensitive patterns", () => {
      expect(sanitize("token=12345secret")).toBe("[REDACTED]");
      expect(sanitize("api_key=mykey123")).toBe("[REDACTED]");
    });

    it("should correctly identify private IPs and localhost", () => {
      expect(isPrivateIp("localhost")).toBe(true);
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("192.168.1.1")).toBe(true);
      expect(isPrivateIp("example.com")).toBe(false);
      expect(isPrivateIp("93.184.216.34")).toBe(false);
    });
  });
});
