# Rick and Morty aboard (arsenal, pull request 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rick and Morty joins the rest of the site's ships and progress. Its deeds pay into the one wallet. The Hangar opens there. The street's cruiser flies on its loadout and skills, keys like every other ship, and has a fight to fire at. On foot, the duels and Total Rickall read health on the HUD kit.

**Architecture:**
- **Pure rules first**, each in a new tested file inside `src/components/rickmorty/`:
  - `earn.js`: deed to wallet key
  - `world/patrolRules.js`: the patrol's fight
  - `world/streetFight.js`: the cruiser's guns against it, with no three.js
- **`RmWorld.jsx` and the R&M pages only wire them.** RmWorld is 2,068 lines, so new logic goes in new files and RmWorld grows by wiring only.
- **The universe lends through its faces.**
  - `universe/shared/wallet.js` gains `useEarn`, `createPayLedger` and `EarnNote`.
  - `universe/shared/flying.js` already lends the armoury, the rounds, the powers and `armsView`.
- **The pages own the Hangar, as `Universe.jsx` does.** They lazy-load `HangarPanel`, render the `Hangar.jsx` door and pass the cruiser's stats and skills down as props.

**Tech Stack:** React 19, three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-one-arsenal-and-hangar-design.md`, Part 7 (and 1.4's key clashes). Pull requests 1–4 are done.

## Global Constraints

- **Wallet side** is `'rickmorty'` (`SIDE_RATES.rickmorty` is 1). The deeds use only keys `EARN` already has:
  - a C-137 task, a Citadel quest or a big-planet quest done is `questDone`
  - a big-planet place found is `found`
  - a duel won is `killAce`
  - a Total Rickall parasite is `killPirate`
  - a Portal panic boss is `killCapital`
  - a street patrol shot down is `killHunter`
- **Pay once** for anything that can only be done once (tasks, quests, places). The ledger is seeded from the saved done lists, as `GalaxySurface.jsx`'s `createPayLedger` is.
- **Keys** (spec 1.4):
  - The street cruiser climbs on Space and sinks on Shift. Both are bound already, so `FLY_KEYS` goes and R, F and C are freed.
  - In flight: F fires, R / Shift+R picks the next or previous line, 1 2 3 pick a line, G is the power, X is the big one.
  - Anywhere on the street, the Citadel and the big planets: H is the Hangar and C is the Hangar on Crew.
  - The big planets' guide moves off H to the site's `?`.
- **The cruiser's numbers:** `statsOf('cruiser', loadout, build, tune, fx)` over `CRUISER`:
  - `top` × cruise × boost
  - `accel` × accel
  - `turn` and `climb` × agility
  - Each is clamped to 0.7–1.6 of stock.
- **The patrol** stays calm until fired on. Then it fights with:
  - `hunterRules.js`'s `LASER` (speed 34, life 1.1, damage 12)
  - `sides.js`'s patrol hp (2) and fire range (0.8–1.5 s)

  Shot down, it pays `killHunter`, and a new patrol comes round its loop 60 s later.
- **The cruiser on the street:**
  - Deflectors 0–100, regen as the map's.
  - At 0 it is forced down where it is and grounded 10 s, and the patrol goes back to its loop.
  - The patrol's damage takes `stats.armorGame`.
- **On foot:**
  - Hearts become health: 100 ÷ hearts each, so Morty's 3 are 100 and a hit takes 34.
  - The enemy's hits show as a share of its full.
  - Shown on the kit's `Vitals`; the gun's name on `Arms` with no rack. The toon skin stays (`RmHud.jsx`'s classes over the kit's).
- **Islands:**
  - The R&M world imports the universe only through `universe/shared/`, and never `components/hangar`.
  - `boundary-breaks` ≤ 482, `loops` ≤ 58, `cycles` ≤ 5.
  - No new file over 800 lines.
- British spelling, no Oxford comma, house UI rules (44 px touch targets, tokens, the HUD kit).
- **Done means:**
  - lint
  - the suite against the baseline (timeouts rerun at 60 s)
  - the health check
  - the build
  - shots at 1440×900 and 390×844 of:
    - `/c-137` walking, in flight with the cluster, and mid-fight
    - the Hangar open on `/c-137`
    - `/c-137/citadel`
    - a big planet

## Review Focus

1. **Paid twice.** A quest done again after a reload, or Portal panic's two mounts (the C-137 page and the garage cabinet), must pay once per deed. Every once-key is seeded from the saved done lists. A boss is paid by the instance that emitted it.
2. **Keys in the wrong place.**
   - C typed in a field does nothing.
   - F in a duel still fires the duel's shot, not the cruiser's.
   - Shift on foot still runs, and only sinks in flight.
   - H on a big planet opens the Hangar, not the guide.
   - Escape with the Hangar open shuts the Hangar, not the world (`RmSurface`'s takeOff).
3. **Soft-locks.** Shot down on the street, the cruiser can fly again after 10 s. The Hangar shut puts the world's keys back. A forced landing inside a building's footprint lands on `floorAt`.
4. **A calm patrol stays calm.** Flying near it, tailing it or landing never starts the fight. Only a shot that hits it does, and only for the patrol hit.
5. **The phone.** The door, the cluster, the touch Fire and Weapon buttons and the R&M HUD's own buttons don't overlap at 390×844.

---

### Task 1: Rick and Morty pays into the wallet

**Files:**
- Create: `src/components/rickmorty/earn.js`, `earn.test.js`
- Modify:
  - `src/components/universe/shared/wallet.js` and its `shared.test.js` name list (`useEarn`, `createPayLedger`, `EarnNote`)
  - `world/RmWorld.jsx`: `complete(id)` at :331, `landDuel` at :1033, `landRickall` at :717
  - `citadel/CitadelWorld.jsx`: `complete(id)` at :106
  - `planets/RmSurface.jsx`: `onEvent` at :126 and :134
  - `portal/PortalPanic.jsx`: `case 'bossDown'` at :243

**Interfaces:**
- Produces:
  - `RM_EARN` (deed to `EARN` key)
  - `earnOf(deed, id = null, where = null) → { what, once: string | null }`
    - the deeds: `'task' | 'citadel' | 'quest' | 'found' | 'duel' | 'parasite' | 'boss' | 'patrol'`
    - `once` keys: `task:<id>`, `citadel:<id>`, `quest:<where>:<id>`, `found:<where>:<id>`
    - repeatables have `once: null`
  - `useRmEarn(seeds) → { earn(deed, id, where), note }`, a hook in `rickmorty/useRmEarn.js` over the wallet face's `useEarn` and `createPayLedger`, side `'rickmorty'`

- [ ] **Step 1: Write the failing tests.**
  - Every deed maps to a key `EARN` has (read live from the wallet face).
  - Once-keys are as above.
  - `duel`, `parasite`, `boss` and `patrol` have `once: null`.
  - An unknown deed is `null`.
- [ ] **Step 2: Run them.** `npx vitest run src/components/rickmorty/earn.test.js`. Expected: FAIL, no module.
- [ ] **Step 3: Implement `earn.js`, `useRmEarn.js` and the face's three names.** Wire the six seams, seeding each world's ledger from its saved done list (RmWorld's tasks, the Citadel's quests, RmSurface's `foundNow`/`doneNow`). Mount `EarnNote` in each world's HUD corner, from `useRmEarn().note`.
- [ ] **Step 4: Run them.** The same and `src/components/universe/shared`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(rickmorty): its deeds pay into the one wallet`

### Task 2: The Hangar aboard

**Files:**
- Modify:
  - `src/pages/RickMorty.jsx`, `Citadel.jsx`, `RmPlanet.jsx`: lazy `HangarPanel`, the `Hangar.jsx` door, `useShipyardPage({ ship: 'cruiser', unlocked })`, `hangarTab` as `Universe.jsx` keeps it
  - `world/RmWorld.jsx` and `world/RmHud.jsx`: the Wardrobe chip and C open the Hangar on Crew (`onHangar('crew')`). The `Wardrobe` dialog's mount goes. A `frozen` prop stops the world while the Hangar is open, as `open` does now.
  - `citadel/CitadelWorld.jsx`: the same at :637–641, :1058 and :1166
  - `planets/RmSurface.jsx`: H no longer toggles the guide (`?` does, the site's own); Escape leaves the Hangar's own
- Test: a pure `rickmorty/hangarSeat.js`:
  - `HANGAR_SHIP = 'cruiser'`
  - `doorCorner(page) → 'top-right' | 'bottom-left'`, where each page's door sits clear of its HUD
  - tested for the three pages

**Interfaces:**
- Consumes: `HangarPanel` (`open`, `onOpen`, `tab`, `onTab`, `ship`, `shipName`, `live`, `lastBuild`, `saves`, `dropped`, `onApply`, `onSell`, `returnTo`), `Hangar.jsx`'s `.universe-hangar-btn` (which `wantsKey` needs as its door)
- Produces: `RmWorld` / `CitadelWorld` / `RmSurface` props `frozen`, `onHangar(tab)`

- [ ] **Step 1: Write the failing `hangarSeat` test.** Run it. Expected: FAIL.
- [ ] **Step 2: Implement and wire.** The door's corner comes from `doorCorner`. `returnTo` is the door.
- [ ] **Step 3: Run the R&M tests and `src/components/hangar`.** Expected: PASS. Then shots of the Hangar on the three pages, desktop and phone, with H and C each opening it and Escape shutting it.
- [ ] **Step 4: Commit.** `feat(rickmorty): the Hangar opens on the street, the Citadel and the big planets`

### Task 3: The street's cruiser flies on its loadout, its skills and the site's keys

**Files:**
- Modify:
  - `world/rules.js`: `cruiserOf(stats) → { ...CRUISER, top, accel, turn, climb }` (clamped 0.7–1.6 of stock), and `stepCruiser(c, input, dt, k = CRUISER)` reads `k`
  - `world/RmWorld.jsx`: `FLY_KEYS` goes; a `cruiser` prop (the page's stats) feeds `cruiserOf` once per change
  - `world/scene.js`: reads `k` where it reads `CRUISER.hover/top/ceiling`
  - `src/pages/RickMorty.jsx` and `RmPlanet.jsx`: `statsOf('cruiser', loadout, build, tune, useSkills().fx)`
- Test: `world/rules.test.js`
  - `cruiserOf(statsOf-like stock)` equals `CRUISER`
  - `boost` 1.2 and `cruise` 1.1 give `top` 22 × 1.32
  - a wild stat clamps at 1.6
  - `stepCruiser` with a faster `k` goes further in 1 s

- [ ] **Step 1: The failing tests.** Run them. Expected: FAIL (`cruiserOf` not defined).
- [ ] **Step 2: Implement.**
  - Space climbs and Shift sinks in flight; on foot Shift runs as before.
  - The street's hull (the Meshy saucer, `world/scene.js:320`) isn't the map's `cruiser3dCore` hull, so paint and parts show only in the Hangar.
- [ ] **Step 3: Run them.** Expected: PASS.
- [ ] **Step 4: Commit.** `feat(rickmorty): the street's cruiser flies on its loadout and skills, on the site's keys`

### Task 4: A fight on the street

**Files:**
- Create:
  - `world/patrolRules.js` and its test
  - `world/streetFight.js` and its test: the cruiser's armoury, its bolts as data, hits on the patrol, the patrol's shots on the cruiser, the deflectors
  - `world/streetBolts.js`: a small pool of bolts drawn in the scene, with the heavy rounds through `createRounds`
- Modify:
  - `world/ship.js`: `stepFedShip` takes the fight's mode
  - `world/visitors.js`: draws the patrol's hits and its fall
  - `world/RmWorld.jsx`: F, R, Shift+R and 1 2 3 while flying; the touch Fire and Weapon buttons; pays `patrol` through Task 1's `earn`
  - `world/RmHud.jsx`: the kit's `Cluster` with `Vitals` (Deflectors) and `Arms` while flying, written through refs by `createFlightCluster().place`
- **Interfaces:** `patrolRules.js` produces:
  - `PATROL = { hp: 2, laser: { speed: 34, life: 1.1, damage: 12 }, fire: [0.8, 1.5], back: 60, range: 40 }`
  - `newPatrol() → { mode: 'calm' | 'fight' | 'down', hp, nextShot, downAt }`
  - `provoke(p, now)`
  - `hitPatrol(p, punch, now) → { down: boolean }`
  - `patrolShot(p, cruiser, now, rand) → { from, dir } | null` (fighting, in range, by cadence)
  - `stepPatrol(p, now)` (back to calm and full after `back` s)
- Tests:
  - calm patrols never shoot
  - a hit provokes and takes hp
  - two punches down it
  - down, it comes back at 60 s calm
  - its shot leads nothing and fires only in range
  - `streetFight` takes the deflectors down by 12 × `armorGame` a hit, and grounds at 0 for 10 s

- [ ] **Step 1: The failing tests for both files.** Run them. Expected: FAIL.
- [ ] **Step 2: Implement the rules, then the drawing and the wiring.** The duel's F stays the duel's; the cruiser's F is only in flight.
- [ ] **Step 3: Run the R&M tests.** Expected: PASS. Shots mid-fight, desktop and phone.
- [ ] **Step 4: Commit.** `feat(rickmorty): the street's patrol fights back once fired on`

### Task 5: The cruiser's powers on the street

**Files:**
- Modify:
  - `world/streetFight.js`: hands `createGalaxyPowers` (through `universe/shared/flying.js`) its adapters, as the galaxy's scene does in pull request 2:
    - `hunters`: the patrol as a list of one
    - `war`: none
    - `strike`: the street's bolt test
    - `bolts`, `flashes`, `pops` and `crashFx`: the street's
  - `world/RmWorld.jsx`: G and X while flying
  - `world/RmHud.jsx`: `PowerBar` (picks and carry from the page)
- Test: `streetFight.test.js`
  - G turns the power on while flying, and nothing on foot
  - the big one charges from a patrol shot down
  - the tiles agree with the picks (`picksFor`)

- [ ] **Step 1: The failing tests.** Run them. Expected: FAIL.
- [ ] **Step 2: Implement.** Run them. Expected: PASS.
- [ ] **Step 3: Commit.** `feat(rickmorty): the cruiser's powers on the street`

### Task 6: Health on foot, on the kit

**Files:**
- Create: `world/vitalsOf.js` and its test
  - `heartsToHealth(hp, max) → { value, max: 100, low }` (100 ÷ max a heart, `low` under 25)
  - `enemyShare(hp, max) → 0–100`
- Modify: `world/RmHud.jsx`
  - the duel's hearts and Total Rickall's status draw on `Vitals` (yours) with the enemy's share beside it
  - the gun's name on `Arms` with no rack
  - the `.rm-fight` toon classes over the kit's
- Tests:
  - 3 of 3 hearts is 100
  - 2 of 3 is 66
  - 1 of 3 is 33 and low
  - an enemy at 4 of 6 is 67

- [ ] **Step 1: The failing tests.** Run them. Expected: FAIL.
- [ ] **Step 2: Implement.** Run them. Expected: PASS. Shots of a duel, desktop and phone.
- [ ] **Step 3: Commit.** `feat(rickmorty): health on foot on the HUD kit`

### Task 7: Prove it

- [ ] **Step 1: Verify.** Lint; the suite against the baseline; the health check; the build; the shots listed under Done.
- [ ] **Step 2: Review and finish.** The final review (most capable model) against this plan and the spec's Part 7. Then one fix pass, the ledger, the push and the draft pull request's body.
