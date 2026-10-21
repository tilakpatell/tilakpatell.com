# The heavy assets move to Cloudflare R2, and Supabase Storage is emptied

**Date:** 2026-10-21 · **Status:** accepted · **Where:** `scripts/lib/bucket.mjs`, `.github/workflows/assets-to-r2.yml`, the repository variable `ASSET_BASE` · **Follows:** [the mirror on Supabase Storage](2026-10-09-heavy-assets-mirrored-on-supabase-storage.md), [the site on Cloudflare](2026-10-21-cloudflare-for-the-site.md)

## Context

The owner asked for the Supabase files to move to Cloudflare, and for them to be deleted from Supabase once they had. The ceiling is $20 to $30 a month, not nothing.

- Supabase held four buckets: `site-assets` (the public one the site reads, 77,545 files on 2026-10-15), `bf2017-assets` (the 2017 drop, private), `bf2-extract` (empty on 2026-10-10) and `bf2-workspace-backup` (made 2026-10-18). The owner counts 80 to 90 GB in all, which keeps the project on Pro ($25 a month) with its 250 GB of cached egress; the deploy's check once ran that to 387 GB in a month (`docs/stack/supabase.md`).
- R2 stores a GB for $0.015 a month past 10 GB, sends nothing out for a fee, and counts reads ($0.36 a million) only where Cloudflare's cache doesn't answer.
- Cloudflare's own copy (Super Slurper) and its copy-on-read (Sippy) refuse Supabase's S3 address, whose bucket sits under `/storage/v1/s3`. rclone takes it (provider Other, path-style), as Supabase's own guide copies a project out.
- The first runs of the copy failed listing R2: the saved `R2_ACCESS_KEY_ID` held a line break, and Go refused the `Authorization` header it went into. The workflow now takes whitespace out of each key and holds R2's to their 32 and 64 hex characters.
- About forty scripts read or wrote Storage through its REST calls (a list call one folder deep, `apikey` and `Bearer` headers, `x-upsert`), one through supabase-js, and the desktop's jobs through the export's own `upload_supabase.py`. Nothing in the browser called Storage: the site asks `<ASSET_BASE>/<hash12>/<path>` and nothing more (`src/lib/assetPath.js`).
- The live build makes no Supabase client (no `VITE_SUPABASE_URL` in it); the database and Realtime aren't what is moving.

## Decision

The buckets are copied to R2 by `.github/workflows/assets-to-r2.yml` (rclone, each file streamed across with its type and cache header, both sides counted after): `site-assets` into `tilak-assets`, the bucket the owner made first, which had the domain and its CORS already, and `bf2017-assets` under its own name, private. The public one answers at its own domain, `assets.tilakpatell.com`, with CORS for any origin and a cache rule (a year at the edge, an error never cached); `ASSET_BASE` becomes that domain once every manifest's file answers there. The scripts reach R2 through `scripts/lib/bucket.mjs`, which signs S3 requests with node:crypto (nothing installed: four of AWS's worked examples hold it) and answers a folder's listing in Storage's old shape, so their logic stays. The desktop's uploads go through `scripts/bucket-put.mjs`, which keeps the export's `upload_state.tsv`. Once R2 holds every file at its size and the site has read from it, the Supabase buckets are emptied; the project stays, on the free plan, for the database and Realtime.

## Consequences

- R2 costs about $1 to $2 a month for the 80 to 90 GB; Supabase Pro's $25 goes once its storage is gone.
- The keys are R2's S3 pair, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, in `.env.local`, the repository's secrets, the desktop runner's `.env` and a cloud session's environment, where `SUPABASE_URL` and `BF2017_KEY` (or `SUPA_KEY`) were.
- A publish asks R2 itself whether a hash is up (a signed HEAD), never the public domain, whose cache would otherwise keep a "not there".
- New uploads say `public, max-age=31536000, immutable`; what came across from Supabase says what Supabase had (`max-age=31536000`), and the asset check holds both to the year.
- Going back means the copy the other way and `ASSET_BASE` pointed back, while Supabase still holds the files; after they are deleted, R2 is the only copy beside the desktop's export.

## Revisit when

- R2's reads pass 10 million a month: a file the cache missed is a read, so the cache rule is the first thing to look at.
- The stored bytes pass about 1 TB (R2 then costs past the ceiling's half).
- A script needs a call `bucket.mjs` doesn't make (a multipart upload for a file over 5 GB, a copy inside R2).
