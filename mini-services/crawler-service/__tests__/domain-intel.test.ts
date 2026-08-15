import assert from "node:assert";
import { getObservedDomain } from "../domain-intel";

function runTests() {
  console.log("Running getObservedDomain tests...");
  let passed = 0;
  let failed = 0;

  function runTest(name: string, fn: () => void) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${name}`);
      console.error(error);
      failed++;
    }
  }

  runTest("It should return the fallback when the array is empty", () => {
    assert.strictEqual(getObservedDomain([], "fallback.com"), "fallback.com");
  });

  runTest("It should return the most observed domain", () => {
    assert.strictEqual(
      getObservedDomain(
        [
          "https://example.com/a",
          "https://example.com/b",
          "https://other.com/a",
        ],
        "fallback.com"
      ),
      "example.com"
    );
  });

  runTest("It should ignore malformed values and still correctly compute the most observed valid domain", () => {
    assert.strictEqual(
      getObservedDomain(
        [
          "https://example.com/a",
          "not a valid url",
          "https://example.com/b",
          "https://other.com/a",
        ],
        "fallback.com"
      ),
      "example.com"
    );
  });

  runTest("It should return fallback if all values are malformed", () => {
    assert.strictEqual(
      getObservedDomain(
        [
          "not a valid url",
          "also not valid",
        ],
        "fallback.com"
      ),
      "fallback.com"
    );
  });

  console.log(`\nTests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
