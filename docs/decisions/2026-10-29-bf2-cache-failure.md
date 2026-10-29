# Engine loads when Cache Storage fails

The engine service worker previously awaited `caches.open()` and
`cache.match()` without handling rejection. A failed or unavailable disk
cache therefore rejected the intercepted asset request before the engine
could use a working network response.

Both failures now use the existing network path, including its existing
retry policy. Successful cached loads, background cache writes and cache
pruning retain their behavior. A warm request whose cache cannot open gets
the existing warming failure status (502), without downloading bytes that
cannot be kept. This changes only the site's optional asset cache and adds
no game or frontend behavior.

Validation on site base `cd911e86ca66eda1599069bdfcd89efef1c50e1e`:

- Injected `open` and `match` failures both rejected asset fetches before the
  fix (2 failed, 14 passed in the cache suite).
- After the fix, repeated foreground requests receive the actual network
  bytes for both failure cases. A failed warm performs no download.
- 60 tests pass across `cloudflare/{play,playReturn,worker,engineCache,
  playTimers,source}.test.js`, using Vitest with one worker and a local cache
  directory in the sparse worktree.
- ESLint for the two changed JavaScript files and `git diff --check` pass.

This failure injection proves cache errors no longer block the network;
it does not claim those errors occurred in a particular live browser.
No GPU test, full site build or deployment was run. The deployment
coordinator owns publishing; the stable service-worker URL revalidates on
registration so the fix reaches returning visitors after publication.
