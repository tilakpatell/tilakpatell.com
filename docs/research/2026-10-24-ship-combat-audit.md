# Ship combat, audited: targeting, weapons, enemy ships and the bounty

Date: 2026-10-24. The owner’s ask: “revamp the ship targeting and weapons system to make it more robust and better along with the enemy ships and bounty system”, on both the universe map and the galaxy’s space flight, with one core and one HUD. This note is what the code does today and what is wrong with it; the design that answers it is `docs/superpowers/specs/2026-10-24-one-flight-combat-core-design.md`.

Read: `universe/targeting.js`, `weapons.js`, `rounds.js`, `roundRules.js`, `uniqueArms.js`, `uniqueFx.js`, `hunterRules.js`, `hunters.js`, `wanted.js`, `law.js`, `standing.js`, `economy.js`, `sides.js`, `src/lib/arms/`, `src/lib/combat/contact.js`, `galaxy/hunted.js`, `radar.js`, `cluster.js`, `FlightCluster.jsx`, `GalaxyView.jsx`, `UniverseMap.jsx`, `src/runtime/hud/`, and the lock, fire, bolt and HUD code of both scenes. Every bug below was claimed by one reader and re-traced by a second through the real callers; the ones the second could not reproduce are listed apart. Line numbers are at `cc5e2eaf`.

## How it is built

- **One targeting rule, wired twice.** `universe/targeting.js` is pure and tested: the lock (`track`: picked up within 0.5 rad and 60 units, held to 1.05 rad and 78, 2 s of grace, 4 s for one picked by hand), the lead (`intercept`), the bend onto it (`assist`, full inside 8°, none past 21°) and the nose’s nudge (`trackNudge`). Each scene builds its own candidate list, calls it, and keeps its own `state.lock`, `lockTarget`, `lead`, `hot` and `trackable` (universe `scene.js:4518-4562`, galaxy `scene.js:1805-1840`).
- **One weapon table, fired three ways.** `src/lib/arms/ship.js` has the eleven weapons. Each scene has its own cadence table, bolt pool, `fire()` and `moveBolts()` (universe `scene.js:235`, `2355-2430`, `2546-2625`; galaxy `scene.js:157`, `1000-1045`); torpedoes have a second hand-ordered hit chain (`missileHit`), and the unique arms a third (`uniqueArms.js:56-69`, `powerStrike`).
- **One overlay design, copied.** The reticle, lock bracket, lead pip, threat and ally arrows and the nav diamond are the same markup and classes on both maps, written by near-identical code (universe `scene.js:2863-3041`, galaxy `scene.js:2091-2252`). The bottom cluster is already the kit’s (`src/runtime/hud/cluster.js`). The galaxy alone has the radar, speed, kills and a target block; the universe alone the wanted strip, the altitude gauge and the Citadel line.
- **One enemy engine.** `hunterRules.js`’s `createHunt` flies both maps’ hunters (the galaxy’s through `galaxy/hunted.js`), but the front’s battles (`battleAi.js`), the wingmen (`wingRules.js`) and the starfighter mission (`lib/battlefront/ai/squadron.js`) are dogfight brains of their own with other numbers: a TIE is hp 1 and speed 19 as a hunter (`sides.js:71`), hp 5 and 21 in a battle (`wars.js:254`).
- **The law on the universe map only.** `wanted.js` (stars, the search, a bounty per side kept in `tp:universe-wanted`), `standing.js` (three axes per side in `tp:universe-standing`, fading), `law.js` (who saw it, who is sent). The galaxy has no law.
- **The galaxy reaches into the universe** for targeting, controls, hunters and ships (`galaxy/scene.js:91-112`), against “worlds are islands”; they count in `boundary-breaks`.

## Bugs, confirmed

| lane | bug | where |
| --- | --- | --- |
| 1 | The lead pip, the hot flag, assist and tracking use the blaster’s speed and life whatever is selected: dark matter shows hot and misses | universe `scene.js:4542-4544` vs `2419`; galaxy `1825-1826` |
| 1 | T flips between two targets once the nose follows the lock, and never reaches a third | `targeting.js:107-116` |
| 1 | A lock picked by hand past 78 units drops at once, with no grace | `targeting.js:104`, `109`, `152` |
| 1 | A torpedo keeps homing on a dead target’s frozen spot | `scene.js:2379`; `roundRules.js:18-29`; `hunterRules.js:474-479` |
| 1 | The hot flag ignores Force Focus’s stronger assist | `scene.js:4544` vs `2413`; `shipPowers.js:67`, `273-276` |
| 1 | A tap on a hunter in front of a planet flies you to the planet | `scene.js:5757-5765` |
| 1 | A tap can lock only hunters and pilots, not the front, NPCs, skirmishes, the capital ship or the Citadel | universe `scene.js:1687`; galaxy `2635` |
| 1 | The universe’s threat arrows leave out front fighters and NPC enemies on you | `scene.js:2966-2968` |
| 1 | Lock ticks play in the whole-map view, where no lock is drawn | `scene.js:4541`, `5101` |
| 1 | Seismic charge and Blue sky cannot hurt the Citadel | `scene.js:2421`, `2319-2325` |
| 1 | On the universe map the Energon arc, Dark matter and Seismic hit only your own hunters | `scene.js:2340` (`war: null`); `uniqueArms.js:57-58` |
| 1 | The X-wing’s fire-rate parts and Quick trigger do nothing: it already fires at the 0.12 s cap | `scene.js:235`, `2394`; `outfit.js:30` |
| 1 | Dark matter orbs past six are invisible and still hit | `uniqueFx.js:21`, `117` |
| 1 | Dark matter passes visibly through a ship: its radius is half the size, not the bolt’s | `lib/arms/behaviours.js:75-83` vs `hunterRules.js:199` |
| 1 | Shots in flight survive your death and can still score | `scene.js:3044-3046`, `3111-3113` |
| 1 | The galaxy ignores the flight difficulty setting it shows | galaxy `scene.js:314`, `1874` |
| 1 | The galaxy’s touch Fire, Boost and climbs let go when the thumb drifts | `GalaxyView.jsx:300-305` |
| 1 | The overlay’s labels are 0.6 rem (0.62 on a phone), under the 0.7 rem floor | `universe.css:609`, `1288-1291` |
| 2 | After a skill reset a fitted unique part fires stock but still costs and reads as the unique | `weapons.js:50`; `outfit.js:259-280` |
| 3 | A hunter that has forgotten you chases your true position | `hunterRules.js:884-892` |
| 3 | Hunters and their lasers pass through moving capital ships | universe `scene.js:972` vs `4371`; galaxy `314` |
| 3 | A medic heals past full hull with fractional damage | `hunterRules.js:1135-1141` |
| 3 | The galaxy drops the missile warning | galaxy `scene.js:1869-1880` |
| 4 | Any non-civil traffic downed is a patrol killed, friends included | `scene.js:2643-2651`; `traffic.js:519` |
| 4 | Downing the law’s enemies lowers your standing with the law | `scene.js:2694-2695`; `standing.js:33` |
| 4 | A capital ship downed is always the law’s crime, whoever’s it is (Gus’s Madrigal) | `scene.js:3835`, `3846`; `law.js:35` |
| 4 | The law, the bounty and standing follow the crew’s side; traffic, hunters and NPCs the sector’s | `scene.js:1015` vs `968`, `3436` |
| 4 | The Wanted achievement counts only Slave I and Phoenixperson | `src/pages/Universe.jsx:440` |
| 4 | `events-check`’s bounty assertion is stale and fails on its own default ship | `scripts/events-check.mjs:25`, `85-88` |

## Claimed, not confirmed

- “The Most Wanted boss is never sent” and “tier 3 sends what tier 2 does”: true, but a flag nothing reads (`wanted.js:65`), a feature never built, not a defect. Lane 4.
- “Every Star Wars hunt fought back is a crime that pays nothing”: the code’s stated design, pinned by `law.test.js:85`. It is the owner’s call in lane 4.
- “The Fett stand-in is an Empire pack, so downing it is a crime”: real in code (`scene.js:3551-3556`), rare in play, since Slave I is fetched with the first traffic.
- “The Primary part and Quick trigger change every line”, “scatter fans stay level”, “the difficulty scales only the hunters’ lasers”, “a full laser pool deletes a bolt”, “the inspector ignores the bounty”, “the chase clock runs on foot”, “the bounty timer isn’t re-timed”: as designed or out of reach in play.
- “Front fighters get no nose tracking on an auto lock”: what the targeting spec says.

## Thin or missing

- **Targeting**: no single current target (several copies of it); no kind or side on a candidate, so no priority or friend-or-foe; a thin bracket (name, distance, hp only when over 1; ship lengths on the map, units in the galaxy); no missile lock (ordnance homes the instant it fires, with no tone or break-lock); no touch cycle; no gamepad in flight on either map.
- **Weapons**: one cooldown for all three lines; no heat or energy; every line leaves the primary’s muzzles; a fixed hit order, not the nearest hit; thin feedback (one binary hit flag, no kill mark on the map, no hit sound); other pilots see the uniques as plain bolts.
- **Enemy ships**: one hp pool, so ion and flak have no job; part hits known and ignored; nothing dodges your torpedoes; hunters shoot only you, never your wingmen or the freighter in distress; Normal barely scratches you (a scratch probe: about 54 shield a minute from a regular pack of four, against 12 a second of regeneration), with a cliff at elite; bounty hunters pay like a TIE.
- **Bounty**: no contracts in space; the bounty never fades; paying off is automatic, all or nothing, and only on landing; going down clears five stars for free; stars and standing are two “wanted”s that don’t talk; no browser check covers the law.

## Benchmark, the top picks

Against Squadrons, Battlefront II’s starfighter assault, Freelancer, Elite, Everspace 2, Ace Combat and the Red Dead and GTA wanted loops, by what a player would feel first:

1. Gamepad flight (`src/runtime/input.js` already reads a pad).
2. The lead pip and the target cycle right.
3. A missile lock with a tone, and a marker for where a hit came from.
4. Bounty contracts in space, and a bounty that fades.
5. Enemy shields, or parts that matter, so the secondaries have a job.

The audit’s full working (each reader’s map, the skeptics’ verdicts) was not kept; the code and this note are the record.
