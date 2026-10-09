# Space Battles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every war's battles, fleets, patrols, hunters and traffic fly only that war's ships; the Venator and the TIE come from the assets repo; capital ships manoeuvre, fire broadsides and really sink by a fleet ledger every pilot shares; fighters carry their own weapons; ships break apart; the systems' standing battles run on the real engine; Republic pilots launch from a Venator's hangar.

**Architecture:** One pure table, `galaxy/roster.js`, says which side flies which ship in which war and what colour their bolts are; every table that picks a ship reads it or is held to it by `galaxy/rosterAudit.js` (tested, and printed by `scripts/roster-audit.mjs`). The battle engine (`universe/battle*.js`) gains arcs, courses on the shared clock, salvos, flak bursts and per-ship guns; a new pure `universe/battleLedger.js` replaces the director's pressure curve with a capital-ship fight stepped from the seed; drawing gains `universe/wrecks.js` over pure `universe/wreckRules.js`. Models come through `scripts/assets-fetch.mjs starwars` and new import scripts.

**Tech Stack:** three.js, Vitest in Node (no jsdom), `@gltf-transform/*` and `meshoptimizer` for imports, `playwright-core` checks against Vite.

**Spec:** `docs/superpowers/specs/2026-10-09-space-battles-design.md`

## Global Constraints

- Pure rules modules: no `three`, no DOM; chance through a `rand` argument or `seededRand` (`universe/battleKit.js`). Tests beside the file (`x.test.js`), under a second, no network (`docs/health/RULES.md`).
- Files under 800 lines. `universe/battle.js` (672) and `galaxy/world.js` (921) may not grow: what is added goes into new modules. `galaxy/scene.js` may grow by at most 20 lines net.
- No new dependencies. No paid service (no Meshy, no Sketchfab API); models only from the `sketchfab-star-wars` release, fetched by `node scripts/assets-fetch.mjs starwars <name>` into `lab/assets/starwars/` (never committed).
- No sequel trilogy ship, place or name. After Episode 6 only The Mandalorian and Ahsoka.
- The shared battle stays shared: anything that decides a battle is a function of the battle's seed, the shared clock and the tally, never of the device tier or `Math.random`.
- Sizes: a galaxy ship model under 2.5 MB (`venator.hq.glb` included); the hangar bay under 2 MB.
- Credits: every Sketchfab model in `src/data/modelCredits.json` (its test is the law) and through `scripts/credits.mjs` into `CREDITS.md`.
- Copy: British spelling, curly quotes, sentence case, no Oxford comma; toasts one sentence.
- Commits: one plain sentence about what changed, ending with the session's attribution lines. One PR per PR heading below, to `main`, merge commit after green CI; never force-push.
- PRs 4, 5, 6 and 7 change the engine the universe map's Rick and Morty and Breaking Bad wars share: before each, `node scripts/universe-war-check.mjs rm high` as well, and its shots in the PR.
- Before each PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; merge `origin/main` in first and trial-merge against open branches that touch the same files (`gh pr list`; today `claude/galaxy-solid-ships` #413 touches `battle.js`, `wars.js`, `world.js`, `setpieces.js`).

## Review Focus

1. **The unsworn pilot.** Unsworn, `current(a)` is the theatre's war with `side: null`; every by-war choice (scenery, interdiction, runners) must use that war, not fall back to the Civil War's ships. Test: Task 6, `an unsworn pilot in the Clone Wars theatre sees no TIE patrol at Yavin`.
2. **A system out of the war** (Alderaan, Dagobah: `effectsFor` → null). Its pieces must all still show and nothing may throw on a missing war. Test: Task 6, `null effects show every piece`.
3. **A late arrival in a ledger battle.** A pilot joining at 540 s must see exactly the ships the ledger has sunk by then, and none sinking a second time. Test: Task 18, `state(t) cold equals state stepped to t`.
4. **A tier change mid-battle** (the watchdog drops high to mid): wreck pools and trails must shrink without throwing or leaking slots. Test: Task 11, `the pool shrinks to the new tier, oldest first`.
5. **A model that fails to load** (the new Venator 404s or is slow): the stand-in must be a Republic ship, never the Star Destroyer, and the battle must lay out from `WIDTH`/`HULLS` regardless. Test: Task 5, `the Venator stands in as an Acclamator`.

---

## File structure

| File | Responsibility |
|---|---|
| `src/components/galaxy/roster.js` (+ test) | `SHIPS`, `LOOKS`, `RUNNERS`, `allowed`, `rosterOf`, `runnerOf`, `lookOf`, `hasRole` |
| `src/components/galaxy/rosterAudit.js` (+ test) | `kindsOfPiece`, `auditRoster()` → rows; walks every source |
| `scripts/roster-audit.mjs` | prints the audit as Markdown, exits 1 on a mix |
| `src/components/galaxy/patrols.js` (+ test) | `patrolFor(sys, war, owner, piece)` |
| `scripts/venator-import.mjs` | ForkyForklift's Venator into `hq/venator.glb` and `venator.glb` |
| `scripts/hangar-import.mjs` | ShineyFX's kit into `public/models/galaxy/hangar/venator-bay.glb` |
| `src/components/universe/wreckRules.js` (+ test) | pieces, spin, drift, pool by tier |
| `src/components/universe/wrecks.js` | three.js: cutting a model into pieces, smoke, drifting halves |
| `src/components/universe/trails.js` | instanced engine ribbons |
| `src/components/universe/battleArcs.js` (+ test) | turret facings, `inArc`, `broadsideOf` |
| `src/components/universe/battleCourses.js` (+ test) | where each capital is at clock `t` |
| `src/components/universe/battleGuns.js` (+ test) | per-ship guns, ion stun, discord, bomb, missile |
| `src/components/universe/battleLedger.js` (+ test, + `.scenario.test.js`) | the shared capital fight |
| `src/components/galaxy/liveBattle.js` (+ test) | the systems' standing battles on the engine |
| `src/components/galaxy/warpieces/launch.js` (+ test) | the Venator hangar launch |

Modified (by task): `galaxy/battles.js`, `galaxy/battlesWars.js`, `galaxy/battles.test.js`, `galaxy/warEffects.js`, `galaxy/roamRules.js`, `galaxy/hunted.js`, `galaxy/battlePlans.js`, `galaxy/fx.js`, `galaxy/models.js`, `galaxy/scene.js`, `galaxy/world.js`, `galaxy/warfront.js`, `galaxy/warpieces/index.js`, `universe/setpieces.js`, `universe/capitalRules.js`, `universe/battleCapitals.js`, `universe/battleFleet.js`, `universe/battleKit.js`, `universe/battleAi.js`, `universe/battle.js`, `universe/battleScene.js`, `universe/battleFx.js`, `universe/battleDirector.js`, `universe/battleStages.js`, `src/data/modelCredits.json`, `docs/architecture.md`.

---

## PR 1: the roster, and the mixes it finds (branch `claude/space-battles-faction-ships-d58a4d`)

### Task 1: `roster.js`

**Files:**
- Create: `src/components/galaxy/roster.js`, `src/components/galaxy/roster.test.js`

**Interfaces:**
- Consumes: `WAR_IDS`, `WARS`, `SIDES` (`galaxy/sides.js`).
- Produces:
  - `SHIPS: { [kind]: { sides: string[] | null, wars: string[], class: 'capital' | 'frigate' | 'transport' | 'shuttle' | 'fighter' | 'interceptor' | 'bomber' | 'hero' | 'civil', guns?: string[], tail?: true } }`; `sides: null` is anyone's (civilians, bounty hunters).
  - `allowed(kind, war, side) → boolean`: false for an unknown kind.
  - `rosterOf(war, side, cls) → string[]` (kinds of that class that side flies in that war, in `SHIPS` order).
  - `hasRole(war, side, kind) → boolean` (`allowed` alias kept for readability where a role is asked).
  - `RUNNERS: { evacuation: { [side]: kind }, blockade: { [side]: kind } }`; `runnerOf(battleKind, side) → kind`.
  - `LOOKS: { [side]: { laser: [r, g, b], turbo: [r, g, b] } }`; `lookOf(side) → { laser, turbo }`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { LOOKS, RUNNERS, SHIPS, allowed, lookOf, rosterOf, runnerOf } from './roster';
import { SIDES, WARS, WAR_IDS } from './sides';

describe('the roster', () => {
  it('keeps each war to its own ships', () => {
    expect(allowed('venator', 'clone', 'republic')).toBe(true);
    expect(allowed('venator', 'gcw', 'empire')).toBe(false);
    expect(allowed('interdictor', 'clone', 'separatists')).toBe(false);
    expect(allowed('gozanti', 'clone', 'separatists')).toBe(false);
    expect(allowed('transport', 'clone', 'republic')).toBe(false);
    expect(allowed('shuttle', 'clone', 'republic')).toBe(false);
    expect(allowed('tieadvanced', 'remnant', 'remnant')).toBe(false);
    expect(allowed('tiedefender', 'remnant', 'remnant')).toBe(false);
    expect(allowed('executor', 'remnant', 'remnant')).toBe(false);
    expect(allowed('vulture', 'gcw', 'separatists')).toBe(false);
    expect(allowed('ywing', 'clone', 'republic')).toBe(true);
    expect(allowed('corvette', 'clone', 'republic')).toBe(true);
    expect(allowed('razorcrest', 'remnant', null)).toBe(true);
    expect(allowed('razorcrest', 'gcw', null)).toBe(false);
    expect(allowed('nope', 'gcw', 'empire')).toBe(false);
  });
  it('lets the Hutts fly their own in every war', () => {
    for (const war of WAR_IDS) for (const k of ['gozanti', 'skiff', 'corvette']) expect(allowed(k, war, 'hutt'), `${war} ${k}`).toBe(true);
  });
  it('has fighters, an interceptor and a capital for every side of every war', () => {
    for (const w of Object.values(WARS))
      for (const side of [w.liberator, w.raider]) {
        expect(rosterOf(w.id, side, 'fighter').length, `${w.id} ${side}`).toBeGreaterThan(0);
        expect(rosterOf(w.id, side, 'capital').length, `${w.id} ${side}`).toBeGreaterThan(0);
      }
  });
  it('names runners each side may fly', () => {
    for (const w of Object.values(WARS))
      for (const side of [w.liberator, w.raider, 'hutt'])
        for (const kind of Object.keys(RUNNERS)) expect(allowed(runnerOf(kind, side), w.id, side), `${kind} ${w.id} ${side}`).toBe(true);
  });
  it('colours every side, the Republic red fighters and blue batteries', () => {
    for (const id of Object.keys(SIDES)) expect(LOOKS[id], id).toBeDefined();
    const r = lookOf('republic');
    expect(r.laser[0]).toBeGreaterThan(r.laser[2]);
    expect(r.turbo[2]).toBeGreaterThan(r.turbo[0]);
    expect(lookOf('empire').laser[1]).toBeGreaterThan(lookOf('empire').laser[0]);
  });
  it('gives every fighter class a gun list', () => {
    for (const [k, s] of Object.entries(SHIPS)) if (['fighter', 'interceptor', 'bomber'].includes(s.class)) expect(s.guns?.length, k).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/components/galaxy/roster.test.js`. Expected: FAIL, `./roster` missing.

- [ ] **Step 3: Implement** `roster.js`. A header comment in the house style (what it is, the canon it follows, the no-sequels rule). The table, in full (wars: `C` = `['clone']`, `G` = `['gcw']`, `R` = `['remnant']`, `ALL` = `WAR_IDS`):

```js
const C = ['clone'];
const G = ['gcw'];
const R = ['remnant'];
const GR = ['gcw', 'remnant'];
const ALL = ['clone', 'gcw', 'remnant'];
const REB = ['rebel', 'newrepublic'];
const IMP = ['empire', 'remnant'];
export const SHIPS = {
  // the Clone Wars
  venator: { sides: ['republic'], wars: C, class: 'capital' },
  acclamator: { sides: ['republic'], wars: C, class: 'capital' },
  arc170: { sides: ['republic'], wars: C, class: 'fighter', guns: ['laser', 'torpedo'], tail: true },
  delta7: { sides: ['republic'], wars: C, class: 'interceptor', guns: ['laser'] },
  nubian: { sides: ['republic'], wars: C, class: 'transport' },
  providence: { sides: ['separatists'], wars: C, class: 'capital' },
  lucrehulk: { sides: ['separatists'], wars: C, class: 'capital' },
  munificent: { sides: ['separatists'], wars: C, class: 'capital' },
  coreship: { sides: ['separatists'], wars: C, class: 'transport' },
  vulture: { sides: ['separatists'], wars: C, class: 'fighter', guns: ['laser'] },
  trifighter: { sides: ['separatists'], wars: C, class: 'interceptor', guns: ['laser', 'discord'] },
  // more than one war
  corvette: { sides: ['republic', ...REB, 'hutt'], wars: ALL, class: 'frigate' },
  ywing: { sides: ['republic', ...REB], wars: ALL, class: 'bomber', guns: ['laser', 'ion', 'torpedo'] },
  n1: { sides: ['republic', null], wars: ['clone', 'remnant'], class: 'fighter', guns: ['laser'] },
  // the Empire, and what's left of it
  destroyer: { sides: IMP, wars: GR, class: 'capital' },
  executor: { sides: ['empire'], wars: G, class: 'capital' },
  interdictor: { sides: IMP, wars: GR, class: 'capital' },
  lightcruiser: { sides: IMP, wars: GR, class: 'capital' },
  gozanti: { sides: [...IMP, 'hutt'], wars: ALL, class: 'frigate' },
  shuttle: { sides: [...IMP, ...REB], wars: GR, class: 'shuttle' },
  tie: { sides: IMP, wars: GR, class: 'fighter', guns: ['laser'] },
  interceptor: { sides: IMP, wars: GR, class: 'interceptor', guns: ['laser'] },
  tiebomber: { sides: IMP, wars: GR, class: 'bomber', guns: ['laser', 'bomb'] },
  tieadvanced: { sides: ['empire'], wars: G, class: 'fighter', guns: ['laser', 'missile'] },
  tiestriker: { sides: ['empire'], wars: G, class: 'fighter', guns: ['laser'] },
  tiedefender: { sides: ['empire'], wars: G, class: 'interceptor', guns: ['laser', 'ion', 'missile'] },
  // the Rebellion, and the New Republic after it
  moncal: { sides: REB, wars: GR, class: 'capital' },
  nebulon: { sides: REB, wars: GR, class: 'capital' },
  hammerhead: { sides: REB, wars: GR, class: 'frigate' },
  transport: { sides: REB, wars: GR, class: 'transport' },
  xwing: { sides: REB, wars: GR, class: 'fighter', guns: ['laser', 'torpedo'] },
  awing: { sides: REB, wars: GR, class: 'interceptor', guns: ['laser', 'missile'] },
  bwing: { sides: REB, wars: GR, class: 'bomber', guns: ['laser', 'ion', 'torpedo'] },
  uwing: { sides: REB, wars: GR, class: 'fighter', guns: ['laser'] },
  ghost: { sides: REB, wars: GR, class: 'hero', guns: ['laser'] },
  falcon: { sides: [...REB, null], wars: GR, class: 'hero', guns: ['laser'] },
  // the Hutts'
  skiff: { sides: ['hutt'], wars: ALL, class: 'fighter', guns: ['laser'] },
  // anyone's: bounty hunters, freighters, the shows' ships
  freighter: { sides: null, wars: ALL, class: 'civil' },
  slave1: { sides: null, wars: ALL, class: 'civil' },
  ig2000: { sides: null, wars: GR, class: 'civil' },
  houndstooth: { sides: null, wars: GR, class: 'civil' },
  punishingone: { sides: null, wars: GR, class: 'civil' },
  cloudcar: { sides: null, wars: ALL, class: 'civil' },
  razorcrest: { sides: null, wars: R, class: 'civil' },
  gauntlet: { sides: null, wars: ['clone', 'remnant'], class: 'civil' },
};
```

Rules: `allowed(kind, war, side)` is `!!s && s.wars.includes(war) && (s.sides === null || s.sides.includes(side) || (side === null && s.sides.includes(null)) || s.class === 'civil')`. `rosterOf` filters on `allowed` and `class`. `RUNNERS = { evacuation: { republic: 'corvette', rebel: 'transport', newrepublic: 'transport', separatists: 'coreship', empire: 'gozanti', remnant: 'gozanti', hutt: 'gozanti' }, blockade: { republic: 'corvette', rebel: 'corvette', newrepublic: 'corvette', separatists: 'coreship', empire: 'gozanti', remnant: 'gozanti', hutt: 'gozanti' } }`. `LOOKS` copies today's numbers so nothing changes colour that is right already: `rebel` and `newrepublic` `laser: [5.8, 0.75, 0.55]`, `turbo` the universe Rebels' (`universe/wars.js` `WARS.starwars.sides[0].turbo`, copy its value literally so roster.js imports nothing from the universe); `empire` and `remnant` `laser: [0.5, 5.5, 0.9]`, `turbo` the universe Empire's; `republic` `laser: [5.8, 0.75, 0.55]`, `turbo: [0.6, 2.2, 6.5]`; `separatists` `laser: [6.0, 2.5, 0.5]`, `turbo: [6.2, 0.7, 0.4]`; `hutt` `laser: [6.0, 3.0, 0.6]`, `turbo: [6.5, 3.4, 0.8]`.

- [ ] **Step 4: Run to verify pass** — same command. Expected: PASS.
- [ ] **Step 5: Commit** — `git add src/components/galaxy/roster.js src/components/galaxy/roster.test.js && git commit -m "The roster: which side flies which ship in which war, and the colour of its bolts"`

### Task 2: the audit and its script

**Files:**
- Create: `src/components/galaxy/rosterAudit.js`, `src/components/galaxy/rosterAudit.test.js`, `scripts/roster-audit.mjs`
- Modify: `src/components/galaxy/roamRules.js` (export `ROLES`, `ESCORTS`), `src/components/galaxy/battlePlans.js` (export `GIDEON`)

**Interfaces:**
- Consumes: `allowed` (Task 1); `TEMPLATES`, `HUTTS`, `BATTLE_KINDS`, `templateFor` (`battles.js`); `WAR_SYSTEMS` (`gcw.js`); `OWNERS`, `piecesShown` (`warEffects.js`); `ROLES`, `ESCORTS` (`roamRules.js`); `FACTIONS` (`hunted.js`); `GIDEON` (`battlePlans.js`); `SYSTEMS` or the list `systemById` reads (`systems.js`); `WARS` (`sides.js`).
- Produces: `kindsOfPiece(piece) → string[]` (fleet: `ships[].kind`; battle: every `sides[*][].kind` and `fighters[*][]`; patrol, depart, liftoff, escape: `kind` and `escort`; chase: `runner.kind`, `hunter.kind`; stream: `kinds`; anything else: `[]`); `auditRoster() → [{ war, side, source, kind, ok }]` with one row per kind each source names for each side of each war; `mixes() → rows.filter(r => !r.ok)`.
  - Sources, by name: `template:<sys>` (flagship, escorts, fighters, ace, by stance → the war's liberator or raider), `hutts`, `runners:<battleKind>` (for now the stance table `BATTLE_KINDS[k].runners.kind`; Task 3 switches it to `runnerOf`), `owners` (`capital`, `traffic`, `escorts`), `roles:<garrison>` (`capitalShip`, `escort`), `escorts`, `hunters:<faction>` (the `kinds` of each faction a side's `ROLES.hunt` names, and `separatists` where `effects.droids` would add it), `interdiction` (the pack of the faction the interdiction would use in that war; for now always `empire`), `ace:remnant` (`GIDEON.kind`), `scenery:<sys>` (each shown piece's kinds, for the owner of each side of the war, `piecesShown(sys, { fleet: owner, heat: 1, war })`).
  - A row is ok when `allowed(kind, war, side)`; scenery rows are ok when the kind is allowed for any side of that war, the Hutts or nobody (`null`).

- [ ] **Step 1: Write the failing test** (it fails on today's data, which is the point; Tasks 3–5 make it pass)

```js
import { describe, expect, it } from 'vitest';
import { auditRoster, kindsOfPiece, mixes } from './rosterAudit';

describe('the roster audit', () => {
  it('reads every ship a piece names', () => {
    expect(kindsOfPiece({ type: 'chase', runner: { kind: 'corvette' }, hunter: { kind: 'destroyer' } })).toEqual(['corvette', 'destroyer']);
    expect(kindsOfPiece({ type: 'escape', kind: 'transport', escort: 'xwing' })).toEqual(['transport', 'xwing']);
    expect(kindsOfPiece({ type: 'stream', kinds: ['xwing', 'ywing'] })).toEqual(['xwing', 'ywing']);
    expect(kindsOfPiece({ type: 'rocks' })).toEqual([]);
  });
  it('walks every source of every war', () => {
    const sources = new Set(auditRoster().map((r) => r.source.split(':')[0]));
    for (const s of ['template', 'hutts', 'runners', 'owners', 'roles', 'escorts', 'hunters', 'interdiction', 'ace', 'scenery']) expect(sources.has(s), s).toBe(true);
  });
  it('finds no ship flown in the wrong war or by the wrong side', () => {
    expect(mixes().map((r) => `${r.war} ${r.side} ${r.source} ${r.kind}`)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/components/galaxy/rosterAudit.test.js`. Expected: the first two PASS once the module exists; the third FAILS listing today's mixes (the Separatists' Interdictors and Gozantis, the Republic's GR-75s and Lambda, the droid hunters in the Civil War, the interdiction's TIEs in the Clone Wars, Gideon's Defender, the out-of-war scenery). Keep that list for the PR body.
- [ ] **Step 3: Write `scripts/roster-audit.mjs`**: imports `auditRoster`, prints a Markdown table per war (side, source, kinds, a ✗ on each mix), `--json` for JSON, exits 1 if any mix. Header comment says how to run it: `node scripts/roster-audit.mjs [--json]`.
- [ ] **Step 4: Run** `node scripts/roster-audit.mjs`. Expected: exit 1, the mixes listed.
- [ ] **Step 5: Commit** (the third test is red on purpose until Task 5; commit the audit with it marked `it.fails` and switch it to `it` in Task 5) — `git add -A src/components/galaxy scripts/roster-audit.mjs && git commit -m "The roster audit: every ship each war's battles, fleets, hunters and scenery name, against the roster"`

### Task 3: the battles' lines, runners and interdictions by war

**Files:**
- Modify: `src/components/galaxy/battles.js:58-81, 120-136, 239-247, 296-330`, `src/components/galaxy/battlesWars.js` (the lines `rosterAudit` names), `src/components/galaxy/battles.test.js:99-102`, `src/components/galaxy/battlePlans.js:161`, `src/components/universe/battleScene.js` (`RUNNERS` names `coreship: 'core ship'`)

**Interfaces:**
- Consumes: `runnerOf`, `lookOf`, `rosterOf` (Task 1).
- Produces: `layBattle` unchanged in shape; `laid.runners.kind` from `runnerOf(kind.id, side)`; an interdiction in a war whose raider has no `interdictor` in `rosterOf(war, raider, 'capital')` is laid as `BATTLE_KINDS.siege` (its `kind` field says `siege`); `LOOKS[side]` colours from `lookOf`.

- [ ] **Step 1: Turn the old test round and add the new ones** in `battles.test.js`:

```js
it('gives the interdiction worlds’ raider an Interdictor only where the war has one', () => {
  for (const war of WAR_IDS)
    for (const id of WAR_SYSTEMS.filter((x) => kindFor(x) === 'interdiction')) {
      const has = templateFor(id, war).dark.escorts.some((c) => c.kind === 'interdictor');
      expect(has, `${war} ${id}`).toBe(war !== 'clone');
    }
});
it('fights a Clone Wars interdiction as a siege', () => {
  const sys = systemById(WAR_SYSTEMS.find((x) => kindFor(x) === 'interdiction'));
  const laid = layBattle(sys, { war: 'clone', attacker: 'republic', defender: 'separatists', seed: 's' }, { tier: 'low' });
  expect(laid.kind).toBe('siege');
  expect(laid.objectivesOn).toBe('flagship');
});
it('runs each side’s own runners', () => {
  // an evacuation the Republic defends runs CR90s; a blockade the Separatists run, core ships
  expect(runnersOf('clone', 'evacuation', 'republic')).toBe('corvette');
  expect(runnersOf('clone', 'blockade', 'separatists')).toBe('coreship');
  expect(runnersOf('gcw', 'evacuation', 'rebel')).toBe('transport');
});
```

`runnersOf(war, kindId, side)` is a three-line helper in the test that lays a battle at the first system of that kind with that side on the runners' team and returns `laid.runners.kind` (copy the `layBattle` call shape from the nearest existing `layBattle` test in the file; check its `battle` argument for the real field names before writing it).

- [ ] **Step 2: Run** — `npx vitest run src/components/galaxy/battles.test.js`. Expected: the three FAIL.
- [ ] **Step 3: Implement**:
  - `battles.js` `BATTLE_KINDS`: drop `runners.kind` (the stance table); `layBattle` reads `runnerOf(kind.id, sides[team])`; add `coreship: m(900)` to `SIZE` (the `m()` helper's metres) if it is not there.
  - `layBattle`: `const raider = WARS[warId].raider; const kind0 = BATTLE_KINDS[battle.kind] ?? BATTLE_KINDS[kindFor(sys.id)]; const kind = kind0.id === 'interdiction' && !rosterOf(warId, raider, 'capital').includes('interdictor') ? BATTLE_KINDS.siege : kind0;`
  - `DEFAULT.clone.dark.escorts`: the `interdictor` becomes `munificent`.
  - `battlesWars.js`: every `interdictor` and `gozanti` in a Clone Wars `dark` line becomes `munificent` (the second of two in a line becomes `providence`); every `transport` in a Clone Wars `light` line becomes `corvette`, an evacuation's third becomes `acclamator`. Edit only what `node scripts/roster-audit.mjs` names.
  - `LOOKS`: each side's `laser`/`turbo` from `lookOf(side)`; the Rebels' and the Empire's `colour` stays the universe's.
  - `battlePlans.js:161`: `GIDEON = { kind: 'tie', name: 'Moff Gideon’s TIE fighter', hp: 14 }`.
- [ ] **Step 4: Run** — `npx vitest run src/components/galaxy src/components/universe/battleScene.test.js`. Expected: PASS (fix any other test that pinned a Clone Wars Interdictor or Gozanti by asking for the roster's ship instead).
- [ ] **Step 5: Commit** — `git commit -am "Clone Wars lines fly Clone Wars ships: no Interdictors or Gozantis with the droids, no GR-75s with the Republic; runners by side; a Clone Wars interdiction is fought as a siege; Gideon flies his TIE"`

### Task 4: owners, hunters and the hyperspace interdiction by war

**Files:**
- Modify: `src/components/galaxy/warEffects.js:37-45, 53-80`, `src/components/galaxy/warEffects.test.js`, `src/components/galaxy/roamRules.js`, `src/components/galaxy/scene.js:1325-1340, 1360-1366`, `src/components/galaxy/interdiction.js` (a pure `interdictionFor(war)`), `src/components/galaxy/interdiction.test.js`, `src/components/galaxy/rosterAudit.js` (`interdiction` source from `interdictionFor`)

**Interfaces:**
- Consumes: `allowed` (Task 1), `current(a)` (`allegiance.js`: `{ war, side, … }`).
- Produces: `effectsFor(...)` adds `war` (`current?.war ?? DEFAULT_WAR`) and sets `droids` only when `war === 'clone'`; `interdictionFor(war) → 'empire' | 'remnant' | null` (`gcw` → `'empire'`, `remnant` → `'remnant'`, `clone` → `null`).

- [ ] **Step 1: Failing tests**

```js
// warEffects.test.js
it('sends the droids hunting only in the Clone Wars', () => {
  const sep = SYSTEMS_LIST.find((s) => s.faction === 'separatists').id; // (whatever this file already uses to name a Separatist world)
  for (const war of ['gcw', 'remnant']) expect(effectsFor(sep, tableWith(sep, WARS[war].liberator), { war, side: null }).droids, war).toBe(false);
  expect(effectsFor(sep, tableWith(sep, 'republic'), { war: 'clone', side: null }).droids).toBe(true);
});
it('flies no Lambda for the Republic', () => expect(OWNERS.republic.traffic).not.toContain('shuttle'));
// interdiction.test.js
it('is the Empire’s in the Civil War, the Remnant’s after, and nobody’s in the Clone Wars', () => {
  expect(interdictionFor('gcw')).toBe('empire');
  expect(interdictionFor('remnant')).toBe('remnant');
  expect(interdictionFor('clone')).toBeNull();
});
```

(`tableWith(sysId, owner)` is a two-line helper building `{ systems: [{ id, owner, front: true }] }`; reuse the file's own if it has one.)

- [ ] **Step 2: Run** — `npx vitest run src/components/galaxy/warEffects.test.js src/components/galaxy/interdiction.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**: `OWNERS.republic.traffic = ['arc170', 'acclamator', 'corvette']`; `effectsFor` as above; `interdictionFor` in `interdiction.js`; in `scene.js`, where `interdiction.jumped(...)` gives `verdict.interdicted` (line ~1363), skip the bite when `interdictionFor(allegiance war) === null`, and `bite()` sets `faction: interdictionFor(war)` instead of the system's faction. Read the war the way `scene.js:294` does (`a?.war`). Net lines in `scene.js`: at most +4.
- [ ] **Step 4: Run** — `npx vitest run src/components/galaxy`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "Owners, hunters and interdictions by war: no Lambda for the Republic, the droids hunt only in the Clone Wars, and an Interdictor waits only where the Empire or the Remnant has one"`

### Task 5: one colour table, the drop-in's own guns, a Republic stand-in

**Files:**
- Modify: `src/components/galaxy/fx.js:14-23`, `src/components/galaxy/hunted.js:22-38`, `src/components/galaxy/models.js:176`, `src/components/galaxy/models.test.js`, `src/components/universe/setpieces.js:67, 216, 502`, `src/components/universe/capitalRules.js:68` (`PARTS.venator`, `PARTS.moncal`), `src/components/universe/capitalRules.test.js`, `src/components/galaxy/rosterAudit.test.js` (`it.fails` → `it`)

**Interfaces:**
- Consumes: `lookOf` (Task 1).
- Produces: `fx.js` `LASER.<side>` from `lookOf(side).laser` for the six war sides (`separatist` kept as an alias of `separatists`; `mandalorian`, `naboo`, `ion` stay literal); `hunted.js` factions' `laser` from `lookOf`; `STAND_IN.venator = 'acclamator'`; `setpieces.js` `BOLT_COLOR.venator = [0.6, 2.2, 6.5]`, `BOLT_COLOR.moncal = [5.8, 0.75, 0.55]`; `PARTS.venator` (two shield domes atop the twin bridge towers, the bridge between them, the reactor aft) and `PARTS.moncal` (domes amidships, bridge forward, reactor aft), positions as shares of length read off the models with `scripts/glb-shot.mjs` top and side views.

- [ ] **Step 1: Failing tests**

```js
// models.test.js
it('stands the Venator in as an Acclamator, a Republic ship', () => expect(STAND_IN.venator).toBe('acclamator'));
// capitalRules.test.js
it('lays a Venator and a Mon Cal out on their own parts', () => {
  expect(PARTS.venator).toBeDefined();
  expect(PARTS.moncal).toBeDefined();
  expect(PARTS.venator.shields.length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run** — `npx vitest run src/components/galaxy/models.test.js src/components/universe/capitalRules.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** as in Interfaces. For the Venator's parts: open `public/models/universe/venator.glb` with `node scripts/glb-shot.mjs public/models/universe/venator.glb /tmp/v.png top,side` (dev server on 5188 first: `npx vite --port 5188`) and read the towers' and the dome's positions off the picture as shares of its length; the same for `public/models/galaxy/moncal.glb`.
- [ ] **Step 4: Run** — `npm test` and `node scripts/roster-audit.mjs`. Expected: PASS; the audit exits 0. (If scenery rows still fail, they are PR 2's: mark only the scenery rows `skip` in `mixes()` with a `// PR 2` comment for this PR, and say so in the PR body.)
- [ ] **Step 5: Browser check** — dev server up, then `OUT=docs/superpowers/evidence/space-battles/pr1 SIDE=republic node scripts/galaxy-war-check.mjs coruscant high` (set `CHROME` to the Playwright Chromium per the memory recipe, with `--use-angle=metal`). Look at the shots: no Imperial ship in the Clone Wars battle; Republic bolts red, batteries blue.
- [ ] **Step 6: Commit and open PR 1** — `git commit -am "One colour table for every side, the Venator and Mon Cal drop in on their own parts and fire their own colours, and the Venator stands in as a Republic ship"`; push, PR titled "Space battles 1: each war flies its own ships", body: the audit table before and after, the shots.

---

## PR 2: the scenery belongs to the war you are in (branch `claude/space-battles-scenery`)

### Task 6: `piecesShown` by war

**Files:**
- Modify: `src/components/galaxy/warEffects.js:83-90`, `src/components/galaxy/warEffects.test.js`, `src/components/galaxy/systems.js` (a `wars` field on the film moments: Tatooine's chase at `:161`, Endor's battle at `:262`, Hoth's escape at `:214`, any piece the audit flags that is a film moment), `src/components/galaxy/rosterAudit.js` (remove the PR 1 skip)

**Interfaces:**
- Consumes: `allowed` (Task 1), `kindsOfPiece` (Task 2), `effects.war` (Task 4).
- Produces: `piecesShown(sys, effects)` → for each piece, `false` if `effects` is set and either `p.wars` excludes `effects.war` or some kind in `kindsOfPiece(p)` is not allowed in `effects.war` for any of `WARS[war].liberator`, `WARS[war].raider`, `'hutt'`, `null`; otherwise today's rule (fleets for their holder, battles while fought over).

- [ ] **Step 1: Failing tests**

```js
it('hides another war’s ships', () => {
  const yavin = systemById('yavin');
  const shown = piecesShown(yavin, { fleet: 'republic', heat: 0, war: 'clone' });
  yavin.pieces.forEach((p, i) => { if (p.type === 'patrol' && p.kind === 'tie') expect(shown[i]).toBe(false); });
});
it('shows a film moment only in its war', () => {
  const t = systemById('tatooine');
  const i = t.pieces.findIndex((p) => p.type === 'chase');
  expect(piecesShown(t, { fleet: 'hutt', heat: 0, war: 'gcw' })[i]).toBe(true);
  expect(piecesShown(t, { fleet: 'hutt', heat: 0, war: 'remnant' })[i]).toBe(false);
});
it('null effects show every piece', () => {
  for (const id of ['yavin', 'tatooine', 'endor']) expect(piecesShown(systemById(id), null).every(Boolean)).toBe(true);
});
it('an unsworn pilot in the Clone Wars theatre sees no TIE patrol at Yavin', () => {
  const e = effectsFor('yavin', tableWith('yavin', 'separatists'), { war: 'clone', side: null });
  const yavin = systemById('yavin');
  const shown = piecesShown(yavin, e);
  expect(yavin.pieces.some((p, i) => shown[i] && kindsOfPiece(p).includes('tie'))).toBe(false);
});
```

- [ ] **Step 2: Run** — `npx vitest run src/components/galaxy/warEffects.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**, then tag the moments in `systems.js` with `wars: ['gcw']` (Tatooine's chase, Endor's battle, Hoth's escape) — check each against the audit's scenery rows.
- [ ] **Step 4: Run** — `npx vitest run src/components/galaxy && node scripts/roster-audit.mjs`. Expected: PASS, exit 0 with no skips.
- [ ] **Step 5: Commit** — `git commit -am "The systems' fleets, patrols and chases show only in the war their ships fly in, and the films' moments only in their film's war"`

### Task 7: the holder's own patrol where another war's is hidden

**Files:**
- Create: `src/components/galaxy/patrols.js`, `src/components/galaxy/patrols.test.js`
- Modify: `src/components/galaxy/world.js` (the `patrol` builder factored into `buildPatrol(p) → { holders, tick, dispose }`, and `setEffects` making and dropping the replacement patrols alongside `garrison`)

**Interfaces:**
- Consumes: `rosterOf` (Task 1), `piecesShown` (Task 6).
- Produces: `patrolFor(sys, war, owner, piece) → { ...piece, kind } | null`: the owner's first `rosterOf(war, owner, 'fighter')` kind, the piece's path, count and size kept; null when the owner flies no fighter (the Hutts' skiff is fine) or the piece was not a patrol. `replacementPatrols(sys, effects) → [{ index, piece }]` for every patrol `piecesShown` hides for its war.

- [ ] **Step 1: Failing test**

```js
it('puts the holder’s fighters on a hidden patrol’s path', () => {
  const yavin = systemById('yavin');
  const rep = replacementPatrols(yavin, { fleet: 'republic', heat: 0, war: 'clone' });
  expect(rep.length).toBeGreaterThan(0);
  expect(rep[0].piece.kind).toBe('arc170');
  expect(rep[0].piece.at).toEqual(yavin.pieces[rep[0].index].at);
});
it('makes none where the patrol already flies in this war', () => {
  expect(replacementPatrols(systemById('yavin'), { fleet: 'empire', heat: 0, war: 'gcw' })).toEqual([]);
});
```

- [ ] **Step 2: Run** — `npx vitest run src/components/galaxy/patrols.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `patrols.js`; in `world.js`, factor the patrol builder (find it with `grep -n "patrol(p" src/components/galaxy/world.js`) into `buildPatrol` without changing what it draws, and in `setEffects` keep `garrison.patrols` keyed by `index:kind`, made and disposed as `garrison.slots` are. `world.js` must not grow: move the patrol builder itself into `patrols.js`'s drawing half (`buildPatrol` there, three.js allowed in that function only: split as `patrols.js` pure + `patrolDraw.js` if lint or the purity test minds).
- [ ] **Step 4: Run** — `npx vitest run src/components/galaxy`. Then the browser: `OUT=docs/superpowers/evidence/space-battles/pr2 SIDE=republic node scripts/galaxy-war-check.mjs yavin high`; look for ARC-170s on the patrol path and no TIEs.
- [ ] **Step 5: Commit and open PR 2** — `git commit -am "Where another war's patrol is hidden, the holder's own fighters fly its path"`; PR "Space battles 2: the scenery belongs to the war you are in".

---

## PR 3: the Venator and the TIE from the assets repo (branch `claude/space-battles-models`)

### Task 8: `scripts/venator-import.mjs`

**Files:**
- Create: `scripts/venator-import.mjs`
- Create (outputs): `public/models/galaxy/hq/venator.glb`, `public/models/galaxy/lod/hq/venator.glb`; maybe `public/models/universe/venator.glb` (replaced only if Task 10's comparison says so)

**Interfaces:**
- Consumes: `lab/assets/starwars/venator.glb` (`node scripts/assets-fetch.mjs starwars venator`).
- Produces: `node scripts/venator-import.mjs [--tris 60000] [--atlas 2048] [--out public/models/galaxy/hq/venator.glb]`, printing triangles, maps, bytes and the size in metres; nose and length matching today's `venator.glb` (longest side 1.9 m in the file, nose along +x as `MODELS.venator.nose = π/2` expects; check with `glb-shot`).

- [ ] **Step 1: Fetch and measure** — `node scripts/assets-fetch.mjs starwars venator`, then list its primitives (name, material, triangles, bounding box) with a throwaway `node -e` over `@gltf-transform/core` into the scratchpad. Note which are interior (the hangar's floor and walls: inside the hull's bounding box shrunk by 5%, and facing inward) and the greeble sets.
- [ ] **Step 2: Write the script**: read; `dedup`, `metalRough`, `prune`; drop the primitives named in Step 1 as interior (by material name list, kept in the script with a comment); `join` by material; `weld`; `simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.02, lockBorder: false })` until under `--tris`; bake the maps into one atlas when `--atlas` is given (`textureCompress` to WebP, `resize: [1024, 1024]` for the three body maps, `[256, 256]` for the rest); centre and scale as `sketchfab-import.mjs` does (`--size 1.9`); `meshopt` at `medium`; write.
- [ ] **Step 3: Run it** for the high cut. Expected: under 2.5 MB and 60k triangles. If not, lower `--tris` to 45000 and the greeble maps to 128; if still over, record the numbers and stop this task with the PR body saying why (the spec's fallback).
- [ ] **Step 4: Make its far copy** — `node scripts/galaxy-lod.mjs hq/venator`. Expected: `public/models/galaxy/lod/hq/venator.glb`, about 4,000 triangles.
- [ ] **Step 5: Commit** — `git add scripts/venator-import.mjs public/models/galaxy/hq/venator.glb public/models/galaxy/lod/hq/venator.glb && git commit -m "ForkyForklift's Venator, cut down for the galaxy's high detail"`

### Task 9: the TIE fighter and the hangar bay

**Files:**
- Create: `scripts/hangar-import.mjs`, `public/models/galaxy/hangar/venator-bay.glb`; maybe `public/models/galaxy/tie.glb` (replaced only if Task 10 says so)

**Interfaces:**
- Consumes: `lab/assets/starwars/tie-fighter.glb`, `lab/assets/starwars/venator-clone-wars.glb`.
- Produces: `public/models/galaxy/hangar/venator-bay.glb`: one bay, the floor at y = 0, the door along −z, 31 m wide in metres (as the kit is), under 2 MB; the TIE candidate at `lab/swcmp/tie.glb` (12–13k triangles, 1024 maps, under 400 KB) for Task 10.

- [ ] **Step 1: TIE** — `node scripts/sketchfab-import.mjs lab/assets/starwars/tie-fighter.glb lab/swcmp/tie.glb --tris 12000 --tex 1024`. Expected: about 12.7k triangles, about 320 KB. Turn its nose to match today's `tie.glb` (`MODELS.tie.nose`) by checking both in `glb-shot`.
- [ ] **Step 2: Hangar** — write `hangar-import.mjs`: keep the floor, one run of wall panels each side, the large door and the wall lights (by material name: `Venator_Floor`, `VenatorV3_WallPanels`, `VenatorV3_LargeDoor`, `VenatorV3_SmallDoor_WallLight`), simplify to 40k triangles, maps to 1024 WebP, meshopt. Run it. Expected: under 2 MB.
- [ ] **Step 3: Commit** — `git add scripts/hangar-import.mjs public/models/galaxy/hangar/venator-bay.glb && git commit -m "One Venator hangar bay from ShineyFX's Clone Wars kit"`

### Task 10: compare in the battle, wire what wins, credit it

**Files:**
- Modify: `src/components/galaxy/models.js:133-136` (`HQ.venator`), maybe `public/models/universe/venator.glb`, `public/models/galaxy/tie.glb`, `public/models/galaxy/lod/tie.glb`; `src/data/modelCredits.json`; `CREDITS.md` (via `node scripts/credits.mjs`); `src/components/galaxy/models.test.js`

**Interfaces:**
- Produces: `HQ.venator = { url: '/models/galaxy/hq/venator.glb', nose: <as measured> }`; credits rows `galaxy-venator-hq` (ForkyForklift, CC BY 4.0, "the Republic's Venators, close up"), `galaxy-hangar-venator` (ShineyFX, CC BY 4.0, "the Venator's hangar"), and, if the TIE wins, `galaxy-tie` rewritten to Mickael Boitte's.

- [ ] **Step 1: Failing test**

```js
it('has a close-up cut of the Venator on strong graphics', () => {
  expect(HQ.venator?.url).toBe('/models/galaxy/hq/venator.glb');
  expect(withHq(MODELS, 'high').venator.hq).toBe(true);
  expect(withHq(MODELS, 'mid').venator.hq).toBeUndefined();
});
```

- [ ] **Step 2: Run** — `npx vitest run src/components/galaxy/models.test.js`. Expected: FAIL. **Step 3:** add `HQ.venator`. **Step 4:** run again, PASS.
- [ ] **Step 5: Compare** — sheets: `node scripts/glb-shot.mjs public/models/universe/venator.glb docs/superpowers/evidence/space-battles/pr3/venator-old.png three,side,top` and the same for the new cut; in the battle: `OUT=docs/superpowers/evidence/space-battles/pr3 SIDE=republic node scripts/galaxy-war-check.mjs coruscant high`, before (stash the `HQ` line in a WIP commit) and after. The same for the TIE at Endor as the Rebellion with `lab/swcmp/tie.glb` copied over `public/models/galaxy/tie.glb` (and `node scripts/galaxy-lod.mjs tie`). Keep the new one only where it reads better at battle range; revert the TIE files if not.
- [ ] **Step 6: Credits** — add the rows to `modelCredits.json` (copy the release README's title, author, author URL, licence and source), run `node scripts/credits.mjs`, run `npx vitest run src/data` (the credits test). Expected: PASS.
- [ ] **Step 7: Commit and open PR 3** — `git commit -am "The Venator's close-up cut from the assets repo on high and ultra; the TIE where it reads better; credited"`; PR body: the sheets and battle shots side by side, sizes and triangles.

---

## PR 4: things break (branch `claude/space-battles-wrecks`)

### Task 11: `wreckRules.js`

**Files:**
- Create: `src/components/universe/wreckRules.js`, `src/components/universe/wreckRules.test.js`

**Interfaces:**
- Produces:
  - `WRECKS = { pool: { ultra: 24, high: 24, mid: 12, low: 6 }, life: 6, pieces: [3, 5], spin: [0.6, 2.4], spread: 0.35, smoke: 0.5 }`.
  - `breakUp(f, rand) → [{ vel: {x,y,z}, spin: {x,y,z}, plane: { n: {x,y,z}, d }, smoke: boolean }]` for a fighter `f` (`{ pos, vel, size }`): 3–5 pieces, each the fighter's velocity plus a spread, a spin, the cutting plane (unit normal through the middle, varied by `rand`), the biggest one smoking.
  - `createPool(tier) → { add(w) → evicted | null, live(), setTier(tier) → evicted[], step(dt) → expired[] }`: oldest out first.
  - `drift(cap, rand) → { vel, spin }` for a lost capital's halves (slow, ±0.4 units a second, ≤0.05 rad a second).

- [ ] **Step 1: Failing tests**

```js
import { describe, expect, it } from 'vitest';
import { WRECKS, breakUp, createPool, drift } from './wreckRules';
import { seededRand } from './battleKit';

describe('wrecks', () => {
  it('breaks a fighter into three to five pieces that carry its speed', () => {
    const r = seededRand('w');
    for (let i = 0; i < 20; i++) {
      const p = breakUp({ pos: { x: 0, y: 0, z: 0 }, vel: { x: 10, y: 0, z: 0 }, size: 0.3 }, r);
      expect(p.length).toBeGreaterThanOrEqual(3);
      expect(p.length).toBeLessThanOrEqual(5);
      expect(p.filter((x) => x.smoke)).toHaveLength(1);
      for (const x of p) expect(x.vel.x).toBeGreaterThan(5);
    }
  });
  it('the pool shrinks to the new tier, oldest first', () => {
    const pool = createPool('high');
    for (let i = 0; i < WRECKS.pool.high; i++) pool.add({ id: i });
    expect(pool.add({ id: 99 })).toEqual({ id: 0 });
    const out = pool.setTier('low');
    expect(out.map((w) => w.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(pool.live()).toHaveLength(WRECKS.pool.low);
  });
  it('expires a wreck after its life', () => {
    const pool = createPool('mid');
    pool.add({ id: 1 });
    expect(pool.step(WRECKS.life + 0.1).map((w) => w.id)).toEqual([1]);
  });
  it('lets a lost capital drift slowly', () => {
    const d = drift({ fwd: { x: 0, y: 0, z: 1 } }, seededRand('d'));
    expect(Math.hypot(d.vel.x, d.vel.y, d.vel.z)).toBeLessThanOrEqual(0.4);
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/components/universe/wreckRules.test.js`. Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** — `git add src/components/universe/wreckRules* && git commit -m "Wreck rules: a fighter's pieces, their spin and drift, and a pool sized by tier"`

### Task 12: `wrecks.js` and `trails.js`, drawn

**Files:**
- Create: `src/components/universe/wrecks.js`, `src/components/universe/trails.js`
- Modify: `src/components/universe/battleScene.js` (`down`, `capital` events; the flagship's `breakUp` generalised to any capital lost), `src/components/universe/battleScene.test.js`

**Interfaces:**
- Consumes: `breakUp`, `createPool`, `drift` (Task 11); `models.slot(kind, size)` (galaxy `models.js`); `createFires` (`battleFx.js`).
- Produces: `createWrecks(parent, { models, tier, reduced }) → { fighter(kind, at, vel, size), capital(cap, slot), setTier(tier), update(dt, camera), dispose() }` (a fighter's pieces are its LOD slot cloned per piece with a clipping plane each, the clone cached per kind; smoke is instanced billboards); `createTrails(parent, { count }) → { update(ships, camera), dispose() }` (one instanced ribbon a ship within 40 units of the camera, the engine colour, 12 segments).
  - With `reduced`, `fighter` and `capital` do nothing (the flash stays).

- [ ] **Step 1: Failing test** in `battleScene.test.js` (it draws into a `THREE.Group` in Node as the file's tests already do):

```js
it('leaves wreck pieces where a fighter went down, and keeps a lost escort’s halves', () => {
  const { scene, battle } = drawn(); // (the file's own helper that shows a battle; reuse it)
  scene.update(0.1, 0, camera, camera.position, [{ type: 'down', team: 1, kind: 'tie', role: 'fighter', at: { x: 0, y: 0, z: 0 } }], 0);
  expect(scene.wrecks.live().length).toBeGreaterThanOrEqual(3);
  const esc = battle.capitals.find((c) => c.role === 'escort');
  scene.update(0.1, 0.1, camera, camera.position, [{ type: 'capital', id: esc.id, kind: esc.kind, team: esc.team, at: esc.pos }], 0);
  expect(scene.halves.length).toBe(2);
});
```

- [ ] **Step 2: Run** — expected FAIL. **Step 3: Implement** `wrecks.js`, `trails.js` (and, for a turbolaser `impact` on a capital's hull, a dark scorch sprite left on the hull beside `createFires`' fire, pooled with the fires); in `battleScene.js` call `wrecks.fighter` on `down` and `wrecks.capital` on `capital` (the existing flagship `breakUp` moves into `wrecks.capital` so `battleScene.js` shrinks), `trails.update` each frame with the visible fighters; expose `wrecks` on the returned object for the test. **Step 4: Run** — PASS.
- [ ] **Step 5: Browser** — `OUT=docs/superpowers/evidence/space-battles/pr4 SIDE=rebel node scripts/galaxy-war-check.mjs endor high`; freeze a wreck by the memory's step-hold recipe and screenshot it; check frame time against PR 3's run (within 10%).
- [ ] **Step 6: Commit and open PR 4** — `git commit -am "Fighters break into tumbling, smoking pieces, lost capital ships break in two and drift for the rest of the battle, and fighters near you leave engine trails"`; PR "Space battles 4: things break".

---

## PR 5: capital ships that fight like capital ships (branch `claude/space-battles-capitals`)

### Task 13: `battleArcs.js`

**Files:**
- Create: `src/components/universe/battleArcs.js`, `src/components/universe/battleArcs.test.js`
- Modify: `src/components/universe/battleCapitals.js` (each turret gets `normal` from `facingOf`; `fireBatteries` skips a target outside `inArc`)

**Interfaces:**
- Consumes: `TURRETS` (`wars.js`: `[[x, y, z], …]` as shares of length in the ship's frame), `place` (`battleCapitals.js`).
- Produces: `facingOf(l) → { x, y, z }` (unit, in the ship's frame: `x` sign for port/starboard where `|x| ≥ |y|`, else `y` sign for dorsal/ventral); `ARC = Math.cos((120 * Math.PI) / 180)`; `inArc(tu, cap, at) → boolean` (the turret's normal turned into the battle by `cap.right/up/fwd`, dotted with the unit way to `at`, ≥ `ARC`); `broadsideOf(cap) → { x, y, z }` (the battle-frame normal shared by the most turrets).

- [ ] **Step 1: Failing tests**

```js
it('faces a turret out from where it sits', () => {
  expect(facingOf([0.3, 0.05, 0.1])).toEqual({ x: 1, y: 0, z: 0 });
  expect(facingOf([-0.2, 0.01, 0])).toEqual({ x: -1, y: 0, z: 0 });
  expect(facingOf([0.02, 0.2, 0])).toEqual({ x: 0, y: 1, z: 0 });
});
it('fires only inside its arc', () => {
  const cap = { right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, fwd: { x: 0, y: 0, z: 1 } };
  const tu = { at: { x: 1, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 } };
  expect(inArc(tu, cap, { x: 50, y: 0, z: 0 })).toBe(true);
  expect(inArc(tu, cap, { x: -50, y: 0, z: 0 })).toBe(false);
});
```

- [ ] **Step 2–4:** run (FAIL), implement, run (PASS). Then `npx vitest run src/components/universe` — the battle tests that count turbolaser hits may need a looser count; change a number only with a comment saying arcs now hold fire.
- [ ] **Step 5: Commit** — `git commit -am "A capital ship's turrets fire only inside their arcs"`

### Task 14: `battleCourses.js`: where each capital is, on the shared clock

**Files:**
- Create: `src/components/universe/battleCourses.js`, `src/components/universe/battleCourses.test.js`
- Modify: `src/components/universe/battleFleet.js:36-45, 125-145` (the push becomes the third leg of a course; `step` reads `courseAt`)

**Interfaces:**
- Consumes: `broadsideOf` (Task 13), `FLEET` (`battleFleet.js`), `shiftCapital`, `turnCapitalBy`.
- Produces: `COURSE = { close: 90, speed: 1.2, swing: (70 * Math.PI) / 180, swingFor: 30 }`; `courseAt(cap, t, focusAt) → { advanced, swung }` (pure: how far forward and how far turned a ship should be at clock `t`: the attacker's line closes `speed` units a second until `close`; from `close` every free escort swings toward putting `broadsideOf(cap)` on `focusAt`, up to `swing`, over `swingFor` seconds; the final push as today on top); `battleFleet.step` moves each free ship by the difference between `courseAt` and what it has done (`cap.advanced`, `cap.swung`), as the push does now, and calls `onMove`.

- [ ] **Step 1: Failing tests**

```js
it('closes, then turns its broadside on the focus', () => {
  const cap = laidEscort(); // (a helper: one escort laid by layCapitals in a two-ship battle)
  expect(courseAt(cap, 0, FOCUS).advanced).toBe(0);
  expect(courseAt(cap, COURSE.close, FOCUS).advanced).toBeCloseTo(COURSE.close * COURSE.speed, 5);
  expect(Math.abs(courseAt(cap, COURSE.close + COURSE.swingFor, FOCUS).swung)).toBeGreaterThan(0.5);
});
it('a late arrival sees the ships where one there all along does', () => {
  const a = battleAt(400); // stepped from 0 to 400 s
  const b = battleCold(400); // created with elapsed 400
  for (let i = 0; i < a.capitals.length; i++) expect(a.capitals[i].pos.x).toBeCloseTo(b.capitals[i].pos.x, 3);
});
```

- [ ] **Step 2–4:** FAIL, implement, PASS; the existing `battleFleet.test.js` push tests keep passing (the push is the same numbers, now after the swing).
- [ ] **Step 5: Commit** — `git commit -am "Capital ships close, then come round to bring their broadsides on their target, on the clock every pilot shares"`

### Task 15: salvos and flak bursts

**Files:**
- Modify: `src/components/universe/battleCapitals.js` (`fireBatteries`), `src/components/universe/battleKit.js` (`BATTLE.salvo = { ripple: 0.3, reload: [2.5, 4] }`, `BATTLE.burst = 1.5`), `src/components/universe/battle.js` (a flak bolt bursts: in `moveBolts`, a flak bolt within `BATTLE.burst` of an enemy fighter, or at the end of its life, hurts every enemy fighter within `BATTLE.burst` and pushes a `{ type: 'burst', at }` event; keep `battle.js` from growing by moving `moveBolts`' flak branch into `battleCapitals.js` as `burstFlak(k, o, out)`), `src/components/universe/battleScene.js` (a `burst` is a dark puff with a flash: `flashes.at` with a dim warm colour and a short-lived smoke sprite from `wrecks`' smoke), `src/components/universe/battle.test.js`

**Interfaces:**
- Produces: a battery's turrets on one ship fire within `ripple` of each other at one target, then wait `reload`; `{ type: 'burst', at }` events.

- [ ] **Step 1: Failing tests**

```js
it('fires a ship’s guns in salvos', () => {
  const shots = turboTimes(battleWithTwoCapitals(), 10); // seconds each turbo bolt left, over 10 s, for the first ship
  const groups = clusters(shots, BATTLE.salvo.ripple);
  expect(groups.length).toBeGreaterThan(1);
  expect(Math.min(...gaps(groups))).toBeGreaterThanOrEqual(BATTLE.salvo.reload[0] - 0.05);
});
it('bursts flak near a fighter and hurts what is round it', () => {
  const { b, events } = flakAt(fighterNear(battle(), 1.0));
  expect(events.some((e) => e.type === 'burst')).toBe(true);
});
```

(`turboTimes`, `clusters`, `gaps`, `flakAt`, `fighterNear` are small helpers in the test file; write them from the battle's `fire` hook: wrap `b.fire` to record `{ t: b.clock, kind }`.)

- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: Browser and PR 5** — Coruscant (Clone Wars) and Endor (Civil War) shots of a broadside mid-salvo; frame time within 10%. `git commit -am "Batteries fire in salvos, and flak bursts round the fighters"`; PR "Space battles 5: broadsides".

---

## PR 6: weapons per ship (branch `claude/space-battles-guns`)

### Task 16: `battleGuns.js`

**Files:**
- Create: `src/components/universe/battleGuns.js`, `src/components/universe/battleGuns.test.js`
- Modify: `src/components/universe/battleKit.js` (`BATTLE.bolts.ion = { speed: 50, life: 0.6, damage: 0.3 }`, `missile = { speed: 40, life: 1.5, damage: 3 }`, `bomb = { speed: 12, life: 5, damage: 14 }`, `discord = { speed: 35, life: 1, damage: 0 }`; `BATTLE.stun = { fighter: 1.5, turret: 4 }`, `BATTLE.discord = { secs: 4, dps: 0.8 }`; `hullShare` and `youHurt` rows for each)

**Interfaces:**
- Consumes: `SHIPS` (`galaxy/roster.js`) passed in as a `guns` table by the caller (the universe must not import the galaxy: `createBattle({ …, guns })`, `warfront.js` passes `Object.fromEntries(Object.entries(SHIPS).map(([k, s]) => [k, s.guns]))`; the universe's own wars pass nothing and keep the laser and torpedo).
- Produces: `gunFor(f, target, guns) → 'laser' | 'ion' | 'missile' | 'torpedo' | 'bomb' | 'discord'` (bomb and torpedo only at capitals or their parts; ion at a capital's shields or a fighter that is fleeing; missile at a fighter beyond 6 units; discord at a fighter within 5; else laser); `stun(f, secs)`; `stuck(f, dt) → boolean` (discord ticking; true when it has finished the fighter).

- [ ] **Step 1: Failing tests**

```js
it('picks the gun for the target', () => {
  const guns = { ywing: ['laser', 'ion', 'torpedo'], awing: ['laser', 'missile'], tiebomber: ['laser', 'bomb'], trifighter: ['laser', 'discord'], tie: ['laser'] };
  expect(gunFor({ kind: 'tiebomber' }, CAPITAL, guns)).toBe('bomb');
  expect(gunFor({ kind: 'ywing' }, CAPITAL_SHIELDED, guns)).toBe('ion');
  expect(gunFor({ kind: 'awing', pos: P0 }, fighterAt(10), guns)).toBe('missile');
  expect(gunFor({ kind: 'trifighter', pos: P0 }, fighterAt(3), guns)).toBe('discord');
  expect(gunFor({ kind: 'tie', pos: P0 }, fighterAt(10), guns)).toBe('laser');
  expect(gunFor({ kind: 'xwing' }, fighterAt(10), {})).toBe('laser');
});
it('an ion hit stuns a fighter a while', () => {
  const f = { stunned: 0 };
  stun(f, BATTLE.stun.fighter);
  expect(f.stunned).toBe(BATTLE.stun.fighter);
});
it('a discord droid finishes a fighter left alone', () => {
  const f = { hp: 3, discord: BATTLE.discord.secs };
  let gone = false;
  for (let t = 0; t < BATTLE.discord.secs && !gone; t += 0.1) gone = stuck(f, 0.1);
  expect(gone).toBe(true);
});
```

- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: Commit** — `git commit -am "Guns per ship: ion cannons, concussion missiles, bombs and the tri-fighters' buzz droids"`

### Task 17: the AI fires them, and the bolts look like what they are

**Files:**
- Modify: `src/components/universe/battleAi.js:187-340` (the fire call asks `gunFor`; a stunned fighter neither steers nor fires; the ARC-170's tail gun fires back at a fighter behind it within 8 units and a 0.5 rad cone), `src/components/universe/battle.js` (`fire` accepts the new kinds; ion on a shielded capital counts double on the shield; discord sets `f.discord`; the step ticks `stuck`), `src/components/universe/battleFx.js:18` (`BOLT_LOOK` rows: ion blue-white and fat, missile a short bright head with a smoke wisp, bomb a slow dark-red ball, discord a small grey streak), `src/components/galaxy/warfront.js` (pass `guns`), `src/components/universe/battle.test.js`, `src/components/universe/battleAi.test.js` if present (else `battle.test.js`)

- [ ] **Step 1: Failing test**

```js
it('flies each side with its own guns', () => {
  const b = galaxyBattle('clone'); // (laid by layBattle at Coruscant, with guns from the roster)
  const kinds = new Set();
  const fire = b.fire;
  b.fire = (...a) => (kinds.add(a[3]), fire(...a));
  for (let i = 0; i < 30 * 60; i++) b.update(1 / 30, null);
  expect(kinds.has('discord') || kinds.has('torpedo')).toBe(true);
  expect(kinds.has('bomb')).toBe(false); // (no TIE bombers in the Clone Wars)
});
```

- [ ] **Step 2–4:** FAIL, implement, PASS; `npx vitest run src/components/universe src/components/galaxy`.
- [ ] **Step 5: Browser and PR 6** — Endor shots of a B-wing's ion bolts on a Star Destroyer's shield, a TIE bomber's run. `git commit -am "The AI fires each ship's own guns, and each looks like what it is"`; PR "Space battles 6: weapons per ship".

---

## PR 7: the fighting decides (branch `claude/space-battles-ledger`)

### Task 18: `battleLedger.js`

**Files:**
- Create: `src/components/universe/battleLedger.js`, `src/components/universe/battleLedger.test.js`

**Interfaces:**
- Consumes: `courseAt` (Task 14), `inArc` and `facingOf` (Task 13), `TURRETS`, `SUBSYSTEMS`, `HULLS` (`wars.js`), `seededRand`, `BATTLE` (`battleKit.js`), `keysOf`, `progressOf` (`battleObjectives.js`), `DIRECTOR` (`battleDirector.js`) for the stages' gates, waves and aces.
- Produces: `LEDGER = { step: 1, volley: 0.6, shieldShare: 1, squadron: 0.08, flakWear: 0.04, run: 0.15 }`; `createLedger({ plan, seed, lines }) → { plan, keys(), scale(team, n), state(t, value) }` where `lines` is the laid battle's capitals (`[{ team, kind, role, size, hull, objective, at, fwd }]`, the same on every peer) and `state` has the director's shape (`{ t, stage, open, opensIn, shield, target, stages, objectives, runners, waves, aces, losses, winner, why, endsAt }`) plus `ships: [{ index, team, hull, hullMax, shield, alive, sunkAt, ranAt }]`.
  - Stepping (pure, from 0 to `t` at `LEDGER.step`): each live ship picks its focus as `battleFleet` does (attacker: the objective ship; defender: the attacker's most hurt, else its flagship); its live turrets in arc of the focus (positions from `courseAt` at that second) deal `LEDGER.volley × BATTLE.bolts.turbo.damage` each to the focus's shield until the objective's shield generators are down (shields are the objective's generators' hp, through the plan's stages and `progressOf`), then to its hull, its bridge and its reactor in the plan's order; squadrons: each side's fighter weight × `LEDGER.squadron` a second on the other side's focus, less the other side's interceptor weight × `flakWear`; waves and aces as the director has them; the pilots' tally (`value(key)`) added on top as the director adds it (`progressOf`, scaled).
  - A turret the tally says is down (`t:<turret id>`) fires no more from that second. An escort under 15% of its hull runs (`ranAt`); one at 0 sinks (`sunkAt`); `losses` lists both with their times.
  - Winner: the attacker when the objective ship sinks; the defender when the attacker's flagship sinks or `t ≥ plan.length`; runners as the director decides them.
  - Cached by whole second, so `state(t)` for a later `t` steps on from the last; `state(t)` for an earlier `t` steps from 0.

- [ ] **Step 1: Failing tests**

```js
it('state(t) cold equals state stepped to t', () => {
  const a = createLedger(fixture('s1'));
  for (let t = 0; t <= 540; t += 7) a.state(t, NO_TALLY);
  const b = createLedger(fixture('s1'));
  expect(b.state(540, NO_TALLY)).toEqual(a.state(540, NO_TALLY));
});
it('sinks a ship by its hull, and never twice', () => {
  const s = createLedger(fixture('s2')).state(600, NO_TALLY);
  const sunk = s.ships.filter((x) => x.sunkAt !== null);
  expect(sunk.length).toBeGreaterThan(0);
  expect(new Set(s.losses.map((l) => l.index)).size).toBe(s.losses.length);
});
it('a turret shot out fires no more', () => {
  const base = createLedger(fixture('s3')).state(300, NO_TALLY);
  const lost = createLedger(fixture('s3')).state(300, tally({ [`t:${firstTurretOf(0)}`]: 99 }));
  expect(lost.ships[1].hull).toBeGreaterThan(base.ships[1].hull);
});
it('the pilots’ runs on the generators bring the shield down sooner', () => {
  const alone = createLedger(fixture('s4')).state(300, NO_TALLY).shield;
  const helped = createLedger(fixture('s4')).state(300, tally({ [generatorKey(fixture('s4'))]: 200 })).shield;
  expect(helped).toBe(false);
  expect(alone).toBe(true);
});
```

(`fixture(seed)` lays Coruscant in the Clone Wars with `layBattle` and `planOf` and returns `{ plan, seed, lines }`; `NO_TALLY = () => 0`; `tally(obj) = (k) => obj[k] ?? 0`; `firstTurretOf(team)` and `generatorKey` read the ids from the fixture.)

- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: Commit** — `git commit -am "The fleet ledger: the capital ships' fight, stepped from the battle's seed, the same on every screen"`

### Task 19: the ledger's balance

**Files:**
- Create: `src/components/universe/battleLedger.scenario.test.js` (under `npm run test:ai` if the scenario tests run there: check `package.json` for how `battleDirector.scenario.test.js` runs and do the same)

- [ ] **Step 1: The test**

```js
it('gives the attacker a fair chance alone, over 200 seeds, in every war', () => {
  for (const war of ['clone', 'gcw', 'remnant']) {
    let wins = 0;
    for (let i = 0; i < 200; i++) if (createLedger(fixtureIn(war, `bal-${i}`)).state(720, NO_TALLY).winner === 0) wins += 1;
    expect(wins / 200, war).toBeGreaterThanOrEqual(0.4);
    expect(wins / 200, war).toBeLessThanOrEqual(0.6);
  }
});
it('a pilot on the generators tips it', () => {
  for (const war of ['clone', 'gcw', 'remnant']) {
    let alone = 0;
    let helped = 0;
    for (let i = 0; i < 200; i++) {
      const fx = fixtureIn(war, `bal-${i}`);
      const keys = generatorKeys(fx); // (the plan's shield-generator objective ids)
      if (createLedger(fx).state(720, NO_TALLY).winner === 0) alone += 1;
      // (40 hp a minute on each generator from the first minute, as a tally total by then)
      const at = (t) => (k) => (keys.includes(k) ? 40 * Math.max(0, (t - 60) / 60) : 0);
      const l = createLedger(fx);
      let s = null;
      for (let t = 0; t <= 720; t += 10) s = l.state(t, at(t));
      if (s.winner === 0) helped += 1;
    }
    expect((helped - alone) / 200, war).toBeGreaterThanOrEqual(0.15);
  }
});
```

- [ ] **Step 2: Run** and tune `LEDGER` (only its numbers) until both pass. Record the final numbers and win rates in a comment above `LEDGER`.
- [ ] **Step 3: Commit** — `git commit -am "The ledger's numbers, tuned so either side can win a battle left to itself and the pilots tip it"`

### Task 20: the ledger in place of the curve

**Files:**
- Modify: `src/components/galaxy/warfront.js:67-74` and where it calls `createDirector` (`createLedger` with the laid battle's lines), `src/components/universe/battleStages.js` (losses at their `sunkAt`/`ranAt`, ship hulls from `state.ships` each sync: `cap.hull = ships[i].hull` for display, `cap.dying` when `sunkAt` passes), `src/components/universe/battleDirector.js` (header: says the ledger has taken its curve; `createDirector` kept for the universe map's own wars, which keep deciding themselves), the HUD's battle readout if it shows a pressure figure (`grep -rn "tAi\|pressure" src/components/galaxy/*.jsx`), `src/components/galaxy/warfront.test.js`

- [ ] **Step 1: Failing test** in `warfront.test.js`:

```js
it('sinks what the ledger sinks, when it sinks it', () => {
  const f = frontAt('coruscant', 'clone', 0); // (the file's own way of making a front with a fake clock; reuse it)
  const lost = f.director.state(600, () => 0).losses[0];
  f.runTo(lost.at + 1);
  expect(f.battle.capitals.find((c) => c.team === lost.team && c.index === lost.index).alive).toBe(false);
});
```

- [ ] **Step 2–4:** FAIL, implement, PASS; `npm test`.
- [ ] **Step 5: Two browsers** — the memory's two-browser recipe (`universe-multiplayer.md`): two pilots in one Coruscant battle, screenshots at the same second of an escort sinking in both.
- [ ] **Step 6: Commit and PR 7** — `git commit -am "The galaxy's battles are decided by the fleet ledger: what you see sink is what sank, for every pilot"`; PR "Space battles 7: the fighting decides", body with the win rates.

---

## PR 8: the systems' standing battles, live (branch `claude/space-battles-live`)

### Task 21: `liveBattle.js`

**Files:**
- Create: `src/components/galaxy/liveBattle.js`, `src/components/galaxy/liveBattle.test.js`
- Modify: `src/components/galaxy/world.js:432-531` (the `battle` piece hands its sides to `createLiveBattle` and draws it with `createBattleScene(parent, { models, small: true, reduced })`; the ellipse code goes; `world.js` shrinks)

**Interfaces:**
- Consumes: `layBattle` (`battles.js`), `createBattle` (`universe/battle.js`), `createBattleScene` (`universe/battleScene.js`), `effects.war` (Task 4).
- Produces: `LIVE = { perSide: { ultra: 6, high: 6, mid: 4, low: 3 }, slowBeyond: 400, frozenBeyond: 1200, slowRate: 0.25 }`; `createLiveBattle(sys, war, { tier, seed }) → { battle, rateAt(distance) → 1 | 0.25 | 0, step(dt, distance) }`: a battle with `tactics: true`, no `plan`, no `director`, `tickets: false`, `clock: Infinity`; its fighters come back from their own carriers' hangar points when down (a `spawn` override passing `from` the carrier's position).

- [ ] **Step 1: Failing tests**

```js
it('fights the war you are in at the system', () => {
  const live = createLiveBattle(systemById('coruscant'), 'clone', { tier: 'high', seed: 'x' });
  const kinds = new Set(live.battle.capitals.map((c) => c.kind));
  expect(kinds.has('venator')).toBe(true);
  expect(kinds.has('destroyer')).toBe(false);
  expect(live.battle.fighters.filter((f) => f.team === 0)).toHaveLength(LIVE.perSide.high);
});
it('slows far off and stops further', () => {
  const live = createLiveBattle(systemById('coruscant'), 'clone', { tier: 'high', seed: 'x' });
  expect(live.rateAt(100)).toBe(1);
  expect(live.rateAt(LIVE.slowBeyond + 1)).toBe(LIVE.slowRate);
  expect(live.rateAt(LIVE.frozenBeyond + 1)).toBe(0);
});
it('never ends', () => {
  const live = createLiveBattle(systemById('endor'), 'gcw', { tier: 'low', seed: 'y' });
  for (let i = 0; i < 30 * 900; i++) live.step(1 / 30, 50);
  expect(live.battle.over).toBeNull();
});
```

- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: Browser and PR 8** — fly by Coruscant's standing battle with reduced motion off and with it on (on: today's flashes only, no battle stepped), screenshots, frame time. `git commit -am "The systems' standing battles are real ones, small, of the war you are in"`; PR "Space battles 8: live system battles".

---

## PR 9: launch from a Venator's hangar (branch `claude/space-battles-launch`)

### Task 22: `warpieces/launch.js`

**Files:**
- Create: `src/components/galaxy/warpieces/launch.js`, test cases in `src/components/galaxy/warpieces/warpieces.test.js`
- Modify: `src/components/galaxy/warpieces/index.js` (`piecesFor`: the launch for a Clone Wars battle you join as the Republic), `src/components/galaxy/warfront.js` (pass `joinedAt` and `firstJoin`)

**Interfaces:**
- Consumes: `public/models/galaxy/hangar/venator-bay.glb` (Task 9), the flagship's capital (`battle.capitals` with `role: 'flagship'` on your team), `ctx` as the other set pieces get it (`warpieces/hangar.js` is the pattern: read its header first).
- Produces: `LAUNCH = { stay: 20, notAfter: 480, door: 'port' }`; `createLaunch(ctx, { cap, models }) → { update(dt, t, live) → { ship?, speedCap?, done }, dispose() }`: on its first update it puts the ship on the bay's deck facing the door (`ship` in the return: position and heading), two parked ARC-170 slots either side, the crew line `"Clear to launch, sir. Good hunting."` (through the crew-lines path `warfront.js` already uses for battle calls); `done` when the ship has passed the door plane or after `stay` seconds (then it hands the ship a push out along the door's normal).
  - `piecesFor` includes it only when the war is `clone`, your side is `republic`, the battle's clock is under `notAfter` and this is your first join of this battle.

- [ ] **Step 1: Failing tests**

```js
it('launches a Republic pilot out of the flagship’s hangar, once', () => {
  expect(piecesFor(cloneBattle(), { side: 'republic', clock: 30, firstJoin: true }).some((p) => p.id === 'launch')).toBe(true);
  expect(piecesFor(cloneBattle(), { side: 'republic', clock: 30, firstJoin: false }).some((p) => p.id === 'launch')).toBe(false);
  expect(piecesFor(cloneBattle(), { side: 'separatists', clock: 30, firstJoin: true }).some((p) => p.id === 'launch')).toBe(false);
  expect(piecesFor(cloneBattle(), { side: 'republic', clock: LAUNCH.notAfter + 1, firstJoin: true }).some((p) => p.id === 'launch')).toBe(false);
  expect(piecesFor(gcwBattle(), { side: 'rebel', clock: 30, firstJoin: true }).some((p) => p.id === 'launch')).toBe(false);
});
it('is done once the ship is through the door, or after its stay', () => {
  const l = createLaunch(fakeCtx(), { cap: fakeVenator(), models: fakeModels() });
  const first = l.update(0.1, 0, null);
  expect(first.ship).toBeDefined();
  let r = null;
  for (let t = 0; t < LAUNCH.stay + 1; t += 0.5) r = l.update(0.5, t, first.ship);
  expect(r.done).toBe(true);
});
```

(Match `piecesFor`'s real signature first: read `warpieces/index.js` and adapt the calls; the assertions stay.)

- [ ] **Step 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: Browser and PR 9** — `SIDE=republic node scripts/galaxy-war-check.mjs coruscant high` from a fresh join: shots on the deck, at the door, out in the battle. `git commit -am "Republic pilots launch into a Clone Wars battle from their flagship's hangar"`; PR "Space battles 9: the hangar launch".

---

## After the last PR

- `docs/architecture.md`: the galaxy's entry gains two sentences (the roster decides who flies what; the ledger decides battles). `docs/superpowers/HANDOFF-space-battles.md`: what merged, what was left and why.
