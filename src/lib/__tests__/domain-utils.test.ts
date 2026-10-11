import { describe, it, expect } from 'vitest';
import { getHostnameFromUrl, getRegistrableDomainFromUrl, isSameRegistrableDomain } from "../domain-utils";

describe("domain-utils", () => {
  describe("getHostnameFromUrl", () => {
    it("should extract hostname from valid HTTPS URL", () => {
      expect(getHostnameFromUrl("https://example.com/path?query=1")).toBe("example.com");
    });

    it("should extract hostname from valid HTTP URL", () => {
      expect(getHostnameFromUrl("http://sub.example.co.uk/")).toBe("sub.example.co.uk");
    });

    it("should lowercase the hostname", () => {
      expect(getHostnameFromUrl("https://EXAmple.COM/")).toBe("example.com");
    });

    it("should return null for invalid URL string", () => {
      expect(getHostnameFromUrl("invalid-url")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(getHostnameFromUrl("")).toBeNull();
    });
  });

  describe("getRegistrableDomainFromUrl", () => {
    it("should extract registrable domain from subdomain", () => {
      expect(getRegistrableDomainFromUrl("https://sub.example.com")).toBe("example.com");
    });

    it("should extract registrable domain from ccTLD", () => {
      expect(getRegistrableDomainFromUrl("https://app.example.co.uk")).toBe("example.co.uk");
    });
  });

  describe("isSameRegistrableDomain", () => {
    it("should return true for URLs under same domain", () => {
      expect(isSameRegistrableDomain("https://a.example.com", "https://b.example.com")).toBe(true);
    });

    it("should return false for different domains", () => {
      expect(isSameRegistrableDomain("https://example.com", "https://other.com")).toBe(false);
    });
  });
});
