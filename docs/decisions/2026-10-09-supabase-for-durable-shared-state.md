# Supabase holds the shared world's durable state; the site stays static

Date: 2026-10-09. The long version: `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (Pillar 2); where it is left: `docs/superpowers/HANDOFF-planet-flight.md`.

## Context

The owner asked for structures and turrets placed on planets that stay, for everyone, across visits. The site has no server: it is `dist/` on GitHub Pages, and its multiplayer is ephemeral Nostr events that relays pass on and keep nothing of. The infinite-worlds design (`2026-10-07-infinite-worlds-design.md`, answer 4) weighed three homes for shared state: replaceable Nostr events (best-effort, prunable, no query by place), a Cloudflare Worker with D1 or R2, and Supabase; it left the seam and built none. A standing rule forbids run-time calls to asset services and any committed key (`2026-10-05-autopilot-design.md`); its purpose is that nothing a visitor does depends on a paid service or leaks a secret.

What was needed now: a query by place (what is built within this envelope on this planet), ownership (only the builder removes), a write by others that is bounded (damage), and change notifications. Nostr has none of the first three.

## Decision

Supabase (PostgreSQL with PostGIS, row-level security, anonymous sign-in, Realtime) is the durable store, reached from the static client with the public anon key, which the build reads from the environment and which is never in the repository. Every table has RLS on; the only writes that are not an owner's own row go through `security definer` functions that clamp and rate-limit. The client is one module (`src/lib/durable/`), and without a URL in the environment the game plays with no durable layer.

## Consequences

- The standing rule is read as it was meant: no *asset* service at run time, no committed key. A public anon key behind RLS is not a secret; the service-role key never leaves the owner's dashboard. The rule's text in the autopilot design is not changed; this entry is the reading.
- The site now depends on one hosted service for one feature. Its outage loses the building, not the flying, and a visitor is told nothing is kept.
- The free tier's limits (storage, egress, realtime peers) are the launch's limits; the spec's envelope cap (8 km a side, 2,000 rows) and the per-owner cap (200 a planet) keep a client from asking for the whole world.
- Nostr stays what it is: the volatile channel. A durable change is hinted on it, never carried by it.

## Revisit when

- The free tier's realtime peer cap is reached on one planet, or egress passes the tier: then paid, or a Cloudflare Worker in front with a cache by cell.
- A second feature wants a server (accounts with names, a leaderboard): then an auth story beyond anonymous sign-in, in a new entry.
- Nostr relays grow a queryable, durable, spatially indexed event kind: then the Nostr-only path is cheaper, in a new entry that links this one.
