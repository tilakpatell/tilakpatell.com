# The worlds' pictures are served under their hash for a year, drawn from the browser's copy under their own names, and the page opens its connection to the bucket early

**Date:** 2026-10-22 · **Status:** accepted · **Where:** `scripts/site-hashes.mjs`, `src/lib/assetBase.js` (`hereUrl`), `public/sw.js`, `public/_headers`, `cloudflare/headers.test.js`, `scripts/assets-manifest.mjs` (`transformIndexHtml`) · **Follows:** [the site on Cloudflare](2026-10-21-cloudflare-for-the-site.md), [the heavy assets on R2](2026-10-21-heavy-assets-on-r2.md)

## Context

The owner asked for the move to Cloudflare to be used for the worlds' look and speed, and then for the universe map's pictures to get the bucket's year-long cache.

- The site's own files keep Cloudflare's default, `max-age=0, must-revalidate`: every visit asks again for each one before using it, and gets a 304. The universe map's pictures are the site's own, not the bucket's (`textures/universe/` is not in `scripts/assets-upload.mjs`'s `REMOTE`): 121 files, up to 5.7 MB each (`*-xl.ktx2`).
- The bucket's files (`assets.tilakpatell.com`, R2) are a year and `immutable`, their paths their hashes. But `src/data/assets-manifest.json`, the mirror's manifest, has been `{}` since it was made: `scripts/assets-upload.mjs` runs only from the owner's shell with R2's keys, and refuses CI. Moving the pictures there needs those keys; nothing in this session has them, and the refusal is the owner's.
- The Worker's files are on Cloudflare's edge as R2's are, cost nothing, and are uploaded by hash (wrangler sends a file's bytes once whatever its paths).
- Nearly every picture a world draws is fetched through `lib/assetLoad`'s `loadBytes`, which asks `lib/assetBase` where to fetch it.
- `stale-while-revalidate` (RFC 5861): within its window, a browser draws with the copy it has and asks again behind it. Chrome and Firefox keep it; a browser that doesn't treats the file as `max-age=0` was.
- The bucket is another origin, and nothing opened a connection to it before the first loader asked.
- Cloudflare joins a header two matching rules set with a comma, and nothing checked `public/_headers` for it.

## Decision

- **Under their hash, from the site:** the build copies every picture under `textures/`, `cc0/` and `hdri/` that the bucket doesn't hold to `dist/h/<hash12>/<path>` (`scripts/site-hashes.mjs`; 510 files, 149 MB on 2026-10-22, the site 12,308 files) and gives the bundle the hashes (`src/data/site-hashes.json`, `{}` committed). `withFallback` asks the bucket first where it holds a file, then the site's hashed copy, then the plain path if that fails; a miss there says nothing of the bucket. `/h/*` is a year and `immutable`. The service worker answers a hashed path from an installed pack that keeps its plain path.
- **Under their own names**, for what's asked so (a page's picture, a font, a loader that doesn't go through `assetBase`, or after the hashed copy failed): `/textures/*`, `/hdri/*`, `/cc0/*` and `/fonts/*` say `public, max-age=0, stale-while-revalidate=604800`. Models keep the default: their nodes are read by name by the code that comes with them, and a model a visit stale could break that visit.
- The build puts `<link rel="preconnect" href="<the bucket's origin>" crossorigin>` in the page's head, after its charset, when it has a bucket (`VITE_ASSET_BASE`); `crossorigin`, as three's loaders ask the bucket with CORS.
- `cloudflare/headers.test.js` holds the rules: no `/*` rule sets `Cache-Control`, no path is matched by two that set it, the hashed bundle and the hashed pictures are a year, the pictures under their own names are asked again behind the drawing, and models aren't.

## Consequences

- A returning visitor's worlds draw with their pictures with no request for them at all; a picture changed by a deploy is a new path, so none is drawn stale.
- Every build hashes the pictures (about a second) and copies them (a reflink where the disk can); `dist/` gains 510 files toward Cloudflare's 20,000.
- A picture asked by its own path is the old one for a visitor's next visit after a deploy changes it, and the new one after.
- Nothing is billed: the files are the Worker's, answered with no code run.

## Revisit when

- `dist/` nears 20,000 files: the copies go first, or a paid plan.
- The owner runs `scripts/assets-upload.mjs` with `textures/universe` in `REMOTE`: those files are then the bucket's, and the build leaves them out of the copies by itself.
- A picture and the code drawing it change together in a way a visit's mismatch under its own name would break: that folder goes back to the default.
