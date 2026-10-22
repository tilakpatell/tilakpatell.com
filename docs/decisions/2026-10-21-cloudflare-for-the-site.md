# The site moves to Cloudflare: the Worker serves it, and GitHub Pages is left

**Date:** 2026-10-21 · **Status:** accepted · **Where:** `wrangler.jsonc`, `cloudflare/worker.js`, `.github/workflows/deploy.yml`, `public/_headers`

## Context

The owner asked whether moving off GitHub Pages was worth it and what it costs, and wants what GitHub can't give: threads for the engine, and more besides. Measured on the live site, 2026-10-21:

- GitHub Pages sends `cache-control: max-age=600` on every file, the content-hashed `/assets/` chunks too, and sets no header a site asks for. A returning visitor asks again for each of the 344 to 389 files the universe map loads once ten minutes have gone. It compresses with gzip only, and `dist/` is 1.4 GB against its published 1 GB limit, with a soft cap on bandwidth.
- The wait the owner saw on the map ("Fetching the world 0%") was not the host: every download was done by 2.8 s of a 17.7 s wait, the rest the shaders being made in the browser.
- The owner made a Worker, `tilakpatell-com` (account `b12a527c…`, its address `tilakpatell-com.tilakny.workers.dev`), from the dashboard's "Hello world" with Cloudflare's own build on `main`. The build was cancelled; it would have run `npx wrangler deploy` with no config and without the bucket's address.
- `main`'s build with the bucket's address (as the deploy has it) took 68 s here; uploaded to the Worker as files alone, 11,362 files in 229 s, then answered: pages 200, `/universe` 307 to `/universe/`, an unknown path the site's `404.html` at 404, `/assets/` a year and `immutable`, the rest `max-age=0, must-revalidate`, brotli.
- A request for part of a file (`Range`): the Worker's files answer with the whole file (200), on workers.dev and on the domain, a cache `HIT` too, where GitHub Pages answers 206; Safari plays an `<audio>` or `<video>` only from a server that answers 206. (A 206 first read as the domain's was GitHub Pages': the domain was on Cloudflare's DNS with the old A records proxied, so Cloudflare passed requests on to GitHub, `server: GitHub.com`, until the Worker was made its custom domain.) The site's own media that a media element plays is `/audio/sitar-listen.mp3`; its films are the bucket's and Giphy's.
- The free plan: 20,000 files a Worker and 25 MiB a file (wrangler counted 12,279; none over); requests for files alone are not counted against the Worker's daily ones.
- GitHub Pages sends `access-control-allow-origin: *` on every file and Cloudflare sends none unless told. The Minecraft player, framed from its own origin (`tilakpatell.github.io`, `src/components/eagler/load.js`), fetches the game's sealed file from `tilakpatell.com/eagler/` (`public/eagler-player/index.html`): without the header the game would not open once the domain is Cloudflare's. The game keeps its saves in that origin's storage.
- The domain's DNS is Namecheap's, with Namecheap's email forwarding (its MX and SPF records), which by Namecheap's account works only while its own DNS answers for the domain.
- Cross-origin isolation (COOP `same-origin` and COEP), which `SharedArrayBuffer` and threaded WebAssembly need (`docs/stack/webassembly.md`), tried on the Worker: 13 pages (home, the universe, the galaxy, projects, experience, travel, music, Hogwarts, Middle-earth, N64, mc, Battlefront, eagler) came up isolated with no error the plain deploy didn't have. The N64 player and its emulator's CDN load under `credentialless`. The Minecraft player, framed from `tilakpatell.github.io` on purpose (`src/components/eagler/load.js`), is refused (`ERR_BLOCKED_BY_RESPONSE`): GitHub Pages can't send it the header. Under `require-corp` the bucket's pictures fetched as plain images (the Battlefront screens' posters, `runtime/hud/ScreenCanvas.jsx`) would be refused too: the bucket sends CORS, not CORP.

## Decision

The deploy is one job: lint, test, build, and `dist/` to the Worker with the repository's token (the account's id is in `wrangler.jsonc`), its environment, `cloudflare`, listing each deploy in the repository's Deployments. GitHub Pages had every deploy too while the domain moved, and is left once the Worker is the domain's. Cloudflare's own build of the repository is removed: two deploys of each merge would overwrite each other, and its build had none of the deploy's checks or settings. `public/_headers` gives `/assets/*` a year and `immutable`, and nothing else a cache header; every file says any site may read it, as on GitHub. Code runs for `/audio/*` alone (`cloudflare/worker.js`), cutting the range a request asks for. No isolation headers yet. The domain is the Worker's custom domain; the owner left the email forwarding behind.

## Consequences

- No cost for the site's hosting; the audio script's requests count against the free plan's 100,000 a day. The domain stays registered at Namecheap and renews there. The owner's ceiling for Cloudflare is $20 to $30 a month (`docs/stack/cloudflare.md`).
- A returning visitor fetches no hashed chunk again; the unhashed files are asked again each visit and answered 304 when unchanged.
- GitHub Pages keeps its last deploy until it's switched off in the repository's settings; going back to it is the deploy's old steps and the DNS.
- The heavy assets stay on Supabase Storage for now (`2026-10-09-heavy-assets-mirrored-on-supabase-storage.md`); their copy to R2 is `.github/workflows/assets-to-r2.yml`, and the switch gets an entry of its own. R2 costs about $1 to $2 a month for the 80 to 90 GB and nothing for what's sent out, against Supabase Pro's $25 and its egress past 250 GB.
- Threads are a header away, not yet a speed-up: the engine asks for none (`lib/wasm/features.js`'s `threads` is false wherever the page isn't isolated, and nothing reads it), and the physics worker is off for its 0.5 ms hop a frame (`lib/physics/workerClient.js`), which shared pose buffers would remove.

## Revisit when

- The Minecraft player is served from an origin that sends COEP (its saves stay with the old origin: a player exports their worlds first, as EPK files, and loads them in the new one) (a Worker of its own, or a subdomain on Cloudflare): then isolation with `credentialless` for the whole site, and the physics worker's poses in shared memory.
- `dist/` nears 20,000 files: a paid plan.
- `/audio/*`'s requests near the free plan's 100,000 a day: Workers Paid, or the range cut only for the files a media element plays.
