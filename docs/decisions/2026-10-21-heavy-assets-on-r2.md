# The heavy assets move to Cloudflare R2, and Supabase Storage is emptied

**Date:** 2026-10-21 · **Status:** accepted · **Where:** `scripts/lib/bucket.mjs`, `.github/workflows/assets-to-r2.yml`, `scripts/assets-mirror.mjs`, `ASSET_BASE` in `.github/workflows/deploy.yml` · **Follows:** [the mirror on Supabase Storage](2026-10-09-heavy-assets-mirrored-on-supabase-storage.md), [the site on Cloudflare](2026-10-21-cloudflare-for-the-site.md)

## Context

The owner asked for the Supabase files to move to Cloudflare, and for them to be deleted from Supabase once they had. The ceiling is $20 to $30 a month, not nothing.

- Supabase held four buckets. `site-assets` is the public one the site reads; its manifests name 78,529 files (13.5 GB). `bf2017-assets` is the 2017 drop, private, which an S3 listing had passed 51,000 files in on 2026-10-22. `bf2-workspace-backup` was made 2026-10-18 and holds 967 files, 99.06 GB. `bf2-extract` was empty. That is about 120 GB in all, which keeps the project on Pro ($25 a month) with its 250 GB of cached egress; the deploy's check once ran that to 387 GB in a month (`docs/stack/supabase.md`).
- R2 stores a GB for $0.015 a month past 10 GB, sends nothing out for a fee, and counts reads ($0.36 a million) only where Cloudflare's cache doesn't answer.
- Cloudflare's own copy (Super Slurper) and its copy-on-read (Sippy) refuse Supabase's S3 address, whose bucket sits under `/storage/v1/s3`. rclone takes it (provider Other, path-style), as Supabase's own guide copies a project out.
- What the copy met, 2026-10-21 to 22:
  - **A bad key.** The saved `R2_ACCESS_KEY_ID` held a line break, and Go refused the `Authorization` header it went into. The workflow now takes whitespace out of each key and holds R2's to 32 and 64 hex characters.
  - **Missing buckets.** R2 had one bucket, the owner's `tilak-assets`, with the domain and CORS on it. An hour of puts went to `site-assets` and `bf2017-assets`, which didn't exist there (38,594 `NoSuchBucket`).
  - **Rate limits.** Supabase's S3 address answered `429 Too Many Requests` to everything once a copy asked 64 things at once, and at 10 requests a second it still timed out its own database now and then. The drop's copy moved about two files a second there: 11,565 files (3.9 GB) in a six-hour job.
  - **The CDN.** Supabase's public CDN answered for the public bucket's files at once.
- About forty scripts read or wrote Storage through its REST calls (a list call one folder deep, `apikey` and `Bearer` headers, `x-upsert`), one through supabase-js, and the desktop's jobs through the export's own `upload_supabase.py`. Nothing in the browser called Storage: the site asks `<ASSET_BASE>/<hash12>/<path>` and nothing more (`src/lib/assetPath.js`).
- The live build makes no Supabase client (no `VITE_SUPABASE_URL` in it); the database and Realtime aren't what is moving.

## Decision

- **Where each bucket goes on R2.**
  - Supabase's `site-assets` becomes `tilak-assets`, the bucket the owner made first, public at its own domain `assets.tilakpatell.com`. It has CORS for any origin and a cache rule: a year at the edge, an error never stored.
  - `bf2017-assets` and `bf2-workspace-backup` keep their names and stay private.
- **How each is copied.**
  - The public bucket's 78,529 files go by name from Supabase's CDN (`scripts/assets-mirror.mjs`, the copy workflow's `public` job). Each is held to its manifest's bytes and put with its type and a year's cache.
  - The other buckets and whatever else the public one holds go by rclone over S3 at ten requests a second, a bucket at a time, each run carrying on from the last.
- **The scripts.** They reach R2 through `scripts/lib/bucket.mjs`, which signs S3 requests with node:crypto. Nothing is installed for it, and four of AWS's worked examples hold it in its test. It answers a folder's listing in Storage's old shape, so the scripts' logic stays. The desktop's uploads go through `scripts/bucket-put.mjs`, which keeps the export's `upload_state.tsv`.
- **The switch.** `ASSET_BASE` is the R2 domain, written into `deploy.yml`, `ci.yml` and `worlds.yml`. This session can't change repository variables, and the address is not a secret.
- **Emptying Supabase.** A Supabase bucket is emptied only by the copy workflow's `empty-supabase` step, after R2 has been checked to hold every file of it at its size (`rclone check --one-way`). A bucket that fails the check is left whole. The project stays, on the free plan, for the database and Realtime.

## Consequences

- R2 costs about $1.65 a month for the 120 GB, and nothing for what is sent out. Supabase Pro's $25 goes once its storage is gone.
- The keys are R2's S3 pair, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, where `SUPABASE_URL` and `BF2017_KEY` (or `SUPA_KEY`) were:
  - `.env.local`
  - the repository's secrets
  - the desktop runner's `.env`
  - a cloud session's environment
- A publish asks R2 itself whether a hash is up (a signed HEAD), never the public domain, whose cache would otherwise keep a "not there".
- New uploads say `public, max-age=31536000, immutable`; what came across from Supabase says what Supabase had (`max-age=31536000`). The asset check holds both to the year: 78,529 of 78,529 right at `assets.tilakpatell.com` on 2026-10-22.
- The drop takes a day or more of six-hour runs at Supabase's pace. Until it is across, `bf2017-assets` stays on Supabase and the scripts that read it from R2 find what has come over so far. The desktop's export (`BF2_Extract`) is the other copy: `scripts/bucket-put.mjs` sends from it straight to R2.
- Once Supabase is emptied, R2 is the only copy of the backup and of anything the desktop doesn't hold.

## Revisit when

- R2's reads pass 10 million a month: a file the cache missed is a read, so the cache rule is the first thing to look at.
- The stored bytes pass about 1 TB (R2 then costs past the ceiling's half).
- A script needs a call `bucket.mjs` doesn't make (a multipart upload for a file over 5 GB, a copy inside R2).
