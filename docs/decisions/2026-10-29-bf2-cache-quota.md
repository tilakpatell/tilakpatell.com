# Stop speculative downloads when the cache cannot keep them

The deployed service worker and page warmer continued requesting assets
after a cache write failed. A quota failure returned 502 to the warmer, but
each of its four lanes ignored that result and kept scheduling the rest of
the build. Foreground reads also continued fetching the next eight files
for a cache that had already rejected writes.

The current immutable export, `r1035-177d10ea`, has 3,495 files selected by
`warmOrder`, totaling 2,058,197,116 uncompressed bytes. These figures are
from its existing 3,785-entry manifest, read without loading engine data.
They describe the potential warming workload, not measured network traffic.

The fix stops new page warming requests after any response other than the
worker's successful 204. An unexpected 200 still has its unused body
cancelled. A rejected Cache Storage write disables further speculative
fills and cache writes for that worker's lifetime. Foreground requests
continue using existing cached bytes or the existing network/retry path.
Requests already in flight may finish; a fresh worker can try caching again.

Validation on site base `e35e13b44c2af312707111b21d514970a93e5f0b`:

- Four regressions failed before the fix, with the existing 17 cache tests
  passing. A simulated `QuotaExceededError` was followed by nine asset
  downloads for one demanded file (the file plus eight speculative files).
  It now performs only the demanded download and still returns an existing
  cache hit without another network read.
- The page/worker fixture previously requested all 12 test assets after
  cache quota failure. Page fixtures likewise requested all 12 after an
  unexpected 200 or network failure. Each now stops after its initial four
  requests; the 200 bodies are cancelled. This is controlled failure
  injection, not a claim that a particular live visitor hit quota.
- All 68 tests across the six `play`, `playReturn`, `worker`, `engineCache`,
  `playTimers` and `source` suites pass, including successful warming,
  existing cache reuse, network retries and emitted-source serialization.
  ESLint and `git diff --check` pass.
- Read-only live `sw.js` audit at 2026-10-29T17:20:06Z: HTTP 200,
  `public, max-age=0, must-revalidate`, SHA-256
  `9b7af27404295210f009aa5cbc55de9d5b9d36272d56d233dae328743e5a10f8`.
  The served script contains the current warm and cache-network fallback
  paths. Local audit artifacts are retained in the isolated worktree's
  `.scratch` directory.

No engine content, version routing, gameplay, GPU job, browser session or
deployment was changed or started. The existing deployment coordinator owns
publication and live verification. Implementation and validation: Codex.
