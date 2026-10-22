# The worlds' pictures are drawn from the browser's copy while Cloudflare is asked again, and the page opens its connection to the bucket early

**Date:** 2026-10-22 · **Status:** accepted · **Where:** `public/_headers`, `cloudflare/headers.test.js`, `scripts/assets-manifest.mjs` (`transformIndexHtml`) · **Follows:** [the site on Cloudflare](2026-10-21-cloudflare-for-the-site.md), [the heavy assets on R2](2026-10-21-heavy-assets-on-r2.md)

## Context

The owner asked for the move to Cloudflare to be used for the worlds' look and speed.

- The site's own files keep Cloudflare's default, `max-age=0, must-revalidate`: every visit asks again for each one before using it, and gets a 304. The universe map's pictures are its own files, not the bucket's (`textures/universe/` is not in `scripts/assets-upload.mjs`'s `REMOTE`): 121 files, up to 5.7 MB each (`*-xl.ktx2`), each asked again before the map can use it.
- The bucket's files (`assets.tilakpatell.com`, R2) are a year and `immutable` already, their paths their hashes.
- The bucket is another origin. Nothing on the page opened a connection to it before the first loader asked, after the bundle had come and the world had started to load.
- `stale-while-revalidate` (RFC 5861): within its window, a browser draws with the copy it has and asks again behind it. Chrome and Firefox keep it; a browser that doesn't treats the file as `max-age=0` was, so nothing is slower there.
- Cloudflare joins a header two matching rules set with a comma, and nothing checked `public/_headers` for it.

## Decision

- `/textures/*`, `/hdri/*`, `/cc0/*` and `/fonts/*` say `public, max-age=0, stale-while-revalidate=604800`: the copy from the last week is drawn with straight away and asked again behind it.
- Models keep the default. A model's nodes are read by name by the code that comes with it (colliders, sockets), and a model a visit stale could break that visit; a picture a visit stale only looks a visit old.
- The build puts `<link rel="preconnect" href="<the bucket's origin>" crossorigin>` in the page's head, after its charset, when it has a bucket (`VITE_ASSET_BASE`), so the DNS look-up and the TLS handshake are done while the bundle loads. `crossorigin`, as three's loaders ask the bucket with CORS.
- `cloudflare/headers.test.js` holds the rules: no `/*` rule sets `Cache-Control`, no path is matched by two that set it, the hashed bundle is a year, the pictures are asked again behind the drawing and models aren't.

## Consequences

- A returning visitor's world draws with its pictures without waiting on one 304 each.
- A picture changed in place by a deploy is the old one for that visitor's next visit and the new one after it, unless they come back after more than a week.
- Nothing is billed: the files are the Worker's, answered with no code run.

## Revisit when

- A picture and the code drawing it change together in a way a visit's mismatch would break (an atlas re-laid, a map whose layout a rule reads): that folder goes back to the default, or the picture gets a new name.
- The owner uploads `textures/universe/` to the bucket (`REMOTE` in `scripts/assets-upload.mjs`, with R2's keys): then those files are a year by their hash, and this rule matters only for the rest.
