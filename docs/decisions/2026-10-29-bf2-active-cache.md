# Keep caches used by open engine pages

The engine service worker pruned every build cache except the one most
recently written. With an old engine page still open across deployment,
its next successful retained-build download could therefore delete the
new page's active cache. The in-memory `onDisk` set also retained deleted
URLs, allowing a later warm request to report 204 without storing bytes.

Pruning now lists same-origin window clients and keeps each open page's
build cache, as well as the build being written. Uncontrolled windows are
included because service-worker activation and claim can be in progress.
If listing clients is missing, fails, or returns unusable data, pruning
does not delete caches; a later write can retry. Other applications' caches
are untouched. Successful deletion clears the retired build's in-memory
disk markers so subsequent warming checks and fills the real cache.

Inactive build pruning still runs at the existing frequency: once per
written build during a worker lifetime. A cache retained for an open page
can remain after that page closes until a later build or worker performs
pruning. This avoids querying every open client for every engine asset.

Validation on site base `e35e13b44c2af312707111b21d514970a93e5f0b`:

- Four new controls failed before the fix, while the existing 17 cache
  tests passed: an old-page late download removed the new active cache;
  warming a pruned build returned a false 204; missing or rejected client
  listing failed to preserve existing caches.
- After the fix, both active caches remain and the new page reuses its
  cached bytes without another download. An inactive build is still
  deleted, unrelated application caches remain, and a pruned build is
  fetched and stored again before warming reports success.
- Unavailable client listing preserves caches without blocking foreground
  delivery. A later successful listing retries pruning and removes the
  inactive version.
- All 68 tests across the six `play`, `playReturn`, `worker`, `engineCache`,
  `playTimers` and `source` suites pass. ESLint and `git diff --check` pass.

The version-routing changes under independent review were read only; this
patch changes no route, adoption metadata or engine behavior. No GPU,
browser session, full site build or deployment ran. These are controlled
service-worker contract tests, not measured live cache-loss incidents.
Publication and deployed checks remain with the deployment coordinator.
Implementation and validation: Codex.
