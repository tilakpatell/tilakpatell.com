# Endless universe Implementation Plan (index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/universe` into one seamless, endless, populated 3D space. It has nebulae fixed in the world, generated planets and moons you land on and walk, at least 20 kinds of thing in space, at least 15 kinds of event, and one dynamic map that follows the ship.

**Architecture:**
- The work is ten lanes, each one or more PRs from its own session, in three waves.
- This index holds:
  - the rules every lane keeps
  - the one shared module every lane consumes (Task 0)
  - the lanes, their plans, their order and what they hand each other
- Wave 1's four lanes have full plans now. Each later lane's session writes its own plan with superpowers:writing-plans when its dependencies have merged, so it plans against real code, not guesses.

**Tech Stack:**
- React 19, Vite, three.js 0.186
- Vitest
- FastNoiseLite (`fastnoise-lite` 1.1.1)
- The site's world runtime (`src/runtime/`: `workers.js`, `chunkGrid.js`, `store.js`, `saves.js`)
- Playwright-driven check scripts under `scripts/`

**Spec:** `docs/superpowers/specs/2026-10-18-endless-universe-design.md`. Every lane reads it whole; the spec wins over any plan.

## Global Constraints

**Process (from `HANDOFF-universe.md`):**
- Every rule in `docs/superpowers/HANDOFF-universe.md` "The owner's rules" holds.
- Nothing a visitor can do is lost: every key, save key, achievement, sound, ghost and dev hook works after as before. Existing tests stay green and are not loosened.
- Pure first: `src/lib`, `src/runtime` and the generators import no React, no DOM and no three.js. Every rule has its Node test before its drawing half.
- A changed picture is on purpose: before shots on `main` first, with the after beside them in the PR.
- Draw calls and triangles are no higher at any checked route. Say the numbers.
- One PR a lane (or a numbered PR inside a lane): CI green, a merge commit. Never merge red, never force-push, never rebase anyone's branch.
- Before a PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, and the smoke check on the lane's routes.

**Code shape:**
- `src/components/universe/scene.js` (6,226 lines) doesn't grow. A PR that adds wiring to it moves at least as many lines out, and says both numbers.
- New files stay under 800 lines; 1,500 is the ceiling (`docs/health/RULES.md`).
- Generated content is never stored, only seeds and deltas.

**Ids and space:**
- `SECTOR = 120000`; sectors are cubes `(sx, sy, sz)`.
- Today's ids (`E:sx,sz:…`, `e:sx,sz:…`) mean `sy = 0` and resolve to the same thing for good.
- Middle-layer generation is additive.

**Planets:**
- The 50 roster planets keep their plane ground exactly.
- Building stays on the 50 seeded planets only, and no new POI touches the 13 seeded Expanse planets.

**Dependencies and words:**
- A new package gets its `docs/stack/` page before it is first imported.
- No runtime call to any service.
- British spelling and the glossary (`src/components/universe/words.js`, `src/lib/words.js`). A new on-screen word goes there first.

## Review Focus

The five failures most likely to bite a visitor, and the task or lane whose tests pin each:

1. **Old state still works.** A returning visitor's old `tp-*` keys, an old `/universe/<id>` link, an old `/fly/e:sx,sz:i:j` link, and an older pilot's online pose with no `sy` all still work and land in the same place. Pinned by Task 0 (old id forms), lane 2 (pose round-trip) and lane 5a (roster hash).
2. **One place, several spellings.** `E:1,0:3:2`, `e:1,0:3:2` and `e:1,0,0:3:2` are one planet; `E:1,0,1:3:2` is a different one. Pinned by Task 0.
3. **Sector edges.** A ship exactly on a sector boundary, or at `-0`, is in one sector, and doesn't flicker between two as it sits there. Pinned by Task 0 (rounding, `-0`) and lane 2 (the chunk grid's hysteresis).
4. **Far and long.** A body 10^9 units out draws within a pixel, and orbits stay smooth after a tab has been open for days (large `t` on the shared clock). Pinned by lane 2.
5. **No 3D.** On a device with 3D off, the mini-map alone still shows the ship and every hand-made place, wonder and moon, on the same projection as the nav map. Pinned by lane 6a.

---

### Task 0: The shared address (coordinator, before wave 1 starts)

One small pure module that every lane reads ids and sectors through, so no two lanes write their own parser.

**Files:**
- Create: `src/lib/space/address.js`
- Test: `src/lib/space/address.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (every lane uses these names; nobody redefines them):
  - `SECTOR = 120000`
  - `sectorAt(x: number, y: number, z: number) → [sx, sy, sz]`: `Math.round(v / SECTOR) + 0` per axis
  - `sectorCentre(sx, sy, sz) → [x, y, z]`
  - `sectorKey(sx, sy, sz) → string`: `'E:sx,sz'` when `sy === 0`, else `'E:sx,sz,sy'`
  - `parseSectorKey(key: string) → [sx, sy, sz] | null`: either case of `E`, two or three integers
  - `parseSpaceId(id: string) → { sx, sy, sz, key, system?, planet?, moon?, wonder? } | null`: either case, a two- or three-number sector, then `:i`, `:i:j`, `:i:j:k` or `:w<n>`. `key` is `sectorKey`'s form.
  - `spaceId([sx, sy, sz], ...parts) → string`: upper-case `E:` via `sectorKey`, then the parts joined with `:`. A part given as `{ wonder: n }` is written `w<n>`.
  - `sameSpaceId(a: string, b: string) → boolean`: equal after parsing (case and the optional `,0` don't matter); false if either doesn't parse.

- [ ] **Step 1: Write the failing tests** in `src/lib/space/address.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { SECTOR, sectorAt, sectorCentre, sectorKey, parseSectorKey, parseSpaceId, spaceId, sameSpaceId } from './address.js';

describe('address', () => {
  it('sectors are 120,000 cubes, rounded to the nearest centre, never -0', () => {
    expect(SECTOR).toBe(120000);
    expect(sectorAt(0, 0, 0)).toEqual([0, 0, 0]);
    expect(Object.is(sectorAt(-1, -1, -1)[0], 0)).toBe(true);
    expect(sectorAt(59999, 60001, -60001)).toEqual([0, 1, -1]);
    expect(sectorCentre(2, -1, 3)).toEqual([240000, -120000, 360000]);
  });
  it('keys keep the old two-number form on the middle layer', () => {
    expect(sectorKey(1, 0, -2)).toBe('E:1,-2');
    expect(sectorKey(1, 3, -2)).toBe('E:1,-2,3');
    expect(parseSectorKey('E:1,-2')).toEqual([1, 0, -2]);
    expect(parseSectorKey('e:1,-2,3')).toEqual([1, 3, -2]);
    expect(parseSectorKey('E:1')).toBeNull();
    expect(parseSectorKey('X:1,2')).toBeNull();
  });
  it('parses every id form, either case', () => {
    expect(parseSpaceId('E:1,0:3')).toEqual({ sx: 1, sy: 0, sz: 0, key: 'E:1,0', system: 3 });
    expect(parseSpaceId('e:1,0:3:2')).toMatchObject({ system: 3, planet: 2 });
    expect(parseSpaceId('e:1,0,4:3:2:1')).toMatchObject({ sy: 4, key: 'E:1,0,4', system: 3, planet: 2, moon: 1 });
    expect(parseSpaceId('E:-2,5:w7')).toMatchObject({ sx: -2, sz: 5, wonder: 7 });
    expect(parseSpaceId('E:1,0:x')).toBeNull();
    expect(parseSpaceId('beacon:E:1,0:n')).toBeNull();
  });
  it('writes ids in the generator’s form and reads its own back', () => {
    expect(spaceId([1, 0, 0], 3, 2)).toBe('E:1,0:3:2');
    expect(spaceId([1, 4, 0], { wonder: 7 })).toBe('E:1,0,4:w7');
    for (const id of ['E:1,0:3', 'E:1,0,4:3:2:1', 'E:-2,5:w7']) {
      const p = parseSpaceId(id);
      const parts = p.wonder !== undefined ? [{ wonder: p.wonder }] : [p.system, p.planet, p.moon].filter((v) => v !== undefined);
      expect(spaceId([p.sx, p.sy, p.sz], ...parts)).toBe(id);
    }
  });
  it('one place, several spellings', () => {
    expect(sameSpaceId('E:1,0:3:2', 'e:1,0,0:3:2')).toBe(true);
    expect(sameSpaceId('E:1,0:3:2', 'E:1,0,1:3:2')).toBe(false);
    expect(sameSpaceId('E:1,0:3:2', 'nonsense')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/lib/space/address.test.js`. Expected: FAIL, because `./address.js` can't be resolved.

- [ ] **Step 3: Implement** the exports above in `src/lib/space/address.js`. Requirements:
  - pure, no imports
  - a header comment in the repo's voice listing the exports, as `expanse/gen/grid.js` does
  - one anchored regex for keys and one for ids

- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/lib/space/address.test.js`. Expected: PASS, 5 tests.

- [ ] **Step 5: Run the repo's gates.** Run `npm run lint` and `node scripts/health.mjs --check --skip build`. Expected: no new findings.

- [ ] **Step 6: Commit and merge to `main`** before any wave-1 lane branches:

```bash
git add src/lib/space/address.js src/lib/space/address.test.js
git commit -m "Add the shared space address for the endless universe"
```

---

## The lanes

| Lane | Plan | Wave | Depends on | Merge order |
|---|---|---|---|---|
| 1 Nebulae and the sky | `2026-10-18-endless-universe-lane-1-nebulae.md` | 1 | Task 0 | any time |
| 2 One space | `2026-10-18-endless-universe-lane-2-one-space.md` | 1 | Task 0 | first of the `scene.js` lanes |
| 5a Unique planets (pure) | `2026-10-18-endless-universe-lane-5a-unique-planets.md` | 1 | Task 0 | any time |
| 6a The map, first half | `2026-10-18-endless-universe-lane-6a-map.md` | 1 | Task 0 | any time |
| 3 Places you can go | written by its session | 2 | 2 | after 2 |
| 4a Things in space and gargantuans | written by its session | 2 | 2, 3's resolver | after 3 |
| 4b Events and life | written by its session | 2 | 2, 3's resolver | after 4a |
| 4c The first minute and saves | written by its session | 3 | 4a | after 4b |
| 5b Landing and walking | written by its session | 3 | 3, 5a | after 3 |
| 6b The map, second half | written by its session | 3 | 3, 6a | after 3 |

**One change from the spec's lane table:** moons' type and seed move from lane 5a to lane 2, because lane 2 owns the generator (`expanse/gen/sector.js`). Lane 5a writes its moon handling against a fixture row and reads the real rows once lane 2 merges.

**A gap lane 5a found, given to lane 5b:**
- Lane 5a describes each generated planet's sky, clouds, weather, flora colours and biomes, but the flight's ground shader (shared with the galaxy) doesn't colour by biome, and nothing draws weather or sky clouds.
- Lane 5b draws all of these on the flight's ground for generated planets, so the walk is as unique as the description. The 50 roster planets and the galaxy keep their look exactly.
- Lane 5b also marks every new universe-to-flight import for the flight's removal script (`scripts/flight-island.mjs`).

**Handed on by lane 6a:**
- **Lane 4c** fills the mini-map's `ship` prop from the saved position (`tp-universe-where`). With 3D off, nothing else knows where the ship is.
- **Lane 6b** extends the scene's `where()` with heights for other pilots and far fights, and with traffic, so the chart can draw them in 3D.

**Handed on by lane 1:**
- **Lane 2** (or whichever lane next touches `paceTo`, `scene.js:4980-4992`) passes the quality step to the nebula renderer, so `lowerQuality` lowers the nebulae's steps as section H asks.

**Who touches what in wave 1:**
- **Lane 1** changes only the nebula `gl.Points` lines in `expanse/scene/sectors.js`, replacing them with a call to its renderer.
- **Lane 2** keeps that call when it restructures the file. If lane 1 hasn't merged yet, lane 2 keeps today's Points, and whichever merges second resolves the one call site.
- **Lane 6a** doesn't touch `nav.js`'s destinations. Lanes 3 and 6b do, in that order.

**A later lane's plan:**
- Its session starts from `main` after its dependencies merge.
- It writes `docs/superpowers/plans/2026-10-18-endless-universe-lane-<id>-<slug>.md` with superpowers:writing-plans, reading the merged lanes' Interfaces blocks.
- It commits the plan as its PR's first commit.

**The whole-route check:**
- `scripts/universe-endless-check.mjs` is created by lane 2 with the route's first steps: start, cross the old rim, cross a sector boundary, enter a generated system, climb 50,000 straight up.
- Each later lane adds its own steps and assertions: the nebula (1), a gargantuan and the dev-hook sweep of every thing (4a) and every event (4b), the arrival (4c), landing and back (5b), and the ship marker at every step (6a and 6b).

**The hand-off:** each lane's last commit updates `docs/superpowers/HANDOFF-universe.md`:
- "Landed": what it built, with paths
- "Left": what it didn't finish, and why
- the design list: the spec's path, once, added by Task 0's PR

## Done

The spec's ten "What done looks like" items each checked:
- the pure ones in `npm test`
- the rest in `scripts/universe-endless-check.mjs` and the repo's own checks, at `?quality=mid` and on the `low` tier
- the contact sheet of 24 generated planets put in front of the owner
