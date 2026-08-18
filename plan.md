1. Modify `src/lib/__tests__/ssrf-policy.test.ts` to include a `describe('validateUrl', ...)` block.
2. Add a `test` inside to verify that passing an invalid URL string like `'not-a-url'` returns a result where `isValid` is false and `errorCode` is `'INVALID_URL'`.
3. Complete pre commit steps to ensure proper testing, verifications, reviews and reflections are done.
4. Submit the pull request with a testing improvement description.
