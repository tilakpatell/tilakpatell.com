# Supabase and @supabase/supabase-js

**Version** `@supabase/supabase-js@^2.117.3` · **Page owner** `src/lib/durable/` · **Decision** [2026-10-09-supabase-for-durable-shared-state.md](../decisions/2026-10-09-supabase-for-durable-shared-state.md)

## What it is, and why it is here

The client to the durable world’s database: a hosted PostgreSQL with PostGIS, row-level security, anonymous sign-in and Realtime, reached from the static page with the public anon key. The site has no other server; without this, what a player builds on a planet would last only as long as the visit (Nostr relays keep nothing). Without a URL in the environment the client is `null` and the game plays with no durable layer.

## Where it is used

The census row is in [README.md](README.md). The files that import it:

- `src/lib/durable/supabase.js`: the client, made or `null`, and the anonymous sign-in.
- `scripts/supabase-check.mjs`: the schema walked by hand against the real project.

Around them: `src/lib/durable/entityLoader.js` (a planet’s built things, cell by cell; tested against `src/lib/durable/fixtures/fakeClient.js`), `src/lib/durable/entities.js` (the grid and the rows) and `scripts/supabase-seed.mjs` (the planets, into `supabase/seed.sql`). The schema is `supabase/migrations/` (how to apply it: `supabase/README.md`); the design is `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md`, Pillar 2.

## How the site uses it

- **One client, made in one file.** The client is made in `src/lib/durable/supabase.js` alone, once a page, from `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; either empty, and it is `null`.
- **Anonymous sign-in for ownership.** The same file’s `signIn` gives each browser a user id (the session it has, else `signInAnonymously`); RLS makes a row its owner’s to change.
- **An RPC for the envelope.** What is built round the ship is asked for a cell at a time through `get_entities_in_bounding_box` (8,192 m a side and 2,000 rows at most, by the database).
- **A `security definer` function for others’ writes.** Damage goes through `damage_entity`, clamped and rate-limited in the database.
- **Realtime as the backstop.** `postgres_changes` on `world_entities` for one planet folds others’ builds in; a Nostr hint is the fast path.

## What the site does not use, and why

- **The service-role key**: it bypasses RLS; it never leaves the owner’s dashboard, never enters the repository, a workflow or a session.
- **Storage, Edge Functions, auth providers beyond anonymous**: nothing asks for them yet; a second feature that does gets its own decision entry.
- **Realtime presence and broadcast**: the volatile traffic (poses, shots) stays on Nostr (the spec’s decision 8).

## Rules

- The client is made in `src/lib/durable/supabase.js` alone (nothing enforces it; the census shows which files import the package).
- Every table has RLS on (the migration enables it; `scripts/supabase-check.mjs` walks it against a project by hand).
- No key is committed or printed: the build reads the two from the environment (`.env.local`, git-ignored; the repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `deploy.yml`).
- The durable folder imports no three.js and no React, and its tests use a fake client, never the network (`docs/health/RULES.md`).

## Upgrading

```
npm install @supabase/supabase-js@<version>
npx vitest run src/lib/durable
npm run build
node scripts/supabase-check.mjs
```

The site calls `createClient`, `auth.getSession`, `auth.signInAnonymously`, `rpc`, `from().insert().select().single()`, `from().delete().eq()` and `channel().on('postgres_changes').subscribe()`; on a major version, read its changelog for those first. Last upgrade: not recorded; record the next one here, with what it broke.

## Gotchas

- **Anonymous sign-ins are off by default.** Enable them in the project’s Authentication settings, or every write is refused (`supabase/README.md`).
- **Realtime respects RLS for `SELECT`.** A subscriber sees only the changes its read policy lets it see; the read policy here is open, so everyone sees every planet’s changes it asks for.
- **A `DELETE` over Realtime carries only the primary key** unless the table’s replica identity is full, so the loader removes by id and never reads anything else from `old`.
