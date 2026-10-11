import { describe, it, expect } from 'vitest';
import { isValidUrl, isValidId, cn } from "../utils";

describe("utils", () => {
  describe("isValidUrl", () => {
    it("should return true for valid HTTP URL", () => {
      expect(isValidUrl("http://example.com")).toBe(true);
    });

    it("should return true for valid HTTPS URL", () => {
      expect(isValidUrl("https://example.com/path?query=1")).toBe(true);
    });

    it("should return true for URL with trailing space and valid protocol", () => {
      expect(isValidUrl("  https://example.com  ")).toBe(true);
    });

    it("should return false for invalid protocol", () => {
      expect(isValidUrl("ftp://example.com")).toBe(false);
      expect(isValidUrl("mailto:test@example.com")).toBe(false);
      expect(isValidUrl("file:///etc/passwd")).toBe(false);
    });

    it("should return false for invalid URL strings", () => {
      expect(isValidUrl("invalid-url")).toBe(false);
      expect(isValidUrl("example.com")).toBe(false);
    });

    it("should return false for empty strings", () => {
      expect(isValidUrl("")).toBe(false);
      expect(isValidUrl("   ")).toBe(false);
    });
  });

  describe("isValidId", () => {
    it("should return true for valid alphanumeric and hyphenated IDs", () => {
      expect(isValidId("crawl-1234-abcd")).toBe(true);
      expect(isValidId("12345")).toBe(true);
    });

    it("should return false for invalid IDs with spaces or path traversal", () => {
      expect(isValidId("invalid id!")).toBe(false);
      expect(isValidId("../etc/passwd")).toBe(false);
      expect(isValidId("")).toBe(false);
    });
  });

  describe("cn", () => {
    it("should merge tailwind classes properly", () => {
      expect(cn("px-2 py-1", "bg-red-500")).toBe("px-2 py-1 bg-red-500");
    });
  });
});
