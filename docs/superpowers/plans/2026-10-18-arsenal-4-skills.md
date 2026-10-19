# Skills (arsenal, pull request 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A skill tree for the whole site, in the Hangar. Points come from xp and from achievements in every world. You spend them anywhere on four branches. The effects land on the ship's flight, its guns, its powers and the crew on foot, and two crews' powers can be carried by any ship.

**Architecture:**
- **The tree and its rules** are pure data and functions in `src/components/hangar/skills/` (`tree.js` and `rules.js`, tested).
- **The provider.** A `SkillsProvider`, mounted in `App.jsx` beside the `EconomyProvider`, reads the points from the economy's xp and the achievements unlocked. It keeps the nodes taken in `tp-skills` and hands out one flat effects object, `fx`.
- **The pages pass `fx` on.** Pages hand `fx` to their worlds, as they hand the loadout, and the worlds apply it at the seams that already exist:
  - `outfit.statsOf`
  - `weapons.createArmory`
  - `shipPowers.createPowers`
  - the galaxy surface's `perkEffects`
  - the universe foot's `foot.js` numbers
- **Borrowed powers.** A power pick per crew, kept in `tp-powers`, lets a ship carry another crew's pair once its node is taken.

**Tech Stack:** React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-one-arsenal-and-hangar-design.md`, Part 4 (and 3.5, 3.6). Pull requests 1–3 are done.

## Global Constraints

- **Points** (spec 4.1, with the builder check's cap):
  - 1 for each level past the first (10)
  - 1 for each Legend rank, one per 3,000 xp past 11,000, at most 10
  - 1 for every 5 achievements unlocked, Battlefront's left out, at most 50
  - So `maxPoints` is 70.
- **The tree costs 60.** A test pins `0.8 × maxPoints ≤ treeCost ≤ maxPoints`, with `maxPoints` from the live tables.
- **Freedom:**
  - Every branch has two row-1 nodes that need nothing.
  - A deeper node needs any one node of the row above in the same branch, and never one in another branch.
  - Some deep nodes also need a key: any one achievement of a universe's list.
- **Unique weapons** (`u-*`, spec 6) are in the tree with `soon: true`. They count toward the cost but can't be taken until pull request 6.
- **Reset:** the first one is free, and each after costs 500 ¢ through `economy.spend`. A reset takes every node off.
- **Saves:**
  - `tp-skills` is version 1: `{ nodes: [ids in order taken], resets }`.
  - `tp-powers` is version 1: `{ [crew]: { primary, ultimate } }`.
  - Both go through `localSaves()`. Nothing else is stored: the points are always worked out.
- **Never online.** No effect changes what another pilot takes. Damage keys apply only to the game's own ships and troops.
- Layers and islands as before.
  - `boundary-breaks` ≤ 482 and `loops` ≤ 58.
  - The universe and the galaxy never import `components/hangar`: they take `fx` and `picks` as plain props.
- British spelling, no Oxford comma, house UI rules.
- **Done means:**
  - lint
  - the suite against the baseline (timeouts rerun at 60 s)
  - the health check
  - the build
  - shots of the Skills tab and of a ship flying with a node taken (for example `trigger`, with the cadence faster)

## Review Focus

1. **The band stays true as achievements are added.** A test reads `Object.keys(ACHIEVEMENTS).length` live.
2. **A save that's out of step.** The nodes taken are worth more than the points now (an achievement store cleared), or name a node that's gone. `readSkills` keeps the earliest taken while the points last and drops the rest, without throwing.
3. **Borrowed powers on the wrong ship.** A pick for a pair the node no longer allows (after a reset) falls back to the crew's own. The HUD's tiles and the scene's powers always agree.
4. **Effects stack with the parts, never replace them.** `statsOf` with `fx` is `statsOf` without it, plus or times the skill.
5. **No point is spent twice and none is lost** when two tabs of the site are open (the save is read again on focus, or a write merges the nodes).

---

### Task 1: The tree and its rules

**Files:** Create `src/components/hangar/skills/tree.js`, `rules.js`, `rules.test.js`

**Interfaces:**
- **`tree.js` produces:**
  - `BRANCHES = ['flight', 'guns', 'ground', 'powers']` and `BRANCH_LABEL`
  - `NODES`: `{ id: { branch, row (1–4), cost, name, line, key?: 'starwars' | 'rickmorty' | 'breakingbad' | 'universe', soon?: true, does: { …effect keys }, borrows?: crew } }`. The nodes and costs are spec 4.4's tables. The one change is `longlock`, which does homing ×1.3 and a round's life ×1.25 (a ruling: the lock's range lives in each scene's AIM).
  - `KEYS`: `{ starwars: [ids], rickmorty: [ids], breakingbad: [ids], universe: [ids] }`, sorted by hand from `Achievements.jsx`
  - `BATTLEFRONT = ['galacticassault', 'heroesvsvillains', 'blast']`, plus any others of Battlefront's own
- **`rules.js` produces:**
  - `LEGEND = { from: 11000, every: 3000, most: 10 }`
  - `legendRank(xp)`: 0 until 14,000, then 1 and up
  - `pointsOf({ level, xp, achievements })`: `{ levels, legend, deeds, earned }`
  - `maxPoints(countable)` and `treeCost()`
  - `keyMet(key, achievements)`
  - `canTake(nodes, id, { earned, achievements }) → { ok, why: 'taken' | 'soon' | 'parent' | 'key' | 'points' }`
  - `readSkills(raw, { earned, achievements }) → nodes[]`
  - `effectsOf(nodes) → fx`
  - `resetCost(resets)`: 0, then 500
  - `canCarry(nodes, crew, powerCrew)`

  `fx` holds:
  - **Adders:** `boost`, `accel`, `cruise`, `agility`, `level`, `ammo`, `shots`
  - **Multipliers:** `regen`, `armor`, `cadence`, `reload`, `homing`, `life`, `jump`, `health`, `heal`, `spread`, `heat`, `cool`, `damage`, `powerCool`, `powerDur`, `charge`, `pickup`, `bigPunch`
  - **`carry`:** the crews whose powers any ship may carry

- [ ] **Step 1: Write the failing tests:**
  - `the tree costs 60 and fits the band`: `treeCost() === 60`, and `0.8 * maxPoints(countable) <= 60 <= maxPoints(countable)`, where `countable` is `Object.keys(ACHIEVEMENTS).filter((id) => !BATTLEFRONT.includes(id)).length`.
  - `every id in KEYS and BATTLEFRONT is an achievement`.
  - `every branch opens from two row-1 nodes that need nothing`.
  - `points`: `pointsOf({ level: 3, xp: 200, achievements: Array(12) })` gives `levels: 2` and `deeds: 2`. Legend at 17,000 xp is 2. `deeds` caps at 50. Battlefront's ids don't count.
  - `canTake`:
    - a row-2 node with no row-1 node is `'parent'`
    - with one it's ok
    - `kesselrun` without a Star Wars achievement is `'key'`
    - a `soon` node is `'soon'`
    - with too few points it's `'points'`
  - `readSkills`:
    - keeps the taken order while the points last
    - drops an unknown id, a node whose parent was dropped, and a `soon` node
    - junk gives `[]`
  - `effectsOf(['afterburn', 'trigger', 'racks'])`: `boost` 0.1, `cadence` 0.92, `ammo` 1, and everything else neutral (0 adders, 1 multipliers).
  - `canCarry`: with `b-cruiser` taken, the X-wing may carry the cruiser's pair.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit.**

### Task 2: The provider and the save

**Files:**
- Create: `src/components/hangar/skills/SkillsProvider.jsx`, `src/components/hangar/skills/powerPicks.js` with its test
- Modify:
  - `src/App.jsx` (mount `SkillsProvider` inside `EconomyProvider`)
  - `src/components/hangar/index.js` (lend `SkillsProvider`, `useSkills`)

**Interfaces:**
- **`useSkills()`** returns `{ nodes, points: { earned, spent, free, max, legend }, can(id), take(id) → result, reset() → result, resetCost, fx, picks, pick(crew, slot, id) }`.
  - It re-reads `tp-skills` on the window's `focus` and `storage` events (Review Focus 5).
  - `reset()` spends through `economy.spend(resetCost)` first, and does nothing if that fails.
- **`powerPicks.js` (pure):**
  - `readPicks(raw)`
  - `picksFor(crew, picks, fx) → { primary, ultimate }`: the crew's own, or a borrowed pair the fx allows; the slots stay true (a primary on G).
  - `POWERS_KEY = 'tp-powers'`

- [ ] Steps: the tests for `picksFor` first (own by default; a borrowed one allowed only with `carry`; a primary never goes on X). Then the provider, then mount it.

### Task 3: The effects land

**Files:**
- Modify:
  - `src/components/universe/outfit.js`: `statsOf(kind, loadout, build, tune, fx = NO_FX)`. Add fx's adders to boost, accel, cruise, agility and level, and multiply regen, armor and cadence.
  - `src/components/universe/weapons.js`: `createArmory(kind, loadout, fx = NO_FX)`. The rack gets `+fx.ammo` and reload `× fx.reload`. A secondary gets `+fx.shots` count. Homing is `× fx.homing`, and a heavy round's life `× fx.life` (through the weapon the armoury reads).
  - `src/components/universe/shipPowers.js`: `createPowers(crew, { charge, cool, fx, picks })`. Cool `× fx.powerCool`, duration `× fx.powerDur`, every charge gain `× fx.charge` (a pickup's `× fx.pickup`), and the slots from `picks`.
  - `src/components/universe/powers.js`: the big ones' punch `× fx.bigPunch`, and `setCrew(kind, { fx, picks })`.
  - `src/components/universe/foot.js` and `footScene.js`: health `× fx.health`, heal `× fx.heal`, and damage to troops `× fx.damage`.
  - `src/components/galaxy/surface/scene.js`: `perkEffects(...)` multiplied by `groundEffects(fx)`. That is `{ hurt: 1, regen: fx.heal, heat: fx.heat, cool: fx.cool, damage: fx.damage }`, and `spread: fx.spread` where the gun's spread is read.
  - `src/components/universe/scene.js` and `galaxy/scene.js`: take `props.skillFx` and `props.powerPicks`, and pass them at the seams above. Refit when they change, as a new loadout does.
  - `src/pages/Universe.jsx`, `Galaxy.jsx`, `GalaxySurface.jsx` and the universe foot's host: read `useSkills()` and pass `skillFx` and `powerPicks`.
  - `src/components/universe/PowerBar.jsx`: the tiles from `picksFor`.
- Tests:
  - `statsOf` with `effectsOf(['afterburn'])` has `boost` +0.1 over without, and without fx it's unchanged.
  - `createArmory` with `racks` holds 5 heavy rounds, and with `scatter` the spread fires 6.
  - `createPowers` with `recovery` cools in `0.85 × 22` s, and with picks `{ primary: 'portal' }` on the X-wing (with `carry: ['cruiser']`) its primary is `portal`.
  - The galaxy's `groundEffects`.

### Task 4: The Skills tab, and the Powers tab's picks

**Files:**
- Create: `src/components/hangar/SkillsTab.jsx`
- Modify:
  - `HangarPanel.jsx`: `TABS` gains `'skills'` (between Powers and Shipyard). The head shows the points free and a Legend rank past level 11.
  - `hangarRules.js` and its test
  - `PowersTab.jsx`: each slot a chip row of the powers this ship may carry there (own, then borrowed), the picked one pressed; locked ones show the node that opens them.
  - `hangar.css`
- Behaviour:
  - The Skills tab is four columns, one per branch, with rows 1–4.
  - Each node is a button: its name, cost and line, and its state (taken; can take; needs a parent; needs a key, naming the universe; short of points; arrives with the unique weapons).
  - Press to take, kept at once.
  - Reset sits at the foot with its price.
  - On a phone, the branches stack.

- [ ] Steps: `headOf` gains `legend` and `points` (test first), then the tab, then the shots.

### Task 5: Prove it

- [ ] Lint; the suite against the baseline; the health check; the build; shots at 1440x900 and 390x844; a flight with `trigger` taken (its cadence measured from the scene's debug).
