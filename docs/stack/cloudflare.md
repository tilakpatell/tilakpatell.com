# Cloudflare

**Version** wrangler 4.149.0, pinned in `.github/workflows/deploy.yml` (run with `npx`, not a package) · **Page owner** `wrangler.jsonc`, `cloudflare/worker.js`, `public/_headers` and `scripts/lib/bucket.mjs` · **Decisions** [the site on Cloudflare](../decisions/2026-10-21-cloudflare-for-the-site.md), [the heavy assets on R2](../decisions/2026-10-21-heavy-assets-on-r2.md)

## What it is, and why it is here

Cloudflare answers for tilakpatell.com since 2026-10-21. Its DNS holds the domain's records (the nameservers moved from Namecheap; the domain stays registered and renewed there), and the Worker `tilakpatell-com` serves the site: the build's files, and one small script for `/audio/*`. It took over from GitHub Pages, which served the site until 2026-10-21, for what Pages can't do: a long cache on the hashed files, headers the site chooses (cross-origin isolation among them), no bandwidth cap, and next, R2 for the heavy assets with nothing charged for what's sent out. Without it, the site is GitHub Pages again, by pointing the DNS back.

## Where it is used

Nothing under `src/` knows about Cloudflare (the site asks `ASSET_BASE`, whatever it is, for the heavy files). These do:

- `wrangler.jsonc`: the Worker's name, the account's id, the build's files (`./dist`), the site's `404.html` for a path with no file, and the script for `/audio/*` alone.
- `cloudflare/worker.js` (tested beside it): that script, which answers a `Range` on audio.
- `public/_headers`: the header rules, copied into `dist/` by the build.
- `.github/workflows/deploy.yml`: lints, tests and builds `main`, then uploads it.
- `scripts/lib/bucket.mjs` (tested beside it): the R2 buckets for the scripts, each request signed with R2's S3 keys; `scripts/bucket-put.mjs` sends the desktop's files with it.
- `.github/workflows/assets-to-r2.yml`: the copy from Supabase Storage, by hand.

## How the site uses it

- **Files, and code for audio alone.** A request for one of a Worker's files runs no code and is neither billed nor counted against the Workers free plan's 100,000 requests a day. `run_worker_first: ["/audio/*"]` runs `cloudflare/worker.js` for those paths only, so only audio requests count.
- **The deploy.** One job, `deploy`, lints, tests and builds `main`, then runs `npx --yes wrangler@4.149.0 deploy` with the secret `CLOUDFLARE_API_TOKEN` (it fails, naming the secret, without it). Wrangler hashes every file and sends only the ones the Worker doesn't hold (the first time, 11,362 files in 229 s; after, about 30 s). The job's environment, `cloudflare`, lists each deploy in the repository's Deployments with the site's address, done once the upload has gone through.
- **Headers** (`public/_headers`): `/assets/*` (Vite's hashed names) a year and `immutable`; every file `Access-Control-Allow-Origin: *`, as GitHub Pages sent, which the Minecraft player on its own origin needs for `/eagler/*.bin`. Everything else keeps Cloudflare's default, `max-age=0, must-revalidate`, and is answered 304 when unchanged.
- **R2 for the heavy assets.** Two buckets: `site-assets`, public through its own domain `assets.tilakpatell.com` (the repository variable `ASSET_BASE`), and `bf2017-assets`, the 2017 drop, private. The domain has a CORS policy (any origin, `GET` and `HEAD`, `Content-Length`, `Content-Range` and `ETag` exposed) and a cache rule (hostname `assets.tilakpatell.com`: eligible for cache, a year at the edge whatever the object says, 400 and over never stored). A path there is `<hash12>/<path>` and never overwritten, so a year is safe. The scripts sign each request themselves (`lib/bucket.mjs`: AWS's Signature Version 4, region `auto`, the payload unsigned); a listing comes back in Supabase Storage's old shape for the scripts that walked it.
- **Paths:** a folder's `index.html` answers at its path with the slash (`/universe` is a 307 to `/universe/`); a path with no file gets `404.html` at 404, which sends a hash route on.
- **Ranges:** the Worker's files answer a `Range` with the whole file, 200, on the domain and on workers.dev alike, cached or not; Safari plays an `<audio>` only from a server that answers 206, and the Music page plays `/audio/sitar-listen.mp3` so. `cloudflare/worker.js` asks for the file whole and cuts the bytes asked for: 206 with `Content-Range`, 416 past the end, `Accept-Ranges: bytes` on a whole answer. Every other path still answers a range whole; the site's other media (films, Giphy) aren't its files.

## What it costs

The owner's ceiling, 2026-10-21: **$20 to $30 a month** for Cloudflare. A paid plan or a script is fine where it buys something the site needs; past the ceiling is not.

- **Now: nothing.** DNS, the Worker's files and their bandwidth are on the free plan; the audio script's requests count against the free plan's 100,000 a day, a few a visit to a page with sound.
- **R2 for the heavy assets** (80 to 90 GB, the owner's count; the copy is `.github/workflows/assets-to-r2.yml`, run by hand, as Cloudflare's own copy won't take Supabase's address): $0.015 a GB-month past 10 GB, so about $1 to $2 a month; reads $0.36 a million past 10 million a month; writes $4.50 a million past 1 million a month; nothing for bytes sent out. Through a custom domain (not `r2.dev`, which is rate-limited and uncached) with a cache rule, a file read again comes from Cloudflare's cache and costs no read.
- **Workers Paid, if a script or more files is ever needed:** $5 a month, with 10 million Worker requests a month in it and the 100,000-file limit.
- **What would break or bill unnoticed:** a script on the Worker on the free plan (each page view and file a request: past 100,000 a day the site stops answering), R2 read without the cache (a read for every file, every visit), Workers KV, D1 or Durable Objects (none used).

## What the site does not use, and why

- **A script for every path.** Only audio needs one (ranges); the rest is files and headers. Run for every path, it would make every request a Worker request.
- **GitHub Pages.** It served the site until 2026-10-21 and had every deploy while the domain moved; the deploy no longer publishes there.
- **Cloudflare Pages.** The owner made a Worker; files on a Worker have the same limits and the same free requests.
- **Cloudflare's own Git builds** (Workers Builds). Removed: they built `main` again without the deploy's checks or the bucket's address, and overwrote what the deploy uploaded.
- **Cross-origin isolation** (COOP and COEP, for `SharedArrayBuffer` and threads). Tried on the Worker: 13 pages fine, but the Minecraft player's frame on `tilakpatell.github.io` is refused until it's served from an origin that sends COEP.
- **An address for each version** (`preview_urls: false`).

## Rules

- Code runs for the paths in `run_worker_first` alone (`/audio/*`); a path joins it only for something the files can't do, and a script for every path waits for Workers Paid. Nothing enforces it.
- `dist/` stays under 20,000 files and 25 MiB a file (wrangler counted 12,279 on 2026-10-21; the largest, `public/eagler/1.12.2.bin`, is 22.2 MiB). The upload fails past either; nothing checks before.
- No `/*` rule in `public/_headers` sets `Cache-Control`: Cloudflare joins a header two matching rules set with a comma. Nothing enforces it.
- Wrangler at an exact version, and `compatibility_date` no newer than its local runtime knows. Nothing enforces it; `wrangler dev` refuses to start.
- Whether a file is in a bucket is asked of R2 itself (a signed HEAD on the endpoint), never of `assets.tilakpatell.com`, whose cache would keep the answer (`scripts/assets-publish.mjs`, `scripts/bucket-put.mjs`). The cache rule stores no 400 or over as a second guard.
- R2's keys are read in one place, `keysOf` in `scripts/lib/bucket.mjs`, and never printed; no S3 package is installed for them.
- A path in `site-assets` is a content hash and is never overwritten; old paths go only with `scripts/assets-upload.mjs --prune`, after the deploy that stopped naming them is live.
- The deploy asks the bucket only for what the manifests gained or changed since the last deploy that went out (`scripts/assets-check.mjs --since <commit>`, one byte's range each, the body never read); every file only by hand (`deploy.yml`'s `full-check`). Nothing in a workflow, a check or a session walks a whole bucket on a schedule.

## Upgrading

Change the version in `.github/workflows/deploy.yml`, then `npx --yes wrangler@<version> deploy --dry-run` beside a built `dist/` and `npx --yes wrangler@<version> dev` to serve it locally. Last: 4.149.0, the first, on 2026-10-21 (4.151.3 was a day old).

## Gotchas

- The dashboard's "Hello world" Worker had its workers.dev address off: every path answered `error code: 1042`. The first `wrangler deploy` replaced its script and turned the address on.
- `compatibility_date: 2026-10-21` deployed but `wrangler dev` on 4.149.0 refused it (its newest is 2026-10-13).
- The first deploy after the move skipped the upload: the step waited for a repository variable with the account's id, and the repository had the login another way. The id is in `wrangler.jsonc` now.
- Right after the first upload, Cloudflare still answered some paths with the old Worker's cached error for a minute.
- A domain on Cloudflare's DNS isn't on the Worker until it's the Worker's custom domain: with the old A records proxied, Cloudflare passed every request on to GitHub Pages (`server: GitHub.com`, GitHub's `max-age=600` on `/assets/`, `/_headers` a 200), and the same build on both hid it. Tell the Worker by what only it does: `/_headers` is a 404 there and `/assets/` says `immutable`.
- The Worker's files don't serve ranges even through Cloudflare's cache (a `HIT`, still 200); a 206 seen on the domain while it moved was GitHub Pages'.
- The first two runs of the R2 copy failed on a key: the saved `R2_ACCESS_KEY_ID` held a line break, and Go refused the `Authorization` header it went into (`invalid header field value`). The copy and `keysOf` now take a key's whitespace out; the copy holds R2's to 32 and 64 hex characters and says their lengths when they aren't.
- R2's S3 keys are the Access Key ID and Secret Access Key shown once when an R2 API token is made, not the token itself.
