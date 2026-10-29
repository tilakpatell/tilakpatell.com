# Return after Quit despite a new preload

The return script watched body class changes but handled completed sessions
only while `window.__playFlow.state` was `menu`. The validated engine export
`r1035-177d10ea` can change `ending -> menu -> loading` before the browser
delivers the MutationObserver callback:

- `runtime/world-play.mjs:590-615`: `finish()` releases the old instance's
  runtime/workers and appends its completed record to `flow.sessions`.
- `runtime/world-play.mjs:626-632`: it calls `leaveGame()`, sets `menu`, then
  starts the next preload after a successful completion.
- `runtime/world-play.mjs:228`: `load()` sets `loading` before awaiting the
  new instance. Direct starts suppress preload and can conceal this race.

The callback therefore saw `loading` and missed a completed Quit. With a
galaxy `from` address, the visitor could wait for an unnecessary new preload
before returning to the site.

The return script now reads newly completed session records regardless of
the transient current state. A requested Quit alone still cannot navigate:
the record exists only after `finish()` releases the old instance. Failed
records take precedence over the requested ending reason: a Quit whose
runtime teardown failed now stays on the page with its diagnostics. The
once-per-record guard is unchanged. This does not alter engine loading,
shutdown, gameplay or the original frontend.

Validation on site base `cd911e86ca66eda1599069bdfcd89efef1c50e1e`:

- A regression coalesces synchronous class mutations into one queued
  microtask, matching MutationObserver delivery. Before the fix, completed
  Quit followed immediately by `loading` failed to return (1 failed,
  8 passed in `playReturn.test.js`).
- After the fix, it returns once; a merely requested Quit never navigates.
  A completed failed session still retains its error and stays on the page.
- A second negative case reproduced a completed record with `endReason:
  'quit'` and `passed: false` navigating away and hiding its error (1 failed,
  9 passed before the ordering fix). Both ordinary and Quit-related failures
  now remain visible without navigation.
- 60 tests pass across the six focused `play`, `playReturn`, `worker`,
  `engineCache`, `playTimers` and `source` suites. The source serialization
  check also passes. ESLint and `git diff --check` pass.

No GPU, full site build, browser game session or deployment was run. The
deployment coordinator owns publishing and live verification. This fix is
independent of the entry/return destination and cache failure changes.
