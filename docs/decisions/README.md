# Decisions

The record of choices the site has made, so the next session that asks “why not X?” finds the answer instead of a grep through the specs.

## The shape

- One file per decision: `YYYY-MM-DD-<slug>.md`, dated the day it was made.
- Four sections, in this order: **Context** (the question and what was measured), **Decision** (what was chosen, in a sentence or two), **Consequences** (what follows, good and bad), **Revisit when** (the facts that would reopen it).
- Under 80 lines. Link the spec that holds the long version rather than copying it.
- Never edited after a week. A change of mind is a new entry that links the old one; the old one stays as it was, so the record shows what was known when.
- Written when a session makes or touches a choice, not retroactively.

## Entries

| date | decision |
| --- | --- |
| 2026-10-08 | [three.js over Babylon.js](2026-10-08-three-over-babylon.md): three.js stays the renderer; WebGPU through `three/webgpu` and TSL |
| 2026-10-08 | [Fingers added to the Meshy skeleton](2026-10-08-fingers-on-the-meshy-skeleton.md): finger and twist bones written into each figure by its geometry; no re-rig; one skeleton, every clip kept |
| 2026-10-09 | [Ship contact: big ships are solids, small ships are bodies](2026-10-09-ship-contact.md): only your ship moves; a ram on another pilot tells nobody |
| 2026-10-09 | [A ram knocks the other ship, and another pilot is told](2026-10-09-ram-knocks-and-the-wire.md): hunters and wingmen knocked off their line; a checked `ram` wire action; the autopilot steers round the big ships moving through |
| 2026-10-09 | [Lightsaber forms from mirrored clips](2026-10-09-forms-from-mirrored-clips.md): a staff and a pair from the library’s sword clips mirrored across the body and a hilt turned in the hand; no motion-capture output ships |
| 2026-10-09 | [Dismemberment by a clipped twin](2026-10-09-dismemberment-by-a-clipped-twin.md): a sever is a clipping plane on the body and a second clone with the opposite plane; no mesh cut, no blood |
| 2026-10-09 | [Supabase holds the shared world’s durable state; the site stays static](2026-10-09-supabase-for-durable-shared-state.md): PostGIS under RLS behind the public anon key; Nostr stays the volatile channel |
| 2026-10-09 | [The heavy assets are mirrored on Supabase Storage; the site stays whole](2026-10-09-heavy-assets-mirrored-on-supabase-storage.md): copies by content hash, asked first when the build has a base, the site’s own files after one failure |
| 2026-10-10 | [The Battlefront II (2017) drop is a source for the galaxy](2026-10-10-battlefront-2017-assets.md): fetched ahead, imported and committed, credited as EA DICE’s with permission; no gate, no sequel era, the 2017 rig kept |
| 2026-10-10 | [No game engine is added; the engine is in place](2026-10-10-the-engine-in-place.md): three’s node renderer, its lighting and display addons, TSL and Rapier as one stack under the galaxy; PlayCanvas and Rogue Engine not added |
| 2026-10-11 | [The node renderer is the only renderer on the Star Wars worlds above the low tier](2026-10-11-the-node-renderer-above-low.md): `galaxy-surface` on `'nodes'`, high and ultra always, mid on WebGPU, low classic; every layer and the record’s picture on; the quality switch checked; every gate green |
| 2026-10-11 | [The ultra picture streamed from the owner’s desktop: a spike](2026-10-11-the-stream-from-the-desktop.md): draft; WebRTC from the desktop’s Chromium, signalling on Supabase Realtime broadcast, a product only if the desktop’s numbers say so |
