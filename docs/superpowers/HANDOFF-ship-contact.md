# Handoff: ship contact

The design is `docs/superpowers/specs/2026-10-09-ship-contact-design.md`, the plan `docs/superpowers/plans/2026-10-09-ship-contact.md`, the decision `docs/decisions/2026-10-09-ship-contact.md`. Flying your ship into another ship now glances, rams or crashes, on the universe map and in the galaxy.

## Done

- **Task 1, the law** (`src/lib/combat/contact.js`, tested): `CONTACT`, `bodyRadius`, `sweptSpheres` (targeting.js's `sweptHit`, moved; `targeting.js` re-exports it under its old name, so every caller is unchanged), `closingSpeed`, `contact`.
- **Task 2, the collector** (`src/components/universe/shipHits.js`, tested with fakes): `createShipHits({ sources, cool, radius })` → `sweep(before, after, dt, now)` → `{ body, k, at, place, touch, normal, into, outcome }`; `solidsWith(base, ...lists)`; `ramNote(name, damage)`.
- **Task 3, bodies** (each tested beside its file): `hunters.bodies` (no rammer, no one flickered out), `wingmen.bodies` (friends), `pilots.bodies` (flying, not parked; and the hunters after them, a ram on one through `hurtGhost`, shared with `hit`), `traffic.bodies(p, r)` (the small ships; `down(m)` shared with `hit` and the escort's `kill`), `skirmishes.bodies`, `npcs.bodies` (`hitOne`, shared with `hit`), `front.bodies` and `warfront.bodies` (the other side's fighters, a ram through `battle.js`'s new `strike(id, damage)`, which shares `hitFighter` with `hit`).
- **Task 4, solids** (each tested): `capitalRules.js`'s `solids` (the hull's chain of spheres while it's here or going up, not while it jumps), read by `setpieces.solids`; `sectorFleet.js`'s `sectorSolids(t)`, read by `sectorFleetView.solids` while you're in the sector; `traffic.solids(p, r)` (the big ships); `interdiction.js`'s `interdictorSolids(state, at)`, read by `interdictor.solids`. Every one carries `ship: true`.
- **Task 5, the universe map** (`universe/scene.js`): `solidsNow` (the map's plus the capital's, the sector fleet's and the big traffic's) goes to `step` and `startCrash`; `shipsHit` after the step's events (not in a crash, a jump, a dive, held, or the map view); a crash into a ship is `kind: 'ship'` and comes back out from where its middle was. The four kill paths are out of `moveBolts` into `hunterShot`, `pilotShot`, `trafficShot` (and `skirmishHelp`, `frontShip` out of `farHit` and `frontHit`), used by a shot and a ram alike. `__universeDebug.ram(gap = 6, kind = 'tie')`.
- **Task 6, the galaxy** (`galaxy/scene.js`): the same, with `scored` as the kill path and `pilotShot` out of `strike`; a power's ghost flies through. `__galaxyDebug.ram(gap = 6, kind)`.
- **Task 7**: this file, the decision, a bullet in `docs/architecture.md`.
- The gate (`npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`) is green: 789 test files, 9,790 tests; `big-files` 30. `boundary-breaks` is 426, one more than the base's 425: `galaxy/scene.js` → `universe/shipHits.js`, the import the design allows beside `universe/hunters` (no new pair of folders).

## Where the code differs from the design

- **`touchAt`, not `sweptSpheres`, finds the contact.** `sweptSpheres` answers the moment two spheres are *nearest*: head on, that is centre on centre, with no direction to push and no closing speed along it (every head-on ram read as a glance at 0). `contact.js` gains `touchAt(a0, a1, b0, b1, r)`, the same test read at the moment they *first touch* (0 when they already do), and the collector uses it. `sweptSpheres` is kept, verbatim, for `targeting.js`.
- **Your speed after a contact is `keptSpeed(speed, keep, SHIP.boost)`.** The design's `sign × max(SHIP.boost, |speed| × keep)` is the rock's rule, which only ever runs past the boost; for a ram at cruise (6) it would throw you *forward* to the boost (12). `keptSpeed` keeps `keep` of your speed, and only from past the boost holds the rock's floor at the boost. Never faster than you were.
- **You're put to `touch`**: the other ship's place *now* plus the normal times the two radii, not its place at the moment you met, so you never end the frame inside a ship that moved on.
- **A ram lands on the ship you rammed.** The plan had the skirmish, the characters and the front take a ram as a shot along your way (`sk.hit(before, after, punch)`, `npcs.hit(...)`, `battle.hit(...)`), which could land on whatever that segment crosses first (a turret, an objective, another hunter). Instead: `sk.hunt.damage(id, punch)`, `npcs.js`'s `hitOne(n, punch)` and `battle.js`'s new `strike(id, damage)`, each the same wound a shot gives. `body.hit(punch, before, after)` still passes the way, as the plan says, for any system that wants it.
- **The skirmish's freighter and escort take nothing from a ram**: no shot of yours can hurt the freighter (`skirmish.hit` tests the hunters only), so a ram writes no new kill.
- **The front's fighters are answered at `seen`** (where they're drawn) with their `vel` and no `prev` (`prev` is the battle's last step's, not the drawn place's).
- **The capital's solids are `capitalRules.js`'s**, the Interdictor's `interdiction.js`'s (pure, tested there); `setpieces.js` and `interdictor.js` only read them (both build three.js things at creation that Node can't). The capital is solid while `here` or `dying`; neither is while jumping in or out.
- **The Interdictor's one sphere is `INTERDICTION.size × 0.3`** (2.7 across a 9-long cruiser), as a big traffic ship's, since the design left it open.
- **`traffic.solids(p, r)` counts a big ship whose hull is within `r`**, not only its middle (a 30-long ship's middle can be far while its side is near). The scene asks within 12; the traffic's bodies within 6 plus the frame's way, so a long frame still finds a freighter it passed.
- **Where the sweep runs**: after the step's events and `if (state.crash) return true;`, not straight after `rocksHit`, so a crash this frame wins. The galaxy's guard is `!state.dive && !powers.mods.ghost` (its `state.held` is the Interdictor's hold, under which you still fly).
- **No "Hit a …" note in the galaxy**: its HUD has no `state.note`. The ram is told there by the crew's bump line, the shake, the flare, the kick and the deflectors. On the universe map the note is `ramNote` (“Hit a TIE fighter: shields −14”, “an X-wing”); a ram that kills one of the law's is followed in the same frame by the law's own note (“Wanted ★ …”), which wins.
- **The galaxy's ram goes through `scored`**, which also lights the hit mark and charges the powers as a shot does; the universe's leaves the hit mark to the guns, as the plan says.
- **`universe/scene.js` gained about 80 lines net, not under 60**: factoring the kill paths out of `moveBolts` costs lines. `big-files` is unchanged.
- **A crash's `crashFx.hit` body is left as it was**: `planetOf[<ship id>]` is already null.
- **The dev hooks take `(gap, kind)`** and set the hunter's velocity at you: headless Chromium in software GL runs a few frames a second, and a TIE put 6 away swings off before it's met.

## The numbers after hand tuning

The cloud container had no GPU. On 2026-10-09 the feel was checked locally on an RTX 5090, with headless Edge on the card (`--use-angle=d3d11 --enable-gpu`), the map at 240 frames a second:

| contact | shields | your speed | back to speed |
| --- | --- | --- | --- |
| a TIE, at cruise (universe) | −12.5 (it goes down) | 3.3 to 0.99 | 0.66 s |
| a TIE, at the boost (universe) | −17.2 | 12 to 3.6 | 1.3 s |
| a TIE Advanced, at cruise (universe and galaxy) | −12.7 to −13 | 3.3 to 0.99 | 0.65 s |
| a TIE Advanced, at the boost (galaxy) | −19.4 | 14.7 to 4.4 | |
| a TIE, on the pulse drive (85) | −45 (the cap) | 85 to 25.5 | |
| the Star Destroyer, at 55 | a crash, `kind: 'ship'` | | Luke's crash line |

One hit a ram; never a second off the same ship. A wing of three in formation stayed 3 or more away at cruise and in turns: no glances. The frame's bodies cost 0.6 µs with nine hunters, and frames held 4.2 ms (p50) and 4.5 ms (p99) among a pack: the arrays rebuilt every frame are not a cost worth pooling.

**`CONTACT` kept as designed.** The one change: **`keptSpeed` had a step at the boost.** A ram at exactly the boost kept 0.3 of your speed, but one at 12.01 (the boost's overshoot, as the galaxy flies it, or a shipyard-tuned boost up to ×1.6) was floored at the boost and kept nearly all of it: in the galaxy a boosting ram went 12.57 to 12, no knock at all. The floor now eases in, `max(s × keep, clamp(s − boost, 0, boost))`: the rock's rule from twice the boost, plain `keep` at it, nothing sudden between.

The merge with main (lane 2C's game feel) put the galaxy's crash through `feel.hitstop` and `knockForce`; the ram's bump now carries `into` and `force` too, so `Galaxy.jsx`'s knock law knocks the camera by the closing speed.

## Screenshots

In `docs/superpowers/handoff/ship-contact/`:

- `universe-ram-tieadvanced.webp`: Vader's TIE Advanced rammed at cruise; the note “Hit a TIE Advanced: shields −12” at the foot, the shields at 88, your speed cut to 0.3 of itself, Vader flying on.
- `universe-ram-tie.webp`: a TIE rammed; it goes down (heat up by one) and the law's “Wanted” note follows, as a shot's kill would.
- `universe-crash-destroyer.webp`: flown into the director's Star Destroyer's hull at 8: a crash (`kind: 'ship'`), and back out 14.8 from its middle (its sphere's 2.7 and 12) with shields up.
- `galaxy-ram-tieadvanced.webp`: the same ram over Tatooine; the deflectors down by 12.5.

`node scripts/autopilot-check.mjs --routes /universe --only smoke` and `--routes /galaxy --only smoke` both pass.

## The follow-ups (2026-10-09)

The decision is `docs/decisions/2026-10-09-ram-knocks-and-the-wire.md`.

- **The other ship is knocked off its line**: `contact.js`'s `shove` and `knock`, a body's `push(dv)`, the sweep's `hit.push`. The hunters (universe, galaxy, skirmish) and the wingmen take it. On the card, a TIE Advanced rammed at cruise went from (5.8, 0.4, −3.9) to (3.2, 1.3, −0.1) a second, and was back on its line in about 0.6 s.
- **Another pilot is told**: `protocol.js`'s `ram { v }`, `readRam`, `ramCounts`; `client.js`'s `ram(id, into)` and the `rammed` event; the scenes' `rammedBy` takes it off your shields by the law, with the note “Rammed by Han: shields −12” on the universe map. Shot down by it, the feed says “Han rammed you out of the sky”, and the rammer's kill is said as a ram.
- **The autopilot steers round the big ships moving through**: `autopilot(…, moving)`, `clearPark`; the scenes hand it the frame's capital, sector fleet, big traffic and Interdictor, and the galaxy's `parkBy` gets the frame's solids.
- **A ram's kill has the crew's ram line**, and so does a pack cleared by one within 2 s (`crews.js`'s `ram.kill`, `ram.cleared`; `Comms.jsx` reads `e.ram`). "Great shot, kid" is a gun's again.

## Not done (the next lane's list)

- C-137's cruiser and the Federation ship, the cockpit page, the cruiser scroll page.
- Hitstop, dust and sound by force on these maps (lane 2C's game feel).
- The traffic, the battle's fighters and the characters aren't knocked by a ram (they fly on lanes or in the battle's step).
- The crews' ram lines have no recordings yet: queue them for the voices batch.
- A glance off a wingman flying very close in formation cuts your speed by 0.15 each time (once every 0.35 s at most); not seen in testing, worth a look in dev.
- A Menu or HUD line for the galaxy's ram note, if wanted.

## Checking it

- `npx vitest run src/lib/combat/contact.test.js src/components/universe/shipHits.test.js` and each system's test beside it.
- In the browser (`npx vite --port 5173`), `localStorage` as `scripts/rocks-check.mjs` sets it (and `tp-tour` `"skipped"`, `tp-worlds` `"load"` for the galaxy): `__universeDebug.ram(1.2, 'tieadvanced')` with W held, or `__galaxyDebug.ram(1.2, 'tieadvanced')` once the arrival jump is over; `__universeDebug.pieces.destroyer(__universeDebug.state.ship, 'destroyer')` then fly into `pieces.solids[0]` for the crash.
