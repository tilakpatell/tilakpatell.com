# Supabase and @supabase/supabase-js

**Version** `@supabase/supabase-js@^2.117.3` · **Page owner** `scripts/supabase-check.mjs`
and `src/lib/durable/` · **Decision** [2026-10-09-supabase-for-durable-shared-state.md](../decisions/2026-10-09-supabase-for-durable-shared-state.md) <!-- planet flight (scripts/flight-island.mjs removes these rows) -->
· **Decision** [2026-10-09-heavy-assets-mirrored-on-supabase-storage.md](../decisions/2026-10-09-heavy-assets-mirrored-on-supabase-storage.md)

## What it is, and why it is here

The client to the durable world’s database: a hosted PostgreSQL with PostGIS, row-level security, anonymous sign-in and Realtime, reached from the static page with the public anon key. The site has no other server; without this, what a player builds on a planet would last only as long as the visit (Nostr relays keep nothing). Without a URL in the environment the client is `null` and the game plays with no durable layer.

## Where it is used

The census row is in [README.md](README.md). The files that import it:

- `src/lib/durable/supabase.js`: the client, made or `null`, and the anonymous sign-in. <!-- planet flight -->
- `scripts/supabase-check.mjs`: the project read from `.env.local` as Vite reads it.
With one, it walks the flight’s schema by hand against it (`scripts/lib/durable-check.mjs`). <!-- planet flight -->
- `src/components/stream/StreamView.jsx` and `src/components/stream/send.js`: the stream spike’s signalling, each end’s own client with no session, on Realtime broadcast (below).

Around them: `src/lib/durable/entityLoader.js` (a planet’s built things, cell by cell; tested against `src/lib/durable/fixtures/fakeClient.js`), `src/lib/durable/entities.js` (the grid and the rows) and `scripts/supabase-seed.mjs` (the planets, into `supabase/seed.sql`). The schema is `supabase/migrations/` (how to apply it: `supabase/README.md`); the design is `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md`, Pillar 2. <!-- planet flight -->

## How the site uses it

- **Storage, until 2026-10-21.** The heavy models and textures, the game-derived files and the 2017 drop were in Storage buckets ([the entry](../decisions/2026-10-09-heavy-assets-mirrored-on-supabase-storage.md)); they moved to Cloudflare R2 with the same paths, the public one as `tilak-assets` ([the move](../decisions/2026-10-21-heavy-assets-on-r2.md), `docs/stack/cloudflare.md`), and Storage is emptied once R2 has served them. Nothing in the repository calls Storage now but the copy, `.github/workflows/assets-to-r2.yml`.
<!-- planet flight: begin -->
- **One client, made in one file.** The client is made in `src/lib/durable/supabase.js` alone, once a page, from `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; either empty, and it is `null`.
- **Anonymous sign-in for ownership.** The same file’s `signIn` gives each browser a user id (the session it has, else `signInAnonymously`); RLS makes a row its owner’s to change.
- **An RPC for the envelope.** What is built round the ship is asked for a cell at a time through `get_entities_in_bounding_box` (8,192 m a side and 2,000 rows at most, by the database).
- **A `security definer` function for others’ writes.** Damage goes through `damage_entity`, clamped and rate-limited in the database.
- **Realtime as the backstop.** `postgres_changes` on `world_entities` for one planet folds others’ builds in; a Nostr hint is the fast path.
<!-- planet flight: end -->
- **Realtime broadcast for a stream’s signalling**. One public channel a stream, `stream:<id>`, the id drawn by crypto; the WebRTC offer, answer and ICE candidates go as broadcast messages through `src/lib/stream/realtime.js` (which takes the client and imports no Supabase). No table, no policy, nothing stored. The clients are made in the stream’s own files, not the durable world’s: the stream holds no session and must outlive that world’s removal. A product mode would move to a private channel with an RLS policy on `realtime.messages` (the owner’s to create then).

## What the site does not use, and why

- **The service-role key**: it bypasses RLS. The heavy-asset upload used it until the move to R2 (2026-10-21); it never enters the repository, a workflow or a session (`scripts/assets-upload.test.mjs` fails on its prefix or role name in any tracked file).
- **Edge Functions, auth providers beyond anonymous**: nothing asks for them yet; a feature that does gets its own decision entry.
- **Realtime presence, and broadcast for play**: the volatile traffic (poses, shots) stays on Nostr (the spec’s decision 8); broadcast carries only a stream’s handshake, a handful of messages a connection.

## Rules

- The client is made in `src/lib/durable/supabase.js` alone (nothing enforces it; the census shows which files import the package), but for the stream’s two ends, which hold no session. <!-- planet flight -->
- Every table has RLS on (the migration enables it; `scripts/supabase-check.mjs` walks it against a project by hand).
- No key is committed or printed: the build reads the two from the environment (`.env.local`, git-ignored; the repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `deploy.yml`).
- The bucket's rules (a content hash a path, never overwritten, old paths only with `--prune`; the deploy asking only for what the manifests gained) went with it to R2: `docs/stack/cloudflare.md`.
- The durable folder (`src/lib/durable/`) imports no three.js and no React, and its tests use a fake client, never the network (`docs/health/RULES.md`). <!-- planet flight -->

## Upgrading

```
npm install @supabase/supabase-js@<version>
npx vitest run src/lib/durable   # planet flight
npm run build
node scripts/supabase-check.mjs
```

The site calls `createClient`, `auth.getSession`, `auth.signInAnonymously`, `rpc`, `from().insert().select().single()`, `from().delete().eq()`, `channel().on('postgres_changes').subscribe()`, and for the stream `channel().on('broadcast')`, `send({ type: 'broadcast' })` and `removeChannel`; on a major version, read its changelog for those first. Last upgrade: not recorded; record the next one here, with what it broke.

## Gotchas

The first three are from when the heavy assets were in Storage, before 2026-10-21, and are why they moved.

- **Egress is the bill a level world grows**. Pro includes 250 GB of cached egress a month, then $0.03 a GB. Every byte a visit pulls is held to its quality level’s `visitMB` (`src/lib/budgets.js`: 40, 120, 400, 1,200 MB), and its boot slice to `bootMB` (3, 6, 12, 12): at 400 MB a visit the included 250 GB is 625 high visits a month, at 1,200 MB about 210 ultra ones; the service worker keeps the world being played (`public/sw.js`, 400 MB), so a second visit on the same machine pulls little. The hedge if it climbs is Cloudflare R2 (no egress charge, $0.015 a GB-month stored) in front of the same hashed paths; the owner’s call. The paths stay public, unsigned and hashed: Smart CDN keys a signed URL apart, and a Range request into one GLB is never made (the loader parses whole files).
- **The deploy’s check was the egress (2026-10-15).** `scripts/assets-check.mjs` asked one byte of every published file at every deploy: 77,545 files, half an hour, and the month’s cached egress came to 387 GB against the included 250, which is 28 deploys of the bucket’s 13.8 GB: the CDN counts a one-byte range as the whole file, or near enough. Now only the entries changed since the last deploy are asked, and the answer’s body is let go unread (the pool’s `peek`); the summary line counts answers that gave the whole file (a 200), so a deploy’s log shows whether the CDN does that. The `Cached Egress per day` chart on the organisation’s usage page is the check: a day with eight deploys read about 110 GB before, and should read under a gigabyte now.
- **Storage’s `cacheControl` is `max-age` only.** The bucket answers `max-age=31536000`; `immutable` cannot be set through the API, and needs not be: a path never changes its bytes.

- **Anonymous sign-ins are off by default.** Enable them in the project’s Authentication settings, or every write is refused (`supabase/README.md`).
- **Realtime respects RLS for `SELECT`.** A subscriber sees only the changes its read policy lets it see; the read policy here is open, so everyone sees every planet’s changes it asks for.
- **A `DELETE` over Realtime carries only the primary key** unless the table’s replica identity is full, so the loader removes by id and never reads anything else from `old`.
