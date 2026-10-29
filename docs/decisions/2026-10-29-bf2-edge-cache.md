# Serve healthy engine assets when the edge cache fails

The production Worker passes `caches.default` into `servePlay`. A rejected cache lookup previously escaped to the outer error handler and returned 503 before trying the healthy R2 asset. Cache writes could also replace a healthy response when no Worker context was supplied or the write threw synchronously. An asynchronous write rejection with a context failed its background task even though the response was already usable.

Cache lookup errors now fall through to the existing manifest-checked R2 read. Cache write errors are contained in the optional background task. Its unused response branch is cancelled without waiting for the caller to consume the original response. Existing cache hits, manifest allowlisting, headers, ranges, conditional reads and actual R2 outage handling remain covered by the focused suite.

Four new failure-injection controls fail on unchanged `e35e13b44`: read failure, synchronous write failure, asynchronous write failure, and reaching the two existing R2 retry attempts when both stores are unavailable. Fixed results: **90/90 tests across eight suites**, ESLint and `git diff --check` pass. The tests also check 404 for an unlisted object despite cache failure, unchanged asset body/isolation/immutable headers, and fulfilled background tasks with a Worker context.

```text
node node_modules/vitest/vitest.mjs run --config .scratch/vitest.config.mjs cloudflare/play.test.js cloudflare/playReturn.test.js cloudflare/worker.test.js cloudflare/engineCache.test.js cloudflare/playTimers.test.js cloudflare/source.test.js scripts/lib/bf2web-site.test.mjs scripts/desktop/bf2web-publish.test.mjs
node node_modules/eslint/bin/eslint.js cloudflare/play.js cloudflare/play.test.js
git diff --check
```

The temporary Vitest config selects the checked-in suites with one worker and a scratch cache. This is a synthetic failure reproduction through the production handler, not an observed live Cloudflare outage. No engine assets, build pointer, workflows or deployment changed. The original root owns publication. This narrow patch is based on deployed main and can be combined with PR1271/1272/1273.
