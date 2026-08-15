import test from "node:test";
import assert from "node:assert/strict";
import { getHostnameFromUrl } from "../domain-utils";

test("domain-utils", async (t) => {
  await t.test("getHostnameFromUrl", async (t) => {
    await t.test("should extract hostname from valid HTTPS URL", () => {
      assert.equal(getHostnameFromUrl("https://example.com/path?query=1"), "example.com");
    });

    await t.test("should extract hostname from valid HTTP URL", () => {
      assert.equal(getHostnameFromUrl("http://sub.example.co.uk/"), "sub.example.co.uk");
    });

    await t.test("should lowercase the hostname", () => {
      assert.equal(getHostnameFromUrl("https://EXAmple.COM/"), "example.com");
    });

    await t.test("should return null for invalid URL string", () => {
      assert.equal(getHostnameFromUrl("invalid-url"), null);
    });

    await t.test("should return null for empty string", () => {
      assert.equal(getHostnameFromUrl(""), null);
    });
  });
});
