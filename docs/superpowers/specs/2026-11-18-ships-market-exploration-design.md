# Ships you can feel, a market that holds together, and sectors worth exploring

**Date:** 2026-11-18 · **Area:** the universe map (`HANDOFF-universe.md`) · **Where:** `src/components/universe/ships/`, `market/`, `explore/`, `signatures/` (all new), with small hooks in `ship.js`, `outfit.js`, `economy.js`, `things/rules.js`, `places/trips.js`, `scene.js`, the Hangar and the place card · **Works alongside:** the layout session (the Core, the neighbourhoods, the regions, the portals, then the events) and the GUI session (the HUD, the pause menu, the inventory).

## What the owner asked

Make the ships and their systems better, and the economy more rigid and thorough, so that speed and upgrades are tangible and exploring sectors is worth it. The ships are the characters’ own, and they differ by the crew you pick. Goods differ by where you are, hand in hand with the layout session’s map. Merge each lane as soon as it is done.

The owner’s answers, in order:

1. “Ship design” is both: tiered systems that change numbers you feel, and that show on the ship.
2. The market is a full one: sell and haul, prices that drift over time, rare goods tied to regions.
3. A ship destroyed drops its cargo as a pod you can fly back to; charts and data are kept.
4. Tiers sit on top of today’s parts, modules and skills, which stay as side-grades. Nothing anyone owns is lost.
5. The four crews’ ships each have a character.
6. Upgrades are bought for each ship separately; credits are shared.
7. Goods follow the layout session’s neighbourhoods, regions and pocket universes.

## Since written

The pacing test (lane 4, `ships/pacing.test.js`) moved three numbers, each a finding: Mk III to V cost 1,600, 8,000 and 25,000 (not 2,000, 6,000 and 15,000); a find’s distance bonus is 1 + 0.08 a sector, 3.4 at 30 (not 0.15, 5.5); the haul is 2 at 10 sectors (not 3). The scan’s key is Z (C opens the Hangar’s crew). Exploration data is sold in fives, five credits and one xp a unit, so every `EARN` row stays whole. The plans are `plans/2026-11-18-ships-lane-1.md`, `plans/2026-11-18-ships-lane-2-market.md`, `plans/2026-11-19-ships-lane-3-explore.md` and `plans/2026-11-19-ships-lane-4-signatures.md` (its “balance pass”).

## What there is today

- `outfit.js`: eight part slots (boosters, thrusters, guns, shields, fins, secondary, ordnance, paint), each part a share of +5 to +55 % on one number; `ship.js`’s `TUNE` holds the boost to 1.6 × at most. A plant (`PLANT`: X-wing 7, Falcon 9, cruiser 8, RV 5 MW) and mass limit a fit.
- The four ships fly the same numbers (`ship.js`’s `SHIP`). Only the guns’ cadence (`lib/combat/flight/guns.js`’s `CADENCE`) and the plant differ.
- The pulse drive (300 a second, out in the open) and super speed (`OVERDRIVE`, 3 ×) are touched by nothing a pilot buys.
- The jump (`nav.js`’s `HYPER`) goes anywhere, “whatever the distance”, every 5 s; the skill tree’s Hot drive takes a quarter off.
- `economy.js`: one wallet (`tp-pilot`, v2): credits and xp from deeds (`EARN`: 30 to 400), spent on parts (`catalog.js`’s bands, 100 to 1,500).
- `things/rules.js`: mining, salvage and scans pay `EARN.found` at once; its ledger is the visit’s, so a field is mined again on every visit.
- Generated stations (`expanse/gen/stations.js`): one system in three has one, with the system’s faction; a sector’s systems carry `traffic` and `hazard`.

## 1. The ships

### The seven core systems

Every ship has seven core systems, Mk I to Mk V. A system’s tier multiplies that ship’s own Mk I numbers, so a ship keeps its character at every tier. The parts, modules and skills of today go on top, as they do now.

| System | What it changes | Ladder on the ship’s Mk I (I → V) |
| --- | --- | --- |
| Engines | cruise, boost and acceleration in a fight | 1, 1.08, 1.16, 1.24, 1.32 |
| Pulse drive | the speed out in the open (super speed is 3 × it) | 1, 1.4, 2, 2.83, 4 (300 → 1,200 at a neutral ship) |
| Hyperdrive | jump range in sectors; the recharge | range: the ship’s own row below; recharge 1, 0.9, 0.8, 0.7, 0.6 |
| Shields | what a hit takes | strength 1, 1.2, 1.4, 1.65, 2 (damage divided by it) |
| Scanner | the scan’s reach and what it tells | reach: 10,000, 25,000, the sector, the sector, the sector; Mk III adds a station’s market type, Mk IV a derelict’s trap, Mk V rare deposits |
| Cargo hold | units carried | 1, 1.6, 2.4, 3.6, 5 |
| Reactor | megawatts added to the plant, for parts | +0, +1, +2, +3, +5 (the Falcon +6 and the RV +8 at Mk V) |

**Mk I is today’s ship within ±15 %**, so a new visitor flies much as they do now, and the pulse drive’s 300 (a neutral ship’s) is what the layout session’s distances are set against.

### The four ships

Each ship’s Mk I, as multipliers on today’s numbers, and its own rows:

| | X-wing (Luke, R2) | Millennium Falcon (Han, Chewie) | Space cruiser (Rick, Morty) | The RV (Walt, Jesse) |
| --- | --- | --- | --- | --- |
| Role | fighter | smuggler and runner | explorer and scientist | hauler and cook |
| Engines | 1.10 | 1.00 | 1.00 | 0.88 |
| Agility | 1.12 | 0.90 | 1.00 | 0.88 |
| Pulse drive | 0.95 | 1.10 | 1.00 | 0.95 |
| Shields | 1.00 | 1.10 | 0.90 | 1.15 |
| Scanner reach | 1.00 | 1.00 | 1.25 | 0.90 |
| Scan recharge | 8 s | 8 s | 6 s | 9 s |
| Hold (I → V) | 6 → 30 | 12 → 60 | 10 → 50 | 16 → 80 |
| Jump range (I → V, sectors) | 2, 4, 8, 14, 24 | 3, 6, 12, 22, 40 | 2, 4, 8, 16, 32 | 2, 4, 7, 13, 24 |
| Jump recharge, Mk I | 5 s | 4.5 s | 4 s | 5.5 s |
| Plant (today’s) | 7 MW | 9 MW | 8 MW | 5 MW |
| Signature | R2 astromech | Smuggling compartments | Portal gun | The lab |

A garage build (`shipyard/build.js`) flown in a crew’s place is a neutral ship: 1 everywhere, a hold of 10, jump range 2, 4, 8, 16, 32, recharge 5 s, its own plant, and no signature. Tiers are kept for each crew, so the crew’s own ship and the build it flies in its place share them.

### The signatures

Each grows with a system’s tier.

- **R2 astromech (X-wing):** patches the shields by 4 a second while under fire, for 3 s in every 12 (Mk I), to 8 a second at Shields Mk V; and plots each hop one sector further (Hyperdrive tier).
- **Smuggling compartments (Falcon):** a third of the hold (rounded down) is hidden. What is in it is kept when the ship is destroyed and never seen by a check for contraband. The Kessel Run is the Falcon’s Mk V jump, 40 sectors, the longest of any ship.
- **Portal gun (cruiser):** a jump to any sector you have charted, past the range, once every 10 minutes at Hyperdrive Mk I, to every 4 at Mk V.
- **The lab (RV):** turns one unit of a raw good or a specialty in the hold into its refined good, worth about 1.5 ×, every 30 s at Reactor Mk I, to every 10 s at Mk V (recipes in section 2).

### What a tier costs

| Step | Credits | And |
| --- | --- | --- |
| Mk I → II | 600 | |
| Mk II → III | 2,000 | |
| Mk III → IV | 6,000 | 2 units of the system’s rare (section 2) |
| Mk IV → V | 15,000 | 4 units of the system’s pure rare |

A system’s rare: engines and the pulse drive take exotic matter; the hyperdrive void crystal; shields and the reactor relics; the scanner and the hold nebula silk. A tier is bought through `economy.checkout`, the credits and the rares together or neither. A tier is never sold back (`refundOf` does not apply to it).

### What the owner can feel, and the targets a test holds

- Crossing a sector (120,000) on super speed: about 130 s at Mk I, 33 s at Mk V.
- A 40-sector trip into generated space: 20 hops at Mk I, 2 at Mk V (section 3).
- The enemies keep their speeds (`PACE`), so better engines outrun hunters.
- Reactor power lets the portal injectors and the fusion cannon go on together.

The pacing targets, for one ship, held by `pacing.test.js` (lane 4) on a model of a pilot’s minute: the first Mk II in about 10 minutes of play; every system at Mk III in about 2 hours; the first Mk V in about 5 hours. A change to a price or a pay that moves one of them by more than a fifth fails the test.

### On the ship

Every look is a number on what is drawn already, not a new draw:

- **Engines:** the glow (`engines.js`’s one draw) grows a tenth a tier and runs hotter, toward blue-white at Mk V.
- **Hyperdrive:** a ring of light round the engines as the jump spools, wider a tier.
- **Scanner:** the dish (`modules.js`’s extras) shows from Mk III; the scan’s ring goes out to its reach.
- **Cargo hold:** pods on the flanks from Mk III (merged into the ship’s existing build by material, as `modules3d.js` does).
- **Shields:** the hit’s shimmer takes the tier’s colour.

Draw calls and triangles stay as they are at every checked route (the owner’s rule); the before shots are taken on `main` first.

## 2. The market

### Goods

`market/goods.js` is the table: `{ id, family, base (credits), name, rare?, pure?, contraband? }`.

| Family | Goods |
| --- | --- |
| Raw | iron ore, titanium, ice, gas |
| Salvage | scrap, components, data cores |
| Trade | food, medicine, machinery, electronics, luxuries, munitions |
| Refined | alloys, fuel cells |
| Specialties | by area, below |
| Rare | exotic matter, void crystal, relics, nebula silk, each with a pure grade |

### Areas

An area is where a sector is, by the layout session’s `src/lib/space/regions.js`: `regionOf([sx, sy, sz]) → { kind, id, name, danger 0…1, richness 0…1 }`, asked to name the Core and each neighbourhood too. Until it lands, `market/areas.js` has a stand-in of the same shape: the Core at sector 0, everything else a region kind from the sector’s seed.

| Area | Specialties (cheap here) | Pays well for |
| --- | --- | --- |
| The Core (your pages) | food, medicine, fuel cells | everything, at flat fair prices |
| Hero Reach | vibranium ore, Energon cubes | medicine, alloys |
| The Old Roads | mithril, potion herbs | electronics, luxuries |
| Earthside | Dunder Mifflin paper, rum and spices, Pollos chicken | rares, fuel cells |
| Music | vinyl records, stage rigs | electronics |
| The Arcade Drift | arcade boards | electronics, components |
| The Maelstrom’s mouth | Imperial scrap, and the Star Wars galaxy’s goods from smugglers coming out | off-galaxy goods |
| The Star Wars galaxy (its own pocket) | spice, kyber crystals, bacta, Tibanna gas | off-galaxy goods |
| The Curve (the Citadel’s market) | portal fluid, Plumbuses, Kalaxian crystals | mega seeds |
| The Rime | ice, comet water | food, machinery |
| Nebula reef | gas, nebula silk | components |
| Ship graveyard | scrap, components, relics | fuel cells |
| Pirate haven | munitions, contraband | luxuries, at a premium |
| Star nursery | stellar gas, young-star plasma | machinery |
| Dyson forge | alloys, machinery | ore, and exotic matter |
| The Quiet | void crystal, exotic matter near a gargantuan | nothing: it is empty |

Rares are found only 10 or more sectors from the Core; the pure grade only 25 or more.

### Stations

Every generated station is given a type from its seed and its area (`market/stations.js`), each type making some goods and needing others:

| Type | Makes (sells cheap) | Needs (buys dear) |
| --- | --- | --- |
| Mining | ore, ice | food, machinery |
| Industry | machinery, alloys, electronics | ore, gas |
| Farming | food | machinery, medicine |
| Research | medicine, electronics | data cores, rares (and pays half again for exploration data) |
| Military | fuel cells | munitions, alloys (and takes contraband carried in the open) |
| Frontier | salvage | anything, at worse prices both ways |

A station also sells and buys its area’s specialties. The Core’s exchange is on the Home station’s card, as a tab, so a recruiter’s view of the card is unchanged until it is opened. Each neighbourhood’s market, the Maelstrom’s and the Curve Rift’s smugglers’ posts and the Citadel’s market go on a place the layout session names. Trading at the Star Wars galaxy’s own ports is a later lane with the galaxy’s owner; until then its goods are bought at the Maelstrom’s mouth.

### Prices

`market/prices.js`, pure. What a station pays for a good:

```
sell = base × type × area × haul × drift × shock × yours
buy  = sell × 1.12
```

- **type:** what it makes 0.6, what it needs 1.5, the rest 1.
- **area:** its specialties 0.5 at home; rares 1.
- **haul:** a specialty or a pocket’s good, sold away from where it is made, 1 + 0.2 a sector to 3 at 10 sectors. A pocket’s good sold outside its pocket takes the 10. (Lane 2 starts it at 1 + 0.1 a sector to 2: at 3, one hold of a mid specialty hauled ten sectors paid several times the pacing targets’ minute. Lane 4’s pacing test settles it.)
- **drift:** two slow waves for each station and good, periods 2 to 8 hours, ±25 % together, from the seed and the clock (`Date.now()`), so every pilot sees the same price at the same moment, with no server.
- **shock:** an event’s `marketShock(stationId, good, mul, untilMs)`, 1 when none.
- **yours:** each unit you sell there takes 1.5 % off, each you buy adds it, back to nothing with a half-life of 15 minutes; never under 0.5 or over 1.5.

The rules a test holds: buying and selling at one station never pays, whatever the drift; the best route in a model of the market makes credits a minute inside the pacing targets; the same station, good and clock give the same price everywhere.

### The hold and the dock

A ship’s hold is its own, a unit an item. At a dock, the place card’s Market tab lists what the station sells and buys, with the price, your hold and its room; buy, sell and jettison go through `market/trade.js` and the wallet’s `checkout` and a new `credit(n, why)`, so every credit in or out is on the log.

### Mining and salvage, no longer farmed

- Mining a field (`things/rules.js`’s `mine`) puts its ore into the hold. A field gives `ORE_CAP` rocks and then is empty for 2 hours.
- Salvaging a wreck, a derelict or an outpost puts its goods in the hold once, ever.
- A scan of a relay or a monolith goes to the data bank (section 3).
- What is kept: the id of each field emptied and when, each wreck salvaged, never what was generated (`tp-market`, capped at 2,000 of each, the oldest dropped).

### Combat and events

Today’s `EARN` stays, scaled by where it is earned: × (1 + 1.5 × danger). The layout session’s events pay through `economy.pay(kind, n, { side, where })`, which is `earn` with the area’s scaling; a new `EARN.event` is the unit an event’s worth is counted in.

## 3. Exploring

### Charting and the scan

- Entering a generated sector for the first time charts it: it pays, and the layout session’s nav map marks it (a `Mark` they take through `chart/marks.js`).
- **Z** sends the scan (in flight; C opens the Hangar’s crew, and Z on foot is still the emote wheel): a ring out to the scanner’s reach, again after the ship’s scan recharge. Everything it reaches is scanned: systems, planets, stations, things and gargantuans. The first scan of each pays into the data bank; scanned places show on the chart and their cards fill in by the scanner’s tier.
- A sector whose systems are all scanned is **Surveyed**: a bonus of ten systems’ worth, and a complete mark on the chart.

### What a find is worth

`explore/values.js`: a kind’s worth × distance × (1 + richness), distance being 1 + 0.15 a sector from the Core, to 5.5 at 30.

| Find | Worth |
| --- | --- |
| A sector charted | 40 |
| A system | 25 |
| A planet or moon | 8 |
| A station | 10 |
| A derelict, an outpost | 30 |
| A monolith | 60 |
| A pulsar, a magnetar | 120 |
| A wormhole | 150 |
| A gargantuan | 400 |

### The data bank

Data is not cargo: it never fills the hold and is kept when the ship is destroyed. It is paid, as credits and a fifth as much xp, when you dock at any station; a research station pays half as much again.

### Jump range and hops

`explore/route.js`, pure:

- `jumpRangeOf(ship, tiers) → sectors`.
- `hyperRoute(from, to, range) → [sector, …]`: the hops, each at most `range` sectors on (Chebyshev distance in three dimensions), the last the target’s.
- Only a generated target (an `E:` id) is held to the range. A hand-made place (the Core, every neighbourhood’s world, both portals) is always one jump away, as the layout session asks.
- A target past the range is not refused: the trip goes in hops, one recharge each, the HUD saying how many are left. Links and the terminal’s `fly E:…` work as before, just slower.
- `trips.js`’s `E:` branch calls it; the hand-made travel path is the layout session’s.

### The record

`explore/record.js` keeps `tp-explore`: each charted sector’s key with a bitset of its scanned systems and things, the unpaid data, the counts (sectors charted, systems scanned, Surveyed, the furthest from the Core) and the firsts. It is shown in the Record and in the GUI session’s screens.

## 4. When the ship is destroyed

You keep your credits, charts, data bank and tiers. The hold’s cargo, less what the Falcon hides, drops as a pod where the ship went down: marked on the chart and the HUD, kept until recovered (`tp-market`’s `pod`: sector, place, goods, when). Fly within three of its sizes and press E to take it all back. One pod at a time: going down again before recovering it loses the older one. The ship comes back as it does today (`scene.js`’s respawn).

## Who does what

- **This lane:** every rule, pure, with its test in Node; the Hangar’s Systems tab; the place card’s Market tab; the scan’s ring; the pod; the looks on the ship. One read-out for the GUI session: `ships/sheet.js`’s `shipSheet({ crew, tiers, hold, economy, record }) → { ship, role, signature, systems: [{ id, label, tier, value, next: { tier, price, needs } | null }], hold: { used, room, goods }, credits, data, explored }`.
- **The layout session:** `regionOf`; the neighbourhoods’ and portals’ places; the events, paying through `economy.pay` and moving prices through `marketShock`; the nav map’s marks; the travel to hand-made places.
- **The GUI session:** where the hold, the record and the jump’s hops sit in its pause menu, inventory and HUD. Until it says where, the hops are a line in the existing jump note and the hold is shown on the Market tab.

## The saves

All through `runtime/saves.js`, each registered with a version; nothing generated is kept, only seeds and deltas.

| Key | What |
| --- | --- |
| `tp-pilot` (v2) | as now: a tier is an owned item (`tier:<crew>:<system>:<n>`), bought on the log as `buy`; the log takes one new kind, `credit` (lane 2; an older page reading it drops it, as it drops any kind it doesn’t know) |
| `tp-ships` (v1) | for each crew: its tiers and its hold |
| `tp-market` (v1) | your selling and buying at each station (with when), the fields emptied, the wrecks salvaged, the pod |
| `tp-explore` (v1) | the charted sectors and what in them is scanned, the unpaid data, the counts |

A save from before any of this reads as every system at Mk I, an empty hold and nothing charted.

## The lanes

One pull request each, merged on its own when CI is green, in this order:

1. **Ships:** `ships/` (the profiles, the systems and their ladders, the prices, the store, the sheet, the looks as numbers); `ship.js` taking a pulse and the tier’s caps through its tune; `outfit.js`’s `statsOf` taking the tiers; the shields’ strength in the scene’s hurt; the Hangar’s Systems tab; the looks on the ship.
2. **Market:** `market/` (goods, areas, stations, prices, trade, fields, store); the Market tab; mining and salvage into the hold.
3. **Exploring:** `explore/` (record, scan, values, route); the scan on C and its ring; the data bank paid at a dock; the hops; the charted mark handed to the layout session.
4. **Signatures and balance:** `signatures/` (the pod, the lab, the compartments and contraband, R2, the portal gun); `pacing.test.js`; the balance pass that sets the numbers above against it.

Each lane before its pull request: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, and the map’s checks on its routes (`scripts/universe-check.mjs`, `scripts/shipyard-check.mjs`, `scripts/universe-endless-check.mjs`).

## Testing

- Each pure module has its test beside it: the ladders and the ships’ rows (Mk I within ±15 % of today’s numbers), `checkout` of a tier with its rares, the price model’s rules above, depletion, the route’s hops, the record’s bitsets, the pod.
- `pacing.test.js` models a pilot’s minute (fights, scans, hauls) and holds the targets.
- In the browser: a tier bought in the Hangar changes the pulse speed `__universeDebug` reports; a trade at a generated station moves the credits and the hold; a scan marks a sector; a jump past range goes in hops.

## Not in this design

- The Star Wars galaxy’s own ports (a later lane with the galaxy’s owner); the galaxy’s ships keep their own numbers. The credits are one wallet, as now.
- Other pilots seeing your tiers on the wire (`online/protocol.js` sends parts only). A later lane.
- Fuel, docking fees and repair bills.
- Patrols that scan you in flight for contraband: that is an event, the layout session’s, through the same rule a military dock uses.
