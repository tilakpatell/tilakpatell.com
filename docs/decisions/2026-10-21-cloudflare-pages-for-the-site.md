# The site is deployed to Cloudflare Pages beside GitHub Pages, and the domain moves when the owner says

**Date:** 2026-10-21 · **Status:** accepted · **Where:** `.github/workflows/deploy.yml` (the Cloudflare step), `public/_headers`

## Context

The owner asked whether moving off GitHub Pages was worth it, and what it costs. Measured on the live site, 2026-10-21:

- GitHub Pages sends `cache-control: max-age=600` on every file, the content-hashed `/assets/` chunks too, and sets no header a site asks for. A returning visitor asks again for each of the 344 to 389 files the universe map loads once ten minutes have gone.
- It compresses with gzip only, and `dist/` is 1.4 GB against its published 1 GB limit, with a soft cap on bandwidth. A deploy takes about forty minutes.
- The wait the owner saw on the map ("Fetching the world 0%") was not the host: every download was done by 2.8 s of a 17.7 s wait, the rest the shaders being made in the browser.
- Cloudflare Pages' free plan: no bandwidth limit listed, 20,000 files a site (100,000 on a paid plan), 25 MiB a file, 100 header rules. `dist/` has 11,540 files, none over 25 MiB.
- The domain's DNS is Namecheap's, with Namecheap's email forwarding (its MX and SPF records), which by Namecheap's account works only while its own DNS answers for the domain.

## Decision

The deploy sends the same `dist/` to a Cloudflare Pages project after GitHub Pages, once the repository has the project's variables and token; until then the step is skipped. `public/_headers` gives `/assets/*` a year and `immutable`, and nothing else a cache header. The domain is pointed at Cloudflare by the owner, its email forwarding moved to Cloudflare's Email Routing first.

## Consequences

- No cost for the site's hosting. The domain stays registered at Namecheap and renews there.
- A returning visitor fetches no hashed chunk again; the unhashed files are asked again each visit (Cloudflare's default, `max-age=0, must-revalidate`, as `wrangler pages dev` served the build) and answered 304 when unchanged.
- Both hosts get every deploy until GitHub Pages is switched off; the domain decides which one visitors reach, and moving it back is a DNS change.
- The heavy assets stay on Supabase Storage (`2026-10-09-heavy-assets-mirrored-on-supabase-storage.md`). R2 would cost cents a month for the 13.8 GB and nothing for what's sent out, against Supabase Pro's $25 and its egress past 250 GB.
- Cloudflare can send the cross-origin isolation headers (COOP and COEP) that `SharedArrayBuffer` and threaded WebAssembly need (`docs/stack/webassembly.md`). They are not sent: under COEP every embedded page (the N64 and Eaglercraft frames) and every picture from another site has to opt in, and Rapier's npm build is single-threaded anyway.

## Revisit when

- `dist/` nears 20,000 files: a paid plan, or Workers' static assets.
- The heavy assets' egress bill grows: the bucket to R2, in an entry of its own.
- A threaded WebAssembly build is wanted: isolation, tested on every embed and outside picture first.
