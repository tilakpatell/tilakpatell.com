# The universe spreads to eight, inside the Expanse’s grid, and the crossings take a third longer

**Date:** 2026-10-22 · **Status:** accepted · **Where:** `src/components/universe/scale.js` (`SPREAD`), `layout.js` (`SECTORS`, `RIM`), `nav.js` (`tripTime`), `supernova.js` · **Follows:** [the spread](../superpowers/specs/2026-10-07-universe-scale-hyperlanes-design.md), [the vastness](../superpowers/specs/2026-10-08-universe-vastness-design.md)

## Context

The owner asked for the universe to be larger, “vast”, so that not everything is close by, and then to “keep trip time longer”: big enough that the jump (hyperspace) is the way about.

- At `SPREAD` six (2026-10-09) the nearest fandom sat 12,000 from the home sun and the furthest 35,760. The wonders reached 40,340, the rim was 48,000 to 51,600 and the map’s edge 54,000. At the pulse drive’s 300 a second those were 40 s and 119 s of free flight. `scale.js` recorded that eight had made free flight a chore at that drive.
- The Expanse, past the edge, is a grid of 120,000 sectors (`lib/space/address.js`), and sector 0,0 is the authored map: its edge must stay inside ±60,000. The Rick and Morty pocket sits at −66,000, just inside the sector past it.
- The generated sectors are held to fingerprints and a legacy layer (`expanse/gen/fixtures/fingerprint.json`, `space.test.js`), so every pilot online and every saved place sees the same Expanse. Growing the grid to 180,000 (tried) broke those fingerprints and the Expanse’s density rules: every sector would be regenerated.
- At eight the farthest wonder (the Lantern) reaches 53,953. At nine it would be past 60,000.

## Decision

- `SPREAD` goes to eight: the gaps between every fandom, wonder and supernova site a third wider; the places, the home system and the Rick and Morty sector their own size and layout.
- The edge and the rim are written from the Expanse’s sector, not from `SPREAD`: the edge 1,000 inside sector 0,0 (59,000), the rim 3,600 wide and 1,000 in from it (54,400 to 58,000). The pocket stays at −66,000, written as the sector’s half plus its own 6,000. The Expanse’s grid, fingerprints and generator are unchanged.
- The pulse drive stays at 300 (a first draft took it to 400 to keep the crossings’ time; the owner asked for them longer): the nearest fandom is about 53 s out and the furthest about 2 min 40 s. The nav map’s trip timer flies up to 25 × `SPREAD` seconds (150 at six, 200 now) before it shows a dash, so the far worlds’ cruise still has a time.
- The two supernova sites that eight put past the edge come in to where the rim starts, as they sat at six.
- Multiplayer’s range and top speed (90,000 and 5,000) already cover the new edge; its ram cap stays with the drive.

## Consequences

- Each place is a third further from the next, so smaller and dimmer in the others’ skies (the far stars fade with distance, `farStars.js`), with more dark between. Free flight takes a third longer, super speed about a minute to the furthest worlds, and the jump still 2 s: the jump is the way about.
- The autopilot’s and the trips’ tests had their time limits set at six; they scale by `SPREAD / 6` now (`ship.test.js`, `nav.test.js`), with every step still checked for a hit.
- The open space between the main map’s edge and the Rick and Morty pocket is 1,000, down from 6,000. Nothing crosses it but the portal.
- The waypoints’ fixture (`__fixtures__/nodes.json`) had its positions rewritten from the new layout; every id, kind, region and name is as it was, since online fronts are shared by id.
- A pilot on the old build and one on the new see each other at different places for the length of a deploy.

## Revisit when

- The map needs to be bigger than eight: that means growing the Expanse’s grid with it, regenerating its fingerprints and retuning its density, a lane of its own.
- Free flight feels too long even for the owner, or the jump stops being enough.
