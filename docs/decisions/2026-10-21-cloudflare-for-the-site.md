# The site is deployed to Cloudflare beside GitHub Pages, and the domain moves when the owner says

**Date:** 2026-10-21 · **Status:** accepted · **Where:** `wrangler.jsonc`, `.github/workflows/deploy.yml` (the Cloudflare step), `public/_headers`

## Context

The owner asked whether moving off GitHub Pages was worth it and what it costs, and wants what GitHub can't give: threads for the engine, and more besides. Measured on the live site, 2026-10-21:

- GitHub Pages sends `cache-control: max-age=600` on every file, the content-hashed `/assets/` chunks too, and sets no header a site asks for. A returning visitor asks again for each of the 344 to 389 files the universe map loads once ten minutes have gone. It compresses with gzip only, and `dist/` is 1.4 GB against its published 1 GB limit, with a soft cap on bandwidth.
- The wait the owner saw on the map ("Fetching the world 0%") was not the host: every download was done by 2.8 s of a 17.7 s wait, the rest the shaders being made in the browser.
- The owner made a Worker, `tilakpatell-com` (account `b12a527c…`, its address `tilakpatell-com.tilakny.workers.dev`), from the dashboard's "Hello world" with Cloudflare's own build on `main`. The build was cancelled; it would have run `npx wrangler deploy` with no config and without the bucket's address.
- `main`'s build with the bucket's address (as the deploy has it) took 68 s here; uploaded to the Worker as files alone, 11,362 files in 229 s, then answered: pages 200, `/universe` 307 to `/universe/`, an unknown path the site's `404.html` at 404, `/assets/` a year and `immutable`, the rest `max-age=0, must-revalidate`, brotli.
- The free plan: 20,000 files a Worker and 25 MiB a file (wrangler counted 12,279; none over); requests for files alone are not counted against the Worker's daily ones.
- GitHub Pages sends `access-control-allow-origin: *` on every file and Cloudflare sends none unless told. The Minecraft player, framed from its own origin (`tilakpatell.github.io`, `src/components/eagler/load.js`), fetches the game's sealed file from `tilakpatell.com/eagler/` (`public/eagler-player/index.html`): without the header the game would not open once the domain is Cloudflare's. The game keeps its saves in that origin's storage.
- The domain's DNS is Namecheap's, with Namecheap's email forwarding (its MX and SPF records), which by Namecheap's account works only while its own DNS answers for the domain.
- Cross-origin isolation (COOP `same-origin` and COEP), which `SharedArrayBuffer` and threaded WebAssembly need (`docs/stack/webassembly.md`), tried on the Worker: 13 pages (home, the universe, the galaxy, projects, experience, travel, music, Hogwarts, Middle-earth, N64, mc, Battlefront, eagler) came up isolated with no error the plain deploy didn't have. The N64 player and its emulator's CDN load under `credentialless`. The Minecraft player, framed from `tilakpatell.github.io` on purpose (`src/components/eagler/load.js`), is refused (`ERR_BLOCKED_BY_RESPONSE`): GitHub Pages can't send it the header. Under `require-corp` the bucket's pictures fetched as plain images (the Battlefront screens' posters, `runtime/hud/ScreenCanvas.jsx`) would be refused too: the bucket sends CORS, not CORP.

## Decision

The deploy sends the same `dist/` to the Worker after GitHub Pages, once the repository has the token (the account's id is in `wrangler.jsonc`: the first deploy, waiting for it as a variable, skipped the upload); until then the step is skipped. Cloudflare's own build of the repository is removed: two deploys of each merge would overwrite each other, and its build had none of the deploy's checks or settings. `public/_headers` gives `/assets/*` a year and `immutable`, and nothing else a cache header; every file says any site may read it, as on GitHub. No isolation headers yet. The domain is pointed at the Worker by the owner, its email forwarding moved to Cloudflare's Email Routing first.

## Consequences

- No cost for the site's hosting. The domain stays registered at Namecheap and renews there.
- A returning visitor fetches no hashed chunk again; the unhashed files are asked again each visit and answered 304 when unchanged.
- Both hosts get every deploy until GitHub Pages is switched off; the domain decides which one visitors reach, and moving it back is a DNS change.
- The heavy assets stay on Supabase Storage (`2026-10-09-heavy-assets-mirrored-on-supabase-storage.md`). R2 would cost cents a month for the 13.8 GB and nothing for what's sent out, against Supabase Pro's $25 and its egress past 250 GB.
- Threads are a header away, not yet a speed-up: the engine asks for none (`lib/wasm/features.js`'s `threads` is false wherever the page isn't isolated, and nothing reads it), and the physics worker is off for its 0.5 ms hop a frame (`lib/physics/workerClient.js`), which shared pose buffers would remove.

## Revisit when

- The Minecraft player is served from an origin that sends COEP (its saves stay with the old origin: a player exports their worlds first, as EPK files, and loads them in the new one) (a Worker of its own, or a subdomain on Cloudflare once the domain moves): then isolation with `credentialless` for the whole site, and the physics worker's poses in shared memory.
- `dist/` nears 20,000 files: a paid plan.
- The heavy assets' egress bill grows: the bucket to R2, in an entry of its own.
