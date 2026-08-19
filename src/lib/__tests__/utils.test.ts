import test from "node:test";
import assert from "node:assert/strict";
import { isValidUrl } from "../utils";

test("utils", async (t) => {
  await t.test("isValidUrl", async (t) => {
    await t.test("should return true for valid HTTP URL", () => {
      assert.equal(isValidUrl("http://example.com"), true);
    });

    await t.test("should return true for valid HTTPS URL", () => {
      assert.equal(isValidUrl("https://example.com/path?query=1"), true);
    });

    await t.test("should return true for URL with trailing space and valid protocol", () => {
      assert.equal(isValidUrl("  https://example.com  "), true);
    });

    await t.test("should return false for invalid protocol", () => {
      assert.equal(isValidUrl("ftp://example.com"), false);
      assert.equal(isValidUrl("mailto:test@example.com"), false);
      assert.equal(isValidUrl("file:///etc/passwd"), false);
    });

    await t.test("should return false for invalid URL strings", () => {
      assert.equal(isValidUrl("invalid-url"), false);
      assert.equal(isValidUrl("example.com"), false);
    });

    await t.test("should return false for empty strings", () => {
      assert.equal(isValidUrl(""), false);
      assert.equal(isValidUrl("   "), false);
    });
  });
});
