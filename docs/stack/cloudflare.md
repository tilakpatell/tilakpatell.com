# Cloudflare

**Version** wrangler 4.149.0, pinned in `.github/workflows/deploy.yml` (run with `npx`, not a package) · **Page owner** `wrangler.jsonc` and `public/_headers` · **Decision** [the site on Cloudflare](../decisions/2026-10-21-cloudflare-for-the-site.md)

## What it is, and why it is here

Cloudflare answers for tilakpatell.com since 2026-10-21. Its DNS holds the domain's records (the nameservers moved from Namecheap; the domain stays registered and renewed there), and the Worker `tilakpatell-com` holds the build's files and nothing else. It took over from GitHub Pages for what Pages can't do: a long cache on the hashed files, headers the site chooses (cross-origin isolation among them), no bandwidth cap, and next, R2 for the heavy assets with nothing charged for what's sent out. Without it, the site is GitHub Pages again, by pointing the DNS back.

## Where it is used

Nothing under `src/` knows about Cloudflare. Three files do:

- `wrangler.jsonc`: the Worker's name, the account's id, the build's files (`./dist`) and nothing else, the site's `404.html` for a path with no file.
- `public/_headers`: the header rules, copied into `dist/` by the build.
- `.github/workflows/deploy.yml`: the `cloudflare` job, after GitHub Pages.

## How the site uses it

- **Files alone, no script.** A request for one of a Worker's files runs no code and is neither billed nor counted against the Workers free plan's 100,000 requests a day; a Worker with a script (`main` in `wrangler.jsonc`, or `run_worker_first`) makes each of those requests a Worker request.
- **The deploy.** The `cloudflare` job downloads GitHub Pages' artifact (`github-pages`, the build's `dist/` as a tar), untars it and runs `npx --yes wrangler@4.149.0 deploy` with the secret `CLOUDFLARE_API_TOKEN`. Wrangler hashes every file and sends only the ones the Worker doesn't hold (the first time, 11,362 files in 229 s; after, about 30 s). The job's environment, `cloudflare`, lists each upload in the repository's Deployments. It runs only when the secret is set.
- **Headers** (`public/_headers`): `/assets/*` (Vite's hashed names) a year and `immutable`; every file `Access-Control-Allow-Origin: *`, as GitHub Pages sent, which the Minecraft player on its own origin needs for `/eagler/*.bin`. Everything else keeps Cloudflare's default, `max-age=0, must-revalidate`, and is answered 304 when unchanged.
- **Paths:** a folder's `index.html` answers at its path with the slash (`/universe` is a 307 to `/universe/`); a path with no file gets `404.html` at 404, which sends a hash route on.
- **Ranges:** on tilakpatell.com, Cloudflare's cache answers a `Range` with 206 (Safari's `<audio>` needs it: `/audio/sitar-listen.mp3`). The bare `tilakpatell-com.tilakny.workers.dev` address answers 200 with the whole file.

## What it costs

The owner's ceiling, 2026-10-21: **$20 to $30 a month** for Cloudflare. A paid plan or a script is fine where it buys something the site needs; past the ceiling is not.

- **Now: nothing.** DNS, the Worker's files and their bandwidth are on the free plan.
- **R2, once the heavy assets move there** (80 to 90 GB, the owner's count; the copy is `.github/workflows/assets-to-r2.yml`, run by hand, as Cloudflare's own copy won't take Supabase's address): $0.015 a GB-month past 10 GB, so about $1 to $2 a month; reads $0.36 a million past 10 million a month; writes $4.50 a million past 1 million a month; nothing for bytes sent out. Through a custom domain (not `r2.dev`, which is rate-limited and uncached) with a cache rule, a file read again comes from Cloudflare's cache and costs no read.
- **Workers Paid, if a script or more files is ever needed:** $5 a month, with 10 million Worker requests a month in it and the 100,000-file limit.
- **What would break or bill unnoticed:** a script on the Worker on the free plan (each page view and file a request: past 100,000 a day the site stops answering), R2 read without the cache (a read for every file, every visit), Workers KV, D1 or Durable Objects (none used).

## What the site does not use, and why

- **A Worker script.** Nothing needs one: the domain serves ranges, and the rest is headers. One would make every request a Worker request.
- **Cloudflare Pages.** The owner made a Worker; files alone on a Worker have the same limits and the same free requests.
- **Cloudflare's own Git builds** (Workers Builds). Removed: they built `main` again without the deploy's checks or the bucket's address, and overwrote what the deploy uploaded.
- **Cross-origin isolation** (COOP and COEP, for `SharedArrayBuffer` and threads). Tried on the Worker: 13 pages fine, but the Minecraft player's frame on `tilakpatell.github.io` is refused until it's served from an origin that sends COEP.
- **An address for each version** (`preview_urls: false`).

## Rules

- The Worker stays files alone (no `main`, no `run_worker_first`) unless a script buys something the files can't do, and then on Workers Paid. Nothing enforces it.
- `dist/` stays under 20,000 files and 25 MiB a file (wrangler counted 12,279 on 2026-10-21; the largest, `public/eagler/1.12.2.bin`, is 22.2 MiB). The upload fails past either; nothing checks before.
- No `/*` rule in `public/_headers` sets `Cache-Control`: Cloudflare joins a header two matching rules set with a comma. Nothing enforces it.
- Wrangler at an exact version, and `compatibility_date` no newer than its local runtime knows. Nothing enforces it; `wrangler dev` refuses to start.

## Upgrading

Change the version in `.github/workflows/deploy.yml`, then `npx --yes wrangler@<version> deploy --dry-run` beside a built `dist/` and `npx --yes wrangler@<version> dev` to serve it locally. Last: 4.149.0, the first, on 2026-10-21 (4.151.3 was a day old).

## Gotchas

- The dashboard's "Hello world" Worker had its workers.dev address off: every path answered `error code: 1042`. The first `wrangler deploy` replaced its script and turned the address on.
- `compatibility_date: 2026-10-21` deployed but `wrangler dev` on 4.149.0 refused it (its newest is 2026-10-13).
- The first deploy after the move skipped the upload: the step waited for a repository variable with the account's id, and the repository had the login another way. The id is in `wrangler.jsonc` now.
- Right after the first upload, Cloudflare still answered some paths with the old Worker's cached error for a minute.
