# Supabase: the durable world

The schema in `migrations/` is the one source of truth for what players build on the planets (the design: `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md`, Pillar 2; why a server at all: `docs/decisions/2026-10-09-supabase-for-durable-shared-state.md`). The client is `src/lib/durable/`.

## Applying it

1. Make a project at supabase.com (the free tier is enough to start). In Authentication, Providers, enable **Anonymous sign-ins**.
2. `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`. Or paste each file under `migrations/` into the SQL editor, oldest first, then `seed.sql`.
3. Put the project's URL and anon key where the build reads them: locally in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (never committed; `.env.example` lists the names), and on GitHub as the repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (`deploy.yml` passes them to the build). The anon key is public by design: row-level security is what guards the tables, which is why every table here has it on.

## Checking it

`node scripts/supabase-check.mjs` with the project in `.env.local`: signs in anonymously, places three entities on `hoth`, asks the envelope round them (and is refused one 9 km wide), is refused inside Echo Base, damages one to nothing and sees it gone, and checks a second anonymous visitor cannot remove the other two before their owner does. Six lines, each `ok`; exit 1 on a failure, 2 with no project set. It runs by hand (it needs a project; each run makes two anonymous users); CI tests the client against a fake.

## The seed

`seed.sql` is written by `node scripts/supabase-seed.mjs`, never by hand: the 50 planets a thing may be built on, in the roster's order (`docs/research/2026-10-09-planet-geographies.md`), and the places on them where nothing may be (each POI's `r` in the table is its `r + edge`, the whole eased band; Echo Base on `hoth` alone until lane A lands). It reads lane A's `src/lib/land/flight/planetSpec.js` when that is in the tree, else `scripts/fixtures/planets.json` (the same ids; `--fixture` rebuilds it from the Expanse's `makeSector`). It upserts, so applying it again after the list changes is safe. After lane A merges (`planetSpec.js` on main), the owner runs `node scripts/supabase-seed.mjs` and applies the new `seed.sql` in the SQL editor: the named planets' placeholder types and seeds are replaced by lane A's, and each world's POIs are added.

## Rules

- A change to the schema is a new migration file, never an edit of an applied one.
- No service-role key anywhere in this repository or its workflows. The client holds the anon key only.
- A write that is not the owner's own row goes through a `security definer` function that clamps and rate-limits (`damage_entity` is the pattern).
