# The heavy assets are mirrored on Supabase Storage; the site stays whole

Date: 2026-10-09. The plan: `docs/superpowers/plans/2026-10-09-asset-hosting.md`; where it is left: `docs/superpowers/HANDOFF-galaxy.md` (lane I).

## Context

`public/` is over a gigabyte, and its biggest files (the HQ models and scans, the galaxy's photo textures, the film-made models, the kit) come from GitHub Pages, with its short cache and its soft bandwidth limit. The durable world already has a Supabase project ([the entry](2026-10-09-supabase-for-durable-shared-state.md)), whose Storage serves public files behind a CDN. The standing rule says no run-time calls to asset services (`2026-10-05-autopilot-design.md`); its purpose is that nothing is generated or chosen at run time and nothing a visitor sees depends on a paid service.

## Decision

The files a pack names under the listed folders, of a heavy kind and 64 KB or more, are mirrored to a public bucket at `<hash12>/<path>` by `scripts/assets-upload.mjs`, run from the owner's shell with the service-role key held there alone. The build, with `VITE_ASSET_BASE` set, sends a loader to the bucket's copy when `src/data/assets-manifest.json` names the file with the hash it has on disk; anything else, and everything after one failure, comes from the site. `public/` stays whole and deployed.

## Consequences

- The rule is read as it was meant: the bucket holds copies of committed, credited files, byte for byte; it makes nothing and chooses nothing, and the site plays the same without it.
- The service-role key lives in one place outside the dashboard: the owner's shell, for the length of an upload. A test fails on its prefix or role name in any tracked file.
- A world installed for offline play holds the bucket's copies under their remote URLs; the service worker serves them, and serves them too for the site's path after a fallback.
- The free tier (1 GB stored, about 5 GB out a month) holds the set but not the site's traffic: Pro before `ASSET_BASE` is set for everyone.

- 2026-10-10 (lane S, `docs/decisions/2026-10-10-battlefront-2017-assets.md`): the bucket is `site-assets` (`assets` was never made), shared with the game-derived files; `src/data/galaxyAssets.json` holds those remote-only entries (manifest committed, files not), the build merges it with this manifest into the one the loaders read, and `--prune` spares what it names.

## Revisit when

- Egress costs more than the gain in load time: unset `ASSET_BASE` and the site is as it was.
- A file kind with sidecars (a `.gltf` and its `.bin`) wants to go: then a folder per hash, in a new entry.
