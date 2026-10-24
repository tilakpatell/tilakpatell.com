# One flight-combat core, one flight HUD: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The universe map and the galaxy’s space flight share one pure targeting-and-guns core and one flight HUD. Both scenes become thin adapters over them, and the 18 lane-1 bugs in that code are fixed.

**Architecture:**
- The rules move down into `src/lib/combat/flight/`: `sight`, `guns`, `targeting`, `roundRules` and `radar`, with `src/lib/flight/orient.js` beside them. The HUD moves into `src/runtime/hud/flight/`: `frame`, `flightHud`, `FlightHud` and `radarDraw`.
- Each scene keeps its meshes, its camera, its hit tests and its effects. It builds its candidates and one ordered hit list, and fills one HUD record a frame.
- The work runs in three phases:
  - **A**: moves that change no pixel (Tasks 3 to 9);
  - **B**: the fixes, one commit each, test first (Tasks 10 to 22);
  - **C**: the commits that change the picture (Tasks 23 to 28).
  - Tasks 1 and 2 build the check tools and take the before numbers; Task 29 closes the lane.

**Tech stack:** JavaScript (ES modules), React 18, three.js, Vite, Vitest (Node, no DOM: markup is tested with `renderToStaticMarkup`), Playwright with the container’s Chromium for the browser checks.

**Spec:** `docs/superpowers/specs/2026-10-24-one-flight-combat-core-design.md`. Read it before any task. The audit behind it is `docs/research/2026-10-24-ship-combat-audit.md`. Where this plan and the spec differ, follow the spec, fix this plan’s line, and say so in one sentence in the commit body.

## Global constraints

**Dependencies, saves and the wire**
- No new dependency, no new save key, no new wire code. `DAMAGE` 10, `DAMAGE_MAX` 30, `PUNCH_MAX` 24 and the weapon codes stay as they are.
- Every key, gesture, save key and dev hook works after as before: `tp-universe-controls`, `tp-universe-loadout`, `window.__universeDebug`, the galaxy’s debug handle, T, Shift+T, Q, tap, F, R, 1 2 3.

**Tests**
- No test is skipped, loosened or deleted. A moved test keeps its expectations.
- A test runs in under a second and touches no network. `x.js` has `x.test.js` beside it.

**Layers and size**
- `src/lib` and the pure files of `src/runtime` import no React, no DOM and no three.js. `src/runtime` imports nothing from `src/components`. The galaxy reaches the universe only through `universe/shared/`.
- A file stays under 800 lines; each new file here stays under 400. Both scenes may only shrink across the lane. Every commit body records `wc -l` of both scenes.

**Every commit**
- It is green on `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build`.
- No measured health number rises above the commit before it. Measured on `main`: boundary-breaks 484, kbd-styles 68, big-files 22, cycles 5. The lane ends with boundary-breaks at 475 or lower and kbd-styles lower than 68.
- Never run `node scripts/health.mjs` without `--check`: it rewrites `src/data/health/latest.json`.
- In phases A and B, draw calls and triangles per pose are equal to Task 2’s. Through phase A the shots stay within Task 2’s noise floor.

**The HUD**
- Numbers are written through refs, never React state.
- Nothing a player reads is under 0.7 rem (from Task 24 on).
- Text over 3D sits on glass at 0.78 alpha or more, never blurred.
- The only key cap is `kbd.hud-cap`.
- No class name is renamed.
- Tints are custom properties only.

**Copy and commits**
- British spelling, curly quotes, sentence case, comments that say why, and no model names anywhere.
- Each commit message is a plain sentence subject in the repo’s style, then a short body, then exactly:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RQ72Qap4ZJEK2vaPYx5CVD
  ```
- Branch `claude/dreamy-bell-msp1j2`; the one pull request is [tilakpatell/tilakpatell.com#1242](https://github.com/tilakpatell/tilakpatell.com/pull/1242). Never force-push or rebase.

**Browser gates**
- `S=${FLIGHT_SHOTS:-/tmp/flight-core}`, outside the repo.
- Every universe gate is:
  `node scripts/universe-check.mjs --quality <q> --lock --out "$S/<task>/<q>"`, then
  `node scripts/shot-compare.mjs "$S/run1/<q>" "$S/<task>/<q>" --floor docs/superpowers/evidence/flight-core/floor-<q>.json`,
  which must print `within the floor` in phase A, and in phases B and C everywhere except where the task names its change.
- The galaxy gate is `node scripts/galaxy-hud-check.mjs` printing only `ok` lines and exiting 0.
- Probes are `node scripts/flight-probe.mjs <scenario> --url http://127.0.0.1:5188`, run against the dev server as Task 1 starts it.
- Never compare against `lab/universe/baseline/`. Nothing over 1 MB is committed under `docs/`.

## Review focus

These are the conditions the spec implies that no fix row tests, most likely to bite first. Each one is pinned by the test named.

1. **A frame with dt 0, or a 0.05 s spike** (a frozen frame, a dive, a tab coming back). The lock, its grace and the lead must not jump, drop or go NaN. *Task 7*, sight.test: `'holds through a still frame and a 0.05 s spike, …'`.
2. **The target dies or leaves between two T presses, or every candidate is gone.** The ring drops the dead id and moves on. With no candidates, the lock and `lockTarget` are null, `hot` is false and `find` returns null. *Task 11*, targeting.test: `'drops the gone, appends the new, never re-sorts'`. *Task 7*: the case above, run with an empty list.
3. **The weapon changes mid-fight** (R, 1 2 3, a refit, a skill bought). The lead and the hot flag follow the new weapon on the next frame, and the dark matter pool never runs short. *Task 13*, sight.fixes.test: `'follows a weapon changed between two frames'`. *Task 18*: `'… the most orbs in flight'`.
4. **Reduced motion: hunters, wingmen and skirmishes are null.**
   - *Task 7*: the sight runs with no hunters and an empty list.
   - *Task 9*: a source that takes nothing passes the bolt on.
   - *Task 21*: the galaxy opened with reduced motion gives `no page errors with reduced motion`.
5. **A held touch button when the window blurs, the tab hides, or the HUD unmounts mid-press.** The press is let go, and nothing throws on the missing event. *Task 22*, HeldButton.test: `'… lets go with no event'`.

## What the probes need from the code

`scripts/lib/flight-probes.mjs` wraps the scenes’ DEV hooks:
- From Task 9 on, the scenes keep calling `hunters.hit`, `pilots.hit`, `meteors.hit`, `siege.strike` and `hunters.update` through those objects’ properties at call time.
- Bolt meshes keep `userData.heavy === false`.

If either changes, `flight-probes.mjs` changes in the same commit.

---

### Task 1: Check tooling: a held lock, a shot comparer, the flight probes

**Files:**
- Create: `scripts/shot-compare.mjs`, `scripts/lib/flight-probes.mjs`, `scripts/flight-probe.mjs`
- Modify: `scripts/universe-check.mjs` (`:27`, `:53`, after `:190`, `:232-239`); `scripts/autopilot-check.mjs` (after `:57`, `:159`, `:197`); `src/components/galaxy/scene.js:2855` (DEV-only `__galaxyDebug`: `pilots, startJump` → `pilots, arms, startJump`)
- Test: `scripts/shot-compare.test.mjs`, `scripts/lib/flight-probes.test.mjs`

**Interfaces:**
- Consumes: the DEV hooks.
- Produces:
  - `universe-check.mjs --lock`: `<pose>.hud.webp`; per pose `lock: { id, at, held } | { skipped: 'on foot' | 'no hunters' }`, `overlay: [{ c, on: false } | { c, on: true, off, hot, hit, tough, t, r, a, hp, text }]`.
  - `shot-compare.mjs`: `OFF = 8`, `diffPixels(a, b)`, `compareReports(a, b)`, `judge(result, floor) → string[]`; CLI `<before> <after> [--write f] [--floor f]` → `within the floor` or `N over the floor` (exit 1).
  - `flight-probes.mjs`: `LOCK_SPOT`, `lockSpot(ship, spot = LOCK_SPOT)`, page-side `freeze(hook)`, `forceLock(at)`, `lockHeld(id)`, `overlay()`, `inFlight()`, `recordTakers(hook = '__universeDebug')`, `stack(opts)`, `intoTheSun()`, `fitUnique(hook, id)`.
  - `flight-probe.mjs <order|crash|galaxy-bolt|reach|unique-pilots> [--line 0|1|2] [--expect clear] [--shot dir] --url http://127.0.0.1:5188`: `ok `/`FAIL ` lines, exit = FAILs.
  - `autopilot-check.mjs --viewport <w>x<h>`.

- [ ] **Step 1: Write the failing tests.**

`scripts/shot-compare.test.mjs`:
```js
import { describe, expect, it } from 'vitest';
import { diffPixels, judge } from './shot-compare.mjs';

const img = (px, channels = 3) => ({ data: Uint8Array.from(px.flat()), width: 2, height: 2, channels });
const K = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
const pose = (calls, overlay) => ({ calls, triangles: [100, 100], overlay });
describe('shot-compare', () => {
  it('counts a pixel off past 8/255 in a colour channel', () => {
    expect(diffPixels(img(K), img([[9, 0, 0], [8, 8, 8], [0, 0, 200], [0, 0, 0]]))).toEqual({ share: 0.5, max: 200 });
    expect(diffPixels(img(K), { data: new Uint8Array(3), width: 1, height: 1, channels: 3 })).toBeNull();
  });
  it('judges against the floor', () => {
    const floor = { images: { a: { share: 0.1, max: 30 } }, poses: { p: pose([38, 39], []) } };
    expect(judge({ images: { a: { share: 0.12, max: 40 }, b: null }, poses: { p: pose([38, 40], ['1 lock']), q: { error: 'no pose q' } } }, floor)).toEqual(["a: 12.000% of pixels off, over the floor's 10.000%", 'b: the sizes differ', "p: 40 calls, outside the floor's 38–39", 'p: the overlay differs (1 lock)', 'q: the pose failed (no pose q)']);
    expect(judge({ images: { a: { share: 0.1, max: 99 } }, poses: { p: pose([39, 38], []) } }, floor)).toEqual([]);
  });
});
```

`scripts/lib/flight-probes.test.mjs`:
```js
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forceLock, inFlight, lockHeld, lockSpot } from './flight-probes.mjs';

const r9 = (...v) => v.map((x) => +x.toFixed(9));
afterEach(() => delete globalThis.window);
describe('flight-probes', () => {
  it('puts the lock 6 ahead, 0.6 up and 1.2 right of the ship', () => {
    expect(lockSpot({ x: 0, y: 0, z: 0, heading: 0 })).toEqual({ x: 1.2, y: 0.6, z: -6 });
    const p = lockSpot({ x: 10, y: 2, z: 5, heading: Math.PI / 2 });
    expect(r9(p.x, p.y, p.z)).toEqual([4, 2.6, 3.8]);
  });
  it('spawns a still TIE there, its clock stopped once, locked by hand', () => {
    const body = { id: 7, at: {}, prev: {}, vel: {} };
    const update = vi.fn();
    const h = { bodies: [], update, pack: vi.fn(() => h.bodies.push(body)) };
    const state = { ship: { x: 0, y: 0, z: 0, heading: 0 }, lock: null };
    let foot = null;
    globalThis.window = { __universeDebug: { state, hunters: h }, __universe: () => ({ foot, lock: state.lock?.id }) };
    const at = { x: 1.2, y: 0.6, z: -6 };
    forceLock(at);
    expect(forceLock(at)).toEqual({ id: 7, at: [1.2, 0.6, -6] });
    expect(h.pack).toHaveBeenCalledWith('empire', state.ship, { size: 1, ace: false, kinds: ['tie'], more: 0 });
    expect(body.prev).toEqual(at);
    expect(r9(body.vel.x, body.vel.z)).toEqual([-0.0024, 0.012]);
    expect([state.lock, lockHeld(7)]).toEqual([{ id: 7, out: 0, manual: true }, true]);
    h.update(0.05, 3, state.ship);
    expect(update.mock.calls).toEqual([[0, 3, state.ship]]);
    foot = { phase: 'walk' };
    expect(forceLock({})).toEqual({ skipped: 'on foot' });
  });
  it('counts the rounds and bolts in flight, not hidden ones', () => {
    const all = [[true, true], [false, true], [true, false], [true, undefined]].map(([visible, heavy]) => ({ isMesh: true, visible, userData: { heavy } }));
    globalThis.window = { __universeDebug: { scene: { traverse: (f) => all.forEach(f) } } };
    expect(inFlight()).toEqual({ rounds: 1, bolts: 1 });
  });
});
```

- [ ] **Step 2: Run to fail.** `npx vitest run scripts/shot-compare.test.mjs scripts/lib/flight-probes.test.mjs`: `Test Files 2 failed (2)`, no module.

- [ ] **Step 3: Implement.**
  - `shot-compare.mjs`: `compareReports`, a pose in both: `{ calls: [a, b], triangles: [a, b], overlay: ['<i> <c>' per mark unequal as JSON] }` or `{ error }`; `judge` holds the after value to the floor's min–max, the overlay only where the floor's is empty. The CLI reads `*.webp`/`*.png` in both folders (`sharp(f).removeAlpha().raw()`) and `<dir>.json`; `--write` saves `{ images, poses }`; `--floor` prints `OVER <message>` lines and the verdict.
  - `flight-probes.mjs` (`/* global window, document */`): `freeze(hook)` wraps `window[hook].hunters.update` once (`stopped` flag) with dt 0: the TIE neither moves nor fires. `overlay()` reads `data-on|off|hot|hit|tough`, `style.transform`, `--r|--a|--hp`, text. `recordTakers` wraps by property `hunters.hit`, `pilots.hit` (calls counted in `__asked`), `siege.strike` (`citadel`), `meteors.hit` (`rock`); takers in `__takers`. `stack({ from, hunter = true, line = 0 })`: rocks (`meteors.count || meteors.storm(ship)`) parked far off; the ship held (`state.held = { name: 'flight-probe', view: null }`) at r + 0.6 on `[0.6, 0, 0.8]` from `citadelGeo.center` (r = `from ?? citadelGeo.shield`), facing in; `frames(2)`; rock 0 at `size` 0.25 (bigger meets the ship) and, with `hunter`, a forced TIE at r − 0.1; `arms().select(line)`. `intoTheSun()`: ship at `(0, 0.3, 75.45)`, heading 0, speed 12, the rest 0. `fitUnique`: `arms().refit({ ...loadout, ordnance: id }, { ...fx, arms: [id] })`, `select(2)`.
  - `flight-probe.mjs`: the universe opened as `universe-check.mjs:139-175` at low; the galaxy by `open()` of `./galaxy-hud-check/lib.mjs`, imported after `process.env.BASE = url`; fire holds `state.fireBtn` till what is awaited, 20 steps at most; last, `no page errors`.
    - `order` on `--line`: `stack({})` wants `hunter` first, `{ hunter: false }` `citadel` and no `rock`, `{ from: 300, hunter: false }` `rock`; lines end `(<takers>; kills +n)` from `state.kills ?? 0`; `--line 2` adds `one torpedo kill counts once` (+1), or `ok   no state.kills yet`.
    - `crash`: a torpedo, a bolt, `intoTheSun()`, the crash awaited: `rounds a, bolts b`, and three frames on; `--expect clear` wants 0s.
    - `galaxy-bolt`, `unique-pilots` (hook `__galaxyDebug`): `pin(ship)`, a `ram(6)` hunter stilled, frozen; line 0 wants `hunter`; crystal locked on it, 3 s on, `__asked.hunter ≥ 1`, `__asked.pilot` 0.
    - `reach`: `pose('rickmorty')`, seismic, `forceLock(lockSpot(ship))`: wants `.universe-lead[data-on]`; at `ahead: 12`, off; `--shot` saves both.
  - `universe-check.mjs`: `--out` by `resolve`; with `--lock`, `forceLock(lockSpot(ship))` after the grain line, `lockHeld` or throw before the shot, then `overlay()` and the `.hud.webp` (`.universe-hud` made visible); `ok` lines end `lock held|on foot`.
  - `autopilot-check.mjs`: `--viewport` (`split('x').map(Number)`) beats `--phone`'s size, unresized.

- [ ] **Step 4: Run to pass.** Step 2's command: `Tests 5 passed (5)`. Then `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`: green, `within budget`, the numbers main's.

- [ ] **Step 5: Browser check.** Once for the lane (the scripts miss `chrome-linux64/`):
  ```
  export CHROMIUM=/opt/pw-browsers/chromium CHROME=/opt/pw-browsers/chromium S=${FLIGHT_SHOTS:-/tmp/flight-core}
  node node_modules/vite/bin/vite.js --port 5188 --strictPort --host 127.0.0.1 &
  for a in order "order --line 2" crash "crash --expect clear" galaxy-bolt reach unique-pilots; do node scripts/flight-probe.mjs $a --url http://127.0.0.1:5188; echo "exit $?"; done
  node scripts/universe-check.mjs --quality low --poses rickmorty,overview --lock --out "$S/try/low"
  ```
  Expected: `order`s exit 0, `(hunter…)`, `(citadel…)`, `(rock…)`; `crash` 0; `crash --expect clear` 1 until Task 20; `galaxy-bolt`, `unique-pilots` 0; `reach` 1 at 12 out until Task 13. `ok   low  rickmorty  calls   40  tris    65899 … lock held`, lock mark `translate3d(636.2px, 347.7px, 0px)`; overview marks off.

- [ ] **Step 6: Commit.**
  ```
  git add scripts/{shot-compare.mjs,shot-compare.test.mjs,flight-probe.mjs,universe-check.mjs,autopilot-check.mjs} scripts/lib/flight-probes{,.test}.mjs src/components/galaxy/scene.js
  git commit -F- <<'EOF'
  The universe check pictures a held lock, and a shot comparer gives the noise floor

  A pose clears the lock, so the bracket was never pictured.
  Scenes: universe 6409 lines, galaxy 3092.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RQ72Qap4ZJEK2vaPYx5CVD
  EOF
  ```

### Task 2: The baseline on the tooling commit

**Files:**
- Create: `docs/superpowers/evidence/flight-core/README.md`, `floor-high.json`, `floor-low.json`

**Interfaces:**
- Consumes: Task 1's tools at its commit (main's code, bar a DEV hook).
- Produces: `$S/run1/{high,low}`, every later universe gate's before, never `lab/universe/baseline/` (lost: re-take it here in a worktree); `floor-{high,low}.json`; `$S/{universe,galaxy}-<w>x<h>.webp`.

- [ ] **Step 1: Poses, twice a tier.** Task 1 Step 5's `export` and server; `mkdir -p "$S" docs/superpowers/evidence/flight-core`. In the background (hours): `for r in 1 2; do for q in high low; do node scripts/universe-check.mjs --quality $q --lock --out "$S/run$r/$q" | tee "$S/run$r-$q.txt"; done; done`. Check: 14 `ok` lines a file, `lock held`, `landing-middleearth`'s `lock on foot`.

- [ ] **Step 2: Floors.** `for q in high low; do F=docs/superpowers/evidence/flight-core/floor-$q.json; node scripts/shot-compare.mjs "$S/run1/$q" "$S/run2/$q" --write $F | tee "$S/floor-$q.txt"; node scripts/shot-compare.mjs "$S/run1/$q" "$S/run2/$q" --floor $F; done`. Check: 28 image and 14 pose lines, `within the floor`.

- [ ] **Step 3: Galaxy, probes, health.** `OUT="$S/galaxy-hud" node scripts/galaxy-hud-check.mjs | tee "$S/galaxy.txt"` (`all ok`); `for s in pickups hangar; do OUT="$S/galaxy-$s" node scripts/galaxy-hud-check.mjs $s | tee "$S/galaxy-$s.txt"; done` (`pickups` all `ok`; `hangar` has one FAIL already on main, `the secondary line says it fires on the universe map only`: record it, it is not this lane's); Task 1 Step 5's probe loop with `"order --line 1"` added, `| tee "$S/probes.txt"`; `node scripts/health.mjs --check --skip build`; `wc -l src/components/universe/scene.js src/components/galaxy/scene.js` (6409, 3092).

- [ ] **Step 4: Bundle and three sizes.**
  ```
  npm run build && node scripts/autopilot-check.mjs --only bundle | tee "$S/bundle.txt"
  for v in 1440x900 390x844 844x390; do node scripts/autopilot-check.mjs --routes /universe,/galaxy --shots 9900 --viewport $v $([ $v = 1440x900 ] || echo --phone) --skip lint,test,build
    mv public/changes/9900-a.webp "$S/universe-$v.webp"; mv public/changes/9900-b.webp "$S/galaxy-$v.webp"; done
  ```
  Check: `total JS … in N chunks`; `ok   everything green` thrice; `file "$S"/*844x390.webp` says `844x390`.

- [ ] **Step 5: README.** Text only: commit, health, `wc -l`, calls and triangles a pose, chunks, floors, each check's and probe's result (expected FAILs with the task clearing each), the FAILs already on main (`hangar`'s secondary line; 844×390 touch's four `meet` lines, which Task 22 records and Task 27 clears), shot names, commands. Task 1 Step 4's gates; `git status --short` shows the three files.

- [ ] **Step 6: Commit.**
  ```
  git add docs/superpowers/evidence/flight-core/{README.md,floor-high.json,floor-low.json}
  git commit -F- <<'EOF'
  The flight core's baseline: main's numbers before any move

  Every move after this is held to these.
  Scenes: universe 6409 lines, galaxy 3092.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RQ72Qap4ZJEK2vaPYx5CVD
  EOF
  ```

> Task 1 and 2 notes. What the probes print on today's code for `order --line 1/2`, `galaxy-bolt`, `reach`, `unique-pilots` and `crash`'s bolt count was read from the code, not run: Step 5 of Task 1 is where they are first run, and a line that differs from the expected one is recorded in the README with the reason, not forced. The R16 kill check prints `ok   no state.kills yet` until Task 26 adds `state.kills`.

### Task 3: orient moves to `src/lib/flight/orient.js`

**Files:**
- Move: `src/components/universe/orient.js` → `src/lib/flight/` (unchanged), leaving a barrel
- Modify: `src/components/galaxy/space.js:38`
- Test: `src/lib/flight/orient.test.js`

**Interfaces:** Consumes none. Produces `src/lib/flight/orient.js`, its exports unchanged.

- [ ] **Step 1: Write the failing test** `src/lib/flight/orient.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { NOSE, RIGHT, UP, axisAngle, conj, fromAngles, mul, rotate, slerp, toAngles, turnToward } from './orient';

const near = (a, b, d = 6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], d));
const ID = [0, 0, 0, 1];

describe('which way round the ship is', () => {
  it('turns by heading, pitch, bank and axis', () => {
    near(rotate(fromAngles(Math.PI / 2), NOSE), [-1, 0, 0]);
    near(rotate(fromAngles(0, 0.3), NOSE), [0, Math.sin(0.3), -Math.cos(0.3)]);
    near(rotate(fromAngles(0, 0, 0.4), UP), [Math.sin(0.4), Math.cos(0.4), 0]);
    near(rotate(axisAngle(UP, Math.PI / 2), NOSE), [-1, 0, 0]);
  });
  it('gives back its angles; straight up, the roll goes to heading', () => {
    const a = toAngles(fromAngles(0.7, 0.3, -0.4));
    near([a.heading, a.pitch, a.bank], [0.7, 0.3, -0.4], 9);
    const up = toAngles(fromAngles(0.5, Math.PI / 2, 0.2));
    near([up.heading, up.pitch, up.bank], [0.7, Math.PI / 2, 0]);
  });
  it('undoes a turn with conj, and slerps the short way', () => {
    const q = fromAngles(0.7, 0.3, -0.4);
    near(mul(q, conj(q)), ID);
    expect(toAngles(slerp(ID, fromAngles(1).map((x) => -x), 0.5)).heading).toBeCloseTo(0.5, 9);
  });
  it('swings the nose by at most max, over the top from behind', () => {
    near(rotate(turnToward(ID, RIGHT, 3), NOSE), RIGHT);
    near(rotate(turnToward(ID, [0, 0, 1], 0.2), NOSE), [0, Math.sin(0.2), -Math.cos(0.2)]);
  });
});
```

- [ ] **Step 2: Run it to fail.** `npx vitest run src/lib/flight/orient.test.js`: FAIL, `./orient` unresolved.
- [ ] **Step 3: Move.** `git mv src/components/universe/orient.js src/lib/flight/`. The old path: a comment and `export * from '../../lib/flight/orient';`. space.js:38 imports from `'../../lib/flight/orient'`.
- [ ] **Step 4: Run it to pass.** `Tests 4 passed (4)`; CLAUDE.md's four gates pass; health `--only boundary-breaks,cycles,big-files,kbd-styles`: 483/5/22/68; `git diff --cached -C --stat`: `src/{components/universe => lib/flight}/orient.js | 0`.
- [ ] **Step 5: Browser gate**, on Task 1's browser setup and server:
  ```
  S=${FLIGHT_SHOTS:-/tmp/flight-core}; T=t3
  for q in high low; do
    node scripts/universe-check.mjs --quality $q --lock --out "$S/$T/$q"
    node scripts/shot-compare.mjs "$S/run1/$q" "$S/$T/$q" --floor docs/superpowers/evidence/flight-core/floor-$q.json
  done
  BASE=http://127.0.0.1:5188 OUT="$S/$T/galaxy-hud" node scripts/galaxy-hud-check.mjs
  ```
  Pass: `within the floor` twice; galaxy-hud-check only `ok` lines, its shots as Task 2's by eye.
- [ ] **Step 6: Commit.**
```
git add src/lib/flight/orient.{js,test.js} src/components/universe/orient.js src/components/galaxy/space.js
git commit -F - <<'EOF'
Orient moves to lib/flight, its old path a barrel

lib may not import up, and targeting.js follows it there; the galaxy's
space.js is repointed now, as its leaving the universe is the ask.
boundary-breaks 484 → 483; scenes 6,409/3,092 lines.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RQ72Qap4ZJEK2vaPYx5CVD
EOF
```

### Task 4: targeting moves to `src/lib/combat/flight/targeting.js`

**Files:**
- Move: `src/components/universe/targeting.js`, `targeting.test.js` → `src/lib/combat/flight/`, leaving a barrel
- Modify: GS:107; `src/components/galaxy/warpieces/run.js:25`, `endor.js:35`, `scarif.js:23`, `hoth.js:22`
- Test: `src/lib/combat/flight/targeting.test.js`

**Interfaces:** Consumes Task 3's orient.js. Produces `src/lib/combat/flight/targeting.js`, its exports unchanged.

- [ ] **Step 1: Move the test:** `mkdir -p src/lib/combat/flight && git mv src/components/universe/targeting.test.js src/lib/combat/flight/`.
- [ ] **Step 2: Run it to fail.** `npx vitest run src/lib/combat/flight/targeting.test.js`: FAIL, `./targeting` unresolved.
- [ ] **Step 3: Move.** `git mv src/components/universe/targeting.js src/lib/combat/flight/`; there `'./orient'` → `'../../flight/orient'`, `'../../lib/combat/contact'` → `'../contact'`. The old path: a comment and `export * from '../../lib/combat/flight/targeting';`. GS:107 imports from `'../../lib/combat/flight/targeting'`, the warpieces from `'../../../lib/…'`.
- [ ] **Step 4: Run it to pass.** `Tests 35 passed (35)`; four gates pass; health 478/5/22/68; `-C --stat`: targeting.js `| 4 +-`; `node scripts/autopilot-check.mjs --only bundle` gives `$S/bundle.txt`'s chunk count.
- [ ] **Step 5: Browser gate.** Task 3 Step 5 with `T=t4`.
- [ ] **Step 6: Commit.**
```
git add src/lib/combat/flight/targeting.{js,test.js} src/components/universe/targeting.js src/components/galaxy/scene.js src/components/galaxy/warpieces/{run,endor,scarif,hoth}.js
git commit -F - <<'EOF'
Targeting moves to lib/combat/flight

Both maps lock by it, and lib may not import a world; the galaxy's
callers are repointed now, its leaving the universe being the ask.
boundary-breaks 483 → 478; scenes 6,409/3,092 lines.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RQ72Qap4ZJEK2vaPYx5CVD
EOF
```

### Task 5: `guns.js` and roundRules in `src/lib/combat/flight`

**Files:**
- Create: `src/lib/combat/flight/guns.js`
- Move: `src/components/universe/roundRules.js`, `roundRules.test.js` → `src/lib/combat/flight/`, leaving a barrel
- Modify, in `src/components/`: `universe/weapons.js:17-18, 23, 176-235`; `galaxy/pickups.js:25-39`; `galaxy/gunRules.js:7, 10`; US:194, 233-235; GS by line text; `hangar/armsTabRules.js:17, 21-23`; `rickmorty/world/streetFight.js:41, 54`
- Test: `src/lib/combat/flight/guns.test.js`, `roundRules.test.js`

**Interfaces:** Consumes none. Produces `pace(base, delay, fastest, out = { gap: 0, punch: 1 }) → out`; moved names as they were.

- [ ] **Step 1: Write the failing test.** `git mv src/components/universe/roundRules.test.js src/lib/combat/flight/`; create `src/lib/combat/flight/guns.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { CADENCE, gunsUnder, pace } from './guns';

const FASTEST = 0.12;
// pickups.js's gunsUnder at cc5e2eaf
const before = (base, delay, fastest, out = { gap: 0, punch: 1 }) => {
  const wanted = Math.max(fastest, base) * delay;
  out.gap = Math.max(fastest, wanted);
  out.punch = Math.min(1.5, out.gap / wanted);
  return out;
};

describe('the flight core’s guns', () => {
  it('has one pace table, and paces as gunsUnder did', () => {
    expect(CADENCE).toEqual({ xwing: 0.12, falcon: 0.16, cruiser: 0.19, rv: 0.2 });
    for (const base of [0.06, 0.084, 0.12, 0.16, 0.19, 0.2, 0.3, 0.4, 0.5])
      for (const delay of [0.2, 0.6, 1]) {
        expect(pace(Math.max(FASTEST, base), delay, FASTEST)).toEqual(before(base, delay, FASTEST));
        expect(gunsUnder(base, delay, FASTEST)).toEqual(before(base, delay, FASTEST));
      }
    const out = { gap: 0, punch: 0 };
    expect(pace(0.12, 0.6, FASTEST, out)).toBe(out);
    expect(out).toEqual({ gap: 0.12, punch: 1.5 });
  });
});
```

- [ ] **Step 2: Run it to fail.** `npx vitest run src/lib/combat/flight/{guns,roundRules}.test.js`: both FAIL, `./guns`, `./roundRules` unresolved.
- [ ] **Step 3: Implement.** `G` is `lib/combat/flight/guns`.
  - guns.js, no imports, takes US:233-235 (`CADENCE` exported), weapons.js:176-235, pickups.js:25-32, gunRules.js:10; `pace`: `wanted = base * delay; out.gap = Math.max(fastest, wanted); out.punch = Math.min(RAPID_PUNCH_CAP, out.gap / wanted)`; `gunsUnder` returns `pace(Math.max(fastest, base), delay, fastest, out)`.
  - Re-exports from `'../../G'`: `fan, steer` after weapons.js:23; `RAPID_PUNCH_CAP, gunsUnder` for pickups.js:25-39; `shotPunch` for gunRules.js:10; their comments and weapons.js:17-18, gunRules.js:7 name G.
  - `import { CADENCE } from '../../G';` after US:194, GS's `import { shotPunch } from './gunRules';`, armsTabRules.js:17 (`'../../../G'` after streetFight.js:41). US:233-235 and GS's `const CADENCE = {` line go; armsTabRules.js:21-23 → `export const STOCK_CADENCE = CADENCE;`, streetFight.js:54 → `  cadence: CADENCE.cruiser,`, comments naming G.
  - `git mv src/components/universe/roundRules.js src/lib/combat/flight/`; `:12` → `import { steer } from './guns';`; the old path: a comment and `export * from '../../lib/combat/flight/roundRules';`.
- [ ] **Step 4: Run it to pass.** Step 2's run: guns 1, roundRules 4; four gates pass; health 478/5/22/68; `wc -l` US 6,407, GS 3,092; `--color-moved` shows the bodies moved.
- [ ] **Step 5: Browser gate.** Task 3 Step 5 with `T=t5`, and its galaxy-hud-check line ending `pickups` (only `ok`), then `hangar` (the same lines as `$S/galaxy-hangar.txt`: main's one known FAIL and no new one).
- [ ] **Step 6: Commit.**
```
git add src/lib/combat/flight/{guns,guns.test,roundRules,roundRules.test}.js src/components/universe/{roundRules,weapons,scene}.js src/components/galaxy/{pickups,gunRules,scene}.js src/components/hangar/armsTabRules.js src/components/rickmorty/world/streetFight.js
git commit -F - <<'EOF'
The guns' rules and one pace table move to lib/combat/flight

Three CADENCE copies and the maps' split gun rules become one file.
boundary-breaks 478; scenes 6,407/3,092 lines.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RQ72Qap4ZJEK2vaPYx5CVD
EOF
```

### Task 6: the radar to lib, radarDraw to the kit, `forward` to orient

**Files:**
- Move, no barrel: `src/components/galaxy/radar.js`, `radar.test.js` → `src/lib/combat/flight/`; `radarDraw.js`, `radarDraw.test.js` → `src/runtime/hud/flight/`
- Modify: `src/lib/flight/orient.js` (end); `src/components/universe/ship.js:64, 267`; GS from `import { createRadar } from './radar';` (2 lines), `let radarAt = 0;`, from `if (state.clock - radarAt < 0.05) return;` (2 lines)
- Test: `src/lib/combat/flight/radar.test.js`

**Interfaces:** Consumes Task 3's orient.js. Produces orient.js's `forward(h) → [x, z]` (ship.js re-exports) and `createRadar().due(clock, hz = 20) → boolean`.

- [ ] **Step 1: Write the failing test.** `git mv src/components/galaxy/radar.test.js src/lib/combat/flight/`; `:2` imports `forward` from `'../../flight/orient'`; append:
  ```js
  it('is due at most 20 times a second, or at the rate given', () => {
    const radar = createRadar();
    const slow = createRadar();
    expect([0.03, 0.05, 0.09, 0.1].map((t) => radar.due(t))).toEqual([false, true, false, true]);
    expect([0.05, 0.1, 0.15].map((t) => slow.due(t, 10))).toEqual([false, true, false]);
  });
  ```
- [ ] **Step 2: Run it to fail.** `npx vitest run src/lib/combat/flight/radar.test.js`: FAIL, `./radar` unresolved.
- [ ] **Step 3: Implement.**
  - ship.js:267 moves to the end of orient.js; ship.js:64 imports `forward` too, and `:267` is `export { forward };`.
  - `git mv src/components/galaxy/radar.js src/lib/combat/flight/`; `:1` imports from `'../../flight/orient'`; `let drawn = 0;` after `let range = RANGE.cruise;`; after `points(r)`, `due(clock, hz = 20)`: false while `clock - drawn < 1 / hz`, else `drawn = clock`, true.
  - `mkdir -p src/runtime/hud/flight && git mv src/components/galaxy/radarDraw{,.test}.js src/runtime/hud/flight/`.
  - GS imports from `'../../lib/combat/flight/radar'`, `'../../runtime/hud/flight/radarDraw'`; `let radarAt = 0;` goes; the throttle's 2 lines → `    if (!radar.due(state.clock)) return;`.
- [ ] **Step 4: Run it to pass.** `Tests 9 passed (9)`; four gates pass; health 476/5/22/68; `wc -l` US 6,407, GS 3,090; chunks as `$S/bundle.txt`. `git diff --cached -C --stat`: radarDraw.js and radarDraw.test.js as renames `| 0`, radar.test.js and radar.js as renames whose only changed lines are imports and `due`; `git diff --cached --color-moved` shows `forward` moved from ship.js to orient.js.
- [ ] **Step 5: Browser gate.** Task 3 Step 5 with `T=t6`.
- [ ] **Step 6: Commit.**
```
git add src/lib/combat/flight/radar.{js,test.js} src/runtime/hud/flight/radarDraw.{js,test.js} src/lib/flight/orient.js src/components/universe/ship.js src/components/galaxy/scene.js
git commit -F - <<'EOF'
The radar to lib, its picture to the HUD kit, forward to orient

It goes on both maps, so its one importer reads it from lib; the
throttle becomes radar.due(clock).
boundary-breaks 478 → 476; scenes 6,407/3,090 lines.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RQ72Qap4ZJEK2vaPYx5CVD
EOF
```


### Task 7: One sight takes both maps’ lock, lead, nudge, aim and lean (A5)

**Files:**
- Create: `src/lib/combat/flight/sight.js`; `src/lib/combat/flight/fixtures/fight.js` (the reference code, helpers and fight driver)
- Test: `src/lib/combat/flight/sight.test.js`
- Modify: `src/components/universe/scene.js` (US) [190, 291, 2277, 2407-2408, 4393-4397, 4532-4563] and `src/components/galaxy/scene.js` (GS) [107, 187, 450, 1023-1024, 1471-1480, 1681-1684, 1815-1843], main’s (Task 5 moved US’s past 233 up 2); Steps 5–6 quote each line.

**Interfaces:**
- Consumes (Task 4): `src/lib/combat/flight/targeting.js`’s `AIM`, `nose`, `dirTo`, `track`, `intercept`, `assistAmount`, `assist`, `trackNudge`, unchanged.
- Produces:
  - `sight.js`: `TRACK_AFTER_SHOT = 1500`; `createSight(state)` → `{ update(ship, cands, dt, o) → ticked, inReach(), aim(dir, ship, strength) → dir, nudge(ship, stick, strength) → { turn, climb } | null, find(id) → target | null, pickAt(x, y, project, reach = 48) → id | null, lean(bias, ship, dt, reduced), cands, foes }`, `o = { speed, life, help() → { assist }, tracks(t) → bool, foes? }`; `foes` is the last `o.foes`, else `cands`. It writes `state.lock`, `cycle = 0`, `lockTarget`, `trackable`, `lead`, `hot`. `o.quiet` waits for Task 14.
  - `fixtures/fight.js`: `todayLock`, `todayNudge`, `todayAim`, `DT`, `v`, `ship`, `T`, `fresh`, `feed`, `fight(map)`, for Tasks 11–15’s `sight.fixes.test.js`; Task 11 gives `todayLock` its own ring.
  - Per scene: `sight`, `sightIn` (the one kept `o`), `foeBuf`; GS also `lockWar`, and `eyeLine` for its old `sight` Vector3.

- [ ] **Step 1: Write the fixture and the failing test.** `fixtures/fight.js` imports vitest’s `expect`, the eight targeting names and `createSight`, keeps its own `const TRACK_AFTER_SHOT = 1500;`, and exports today’s code:
  - `todayLock(state, ship, cands, dt, env)`: US’s lock block word for word, with `env.hunters`, `env.now`, `env.assist`, `env.reduced` for `hunters?.targets`, `performance.now()`, `controls().assist`, `reduced`; GS’s trackable line (`warCands` → `env.war`) when `env.map === 'galaxy'`; the `lockSound()` line → `const ticked = Boolean(tgt && tgt.id !== was);`; `return ticked;` last.
  - `todayNudge(state, ship, strength, stick)`: GS’s nudge `if` as a ternary, `trackNudge(ship, state.lead, strength, stick)` or `null`.
  - `todayAim(state, s, strength)`: fire’s `let dir = nose(s);` and the line after, `strength` for `powers.aim(controls()).assist`; `return dir;`.

  Then:
```js
export const DT = 1 / 60;
export const v = (x, y, z) => ({ x, y, z });
export const ship = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, bank: 0, speed: 0 }; // (nose along −z)
export const T = (id, x, y, z, vel = v(0, 0, 0)) => ({ id, at: v(x, y, z), vel, size: 0.3 });
export const fresh = () => ({ lock: null, lockTarget: null, lead: null, hot: false, cycle: 0, bias: [0, 0, 0], lastShot: -1e9 });
// (A5's inputs: the blaster's speed and life, the raw setting)
export const feed = (more = {}) => ({ speed: AIM.bolt, life: AIM.life, help: () => ({ assist: 1 }), tracks: () => true, ...more });

export function fight(map) {
  const [a, b] = [fresh(), fresh()];
  const sight = createSight(b);
  const bias = b.bias;
  const H = ['h1', 'h2', 'h3'].map((id) => T(id, 0, 0, 0));
  H[1].threat = 1;
  const W = [T('w1', 0, 0, 0)];
  const env = { map, hunters: H, war: W, now: 0, assist: 1, reduced: false };
  const tracks = (t) => H.includes(t) || (map === 'galaxy' && W.includes(t)) || env.now - b.lastShot < TRACK_AFTER_SHOT;
  const o = feed({ help: () => ({ assist: env.assist }), tracks });
  const seen = { ticks: 0, hot: 0, nudges: 0, followed: 0, unfollowed: 0 };
  for (let f = 0; f < 1800; f++) {
    const t = f * DT;
    const s = { x: Math.sin(t * 0.3) * 20, y: Math.sin(t * 0.7) * 3, z: -t * 6, heading: Math.sin(t * 0.4) * 1.2, pitch: Math.sin(t * 0.9) * 0.3, speed: 8 * Math.sin(t * 0.5) };
    H.forEach((h, i) => {
      h.at = v(s.x + Math.sin(t * (0.5 + i * 0.3) + i) * 25, s.y + Math.cos(t * 0.8 + i) * 6, s.z - 30 + Math.cos(t * (0.4 + i * 0.2)) * 40);
      h.vel = v(Math.cos(t + i) * 12, 0, Math.sin(t * 0.7 + i) * 15);
    });
    const n0 = nose(s);
    if (f % 300 >= 150 && f % 300 < 250) Object.assign(H[0], { at: v(s.x + n0[0] * 20 + 0.5, s.y + n0[1] * 20, s.z + n0[2] * 20), vel: v(1, 0, 0) });
    W[0].at = v(s.x + 10, s.y, s.z - 50 + Math.sin(t) * 20);
    const pilot = T('p1', s.x + Math.sin(t * 2) * 8, s.y, s.z - 25, v(5, 0, 0)); // (afresh each frame, as pilots.targets are)
    const rock = T('r1', s.x - 5, s.y + 1, s.z - 15);
    env.now = f * (1000 / 60);
    env.assist = [1, 0, 2.5, 0.4][Math.floor(f / 150) % 4];
    env.reduced = f > 1650 && f < 1750;
    if (f % 97 === 0) a.lastShot = b.lastShot = env.now;
    if ([30, 31, 400, 405, 200, 700].includes(f)) a.cycle = b.cycle = f === 200 || f === 700 ? -1 : 1;
    if (f === 1000) for (const st of [a, b]) st.lock = { id: 'p1', out: 0, manual: true };
    if (f === 1200) for (const st of [a, b]) Object.assign(st, { lock: null, lockTarget: null, lead: null });
    const cands = f % 300 < 100 ? H : map === 'universe' ? [...H, pilot, rock] : [...H, ...W, pilot];
    const stick = { turn: Math.sin(t * 3) * 0.5, climb: Math.cos(t * 2) * 0.3 };
    const strength = [1, 0.5, 0, 2][f % 4];
    const n = todayNudge(a, s, strength, stick);
    expect(sight.nudge(s, stick, strength)).toEqual(n);
    expect(sight.aim(n0, s, strength)).toEqual(todayAim(a, s, strength));
    const ticked = todayLock(a, s, cands, DT, env);
    o.speed = AIM.bolt + Math.max(0, s.speed);
    expect(sight.update(s, cands, DT, o)).toBe(ticked);
    sight.lean(b.bias, s, DT, env.reduced);
    for (const k of ['lock', 'cycle', 'trackable', 'lead', 'hot', 'bias']) expect(b[k]).toEqual(a[k]);
    expect(b.lockTarget).toBe(a.lockTarget);
    seen.ticks += ticked;
    seen.hot += a.hot;
    seen.nudges += Boolean(n);
    if (a.lockTarget && !H.includes(a.lockTarget)) seen[a.trackable ? 'followed' : 'unfollowed'] += 1;
  }
  // (its records kept: the same bias array, no key today's code didn't write)
  expect(b.bias).toBe(bias);
  expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
  return seen;
}
```

  `sight.test.js` (values probed on today’s targeting):
```js
import { describe, expect, it } from 'vitest';
import { AIM, nose } from './targeting';
import { TRACK_AFTER_SHOT, createSight } from './sight';
import { DT, T, feed, fight, fresh, ship } from './fixtures/fight';

const atLeast = (seen, min) => Object.entries(min).forEach(([k, n]) => expect(seen[k], k).toBeGreaterThanOrEqual(n)); // (the fight took every branch)

describe('the sight', () => {
  it('matches each map’s old lock block, nudge, aim and lean frame for frame through a 30 s fight', () => {
    expect(TRACK_AFTER_SHOT).toBe(1500);
    atLeast(fight('universe'), { ticks: 5, hot: 50, nudges: 500, followed: 100, unfollowed: 1 });
    atLeast(fight('galaxy'), { ticks: 5, hot: 50, nudges: 500, followed: 100 });
  });

  it('locks and ticks once, in reach up to the bolt’s life, reading help after lockTarget and only in reach', () => {
    const st = fresh();
    const sight = createSight(st);
    const a = T('a', 0, 0, -20);
    const saw = [];
    const o = feed({ help: () => saw.push(st.lockTarget) && { assist: 1 } });
    expect(sight.update(ship, [a], DT, o)).toBe(true);
    expect(st).toMatchObject({ lock: { id: 'a', out: 0 }, cycle: 0, trackable: true, lead: { x: 0, y: 0, z: -20, t: 1 / 3 }, hot: true });
    expect(saw[0]).toBe(a);
    expect(sight.update(ship, [T('a', 0, 0, -55)], DT, o)).toBe(false); // (the same id: no tick)
    expect(st.lead.t).toBeCloseTo(0.9166666666666666, 12);
    expect([st.hot, sight.inReach(), sight.nudge(ship, { turn: 0, climb: 0 }, 1), saw.length]).toEqual([false, false, null, 1]);
    const dir = nose(ship);
    expect(sight.aim(dir, ship, 1)).toBe(dir);
    sight.update(ship, [T('a', 0, 0, -51)], DT, o);
    expect([st.lead.t, st.hot, sight.inReach()]).toEqual([AIM.life, true, true]);
    expect(sight.update(ship, [], DT, o)).toBe(false);
    expect([st.lock, st.lockTarget, st.lead, st.hot, st.trackable]).toEqual([null, null, null, false, false]);
  });

  it('finds an id among the ungated foes, then the lock’s own list', () => {
    const sight = createSight(fresh());
    const [a, p, rock] = [T('a', 0, 0, -20), T('p', 5, 0, -20), T('rock', 0, 5, -30)];
    const cands = [a, p];
    sight.update(ship, cands, DT, feed({ foes: [a, rock] }));
    expect([sight.find('rock'), sight.find('p'), sight.find('zz'), sight.find(null)]).toEqual([rock, p, null, null]);
    sight.update(ship, cands, DT, feed());
    expect(sight.cands).toBe(cands);
    expect(sight.foes).toBe(cands);
    expect(sight.find('rock')).toBeNull();
  });

  it('picks the nearest target in front under a tap', () => {
    const project = (x, y, z, out) => Object.assign(out, { x: 400 + x * 10, y: 300 - y * 10, z: -z });
    const sight = createSight(fresh());
    sight.update(ship, [T('c', 0, 0, 20), T('d', 0, 0, -0.3), T('a', 0, 0, -20), T('b', 3, 0, -20)], DT, feed());
    // (c behind and d at depth 0.3, never; 415 a tie, the first; 480 is 50 px off b)
    expect([400, 425, 415, 480].map((x) => sight.pickAt(x, 300, project))).toEqual(['a', 'b', 'a', null]);
    expect(sight.pickAt(480, 300, project, 60)).toBe('b');
  });

  it('holds through a still frame and a 0.05 s spike, and runs with nothing to lock and no hunters', () => {
    // (review focus 1 and 4: a frozen frame, a tab come back, reduced motion)
    const st = fresh();
    const sight = createSight(st);
    const o = feed({ tracks: () => false });
    const a = () => T('a', 0, 0, -20, { x: 4, y: 0, z: 0 });
    sight.update(ship, [a()], DT, o);
    for (const dt of [0, 0.05, 0]) {
      sight.update(ship, [a()], dt, o);
      expect(st.lock.id).toBe('a');
      expect([st.lead.x, st.lead.y, st.lead.z, st.lead.t].every(Number.isFinite)).toBe(true);
    }
    expect(() => sight.update(ship, [], 0.05, o)).not.toThrow();
    expect([st.lock, st.hot, st.trackable, sight.find('a')]).toEqual([null, false, false, null]);
  });
});
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run src/lib/combat/flight/sight.test.js`: `Error: Cannot find module './sight'`, `Tests no tests`.

- [ ] **Step 3: Implement `src/lib/combat/flight/sight.js`**, pure, importing from `./targeting` only; its header says the names stay on `state` for their readers (the HUD, `powers.aim`, the pilots, the checks).
  - `export const TRACK_AFTER_SHOT = 1500;` with the scenes’ comment. `createSight` keeps `life`, `foes` and one point for `pickAt`; `cands` and `foes` start as a frozen `[]`.
  - `update`: `sight.cands = cands`, `foes = sight.foes = o.foes ?? cands`, `life = o.life`, then US’s block from `const was` to the `state.hot` line with `o.speed` for `AIM.bolt + Math.max(0, ship.speed)`, `life` for `AIM.life`, `o.help().assist` for `controls().assist` (same `&&`), trackable `Boolean(tgt && (o.tracks(tgt) || state.lock.manual))`, no `lockSound()`; returns `Boolean(tgt && tgt.id !== was)`.
  - `inReach()` is `Boolean(state.lead && state.lead.t <= life)`. `aim` is fire’s `assist` line, `nudge` GS’s nudge, each with `inReach()` for `state.lead && state.lead.t <= AIM.life`; out of reach `aim` returns `dir` itself, `nudge` `null`.
  - `find`: `foes`, then `sight.cands`. `pickAt`: US’s `const pickHunter` loop over `sight.cands` with `project`, the kept point and `reach` (Task 15 wires it).
  - `lean`: US’s `let bx = 0;` to `state.bias[2] += …`, `state.lockTarget` for `tgt`, `bias` for `state.bias`.

- [ ] **Step 4: Run it to see it pass.** Step 2’s command: `Tests 5 passed (5)`.

- [ ] **Step 5: Wire US.**
  - The `./targeting` import keeps `{ AIM, aimAngles, edgeOf, nose, onScreen }`; under it, `import { TRACK_AFTER_SHOT, createSight } from '../../lib/combat/flight/sight';`. Delete `const TRACK_AFTER_SHOT`.
  - After `const controls = () => props.controls ?? CONTROL_DEFAULTS;`:
    ```js
      // the player's targeting (lib/combat/flight/sight.js); foeBuf: every foe, ungated, for its find
      const sight = createSight(state);
      const foeBuf = [];
      const sightIn = { speed: AIM.bolt, life: AIM.life, help: controls, tracks: (t) => Boolean(hunters?.targets.includes(t)) || performance.now() - state.lastShot < TRACK_AFTER_SHOT, foes: foeBuf };
    ```
  - Fire’s `let dir = nose(s);` and the `dir = assist(…)` line → `const dir = sight.aim(nose(s), s, powers.aim(controls()).assist); // (Force Focus's help onto the game's ships only)`.
  - The nudge comment’s `(targeting.js:` → `(sight.nudge:`; `if (state.view !== 'map' && state.trackable && …) {` and the `trackNudge` line → `const n = state.view !== 'map' ? sight.nudge(state.ship, input, powers.aim(controls()).track) : null;` and `if (n) {`.
  - `const was = state.lock?.id ?? null;` through the `state.hot = …` line, comments too, → the lines below; `let bx = 0;` through `state.bias[2] += …` → `sight.lean(state.bias, ship, dt, reduced);`.
    ```js
        foeBuf.length = 0; // (every foe, ungated, for the sight's find)
        for (const c of hunters?.targets ?? []) if (!c.prey) foeBuf.push(c);
        foeBuf.push(...battleCands, ...(skirmishes?.active ? skirmishes.targets : []), ...(npcs?.targets ?? []), ...capitalCands, ...siegeCands);
        if (meteors.count || mines.count) foeBuf.push(...meteors.targets, ...mines.targets);
        sightIn.speed = AIM.bolt + Math.max(0, ship.speed);
        if (sight.update(ship, cands, dt, sightIn) && state.shown && !document.hidden) lockSound();
    ```

- [ ] **Step 6: Wire GS** as Step 5 (its targeting import, Task 4’s, trimmed alike), but:
  - `const sight = new THREE.Vector3();` → `const eyeLine = …`, and its three uses in `aimAt`.
  - `let lockWar = NO_TARGETS; // (this frame's war list: the nose follows the war's ships too)` follows `foeBuf`, and `tracks` has `|| lockWar.includes(t)` inside its `Boolean(…)`.
  - The nudge has no map gate: `const n = sight.nudge(state.ship, input, powers.aim(controls()).track);`.
  - `const was …` through `state.bias[2] += …` → Step 5’s six lines with its second to fourth as `for (const c of hunters?.targets ?? NO_TARGETS) if (!c.prey) foeBuf.push(c);`, `for (const c of warCands) foeBuf.push(c);` and `lockWar = warCands;`, then `sight.lean(state.bias, ship, dt, reduced);`.

- [ ] **Step 7: Run the gates.** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`: all clean, all tests pass, health within budget at Task 6’s numbers (boundary-breaks 476, kbd-styles 68, big-files 22, cycles 5). `wc -l`: US 6387, GS 3072.

- [ ] **Step 8: Browser gate.** With Task 1 Step 5’s `export` line and dev server on 5188:
  ```
  for q in high low; do
    node scripts/universe-check.mjs --quality $q --lock --out "$S/t7/$q"
    node scripts/shot-compare.mjs "$S/run1/$q" "$S/t7/$q" --floor docs/superpowers/evidence/flight-core/floor-$q.json
  done
  OUT="$S/t7/galaxy" node scripts/galaxy-hud-check.mjs
  ```
  Expected: both compares print `within the floor`; galaxy-hud-check prints only `ok` lines, `T locks a target and the cluster names it` among them, exits 0, and its shots look right.

- [ ] **Step 9: Commit.**
  ```
  git add src/lib/combat/flight/{sight.js,sight.test.js,fixtures/fight.js} src/components/{universe,galaxy}/scene.js
  git commit -F - <<'EOF'
  One sight in lib takes both maps' lock, lead, nudge and lean

  Each scene kept a copy of the player's targeting; the sight holds it
  once and writes the same state fields.

  Scenes: universe 6387 lines, galaxy 3072.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RQ72Qap4ZJEK2vaPYx5CVD
  EOF
  ```

### Task 8: One flight overlay: record, writer, markup (A6)

**Files:**
- Create: `src/runtime/hud/flight/frame.js`, `flightHud.js`, `FlightHud.jsx`
- Modify: `src/lib/combat/flight/targeting.js` (`nose`, `edgeOf`: optional `out`) and `targeting.test.js` (one case); `src/runtime/hud/index.js`; `src/components/universe/UniverseMap.jsx:17`, `:359-393`; `src/components/galaxy/GalaxyView.jsx:19`, `:256-288`
- Modify by line text: `src/components/universe/scene.js` (the `'./targeting'` import, `SHIP_NAMES`, `let hud = { root: null };` to `const range = …`, `placeHud`, both `staticOn` places, `placeFootHud`); `src/components/galaxy/scene.js` (the `targeting'` and `radarDraw'` imports, `const range = (d) =>`, `let hud = { root: null };` to `placeMark`'s close, `courseGoal`, `const threatList = [];` to `placeHud`'s close)
- Test: `src/runtime/hud/flight/frame.test.js`, `flightHud.test.js`, `FlightHud.test.jsx`

**Interfaces:**
- Consumes: Task 4's `nose`, `onScreen`, `edgeOf`, `AIM.life`; `toScreen(x, y, z, out)`; `shortDistance`; Task 7's `state.lockTarget`, `state.lead`, `state.hot`.
- Produces: frame.js `createFrame()` (the spec's record, `cluster` to `alt` null till Task 26), `fillFlight(frame, v, project) → frame` (`v` as frame.test's `view()`, with `bracket = BRACKET`, `navMin = 34`), `distText(d)`, `BRACKET`; `createFlightHud({ distText }) → { place(root, frame), writes }`; `export function FlightOverlay({ hudRef = null, crosshair = null })` and `export default function FlightHud` (the same props) composing it; per scene `frame`, `flightHud`, `hudIn`; the universe's `FOOT_LOCK`, `navGoalFor(s)`.

- [ ] **Step 1: Write the failing tests.** `src/runtime/hud/flight/frame.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { createFrame, fillFlight } from './frame.js';

const project = (x, y, z, out) => ((out.x = x), (out.y = y), (out.z = z), out);
const P = (x, y, z) => ({ x, y, z });
const SHIP = { x: 720, y: 450, z: 0, heading: Math.PI / 2, pitch: 0 };
const view = (o = {}) => ({ on: true, gun: true, foot: false, ship: SHIP, hot: false, hit: false, kill: false, static: false, rect: { x: 0, y: 0, w: 1440, h: 900 }, tanHalf: 0.5, h: 900, lock: null, lockName: '', lockText: null, lead: null, life: 0.85, threatsFrom: [], mates: null, to: null, goal: null, navMax: 260, ...o });
const fill = (o) => fillFlight(createFrame(), view(o), project);
const r6 = (n) => n.toFixed(6);
const LOCK = { id: 'h1', at: P(700, 400, 50), size: 2, hp: 2, hpMax: 3 };
const LEAD = { x: 720, y: 450, z: 30, t: 0.85 };
// a, b, g off the screen; c on it; d behind; e calm; f the lock
const [A, B, C, D, E, F, G] = [[2000, 450, 10, 1], [-300, 450, 10, 0.5], [720, 450, 100, 1], [720, 450, -50, 1], [3000, 450, 10, 0], [760, 450, -20, 1], [720, 5000, 10, 1]].map(([x, y, z, threat], i) => ({ id: 'abcdefg'[i], at: P(x, y, z), threat }));
const MATES = [[1500, 450, 10], [720, 450, 50], [-100, 450, 10], [720, -500, 10], [720, 1500, 10]].map(([x, y, z], i) => ({ id: `m${i + 1}`, name: `M${i + 1}`, at: P(x, y, z) }));
const GOAL = { at: [720, 450, 100], reach: 10, way: true, name: 'Tatooine', text: null };
const FOOT = { foot: true, gun: false, ship: null, hot: true, lock: { id: 't1', at: P(700, 400, 40), size: 1.8, dist: 12.4 }, lockText: '12 m', bracket: { k: 1.6, min: 26, max: 120 }, goal: { ...GOAL, reach: 0, way: false, text: '35 m', dist: 35.2 }, navMin: 40, navMax: 40 };

describe('the flight HUD’s record', () => {
  it('brackets the lock ×2.6, 30 to 140, and leads it', () => {
    const { lock } = fill({ lock: LOCK, lockName: 'TIE', hot: true });
    expect(lock).toMatchObject({ on: true, x: 700, y: 400, z: 50, hot: true, name: 'TIE', text: null, tough: true });
    expect([lock.r, lock.dist, lock.hp].map(r6)).toEqual(['93.600000', r6(Math.sqrt(5400)), '0.666667']);
    expect([500, 5, -5].map((z) => fill({ lock: { ...LOCK, at: P(700, 400, z) } }).lock.r)).toEqual([30, 140, 30]);
    expect(fill({ lock: { ...LOCK, hpMax: undefined } }).lock.tough).toBe(false);
    expect([{}, { t: 0.86 }, { x: 5 }, { x: 10 }].map((d) => fill({ lock: LOCK, lead: { ...LEAD, ...d } }).lead.on)).toEqual([true, false, false, true]);
    expect(fill({ lead: LEAD }).lead.on).toBe(false);
  });
  it('arrows the threats off the screen, nearest first, at most 3, leaving out the lock and the calm', () => {
    const f = fill({ lock: { ...F, size: 1 }, threatsFrom: [[A, B, C, E], null, [D, F, G]] });
    expect([f.threats.n, f.threats.at.map(({ x, y, z }) => [x, y, z])]).toEqual([3, [[720, 450, -50], [-300, 450, 10], [2000, 450, 10]]]);
  });
  it('arrows the mates off the screen, the pilot flown to among them, at most 4', () => {
    const names = (id) => fill({ mates: MATES, to: { id, name: 'W', at: P(720, 450, -5) } }).mates.at.map((m) => m.name);
    expect([names('p'), names('m1')]).toEqual([['W', 'M1', 'M3', 'M4'], ['M1', 'M3', 'M4', 'M5']]);
  });
  it('sizes the nav at reach × 2.2, clamped per map', () => {
    const { nav } = fill({ goal: GOAL });
    expect([nav, r6(nav.r)]).toMatchObject([{ on: true, x: 720, z: 100, way: true, name: 'Tatooine', dist: 100, text: null }, '198.000000']);
    expect([[20, 260], [20, 225], [0, 260]].map(([reach, navMax]) => fill({ goal: { ...GOAL, reach }, navMax }).nav.r)).toEqual([260, 225, 34]);
  });
  it('on foot: the lock ×1.6 in the map’s words, threats and mates left alone', () => {
    const f = fill(FOOT);
    expect([f.lock, r6(f.lock.r), f.reticle.on, f.lead.on, f.threats, f.mates]).toMatchObject([{ on: true, hot: true, dist: 12.4, text: '12 m', tough: null }, '64.800000', false, false, null, null]);
    expect([f.nav.r, f.nav.dist, f.nav.text]).toEqual([40, 35.2, '35 m']);
  });
  it('shows nothing while on is false', () => {
    const f = fill({ on: false, lock: LOCK, lead: LEAD, goal: GOAL, threatsFrom: [[A]], mates: MATES });
    expect([f.reticle.on, f.lock.on, f.lead.on, f.threats.n, f.mates.n, f.nav.on]).toEqual([false, false, false, 0, 0, false]);
  });
  it('fills the same records every frame, and hands the arrows’ back after a walk', () => {
    const f = createFrame();
    const parts = () => [f.reticle, f.lock, f.lead, f.nav, f.threats, f.mates, f.threats.at[0], f.mates.at[3]];
    const kept = parts();
    for (let i = 0; i < 100; i++) fillFlight(f, view({ lock: LOCK, lead: LEAD, goal: GOAL, threatsFrom: [[A, B, D]], mates: MATES }), project);
    [FOOT, {}].forEach((o) => fillFlight(f, view(o), project));
    parts().forEach((r, i) => expect(r).toBe(kept[i]));
  });
});
```

`src/runtime/hud/flight/flightHud.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { createFrame, distText } from './frame.js';
import { createFlightHud } from './flightHud.js';

// (a stand-in element: its last writes in `at`, their count in `n`; all writes in `total`)
let total = 0;
const el = () => {
  const e = { n: 0, at: {}, firstChild: null };
  const w = (k) => (v) => {
    e.n++;
    total++;
    e.at[k] = v;
  };
  e.toggleAttribute = (a, v) => w(a)(v);
  e.style = { setProperty: (k, v) => w(k)(v), set transform(v) { w('transform')(v); } };
  Object.defineProperty(e, 'textContent', { set: w('text') });
  return e;
};
const setUp = () => {
  const $ = Object.fromEntries(['reticle', 'lock', 'lock-name', 'lock-dist', 'lead', 'nav', 'nav-name', 'nav-dist'].map((c) => [c, el()]));
  const threats = [el(), el(), el()];
  const mates = [1, 2, 3, 4].map(() => Object.assign(el(), { firstChild: el() }));
  const root = Object.assign(el(), { querySelector: (c) => $[c.slice(10)], querySelectorAll: (c) => (c === '.universe-threat' ? threats : mates) });
  const hud = createFlightHud({ distText });
  const f = Object.assign(createFrame(), { on: true, rect: { x: 0, y: 0, w: 1440, h: 900 } });
  Object.assign(f.reticle, { on: true, x: 720.04, y: 449.96, hot: true, hit: false, kill: true });
  Object.assign(f.lock, { on: true, x: 700, y: 400, z: 50, r: 93.6, hot: false, name: 'TIE', dist: 12.34, text: null, tough: true, hp: 2 / 3 });
  Object.assign(f.lead, { on: true, x: 710.06, y: 440, hot: true });
  const again = () => (hud.place(root, f), hud.writes);
  again();
  return { $, root, threats, mates, f, again };
};

describe('the flight HUD’s writer', () => {
  it('writes the gun line and the lock as placeHud did', () => {
    const { $, f, again } = setUp();
    expect($.reticle.at).toEqual({ 'data-on': true, transform: 'translate3d(720.0px, 450.0px, 0)', 'data-hot': true, 'data-hit': false, 'data-kill': true });
    expect($.lock.at).toEqual({ 'data-on': true, transform: 'translate3d(700.0px, 400.0px, 0)', 'data-off': false, '--r': '94px', 'data-hot': false, 'data-tough': true, '--hp': '0.667' });
    expect([$['lock-name'].at.text, $['lock-dist'].at.text]).toEqual(['TIE', '12']);
    f.lock.dist = 9.96;
    const tenth = [again(), $['lock-dist'].at.text];
    f.lock.text = '12 m';
    expect([...tenth, again(), $['lock-dist'].at.text]).toEqual([1, '10.0', 1, '12 m']);
  });
  it('turns on as many arrows as the record has, at the edge, a mate’s named', () => {
    const { threats, mates, f, again } = setUp();
    f.threats.n = 1;
    Object.assign(f.threats.at[0], { x: 720, y: 2000, z: 10 });
    f.mates.n = 1;
    Object.assign(f.mates.at[0], { x: 2000, y: 450, z: -50, name: 'M1' });
    again();
    expect([...threats, ...mates].map((t) => t.at['data-on'])).toEqual([true, false, false, true, false, false, false]);
    expect([threats[0].at, mates[0].at.transform, mates[0].at['--a'], mates[0].firstChild.at.text]).toEqual([{ 'data-on': true, '--a': '1.571rad', transform: 'translate3d(720.0px, 872.0px, 0)', 'data-off': true }, 'translate3d(28.0px, 450.0px, 0)', '-3.142rad', 'M1']);
  });
  it('leaves a null part, and the hp flag while tough is null; sets data-static', () => {
    const { root, threats, $, f, again } = setUp();
    f.threats.n = 1;
    Object.assign(f.threats.at[0], { x: 2000, y: 450, z: 10 });
    again();
    const before = threats[0].n;
    Object.assign(f, { threats: null, static: true });
    Object.assign(f.lock, { tough: null, hp: 0.1 });
    again();
    expect([threats[0].n, threats[0].at['data-on'], $.lock.at['data-tough'], $.lock.at['--hp'], root.at['data-static']]).toEqual([before, true, true, '0.667', true]);
  });
  it('writes only what changed: none for the same record, five a frame with a lock held', () => {
    const { $, f, again } = setUp();
    const n = total;
    expect([again(), total]).toEqual([0, n]);
    f.reticle.hot = false;
    expect(again()).toBe(1);
    Object.assign(f.reticle, { x: 721.04 });
    Object.assign(f.lock, { x: 701, r: 95.2, dist: 13.2 });
    Object.assign(f.lead, { x: 711.06 });
    expect([again(), $.lock.at['--r'], $['lock-dist'].at.text, $.lead.at.transform]).toEqual([5, '95px', '13', 'translate3d(711.1px, 440.0px, 0)']);
  });
});
```

`src/runtime/hud/flight/FlightHud.test.jsx`:

```jsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { FlightOverlay } from './FlightHud.jsx';
import Reticle from '../Reticle.jsx';

// both old copies (UM:359-393, GV:256-288), rendered: one string while flying
const s = (c, inner = '') => `<span class="universe-${c}">${inner}</span>`;
const b = (...cs) => cs.map((c) => `<b class="universe-${c}"></b>`).join('');
const GUN = s('reticle');
const OVERLAY = `<div class="universe-hud" aria-hidden="true">${GUN}${s('lock', '<i></i>'.repeat(4) + b('lock-name', 'lock-dist', 'lock-hp'))}${s('threat').repeat(3)}${s('mate', b('mate-name')).repeat(4)}${s('lead')}${s('nav', '<i></i>' + b('nav-name', 'nav-dist'))}</div>`;

describe('FlightOverlay', () => {
  it('is the markup both maps drew, child for child', () => {
    expect(html(<FlightOverlay />)).toBe(OVERLAY);
  });
  it('takes the on-foot crosshair right after the gun line, under the brackets', () => {
    const crosshair = <Reticle className="universe-foot-reticle" state={{ shown: true, tight: 0.5, locked: true }} />;
    expect(html(<FlightOverlay crosshair={crosshair} />)).toBe(OVERLAY.replace(GUN, GUN + html(crosshair)));
  });
});
```

- [ ] **Step 2: Run them to fail.** `npx vitest run src/runtime/hud/flight`: the three new files fail to load; radarDraw.test.js passes.

- [ ] **Step 3: Implement.**
  - `src/lib/combat/flight/targeting.js` gains optional out records, so the HUD allocates nothing while every current caller is unchanged: `nose(s, out = [0, 0, 0])` fills and returns `out`; `edgeOf(dx, dy, rect, pad = 28, out = { x: 0, y: 0, angle: 0 })` likewise. targeting.test.js gains `it('fills an out record when given one', …)`: `const o = [9, 9, 9]; expect(nose({ heading: 0, pitch: 0 }, o)).toBe(o); expect(o).toEqual([-0, 0, -1]);` and `const e = { x: 0, y: 0, angle: 0 }; expect(edgeOf(1, 0, { x: 0, y: 0, w: 200, h: 100 }, 28, e)).toBe(e); expect(e).toEqual({ x: 172, y: 50, angle: 0 });`. frame.js and flightHud.js pass kept records.
  - `frame.js` imports `nose`, `onScreen` from `'../../../lib/combat/flight/targeting.js'`, copies the scene's `clamp` and `apart`, and follows both `placeHud`s line for line. A module `WeakMap` gives back the arrows' records a frame on foot nulled; the arrows allocate nothing (one module array and comparator, projections into `out.at[n]`).
  - `flightHud.js` (`edgeOf`, `onScreen`) takes the universe's `hudEls`, `setText`, `setOn`, `placeMark`; each write goes through `put(el, key, value, write)`, skipped when equal to that element's last, else counted, numbers compared before strings are made. `place` zeroes `writes`, returns on a `null` root, re-reads a new root, writes in today's order (root `data-static`, reticle, lock, threats, mates, lead, nav), and skips a `null` part.
  - `FlightOverlay` is UM:359-393 with `ref={hudRef}` and `{crosshair}` for the Reticle and its comment; `FlightHud` renders `<FlightOverlay hudRef={hudRef} crosshair={crosshair} />`.
  - index.js, after the `from './cluster.js'` export: `export { default as FlightHud } from './flight/FlightHud.jsx';`.

- [ ] **Step 4: Run them to pass.** Step 2's command: frame.test.js (7), flightHud.test.js (4), FlightHud.test.jsx (2) and radarDraw.test.js pass, none failed.

- [ ] **Step 5: Mount it.** UM: `FlightHud` joins the kit import; `:359-393` become the Reticle comment and `<FlightHud hudRef={hud} crosshair={<Reticle className="universe-foot-reticle" state={onFoot ? reticle : null} />} />`. GV: `import { FlightHud } from '../../runtime/hud';` after `import KeysCard`; `:256-288` become `<FlightHud hudRef={hud} />`.

- [ ] **Step 6: Wire the universe scene.**
  - The targeting import loses `edgeOf`, `onScreen`; after the `cluster.js` import, import `{ createFrame, fillFlight }` from `'../../runtime/hud/flight/frame.js'` and `{ createFlightHud }` from `'../../runtime/hud/flight/flightHud.js'`. After `SHIP_NAMES`: `const FOOT_LOCK = { k: 1.6, min: 26, max: 120 };`.
  - `let hud` to `const range` become the made-once `frame = createFrame()`, `flightHud = createFlightHud({ distText: shortDistance })` (ship-lengths till Task 23), `hudIn` (`threatsFrom: [null, null]`), and `toIn`, `navIn`, `footBack` (`v.to`'s and `v.goal`'s shapes).
  - After `navGoal`, `navGoalFor(s)` runs `navGoal(s)` and placeHud's `const mate = pilotId(goal.id)` to `const at =` lines: `null` where `if (!at)` hid the diamond, else `navIn` with `at`, today's `reach`, `goal.way` and name. `navTo` stays.
  - `placeHud`: `const root = props.hud?.current ?? null; if (!root) return flightHud.place(null, frame); if (onFoot()) return placeFootHud(root);`, the `footReticle` reset, the flying column, then `fillFlight(frame, hudIn, toScreen); flightHud.place(root, frame);`. `placeFootHud(root)`: its `info`, `on`, `ret`, `emit` lines, the foot column, those two calls.
  - Delete both `staticOn` places.

  Other fields keep today's expressions (`on`, `rect`, `tanHalf`, `h: size.h`, `lock: on ? <target> : null`, `lockName`, `lead: state.lead`, `life: AIM.life`); `t` is the lock, `lockName` and `lockText` are set only with one, and an ‘if’ cell is `null` otherwise:

| `hudIn` | universe flying | on foot | galaxy |
| --- | --- | --- | --- |
| `gun` `foot` `ship` | `!state.auto` `false` `state.ship` | `false` `true` `null` | `!state.auto && !state.jump` `false` `state.ship` |
| `hot` `hit` `kill` `static` | `state.hot` `state.hitMark > 0` `false` `state.static > 0` | `true` `false` `false` `state.static > 0` | flying's; `state.killMark > 0`, `false` |
| `lockText` `bracket` | `null` `undefined` | `` `${Math.round(t.dist)} m` `` `FOOT_LOCK` | `null` `undefined` |
| `threatsFrom` | `[hunters?.targets, pilots.count ? pilots.targets : null]` | unread | `[hunters?.targets, war?.targets, pilots.count ? pilots.targets : null]` |
| `mates` `to` | `pilots.count ? pilots.mates : null`; `toIn` (`state.auto.pilot`, `state.auto.name ?? ''`, `pilots.at(id)`) if `on && pilots.count && state.auto?.pilot` | `null` `null` | flying's |
| `goal` | `on ? navGoalFor(s) : null` | `footBack` (`at` from `info.ship.at`'s x, y, z, `SHIP_NAMES[state.kind] ?? 'The ship'`, `` `${Math.round(back.dist)} m` ``, `back.dist`) if `on && info.ship.dist > 30` | today's; the jump's `dist:` → `text:`, the autopilot's → `text: null` |
| `navMin` `navMax` | `34` `Math.min(260, size.h * 0.25)` | `40` `40` | `34` `260` |

- [ ] **Step 7: Wire the galaxy scene.** As Step 6, the imports after the `radarDraw` one (frame.js's with `distText`); `const range` goes; `let hud` to `placeMark`'s close become `frame`, `flightHud = createFlightHud({ distText })`, `hudIn` (`threatsFrom: [null, null, null]`), `toIn`; `courseGoal`'s `dist:` → `text:`; `threatList`, `mateList` go; `placeHud` is the root guard, the galaxy column, today's goal block (`state.navGoal` kept), the two calls.

- [ ] **Step 8: Run the gates.** `npm run lint`, `npm test` (all pass, none failed), `npm run build`, `node scripts/health.mjs --check --skip build` (as after Task 7); `wc -l src/components/{universe,galaxy}/scene.js`, both below Task 7's.

- [ ] **Step 9: Verify in the browser.** Task 1 Step 5's `export` line and server, then:
  ```
  for q in high low; do
    node scripts/universe-check.mjs --quality $q --lock --out "$S/task8/$q"
    node scripts/shot-compare.mjs "$S/run1/$q" "$S/task8/$q" --floor docs/superpowers/evidence/flight-core/floor-$q.json
  done
  OUT="$S/task8/galaxy" node scripts/galaxy-hud-check.mjs
  ```
  Expected: `within the floor` twice; the galaxy only `ok` lines, exit 0, shots right by eye.

- [ ] **Step 10: Commit.**
  ```
  git add src/runtime/hud/flight src/runtime/hud/index.js src/components/universe/{scene.js,UniverseMap.jsx} src/components/galaxy/{scene.js,GalaxyView.jsx}
  git commit -F- <<'EOF'
  Both maps draw the flight overlay from one record, one kit writer and one markup

  The overlay was written twice: now one record, one writer, one markup.
  Scenes: universe <N> lines, galaxy <M> (Step 8's wc -l).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RQ72Qap4ZJEK2vaPYx5CVD
  EOF
  ```


### Task 9: One pool of bolts, and one hit list for each map

**Files:**
- Modify: `src/lib/combat/flight/guns.js` (Task 5's); `src/lib/combat/contact.js:6`, `:54-55`; `src/components/universe/hunterRules.js:78`, `:199`; by line text, `src/components/universe/scene.js`, `src/components/galaxy/scene.js`
- Test: `src/lib/combat/flight/guns.test.js`; `src/lib/combat/contact.test.js:2`, after `:24`; `src/components/universe/hunterRules.test.js:3`, after `:569`

**Interfaces:**
- Consumes: Task 4's `aimAngles(dir) → { heading, pitch }` (test only); Task 5's guns.js (no imports), guns.test.js, scene guns imports; Task 8's targeting imports `{ AIM, aimAngles, nose }`; `rounds.fly`'s `hit(m, from, to)`; uniqueArms' `strike(from, to, punch, opts)`.
- Produces:
  - `createGuns({ count = 40, point })` → `{ bolts, fire(at, dirs, speed, { life, punch, damage, heavy = false, scale }), step(dt, sources) → anyInFlight, strike(from, to, shot, sources) → hit | null, clear() }`; slot `{ on, at, from, v, life, punch, damage, heavy, warPunch, heading, pitch, scale, fresh }`; source `(from, to, shot) → truthy if taken`. `shotRadius(size)` (contact.js).
  - US: `guns`, `bolts`, `showBolts()`, `round`, `foeHits(test)`, Step 6's sources and `BOLT_HITS`, `UNIQUE_HITS = [hunterHits, farHits, frontHits]`, `STILL`, `uniqueShot`, `uniqueStrike(from, to, punch, opts)`. GS: `guns`, `myBolts`, `showBolts()`, `BOLT_HITS`, `UNIQUE_HITS`, `STILL`, `uniqueShot`, `uniqueStrike`.
  - Torpedo kills go through `hunterShot`/`pilotShot` only. A mesh's `userData` is its slot (`galaxy-hud-check/pickups.mjs:67` and Task 1's `inFlight()` read it).

- [ ] **Step 1: Write the failing tests.** contact.test.js: `shotRadius` joins line 2's import; after the `bodyRadius is tighter…` case:
```js
  it('shotRadius is a touch more than the size (the bolt’s rule), wider than bodyRadius', () => {
    expect(shotRadius(1)).toBe(1.02);
    expect(shotRadius(0.3)).toBe(0.39);
    expect(shotRadius(0.3)).toBeGreaterThan(bodyRadius(0.3));
  });
```
hunterRules.test.js: after line 3, `import { shotRadius } from '../../lib/combat/contact';`; after the hit-radius case:
```js
  it('hitRadius is the bolt’s shotRadius of the kind’s size, for every kind', () => {
    for (const type of Object.values(HUNTER_KINDS)) expect(hitRadius(type)).toBe(shotRadius(type.size));
  });
```
guns.test.js: `createGuns` joins the `./guns` import, add `import { aimAngles } from './targeting';`, append:
```js
const point = () => ({ x: 0, y: 0, z: 0, own: true }); // (the scenes': () => new THREE.Vector3())
const AT = { x: 1, y: 2, z: 3 };
const AHEAD = [0, 0, -1];
const LINE = { life: 1, punch: 2, damage: 7, scale: 1.5 };
const taker = (log, name, takes = false) => (from, to, shot) => (log.push({ name, from, to, z: [from.z, to.z], shot }), takes ? { name } : null);

describe('createGuns', () => {
  it('fires a bolt a direction from a copy of at; a full pool takes slot 0', () => {
    const SLANT = [0.48, 0.6, -0.64];
    const guns = createGuns({ count: 2, point });
    guns.fire(AT, [AHEAD, SLANT], 10, LINE);
    const [a, b] = guns.bolts;
    expect(a).toMatchObject({ on: true, fresh: true, life: 1, punch: 2, damage: 7, heavy: false, warPunch: 2, scale: 1.5, at: { ...AT, own: true }, v: [0, 0, -10] });
    expect(b.v.map((x) => +x.toFixed(9))).toEqual([4.8, 6, -6.4]);
    expect([b.heading, b.pitch]).toEqual([aimAngles(SLANT).heading, aimAngles(SLANT).pitch]);
    guns.fire({ x: 9, y: 9, z: 9 }, [AHEAD], 5, { ...LINE, punch: 3, heavy: true });
    expect([a.punch, a.at.x, a.heavy, b.punch]).toEqual([3, 9, true, 2]);
  });
  it('steps by v·dt through the sources in order till one takes it, and spends its life', () => {
    const log = [];
    const guns = createGuns({ count: 1, point });
    guns.fire(AT, [AHEAD], 10, LINE);
    const [b] = guns.bolts;
    expect(guns.step(0.25, [])).toBe(true);
    expect([b.from, b.at, b.life]).toMatchObject([AT, { x: 1, y: 2, z: 0.5 }, 0.75]);
    const sources = [taker(log, 'stim'), taker(log, 'hunter'), taker(log, 'citadel', true), taker(log, 'rock', true)];
    expect(guns.step(0.1, sources)).toBe(true);
    expect(log.map((e) => e.name)).toEqual(['stim', 'hunter', 'citadel']);
    expect(log[0].z).toEqual([0.5, -0.5]);
    expect(log.every((e) => e.from === b.from && e.to === b.at && e.shot === b)).toBe(true);
    expect([b.on, guns.step(0.1, sources), log.length]).toEqual([false, false, 3]);
    guns.fire(AT, [AHEAD], 10, LINE);
    expect([guns.step(1, []), b.on, b.at.z]).toEqual([false, false, 3]);
  });
  it('strike hands on copies of from, to and a whole shot; null when none takes it', () => {
    const guns = createGuns({ count: 1, point });
    let seen = null;
    const look = (f, t, s) => ((seen = { f, t, s: { ...s, v: [...s.v] } }), null);
    expect(guns.strike({ x: 0, y: 0, z: 0 }, AT, { punch: 4 }, [look, () => ({ name: 'traffic' }), () => ({ name: 'rock' })])).toEqual({ name: 'traffic' });
    expect(seen).toEqual({ f: { x: 0, y: 0, z: 0, own: true }, t: { ...AT, own: true }, s: { punch: 4, damage: undefined, v: [1, 2, 3], heavy: false, warPunch: 4 } });
    const v = [0, 0, 0];
    expect(guns.strike(point(), AT, { punch: 2, damage: 5, v, heavy: true, warPunch: 1 }, [(f, t, s) => ((seen = s), null)])).toBeNull();
    expect(seen).toEqual({ punch: 2, damage: 5, v: [0, 0, 0], heavy: true, warPunch: 1 });
    expect(seen.v).not.toBe(v);
  });
  it('makes its slots and points once, and clear lets every bolt go', () => {
    let made = 0;
    const guns = createGuns({ count: 2, point: () => (made++, point()) });
    const held = guns.bolts.flatMap((b) => [b, b.at, b.from, b.v]);
    guns.fire(AT, [AHEAD, AHEAD], 10, LINE);
    guns.step(0.1, []);
    guns.strike(AT, point(), { punch: 1 }, []);
    guns.clear();
    expect([made, guns.bolts.some((b) => b.on), guns.step(0.1, [])]).toEqual([6, false, false]);
    expect(guns.bolts.flatMap((b) => [b, b.at, b.from, b.v]).every((p, i) => p === held[i])).toBe(true);
  });
});
```

- [ ] **Step 2: Run to fail.** `npx vitest run src/lib/combat/flight/guns.test.js src/lib/combat/contact.test.js src/components/universe/hunterRules.test.js`: guns.test `4 failed | 1 passed (5)` (`createGuns is not a function`); contact.test `1 failed | 19 passed (20)`, hunterRules.test `1 failed | 57 passed (58)` (`shotRadius is not a function`).

- [ ] **Step 3: shotRadius.** contact.js: after header line 6, `// shotRadius(size) → how near a shot must pass a ship's middle to hit it.`; `// tighter than hunterRules' hitRadius, which forgives a laser` → `// tighter than shotRadius, which forgives a laser`; after `export const bodyRadius = …`, `// the bolt's (hunterRules' hitRadius; dark matter's pierce)` / `export const shotRadius = (size) => size * 0.9 + 0.12;`. hunterRules.js: after line 78 (`lib/combat/pose`), `import { shotRadius } from '../../lib/combat/contact';`; `export const hitRadius = (type) => type.size * 0.9 + 0.12;` → `export const hitRadius = (type) => shotRadius(type.size); // (the bolt's rule)`.

- [ ] **Step 4: createGuns.** Append `export function createGuns({ count = 40, point })` to guns.js, and add the spec's `createGuns`, source and shot lines to its header (`fresh`: true until the scene has turned and sized the mesh). guns.js still has no imports, so add `const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);`. The slots, strike's two points and its shot record (with its own `v`) are all made in this call, and nothing is allocated after it (use indexed loops). `fire` takes the first slot that is off, else slot 0. Its angles are `aimAngles`' without the arrays, so they match bit for bit: `const l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) || 1; b.heading = Math.atan2(-(d[0] / l), -(d[2] / l)); b.pitch = Math.asin(clamp(d[1] / l, -1, 1));`.

- [ ] **Step 5: Run to pass.** Step 2's command: `Test Files 3 passed (3)`; guns.test 5, contact.test 20, hunterRules.test 58.

- [ ] **Step 6: The universe scene.**
  - `aimAngles` leaves the `./targeting` import; the guns import becomes `import { CADENCE, createGuns } from '../../lib/combat/flight/guns';`.
  - The pool: `// shots: a few glowing bolts, reused` → `// shots: a few glowing bolts, flown by lib/combat/flight/guns.js`; after `boltGeo` and `boltMat`, `const guns = createGuns({ count: BOLTS, point: () => new THREE.Vector3() });` and `const bolts = guns.bolts.map((b) => …)`, today's mesh lines but `m.userData = b`. Then `showBolts()`, by index: mesh `visible = b.on`; if on, `position.copy(b.at)`; if also `fresh`, `rotation.set(b.pitch, b.heading, 0)`, `scale.set(b.scale, b.scale, 1 + (b.scale - 1) * 0.4)`, `b.fresh = false`.
  - Delete `spawnBolt` and its comment; `fire`'s `spawnBolt` line → `else guns.fire(shotAt, fan(dir, w.count, w.cone, jitter), speed, { life: AIM.life * w.life, punch: (g.punch ?? 1) * w.punch, damage: w.damage, scale: g.bolt * w.scale });`, then `showBolts();` (keys and touch fire between frames).
  - Delete `const shotFrom = new THREE.Vector3();`; `moveBolts`'s body → `const any = guns.step(dt, BOLT_HITS); showBolts(); return any;`, a line each.
  - From `// what a round meets on its step (rounds.js flies it): the first thing` to `missileHit`'s close:
```js
  // the round on its step (missileHit) blasts where it hits (keyed on it, not on heavy)
  let round = null;
  const shotNormal = (shot) => popDir.set(-shot.v[0], 3, -shot.v[2]).normalize();
  const foeHits = (test) => (from, to, shot) => {
    const hh = test(from, to, shot);
    if (!hh) return null;
    state.hitMark = 1; // the reticle flashes
    hunterShot(hh, shotNormal(shot));
    if (round) boom(round, hh.at, hh.down);
    return hh;
  };
```
  The other sources take that shape: the test, falsy returned; moveBolts' lines for the target word for word (`shotFrom` → `from`, `b.position` → `to`, `d.` → `shot.`, the normal → `shotNormal(shot)`); `if (round) boom(round, …)` with missileHit's arguments; the hit. Test (punch `shot.punch ?? 1`) · blast:
    - `heardHits`: the stim push under `if (npcs?.count && !round)` (no round was ever heard); `null`.
    - `hunterHits = foeHits((from, to, shot) => hunters?.hit(from, to, shot.punch ?? 1))` (looked up per hit: probes wrap it); `farHits`, `frontHits` alike on `farHit`, `frontHit`.
    - `pilotHits`: `pilots.hit` · `ph.at, Boolean(ph.down)`. `citadelHits`: `citadelGeo && siegeHit(from, to, shot.punch ?? 1, shot.heavy)` · `at.clone(), true`. `capitalHits`: `capitalHit` · `ch.at, ch.down || ch.type === 'shielded'`. `removerHits`: `remover && removerHit` · `at, true`.
    - `trafficHits`: `traffic?.hit(from, to) ?? null` · `h.at, !h.glance`. `leviathanHits`: `leviathans.hit(from, to)`, else `false` · `round.position.clone()`, then `leviathanShot()`; `true`. `rockHits`: `meteors.hit(from, to) ?? mines.hit(from, to)` · `mh.at`.

  Then:
```js
  const BOLT_HITS = [heardHits, hunterHits, farHits, frontHits, pilotHits, citadelHits, capitalHits, removerHits, trafficHits, leviathanHits, rockHits];
  const UNIQUE_HITS = [hunterHits, farHits, frontHits];
  // uniqueArms' strike(from, to, punch, opts), as a shot
  const STILL = [0, 0, 0];
  const uniqueShot = { punch: 1, damage: undefined, v: STILL, heavy: false, warPunch: 1 };
  const uniqueStrike = (from, to, punch, { vel = null, warPunch = punch } = {}) => {
    uniqueShot.punch = punch;
    uniqueShot.warPunch = warPunch;
    uniqueShot.v = vel ?? STILL;
    return guns.strike(from, to, uniqueShot, UNIQUE_HITS);
  };
  const missileHit = (m, from, to) => {
    round = m;
    const hit = guns.strike(from, to, m.userData, BOLT_HITS); // (its userData: a heavy shot)
    round = null;
    return Boolean(hit);
  };
```
  - In `createUniqueArms({ parent: map,`, `strike: (...a) => powerStrike(...a)` → `strike: (...a) => uniqueStrike(...a)`.
  - Check: `npx eslint src/components/universe/scene.js` exits 0.

- [ ] **Step 7: The galaxy scene.**
  - As Step 6: the imports; the pool after `// your guns`, with `myBolts` and `scene.add(m)`; `spawnBolt` and `shotFrom` deleted; `moveBolts`.
  - `fire`'s `spawnBolt` line → `} else guns.fire(shotAt, fan(dir, w.count, w.cone, jitter), speed, { life: AIM.life * w.life, punch, damage: w.damage, scale: g.bolt * w.scale });`, then `showBolts();`.
  - `roundHit`'s `const d = m.userData;` and `strike(…)` lines → `const r = guns.strike(from, to, m.userData, BOLT_HITS);`.
  - After `strike`'s close, add these, then Step 6's `STILL`, `uniqueShot` and `uniqueStrike`:
```js
  // the hit list: strike's (the hunters, the war, then another pilot)
  const BOLT_HITS = [(from, to, shot) => strike(from, to, shot.punch ?? 1, { vel: shot.v, warPunch: shot.warPunch, damage: shot.damage })];
  // the skill tree's arms: never a pilot
  const UNIQUE_HITS = [(from, to, shot) => strike(from, to, shot.punch ?? 1, { vel: shot.v, warPunch: shot.warPunch, damage: shot.damage, pilots: false })];
```
  - In `createUniqueArms({ parent: scene,`, `strike: (...a) => strike(...a)` → `strike: (...a) => uniqueStrike(...a)`.
  - Check: `npx eslint src/components/galaxy/scene.js` exits 0.

- [ ] **Step 8: Gates.** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`: all pass, none failed; health as Task 8's (boundary-breaks 476, kbd-styles 68, big-files 22, cycles 5). `wc -l`: US 36 under Task 8's, GS 3 over (the unique adapter; Task 19 deletes it).

- [ ] **Step 9: Browser gate**, on Task 1 Step 5's `export` line and dev server:
```
for q in high low; do
  node scripts/universe-check.mjs --quality $q --lock --out "$S/t9/$q"
  node scripts/shot-compare.mjs "$S/run1/$q" "$S/t9/$q" --floor docs/superpowers/evidence/flight-core/floor-$q.json
done
for a in order "order --line 1" "order --line 2" crash galaxy-bolt unique-pilots; do node scripts/flight-probe.mjs $a --url http://127.0.0.1:5188; echo "exit $?"; done
for s in "" pickups; do BASE=http://127.0.0.1:5188 OUT="$S/t9/galaxy-hud" node scripts/galaxy-hud-check.mjs $s; done
```
  Pass:
  - Both comparisons print `within the floor`.
  - Each probe prints `exit 0`, and its lines match `$S/probes.txt`: `order` ends `(hunter…)`, `(citadel…)` and `(rock…)`; `--line 2` prints `ok   no state.kills yet`; `crash` shows bolts in flight.
  - galaxy-hud-check prints only `ok` lines and exits 0, and its shots look the same as Task 2's when checked by eye.

- [ ] **Step 10: Commit.**
```
git add src/lib/combat/{flight/guns,flight/guns.test,contact,contact.test}.js src/components/universe/{hunterRules,hunterRules.test,scene}.js src/components/galaxy/scene.js
git commit -F - <<EOF
One pool of bolts for both maps, and one hit list for bolts, torpedoes and the skill tree's arms

Each map kept its own pool, the universe a second chain for torpedoes.
Now one list a map takes bolts, torpedoes and arms, in today's reach;
a torpedo also plays a bolt's spark, reticle flash and charge.
Scenes: universe $(wc -l < src/components/universe/scene.js) lines, galaxy $(wc -l < src/components/galaxy/scene.js).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RQ72Qap4ZJEK2vaPYx5CVD
EOF
```

### Task 10: Manual lock grace past 78 (B1)

**Files:**
- Modify: `src/lib/combat/flight/targeting.js` (`track`)
- Test: `src/lib/combat/flight/targeting.test.js`, `describe('the lock')`, after 'holds a lock picked by hand for longer…'

**Interfaces:**
- Consumes: Task 4’s `track`, `AIM`; the test’s `hunter`, `follow`, `ship`. Produces: no new name.

- [ ] **Step 1: Write the failing test.**
```js
  it('keeps a lock picked by hand past 78 for its grace; one the guns picked goes at once', () => {
    const far = hunter('a', [0, 0, -79]); // (past AIM.range × 1.3, 78)
    const lock = { id: 'a', out: 0, manual: true };
    expect(track(ship, [far], lock, 1 / 60)).toEqual({ id: 'a', out: 1 / 60, manual: true });
    expect(follow(ship, [far], lock, AIM.loseManual - 0.2)?.id).toBe('a');
    expect(follow(ship, [far], lock, AIM.loseManual + 0.2)).toBeNull();
    // (back in before it runs out: the clock reset)
    expect(track(ship, [hunter('a', [0, 0, -20])], follow(ship, [far], lock, 2), 1 / 60)).toEqual({ id: 'a', out: 0, manual: true });
    expect(track(ship, [far], { id: 'a', out: 0 }, 1 / 60)).toBeNull();
  });
```
- [ ] **Step 2: Run to fail.** `npx vitest run src/lib/combat/flight/targeting.test.js`: `Tests 1 failed | 36 passed (37)`, `expected null to deeply equal { id: 'a', …(2) }`.
- [ ] **Step 3: Implement.** `if (b.dist > AIM.range * 1.3 && !(lock?.manual && c.id === lock.id)) continue; // (one picked by hand is looked for however far it's gone)`; the doc says so.
- [ ] **Step 4: Run to pass.** `Tests 37 passed (37)`.
- [ ] **Step 5: Gates.** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`: green, no health number above the commit before’s.
- [ ] **Step 5b: Browser gate (R11).** Tasks 11 to 22 run this block with their own `t`. After Task 1 Step 5’s `export` line, its server on 5188:
```
t=t10
for q in high low; do
  node scripts/universe-check.mjs --quality $q --lock --out "$S/$t/$q"
  node scripts/shot-compare.mjs "$S/run1/$q" "$S/$t/$q" --floor docs/superpowers/evidence/flight-core/floor-$q.json
done
OUT="$S/$t/galaxy" node scripts/galaxy-hud-check.mjs
```
  Expected: `within the floor` twice; galaxy-hud-check only `ok` lines, exit 0, shots right by eye.
- [ ] **Step 6: Commit.** Tasks 10–16 commit so (unquoted heredoc for `wc -l`, R29; no `$` or backtick in bodies):
```
git add src/lib/combat/flight/targeting.js src/lib/combat/flight/targeting.test.js
git commit -F - <<EOF
A lock picked by hand keeps its grace out past 78

A target picked by hand was dropped once past the hold range (B1).

Scenes: universe $(wc -l < src/components/universe/scene.js) lines, galaxy $(wc -l < src/components/galaxy/scene.js).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RQ72Qap4ZJEK2vaPYx5CVD
EOF
```

### Task 11: The T ring (B2)

**Files:**
- Modify: `src/lib/combat/flight/targeting.js` (`track`); `src/lib/combat/flight/sight.js` (its `track(` call); `src/lib/combat/flight/fixtures/fight.js` (R2: `todayLock`’s `track(` call, `const env = {`)
- Create: `src/lib/combat/flight/sight.fixes.test.js` (R27)
- Test: `src/lib/combat/flight/targeting.test.js`, at the end (356 lines after)

**Interfaces:**
- Consumes: Task 7’s `createSight`; fight.js’s `todayLock(state, ship, cands, dt, env)`, `DT`, `T`, `feed`, `fresh`, `ship`.
- Produces: `track(s, candidates, lock, dt, { cycle = false, ring = null } = {})`: a cycle with `ring` (the caller’s ids) updates it in place (ids not held drop out, the rest keep their order, newly held ones append in nose order), then steps it by today’s index rule. The sight’s ring empties when the lock is lost or `state.lock` is not the object it last wrote.

- [ ] **Step 1: Write the failing tests.** targeting.test.js:
```js
describe('the T ring', () => {
  const [a, b, d] = [hunter('a', [0, 0, -20]), hunter('b', [5, 0, -20]), hunter('d', [2, 0, -30])];
  const facing = (t) => ({ ...ship, heading: aimAngles(dirTo(ship, t.at)).heading }); // (the nose on it)
  it('drops the gone, appends the new, never re-sorts', () => {
    const ring = ['a', 'b', 'c']; // (c gone since the last press, d new)
    let lock = { id: 'b', out: 0, manual: true };
    const ids = [facing(b), facing(d), ship].map((s, i) => (lock = track(s, [a, b, d], lock, 1 / 60, { cycle: [true, true, -1][i], ring })).id);
    expect([ids, ring]).toEqual([['d', 'a', 'd'], ['a', 'b', 'd']]);
  });
});
```
  sight.fixes.test.js:
```js
import { describe, expect, it } from 'vitest';
import { aimAngles, dirTo } from './targeting';
import { createSight } from './sight';
import { DT, T, feed, fresh, ship } from './fixtures/fight';

describe('the T ring', () => {
  const [a, b, c] = [T('a', 0, 0, -20), T('b', 5, 0, -20), T('c', -9, 0, -20)];
  const facing = (t) => ({ ...ship, heading: aimAngles(dirTo(ship, t.at)).heading });
  const press = (st, sight, s) => ((st.cycle = 1), sight.update(s, [a, b, c], DT, feed()), st.lock.id);
  const start = () => {
    const st = fresh();
    const sight = createSight(st);
    sight.update(ship, [a, b, c], DT, feed());
    return [st, sight, [st.lock.id, press(st, sight, ship)]]; // (the ring a, b, c; the lock b)
  };

  it.each([0.3, 3, 10])('keeps the ring between presses %s s apart', (gap) => {
    const [st, sight, ids] = start();
    for (const t of [b, c]) {
      for (let s = 0; s < gap; s += DT) sight.update(facing(t), [a, b, c], DT, feed());
      ids.push(press(st, sight, facing(t)));
    }
    expect(ids).toEqual(['a', 'b', 'c', 'a']);
  });

  it('starts the ring again when the lock is written from outside, or lost', () => {
    const after = (cut) => {
      const [st, sight] = start();
      cut(st, sight);
      sight.update(facing(b), [a, b, c], DT, feed());
      return press(st, sight, facing(b)); // (round the nose afresh: b, a, c)
    };
    expect(after((st) => (st.lock = { id: 'b', out: 0, manual: true }))).toBe('a'); // (a tap, a pose or a check)
    expect(after((st, sight) => sight.update(facing(b), [], DT, feed()))).toBe('a'); // (lost)
  });
});
```
- [ ] **Step 2: Run to fail.** `npx vitest run src/lib/combat/flight/targeting.test src/lib/combat/flight/sight`: targeting.test `1 failed | 37 passed (38)`; sight.test passes; sight.fixes.test `3 failed | 1 passed (4)`, `expected [ 'a', 'b', 'a', 'b' ] to deeply equal [ 'a', 'b', 'c', 'a' ]`.
- [ ] **Step 3: Implement.** As Produces. sight.js: `const ring = []`, `let mine = null` (the lock it last wrote); `if (state.lock !== mine) ring.length = 0;` before the `track(…, { cycle: state.cycle, ring })` call, `mine = state.lock; if (!state.lock) ring.length = 0;` after. fight.js: the same on `env.ring`/`env.mine`; `env` gains `ring: [], mine: null`.
- [ ] **Step 4: Run to pass.** targeting.test `38 passed (38)`; sight.test `5 passed (5)`; sight.fixes.test `4 passed (4)`.
- [ ] **Step 5: Gates.** Task 10 Step 5.
- [ ] **Step 6: Browser gate (R11).** Task 10 Step 5b with `t=t11`.
- [ ] **Step 7: Commit.** `git add src/lib/combat/flight/{targeting{,.test},sight,sight.fixes.test,fixtures/fight}.js`; `T steps round the targets in the order it found them, so it reaches a third`; body: “Each press re-sorted by the nose, so T flipped between two (B2).”

### Task 12: Torpedoes home by id (B3)

**Files:**
- Modify: `src/lib/combat/flight/roundRules.js`; `src/components/universe/rounds.js`; US and GS (`rounds.launch(`, `rounds.fly(`); `docs/superpowers/evidence/flight-core/README.md`
- Test: `src/lib/combat/flight/roundRules.test.js` (line 2; a case ending the describe)

**Interfaces:**
- Consumes: Task 7’s `sight.find(id)` (callable detached).
- Produces: `homeOn(d, find) → d.target`, `d.target = d.targetId == null ? null : find(d.targetId)`; `launch(…, { life, punch, damage, homing, targetId })`, userData `targetId: targetId ?? null, target: null` for `target`; `fly(dt, hit, expire, find)`, `homeOn(d, find);` before `steerRound`. `rounds.clear()` is Task 20’s.

- [ ] **Step 1: Write the failing test.** Line 2: `import { homeOn, nearTarget, steerRound } from './roundRules';`.
```js
  it('homes on its target by id: straight on while it is gone, onto it again when it is back', () => {
    const t = { id: 'h1', at: { x: 10, y: 0, z: 0 }, size: 0.3 };
    let foes = [t];
    const find = (id) => foes.find((c) => c.id === id) ?? null;
    const here = { x: 0, y: 0, z: 0 };
    const d = round({ target: null, targetId: 'h1' });
    expect(homeOn(d, find)).toBe(t);
    steerRound(d, here, 0.1, scratch);
    expect(angle([0, 0, -10], d.v)).toBeCloseTo(0.2, 5);
    foes = []; // (shot down: gone from the foes)
    const straight = [...d.v];
    expect(homeOn(d, find)).toBeNull();
    steerRound(d, here, 0.1, scratch);
    expect(d.v).toEqual(straight);
    foes = [t]; // (back: out of hiding, say)
    expect(homeOn(d, find)).toBe(t);
    steerRound(d, here, 0.1, scratch);
    expect(angle(straight, d.v)).toBeCloseTo(0.2, 5);
    expect(homeOn(round({ targetId: null }), () => t)).toBeNull(); // (nothing locked when it went)
  });
```
- [ ] **Step 2: Run to fail.** `npx vitest run src/lib/combat/flight/roundRules.test.js`: `Tests 1 failed | 4 passed (5)`, `TypeError: homeOn is not a function`.
- [ ] **Step 3: Implement.** As Produces (rounds.js imports it via the barrel); US and GS launch with `targetId: state.lockTarget?.id ?? null` and pass `sight.find` last to `rounds.fly`. README: `## Accepted: a torpedo lets go of a live target (B3)`, with the spec’s Risks cases (a pilot hidden, safe or ally; the capital ship passed; the Citadel past `SIEGE_NEAR`; the NX-5 past 900; a dive or frozen frame reading the last list).
- [ ] **Step 4: Run to pass.** `Tests 5 passed (5)`.
- [ ] **Step 5: Gates.** Task 10 Step 5, then Task 10 Step 5b with `t=t12`.
- [ ] **Step 6: Commit.** `git add src/lib/combat/flight/roundRules{,.test}.js src/components/universe/{rounds,scene}.js src/components/galaxy/scene.js docs/superpowers/evidence/flight-core/README.md`; `A torpedo homes on its target by id, and flies straight once it's gone`; body: “Torpedoes homed on where a dead hunter fell (B3). A live target let go is the scenes' lists' doing, accepted in the evidence README, not pinned by roundRules.test as the spec said.”

### Task 13: Lead, hot, assist, tracking per weapon; hot honours Focus (B4)

**Files:**
- Modify: `src/lib/combat/flight/sight.js` (`AIM` import, `shotReach`); US and GS (R9, Step 3); `docs/superpowers/evidence/flight-core/README.md`
- Test: `src/lib/combat/flight/sight.fixes.test.js`

**Interfaces:**
- Consumes: `WEAPONS` (`src/lib/arms/ship.js`), `arms().weapon`, `powers.aim(own)`, `sightIn`, `hudIn.life`, Task 1’s `reach`.
- Produces: `shotReach(w, ship, out = {}) → out`: `out.speed = AIM.bolt * w.speed + Math.max(0, ship.speed)`, `out.life = AIM.life * w.life`.

- [ ] **Step 1: Write the failing test.** Imports: `import { WEAPONS } from '../../arms/ship';`, `{ createSight, shotReach }`, `{ DT, T, feed, fresh, ship, v }`; at the end:
```js
describe('the selected weapon', () => {
  const lone = (o, z, vel) => {
    const st = fresh();
    const sight = createSight(st);
    sight.update(ship, [T('a', 0, 0, z, vel)], DT, o);
    return [st, sight];
  };
  it('reads a weapon’s shot speed and life, adding the ship’s forward speed', () => {
    expect([shotReach(WEAPONS.spread, { ...ship, speed: 3.3 }), shotReach(WEAPONS.darkmatter, { ...ship, speed: -2 })]).toEqual([{ speed: 57.3, life: 0.4675 }, { speed: 22.8, life: 2.04 }]);
  });
  it('never calls the spread hot past 0.4675 s; leads dark matter 1.79 s to a hunter 30 out at 6', () => {
    const o = shotReach(WEAPONS.spread, ship, feed());
    const hot = [];
    for (let d = 10; d <= 60; d += 0.5) if (lone(o, -d)[0].hot) hot.push(lone(o, -d)[0].lead.t);
    expect([hot.length, Math.max(...hot) <= 0.4675, lone(feed(), -26)[0].hot]).toEqual([31, true, true]); // (10 to 25 out; the blaster's 26)
    const [st, sight] = lone(shotReach(WEAPONS.darkmatter, ship, feed()), -30, v(0, 0, -6));
    expect([st.lead.t, st.lead.z].map((n) => n.toFixed(9))).toEqual(['1.785714286', '-40.714285714']);
    expect([sight.inReach(), sight.nudge(ship, { turn: 0, climb: 0 }, 1) !== null]).toEqual([true, true]);
  });
  it('is hot by Force Focus’s help at 0.25 rad, assist 2.5, never on a pilot', () => {
    const hotOn = (more) => {
      const st = fresh();
      // (as powers.aim: Focus's 2.5 onto the game's ships, never a pilot)
      createSight(st).update(ship, [{ ...T('a', -20 * Math.sin(0.25), 0, -20 * Math.cos(0.25)), ...more }], DT, feed({ help: () => ({ assist: st.lockTarget?.peer ? 1 : 2.5 }) }));
      return st.hot;
    };
    expect([hotOn({}), hotOn({ peer: 'x' })]).toEqual([true, false]);
  });
  it('follows a weapon changed between two frames', () => {
    // (review focus 3: R, 1 2 3 or a refit mid-fight; the next frame reads the new reach)
    const st = fresh();
    const sight = createSight(st);
    const a = [T('a', 0, 0, -40)];
    const o = shotReach(WEAPONS.darkmatter, ship, feed());
    sight.update(ship, a, DT, o);
    expect(sight.inReach()).toBe(true);
    shotReach(WEAPONS.spread, ship, o);
    sight.update(ship, a, DT, o);
    expect([sight.inReach(), st.hot]).toEqual([false, false]);
  });
});
```
- [ ] **Step 2: Run to fail.** `npx vitest run src/lib/combat/flight/sight.fixes.test.js`: `Tests 3 failed | 5 passed (8)`, `TypeError: shotReach is not a function`. `node scripts/flight-probe.mjs reach --shot "$S/t13/before" --url http://127.0.0.1:5188`: `FAIL` at 12 out, exit 1.
- [ ] **Step 3: Implement.** `shotReach` as Produces. Scenes import it; `help: () => powers.aim(controls())` for `help: controls`; `shotReach(arms().weapon, ship, sightIn);` for the `sightIn.speed = …` line; flying `hudIn.life` reads `sightIn.life`. README: `B4 seismic’s pip: on at 6 out, off at 12; shots in $S/t13/.`
- [ ] **Step 4: Run to pass.** `Tests 8 passed (8)`; `reach --shot "$S/t13/after"` exit 0.
- [ ] **Step 5: Gates.** Task 10 Step 5, then Task 10 Step 5b with `t=t13`.
- [ ] **Step 6: Commit.** `git add src/lib/combat/flight/sight{,.fixes.test}.js src/components/{universe,galaxy}/scene.js docs/superpowers/evidence/flight-core/README.md`; `The lead, hot, bend and nudge take the selected weapon's reach`; body: “All used the blaster's, and hot ignored Force Focus (B4).”

### Task 14: No lock tick in the map view (B5)

**Files:**
- Modify: `src/lib/combat/flight/sight.js` (`update`’s return); US (before `if (sight.update(ship, cands, dt, sightIn)`; GS has no map view)
- Test: `src/lib/combat/flight/sight.fixes.test.js`

**Interfaces:**
- Consumes: Task 7’s `update(…, o)`.
- Produces: `o.quiet`; `update` returns `!o.quiet && <a new lock>`, still writing the lock.

- [ ] **Step 1: Write the failing test.**
```js
describe('the whole-map view', () => {
  it('takes the lock with no tick while quiet, and ticks none late', () => {
    const st = fresh();
    const sight = createSight(st);
    const a = T('a', 0, 0, -20);
    expect(sight.update(ship, [a], DT, feed({ quiet: true }))).toBe(false);
    expect([st.lock, st.lockTarget]).toEqual([{ id: 'a', out: 0 }, a]);
    expect(sight.update(ship, [a], DT, feed())).toBe(false);
    expect(sight.update(ship, [T('b', 1, 0, -15)], DT, feed())).toBe(true);
  });
});
```
- [ ] **Step 2: Run to fail.** `npx vitest run src/lib/combat/flight/sight.fixes.test.js`: `Tests 1 failed | 8 passed (9)`, `expected true to be false`.
- [ ] **Step 3: Implement.** `return !o.quiet && Boolean(tgt && tgt.id !== was);`, `quiet` in the header. US: `sightIn.quiet = state.view === 'map'; // (no lock drawn there, no tick)`.
- [ ] **Step 4: Run to pass.** `Tests 9 passed (9)`.
- [ ] **Step 5: Gates.** Task 10 Step 5, then Task 10 Step 5b with `t=t14`.
- [ ] **Step 6: Commit.** `git add src/lib/combat/flight/sight{,.fixes.test}.js src/components/universe/scene.js`; `No lock tick in the whole-map view`; body: “No lock is drawn there, yet each new one ticked (B5).”

### Task 15: A tap picks any target, before the planet (B6)

**Files:**
- Modify: US (`pickHunter` and its comment, keeping `const tapped`; `onUp` from `const id = pick(x, y);` to its `else if (flying()) {` block’s close); GS (`pickHunter`, its call); `scripts/flight-probe.mjs`; the evidence README
- Test: none new (Task 7’s sight.test pins `pickAt`)

**Interfaces:**
- Consumes: Task 7’s `sight.pickAt(x, y, project, reach = 48)` over `sight.cands`. Produces: nothing; `pickHunter` goes.

- [ ] **Step 1: Write the failing check.** Scenario `tap`: `pose('middleearth')` (planet ahead), `hunters.clear()`, `meetNpc('vader')` held (`npcs.update` at dt 0) at 1.2 on the nose; `frames(3)`; `state.lock = null`; click at `.universe-lock`’s `translate3d`; `frames(2)`: `ok` if `__universe()` shows the NPC locked, `manual`; `--shot` saves `tap.png`.
- [ ] **Step 2: Run to fail.** `node scripts/flight-probe.mjs tap --shot "$S/t15/before" --url http://127.0.0.1:5188`: `FAIL` (the planet took it), exit 1.
- [ ] **Step 3: Implement.** US `onUp`, after the sign and phone returns: `const hid = flying() && state.view !== 'map' ? sight.pickAt(x, y, toScreen) : null; // (before the planet; not in the whole-map view)`; a hit runs `heard(); state.lock = { id: hid, out: 0, manual: true };`, else `const id = pick(x, y); if (id) props.onPick?.(id); else if (flying()) { const wid = pickWonder(x, y); if (wid) navTo(wid); }`. GS: `const hid = sight.pickAt(x, y, toScreen);`. README: `B6 tap: before FAIL (the planet took it), after ok; shots in $S/t15/.`
- [ ] **Step 4: Run to pass.** `tap --shot "$S/t15/after"` exit 0.
- [ ] **Step 5: Gates.** Task 10 Step 5, then Task 10 Step 5b with `t=t15`.
- [ ] **Step 6: Commit.** `git add src/components/{universe,galaxy}/scene.js scripts/flight-probe.mjs docs/superpowers/evidence/flight-core/README.md`; `A tap locks on to any target, ahead of the planet behind it`; body: “A tap tried hunters and pilots only, after the planets (B6).”

### Task 16: Threat arrows from every candidate (B7)

**Files:**
- Modify: `src/runtime/hud/flight/frame.js` (the threats’ gathering, the `v` doc); US and GS (`hudIn`’s `threatsFrom` and placeHud’s fill of it); `scripts/flight-probe.mjs`; the evidence README
- Test (R8): `src/runtime/hud/flight/frame.test.js`: `view()`’s `threatsFrom: []`; “arrows the threats…”, “shows nothing while on is false”, “fills the same records…”; a new describe

**Interfaces:**
- Consumes: Task 8’s frame.test `fill(o)`, `view(o)`, `P`, `A`–`G` (SHIP (720, 450, 0), heading π/2, 1440×900, identity projector); `sight.cands`.
- Produces: `v.cands` for `v.threatsFrom`.

- [ ] **Step 1: Write the failing test.**
```js
describe('the threat arrows', () => {
  it('gives every candidate with a threat an arrow: a front fighter behind with threat 1', () => {
    const front = { id: 'f1', at: P(720, 450, -20), kind: 'tie', threat: 1 };
    const f = fill({ cands: [{ id: 'r1', at: P(720, 450, -10) }, { id: 's1', at: P(720, 450, -15), threat: 0 }, front] });
    expect(f.threats.n).toBe(1);
    expect(f.threats.at[0]).toEqual({ x: 720, y: 450, z: -20 });
  });
});
```
  Scenario `threats`: `pose('far-rim')`, `hunters.clear()`, `meetNpc('vader')` held as in `tap`, 20 behind; `frames(3)`: `ok` if one `.universe-threat[data-on]` and no lock; `--shot` saves `threats.png`.
- [ ] **Step 2: Run to fail.** `npx vitest run src/runtime/hud/flight/frame.test.js`: `Tests 1 failed | 7 passed (8)`, `expected +0 to be 1`. `node scripts/flight-probe.mjs threats --shot "$S/t16/before" --url http://127.0.0.1:5188`: exit 1.
- [ ] **Step 3: Implement.** frame.js gathers threats from the one list `v.cands` where it walked each list in `v.threatsFrom`, its rule unchanged. frame.test: `view()` defaults `cands: []`; the three cases pass `cands: [A, B, C, E, D, F, G]`, `[A]`, `[A, B, D]`, expectations unchanged. Scenes: `threatsFrom` leaves `hudIn` and placeHud's fill; `cands: []` in `hudIn`, filled `hudIn.cands = sight.cands;`. README: `B7 threats: before 0 arrows, after 1; shots in $S/t16/.`
- [ ] **Step 4: Run to pass.** `Tests 8 passed (8)`; `threats --shot "$S/t16/after"` exit 0.
- [ ] **Step 5: Gates.** Task 10 Step 5, then Task 10 Step 5b with `t=t16`.
- [ ] **Step 6: Commit.** `git add src/runtime/hud/flight/frame{,.test}.js src/components/{universe,galaxy}/scene.js scripts/flight-probe.mjs docs/superpowers/evidence/flight-core/README.md`; `A threat arrow for every candidate on you, the front's fighters and NPCs too`; body: “Only hunters and pilots were arrowed (B7).”


### Task 17: Past the cap a quicker gun part gives punch (B8)

**Files:** Modify `src/components/universe/{outfit.js,shipyard/YardCatalogue.jsx,shipyard/ShipyardBody.jsx}`, US, GS. Test `src/components/universe/outfit.test.js`, `F/guns.test.js`.

**Interfaces:** Consumes Task 5's `CADENCE`, `pace`, `RAPID_PUNCH_CAP`, `shotPunch`. Produces `partEffects(p, kind = null)`, US `gun`.

- [ ] **Step 1: Failing tests.** outfit.test.js, after `'says what each part does, in words'`:
```js
  it('says a gun part gives punch on a ship at the cap (B8)', () => {
    const on = (id, kind) => partEffects(partById('guns', id), kind);
    expect([on('incom', 'xwing'), on('twin', 'xwing'), on('incom', 'cruiser'), on('incom'), on('incom', 'falcon'), on('fusion', 'xwing')]).toEqual([['Punch +43%'], ['Punch +25%'], ['Fire rate +43%'], ['Fire rate +43%'], ['Fire rate +33%', 'Punch +7%'], ['Fire rate −50%', '3× on hunters']]);
  });
```
guns.test.js, importing `RAPID_PUNCH_CAP`:
```js
it('pace: Incom on the X-wing, then the cap (B8)', () => {
  expect(pace(CADENCE.xwing, 0.7, FASTEST).punch).toBeCloseTo(0.12 / 0.084, 12);
  expect(pace(CADENCE.xwing, 0.7 * 0.92, FASTEST)).toEqual({ gap: 0.12, punch: RAPID_PUNCH_CAP });
});
```
- [ ] **Step 2: Run to fail.** `npx vitest run src/components/universe/outfit.test.js src/lib/combat/flight/guns.test.js`: `Tests 1 failed`, `expected [ [ 'Fire rate +43%' ], …(5) ] to deeply equal …`.
- [ ] **Step 3: Implement.** outfit.js, with `kind`: `base = CADENCE[kind] ?? 0.18`, `g = pace(base, p.cadence, FASTEST)`, then `Fire rate ${pct(Math.max(FASTEST, base) / g.gap - 1)}` and `Punch ${pct(g.punch - 1)}`, each unless 0%; without, today's line. YardCatalogue takes `ship` through `rowsFor` to `partEffects(p, ship)`; ShipyardBody passes `ship={ship}`. US: `const gun = { gap: 0, punch: 1 };` by `shotAt`; `const cadence = …` → `pace(CADENCE[state.kind] ?? 0.18, g.cadence, FASTEST, gun);`, `arm.ready(now, gun.gap)`; the three `(g.punch ?? 1) * w.punch` → `shotPunch(w, g, gun)`. GS: `gunsUnder(…)` → `pace(CADENCE[state.kind] ?? 0.18, g.cadence * pickups.mods().delay, FASTEST, gun);` (`gunsUnder` leaves its import). Imports: `lib/combat/flight/guns`.
- [ ] **Step 4: Run to pass.** Step 2's run passes; Task 10 Step 5's gates.
- [ ] **Step 5: Browser gate.** Task 10 Step 5b, `t=t17`; then `OUT="$S/t17/galaxy" node scripts/galaxy-hud-check.mjs pickups`, only `ok`.
- [ ] **Step 6: Commit.** Task 10 Step 6's form (Tasks 18–22 too): `git add src/components/universe/{outfit,outfit.test,scene}.js src/components/universe/shipyard/{YardCatalogue,ShipyardBody}.jsx src/lib/combat/flight/guns.test.js src/components/galaxy/scene.js`; “A quicker gun part hits harder on a ship at the cap”; body: “At the cap already, Incom and twin cannons did nothing on it (B8).”

### Task 18: The dark matter pool and pierce radius (B9)

**Files:** Modify `src/lib/arms/behaviours.js`, `src/components/universe/{uniqueFx,uniqueArms}.js`. Create `src/components/universe/uniqueFx.test.js`. Test `src/lib/arms/behaviours.test.js`.

**Interfaces:** Produces `pierce(from, to, list, hit, radius = (t) => (t.size ?? 1) / 2)`, `orbsInFlight(w, fastest, { shots = 0, life = 1 } = {})` = `(w.count + shots) * (Math.floor((life * w.life) / (fastest * w.cadence)) + 1)`.

- [ ] **Step 1: Failing tests.** behaviours.test.js, importing `orbsInFlight`, `{ WEAPONS as SHIP_WEAPONS } from './ship'`, `{ shotRadius } from '../combat/contact'`:
```js
describe('dark matter (B9)', () => {
  it('pierce as a bolt given shotRadius; the most orbs in flight', () => {
    const passing = ship('a', 5, 0.3, 0, 0.5);
    expect(pierce(at(0), at(10), [passing], new Set())).toEqual([]);
    expect(pierce(at(0), at(10), [passing], new Set(), (t) => shotRadius(t.size))).toEqual([passing]);
    expect(orbsInFlight(SHIP_WEAPONS.darkmatter, 0.12, { life: 0.85 })).toBe(5);
    expect(orbsInFlight(SHIP_WEAPONS.darkmatter, 0.12, { shots: 1, life: 0.85 })).toBe(10);
  });
});
```
uniqueFx.test.js:
```js
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createUniqueFx } from './uniqueFx';

describe('uniqueFx', () => {
  it('draws ten dark matter orbs in one instanced draw (B9)', () => {
    const parent = new THREE.Group();
    createUniqueFx(parent).orbs(Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0, z: 0 })));
    const pools = ['unique-orb', 'unique-halo'].map((n) => parent.children.filter((o) => o.name === n));
    expect(pools.map((p) => [p.length, p[0].count])).toEqual([[1, 10], [1, 10]]);
  });
});
```
- [ ] **Step 2: Run to fail.** `npx vitest run src/lib/arms/behaviours.test.js src/components/universe/uniqueFx.test.js`: `expected [] to deeply equal [ { id: 'a', …(2) } ]`, `expected [ [ 1, 6 ], [ 1, 6 ] ] …`.
- [ ] **Step 3: Implement.** behaviours.js: Produces' two, on header lines. uniqueFx.js: `const ORBS = orbsInFlight(WEAPONS.darkmatter, FASTEST, { shots: SCATTER, life: AIM.life });`, `SCATTER = Object.values(NODES).reduce((n, x) => n + (x.does.shots ?? 0), 0)`, from `../../lib/arms/behaviours`, `../../lib/arms/ship`, `../hangar/skills/tree`, `./outfit`, `./targeting`. uniqueArms.js: `const orbReach = (t) => shotRadius(t.size ?? 1);` (`../../lib/combat/contact`), `pierce(from, o, list, o.hit, orbReach)`.
- [ ] **Step 4: Run to pass.** Step 2's run passes; Task 10 Step 5's gates.
- [ ] **Step 5: Browser gate.** Task 10 Step 5b, `t=t18`.
- [ ] **Step 6: Commit.** `git add src/lib/arms/{behaviours,behaviours.test}.js src/components/universe/{uniqueFx,uniqueFx.test,uniqueArms}.js`; “Every dark matter orb in flight is drawn, and hits as a bolt would”; body: “The pool drew six of ten (B9).”

### Task 19: The unique arms reach every foe, the Citadel heavy (B10)

**Files:** Modify `src/components/universe/uniqueArms.js`; `scripts/flight-probe.mjs`; US: `const UNIQUE_HITS = [hunterHits, farHits, frontHits];`, `const frontHits = foeHits(`, the block from `const STILL = [0, 0, 0];` to `uniqueStrike`'s closing line, and `strike: (...a) => uniqueStrike(...a)` in `createUniqueArms({ parent: map,`; GS: the same `STILL`/`uniqueShot`/`uniqueStrike` block, the `const BOLT_HITS = [` and `const UNIQUE_HITS = [` lines, the cands and foeBuf lines (R17), and `strike: (...a) => uniqueStrike(...a)` in `createUniqueArms({ parent: scene,`. Create `src/components/universe/uniqueArms.test.js`.

**Interfaces:** Consumes `sight.foes` (Task 7), Task 9's sources. Produces `createUniqueArms({ parent, foes, bolts, flashes, state, emit, strike, reduced = false })`.

- [ ] **Step 1: Failing tests.** uniqueArms.test.js:
```js
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGuns } from '../../lib/combat/flight/guns';
import { WEAPONS } from './weapons';
import { createUniqueArms } from './uniqueArms';

const v = (x, y, z) => ({ x, y, z });
const src = (id, at, size, kind) => {
  const seen = [], took = [];
  const fn = (from, to, shot) => (seen.push({ ...shot }), Math.hypot(to.x - at.x, to.y - at.y, to.z - at.z) <= size && (took.push({ ...shot }), true));
  return Object.assign(fn, { t: { id, kind, at, size }, seen, took });
};
const fire = (S, id, speed, punch, s = 0, lock = null) => {
  const guns = createGuns({ count: 4, point: () => new THREE.Vector3() });
  const arms = createUniqueArms({ parent: new THREE.Group(), foes: () => S.map((x) => x.t), bolts: { fire() {} }, flashes: { at() {} }, state: { ship: v(0, 0, 0), lockTarget: lock }, emit() {}, strike: (from, to, shot) => guns.strike(from, to, shot, S), reduced: true });
  arms.fire(id, v(0, 0, 0), [0, 0, -1], speed, WEAPONS[id], punch);
  for (let t = 0; t < s; t += 0.1) arms.frame(0.1);
  return S;
};

describe('the unique arms reach what a bolt does (B10)', () => {
  it('seismic: the Citadel heavy, a rock, a skirmish ship', () => {
    const [hunter, skirm, gen, rock] = fire([src('h:1', v(0, 0, -60), 0.3), src('sk:1', v(0, 0, 5), 0.3), src('cit:g0', v(3, 0, 1.2), 2), src('rock:1', v(-3, 0, 1.2), 0.5)], 'seismic', 6, 9, 1.3);
    expect(gen.took).toEqual([{ punch: 9, damage: 0, heavy: true, warPunch: 9, v: expect.any(Array) }]);
    expect([rock.took.length, skirm.took.length, hunter.took.length, hunter.seen.length]).toEqual([1, 1, 0, 3]);
    for (const s of [hunter, skirm, gen, rock].flatMap((x) => x.seen)) expect([typeof s.punch, typeof s.damage, typeof s.warPunch, typeof s.heavy, s.v.length]).toEqual(['number', 'number', 'number', 'boolean', 3]);
  });
  it('the arc: a front lock light, an objective at the cut', () => {
    const S = [src('front:7', v(0, 0, -20), 0.4), src('front:t1', v(6, 0, -20), 0.6, 'turret')];
    const [front, turret] = fire(S, 'energon', 60, 2.4, 0, S[0].t);
    expect(front.took).toEqual([{ punch: 2.4, damage: 0, heavy: false, warPunch: 2.4, v: expect.any(Array) }]);
    expect([turret.took[0].punch, turret.took[0].warPunch].map((x) => +x.toFixed(12))).toEqual([1.68, 0.84]);
  });
  it('a Blue sky round lands heavy on the Citadel', () => {
    const [gen] = fire([src('cit:g1', v(0, 0, -8), 2)], 'crystal', 33, 3, 0.5);
    expect(gen.took[0]).toEqual({ punch: 3, damage: 0, heavy: true, warPunch: 1.5, v: [0, 0, -33] });
  });
});
```
  New probe `galaxy-capital` (R17; `pieces` joins `__galaxyDebug`), set up as `galaxy-bolt`: `pieces.destroyer(state.ship, 'destroyer')`; ship pinned 20 out on +x of `targets[0].at`, `heading: Math.PI / 2`; `pieces.hit` wrapped; line 0 fired 200 ms (no hit in 900 ms: again from −x, `-Math.PI / 2`); `ok` on `type: 'part'`.
- [ ] **Step 2: Run to fail.** `npx vitest run src/components/universe/uniqueArms.test.js`: `Tests 3 failed (3)`, `expected [] to deeply equal [ { punch: 9, …`. `node scripts/flight-probe.mjs galaxy-capital --url http://127.0.0.1:5188`: `FAIL`.
- [ ] **Step 3: Implement.** uniqueArms.js: Produces' options (`hunters`, `war`, `scored` go, in the header too); `huntersNow`, `foes`, `land` →
```js
  // a short shot into it; damage 0: no pilot in reach
  const land = (t, punch, from, heavy = false) => {
    const s = shotAt(t, from);
    return strike(s.from, s.to, { punch, damage: 0, heavy, warPunch: isObjective(t) ? punch * SUB : punch });
  };
```
  blast `land(t, c.punch, c, true)`; shard `strike(from, to, { punch: P.punch * (r.punch / 3), damage: 0, heavy: true, warPunch: P.punch * SUB })`; round `strike(from, r, { punch: r.punch, damage: 0, heavy: true, warPunch: r.punch * SUB, v: r.v })`.
  US: `createUniqueArms({ parent: map, …` drops `hunters`, `war`, `scored`, takes `foes: () => sight.foes` and `strike: (from, to, shot) => guns.strike(from, to, shot, UNIQUE_HITS)`; `const frontHits = foeHits((from, to, shot) => frontHit(from, to, shot.warPunch ?? shot.punch ?? 1));`; `const UNIQUE_HITS = BOLT_HITS.filter((s) => s !== heardHits && s !== pilotHits && s !== trafficHits); // (pilots: the arsenal spec; traffic: lane 4's)`; `STILL`, `uniqueShot`, `uniqueStrike` go.
  GS: its call changes the same way; `STILL`, `uniqueShot`, `uniqueStrike` go; before `BOLT_HITS`:
```js
  // the capital ship's parts, as on the universe map
  const capitalHits = (from, to, shot) => {
    const ch = pieces?.destroyerHere ? pieces.hit(from, to, shot.punch ?? 1) : null;
    if (!ch) return null;
    if (ch.type === 'part' || ch.type === 'bridge') state.hitMark = 1;
    pops.hit({ point: ch.at, normal: popDir.set(-shot.v[0], 3, -shot.v[2]).normalize(), radius: ch.down ? ch.size * 1.8 : ch.type === 'shielded' ? 0.45 : 0.2 });
    return ch;
  };
```
  `BOLT_HITS` and `UNIQUE_HITS` become `[capitalHits, <Task 9's source>]`. Lock block: `const capitalCands = pieces?.destroyerHere ? pieces.targets : NO_TARGETS;`, `|| capitalCands.length` in its `if`, pushed after `warCands` to `candBuf` and `foeBuf`.
- [ ] **Step 4: Run to pass.** Step 2's runs pass; Task 10 Step 5's gates.
- [ ] **Step 5: Browser gate.** Task 10 Step 5b, `t=t19`; `for a in order unique-pilots galaxy-capital; do node scripts/flight-probe.mjs $a --url http://127.0.0.1:5188; echo "exit $?"; done`: each exit 0.
- [ ] **Step 6: Commit.** `git add src/components/universe/{uniqueArms,uniqueArms.test,scene}.js src/components/galaxy/scene.js scripts/flight-probe.mjs`; “The unique arms hit what a bolt does, but pilots and traffic”; body: “They hit only your hunters (B10).”

### Task 20: Shots in flight go when you die, on both maps (B11)

**Files:** Modify `src/components/universe/rounds.js`, US, GS. Create `src/components/universe/rounds.test.js`.

**Interfaces:** Consumes Task 9's `guns.clear()`, Task 12's `launch`, `fly(dt, hit, expire, find)`. Produces `rounds.clear()`: every round hidden, `target`, `targetId` null.

- [ ] **Step 1: Failing test.** rounds.test.js:
```js
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRounds } from './rounds';

describe('createRounds', () => {
  const g = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  beforeAll(() => vi.stubGlobal('document', { createElement: () => ({ getContext: () => g }) }));
  afterAll(() => vi.unstubAllGlobals());
  it('clear() puts every round away (B11)', () => {
    const r = createRounds(new THREE.Group(), 3);
    const opts = { life: 2, punch: 8, damage: 30, homing: 2.4, targetId: null };
    r.launch(new THREE.Vector3(), [0, 0, -1], 30, opts);
    r.launch(new THREE.Vector3(1, 0, 0), [0, 0, -1], 30, opts);
    const on = () => r.list.filter((m) => m.visible).length;
    r.clear();
    const hit = vi.fn(), expire = vi.fn();
    expect([on(), r.fly(0.016, hit, expire, () => null), hit.mock.calls.length + expire.mock.calls.length]).toEqual([0, false, 0]);
  });
});
```
- [ ] **Step 2: Run to fail.** `npx vitest run src/components/universe/rounds.test.js`: `TypeError: r.clear is not a function`.
- [ ] **Step 3: Implement.** `clear()` as Produces, in the header too. In both scenes' `startCrash` and `startDestroyed`, after `unique.clear();`: `guns.clear(); rounds.clear();`.
- [ ] **Step 4: Run to pass.** Step 2's run passes; Task 10 Step 5's gates.
- [ ] **Step 5: Browser gate.** Task 10 Step 5b, `t=t20`; `node scripts/flight-probe.mjs crash --expect clear --url http://127.0.0.1:5188`: exit 0 (1 before).
- [ ] **Step 6: Commit.** `git add src/components/universe/{rounds,rounds.test,scene}.js src/components/galaxy/scene.js`; “Shots in flight go when you're shot down or crash”; body: “They could still score (B11).”

### Task 21: The galaxy reads the difficulty setting (B12)

**Files:** Modify `src/components/universe/shared/flying.js`, GS, `scripts/galaxy-hud-check{.mjs,/lib.mjs}`. Create `scripts/galaxy-hud-check/difficulty.mjs`. Test `src/components/universe/shared/shared.test.js`.

**Interfaces:** Consumes `difficultyOf(id)`. Produces `open(viewport, { reduced = false, controls = null } = {})`, scenario `difficulty`.

- [ ] **Step 1: Failing tests.** shared.test.js: `'difficultyOf'` joins the `[flying, [` row. difficulty.mjs, built as hangar.mjs: 1440×900 with `{ controls: { difficulty: 'outlaw' } }`; `say(label === 'Outlaw', \`the hunters read it (${label})\`)`, `label = __galaxyDebug.hunters.difficulty?.()?.label ?? null`; set `state.safeUntil = 1e12`, `shield = 40`, `hitAt = clock - 60`; over 1500 ms, `say(Math.abs(rate - want) <= want * 0.05, \`shields at its rate (${rate.toFixed(2)}, ${want.toFixed(2)} wanted)\`)`, `rate = Δshield / Δclock`, `want = 12 * stats.regen * 0.7`; no page errors. Then the page again opened `{ reduced: true, controls: { difficulty: 'outlaw' } }` (review focus 4: no hunters): `say(errors.length === 0, 'no page errors with reduced motion')`. lib.mjs `open`: `if (controls) await ctx.addInitScript((c) => window.localStorage.setItem('tp-universe-controls', JSON.stringify(c)), controls);`. galaxy-hud-check.mjs dispatches it as it does `hangar`.
- [ ] **Step 2: Run to fail.** `npx vitest run src/components/universe/shared/shared.test.js`: `face 1 lends exactly its names` fails. `node scripts/galaxy-hud-check.mjs difficulty`: `FAIL … (null)`, `FAIL … (12.00, 8.40 wanted)`.
- [ ] **Step 3: Implement.** flying.js: `export { difficultyOf } from '../difficulty';`. GS imports it from flying.js; after `const controls = …`, `const diff = () => difficultyOf(controls().difficulty);`, `if (hunters) hunters.difficulty = diff;`; in `onHunters`, `else if (e.type === 'laser') hurt(e.damage);` becomes `else if (e.type === 'laser') hurt(e.damage * diff().damage);` (`onNet`'s `hurt(e.damage, e.from)` stays); the shield regen's `* state.stats.regen` gains `* diff().regen`, as in US.
- [ ] **Step 4: Run to pass.** Step 2's vitest run, plus `src/components/universe/difficulty.test.js`, passes; Task 10 Step 5's gates.
- [ ] **Step 5: Browser gate.** `for s in "" difficulty; do OUT="$S/t21/galaxy" node scripts/galaxy-hud-check.mjs $s; done`: only `ok`, `(Outlaw)`, `(8.40, 8.40 wanted)`, `no page errors with reduced motion`.
- [ ] **Step 6: Commit.** `git add src/components/universe/shared/{flying,shared.test}.js src/components/galaxy/scene.js scripts/galaxy-hud-check.mjs scripts/galaxy-hud-check/{lib,difficulty}.mjs`; “The galaxy flies at the difficulty it shows”; body: “It ignored the setting (B12).”

### Task 22: The galaxy’s touch buttons hold while the thumb drifts (B13)

**Files:** Create `K/flight/HeldButton.jsx`. Modify `K/index.js`, `src/components/galaxy/GalaxyView.jsx`, `scripts/galaxy-hud-check.mjs`, the evidence README. Test `K/flight/HeldButton.test.jsx`.

**Interfaces:** Consumes `TouchButton` (its blur let-go calls `onRelease()` with no event). Produces `HeldButton({ on = true, off = false, onHold, ...rest })`.

- [ ] **Step 1: Failing test.**
```jsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import TouchButton from '../TouchButton';
import HeldButton from './HeldButton';

describe('HeldButton', () => {
  it('draws as the universe map’s, holds, lets go with no event', () => {
    expect(html(<HeldButton className="universe-fire" onHold={() => {}}>Fire</HeldButton>)).toBe('<button type="button" class="hud-touch-btn universe-fire">Fire</button>');
    expect(html(<HeldButton size={52} className="universe-climb" aria-label="Nose up" on={1} off={0} onHold={() => {}}>^</HeldButton>)).toBe('<button type="button" class="hud-touch-btn universe-climb" data-size="small" aria-label="Nose up">^</button>');
    const got = [];
    const el = HeldButton({ on: -1, off: 0, onHold: (x) => got.push(x) });
    const e = { preventDefault: vi.fn() };
    el.props.onPress(e);
    el.props.onRelease();
    expect([el.type === TouchButton, e.preventDefault.mock.calls.length, got]).toEqual([true, 1, [-1, 0]]);
  });
});
```
- [ ] **Step 2: Run to fail.** `npx vitest run src/runtime/hud/flight/HeldButton.test.jsx`: `Failed to resolve import "./HeldButton"`. Then in galaxy-hud-check.mjs's `run`, after the chips block's `pickups.clear()` and `settle`, add an `if (touch)` check: mouse down in the middle of `.universe-fire`, move 90 left and 60 up in 6 steps, read `held = __galaxyDebug.state.fireBtn` at 300 ms, mouse up, read `after` at 100 ms; `say(held && after === false, \`Fire holds as the thumb drifts (${held}, ${after})\`)`. After `const SIZES`, add `const ASKED = [[844, 390, true]]; // (when named, till Task 27)` and loop over `only ? [...SIZES, ...ASKED] : SIZES`. `SIZES=1440x900,390x844,844x390 OUT="$S/t22/before" node scripts/galaxy-hud-check.mjs`: the drift line FAILs `(false, false)`; 844×390 also FAILs its `meet` lines.
- [ ] **Step 3: Implement.** HeldButton.jsx, no hooks: `<TouchButton {...rest} onPress={(e) => { e.preventDefault(); onHold(on); }} onRelease={() => onHold(off)} />`. index.js: `export { default as HeldButton } from './flight/HeldButton';`. GalaxyView: `HeldButton` joins Task 8's `'../../runtime/hud'` import; `hold`, `trigger`, `climb` go; Fire, Boost (`size={76}`) and the climb (`size={52}`, `on={way} off={0}`) become `HeldButton`s, `onHold={(x) => view.current?.fire?.(x)}` (`boost`, `climb`).
- [ ] **Step 4: Run to pass.** Step 2's vitest run passes; Task 10 Step 5's gates.
- [ ] **Step 5: Browser gate.** Step 2's run into `"$S/t22/after"`: drift `ok … (true, false)`, no FAIL but 844×390's `meet` lines; the default run only `ok`. Task 2 Step 4's loop with `9922` into `$S/t22/`: FIRE, BOOST in capitals, nothing moved; a README line names the shots.
- [ ] **Step 6: Commit.** `git add src/runtime/hud/flight/{HeldButton,HeldButton.test}.jsx src/runtime/hud/index.js src/components/galaxy/GalaxyView.jsx scripts/galaxy-hud-check.mjs docs/superpowers/evidence/flight-core/README.md`; “The galaxy's touch buttons hold while the thumb drifts”; body: “They let go on pointerleave (B13).”


Short names: US, GS the universe’s and galaxy’s `scene.js`; UM `src/components/universe/UniverseMap.jsx`; GV `src/components/galaxy/GalaxyView.jsx`; K/ `src/runtime/hud/`. Browser steps run after Task 1 Step 5’s `export` line and dev server, `T` the task (`T=t23`…). *Universe gate*: the header’s, for `q` in `high low`, `<task>` being `$T`. *Galaxy gate*: `OUT="$S/$T/galaxy" node scripts/galaxy-hud-check.mjs`, only `ok` lines, shots by eye. *Three sizes*: Task 2 Step 4’s viewport loop, its `mv`s into `$S/$T/`, each shot beside Task 2’s. In phase C, shot-compare’s `OVER` lines are only what the task names. Each commit body ends `Scenes: universe <n> lines, galaxy <m>.`, then the two trailers.

### Task 23: One distance unit in the flight HUD (C1)

**Files:**
- Modify: US: `./nav`’s import loses `shortDistance`; Task 8’s `frame.js` import gains `distText`, its `createFlightHud({ distText: shortDistance })` becoming `createFlightHud({ distText })`.
- Modify: `src/components/galaxy/cluster.js:11, :16, :65`; `scripts/universe-check.mjs` (Task 1’s `--lock` branch). Test: `src/components/galaxy/cluster.test.js`.

**Interfaces:** Consumes `distText(d)`, Task 1’s `lock`, `overlay`. Produces each pose’s `hud: { lockDist, lockUnits }`; *gated*: `lock.held` and the `universe-lock` mark `on` (R14).

- [ ] **Step 1: Failing tests.** `cluster.test.js` imports `distText` from `'../../runtime/hud/flight/frame.js'`; in `describe('flight cluster')`:
  ```js
  it('says how far the target is as the lock’s bracket does (frame.js’s distText)', () => {
    const root = dom();
    const c = createCluster();
    const said = (dist) => {
      c.place(root, v({ lock: { name: 'TIE Fighter', dist, hp: null } }));
      return root.querySelector('.fc-target-dist').textContent;
    };
    expect([0.04, 9.26, 9.96, 14.2, 160.5, 1234.4].map(said)).toEqual(['0.0', '9.3', '10.0', '14', '161', '1234']);
    expect(said(9.96)).toBe(distText(9.96));
  });
  ```
  `universe-check.mjs`: `hud.lockDist` is `.universe-lock-dist`’s text, `hud.lockUnits` the ship’s distance to `__universeDebug.state.lockTarget.at`; a gated pose whose `lockDist` fails `/^\d+(\.\d)?$/` or is over 1 off calls `` fail(`${tier} ${name}: the lock says ${hud.lockDist}, ${hud.lockUnits.toFixed(1)} units off`) ``.
- [ ] **Step 2: Run to fail.** `npx vitest run src/components/galaxy/cluster.test.js`: `expected [ '0.0', '9.3', '10', … ] to deeply equal [ '0.0', '9.3', '10.0', … ]`. `node scripts/universe-check.mjs --quality low --poses rickmorty --lock --out "$S/t23-fail/low"`: `FAIL low rickmorty: the lock says 24, 6.1 units off`.
- [ ] **Step 3: Implement.** `cluster.js:11` imports `distText`; `:16` goes; `:65`: `put(els.tDist, 'td', distText(t.dist), text);`. US as Files; on foot stays `` `${Math.round(t.dist)} m` ``.
- [ ] **Step 4: Run to pass.** `Tests 11 passed (11)`. Four gates green.
- [ ] **Step 5: Browser.** Universe gate: no `FAIL`, `OVER` only for `*.hud.webp` and the lock and nav text (rickmorty `6.1`); galaxy gate; three sizes.
- [ ] **Step 6: Commit.** `git add src/components/universe/scene.js src/components/galaxy/cluster{,.test}.js scripts/universe-check.mjs`; `The flight HUD says how far in map units on both maps`; body: “The map said ship-lengths; the card read 9.96 as 10.”

### Task 24: The overlay’s labels at 0.7 rem (C2)

**Files:** Modify `src/components/universe/universe.css:609` (`0.6rem`) and `:1291` (`0.62rem`) to `0.7rem`. Test `scripts/galaxy-hud-check.mjs`, after the target block’s `await settle(page, 500);`.

**Interfaces:** Consumes `smallText(page, root)` (`galaxy-hud-check/lib.mjs`).

- [ ] **Step 1: Failing check.**
  ```js
  if (await G(() => Boolean(document.querySelector('.universe-lock[data-on]')))) {
    const small = await smallText(page, '.universe-hud');
    say(small.length === 0, `the lock’s words are 0.7 rem at least${small.length ? `: ${small.join(', ')}` : ''}`);
  }
  ```
- [ ] **Step 2: Run to fail.** `SIZES=1440x900,390x844 OUT="$S/t24-fail" node scripts/galaxy-hud-check.mjs`: `FAIL 1440x900: the lock’s words are 0.7 rem at least: b.universe-lock-name "…" 9.6px, …`; `9.92px` at 390x844.
- [ ] **Step 3: Implement.** The two values.
- [ ] **Step 4: Run to pass.** `ok` at both. Four gates green.
- [ ] **Step 5: Browser.** Universe gate (`OVER` as Task 23’s), galaxy gate, three sizes.
- [ ] **Step 6: Commit.** `git add src/components/universe/universe.css scripts/galaxy-hud-check.mjs`; `The flight overlay's words are 0.7 rem, on a phone too`; body: “Under the HUD’s floor before.”

### Task 25: The overlay’s CSS in the kit, under `:where(.universe-hud)` (C3)

**Files:**
- Create: K/`flight/flight.css`, `scripts/flight-hud-style-check.mjs`. Modify: K/`flight/FlightHud.jsx` (`import './flight.css';`).
- Modify: `src/components/universe/universe.css`, cut bottom up: `:1316-1319` (`.universe-reticle[data-hit],` to `.universe-hud > span { transition: none; }`), `:1288-1291`, `:522-695` (`.universe-hud {` to `.universe-mate-name {…}`); `src/components/galaxy/flight.css:62-69` (the kill X).

**Interfaces:** Produces `node scripts/flight-hud-style-check.mjs --write <f> | --against <f> [--maps universe,galaxy] [--parts overlay,cluster] [--order last|first|both]`, all by default.

- [ ] **Step 1: Write the check.** A page per map (`.universe-page > .universe-map[data-ship='xwing']`; the galaxy’s with `.galaxy-page`, `.galaxy-map`) holding the sheets from disk (`universe.css` with its `@import`s, K/`hud.css`, K/`cluster.css`, `galaxy/flight.css`, K/`flight/flight.css` last or first) and Task 8’s overlay and FlightCluster.jsx’s markup, pasted. States: the overlay’s 64 (`data-static`; `data-off`; `data-hot`; the threats’ `data-on`; `data-way` with `data-hit`; `data-tough` with `data-kill`), the cluster’s 16 (`.hud-cluster[data-on]`, `.fc-target[data-on]`, `.fc-speed[data-boost]`, `.hud-vitals[data-low]`). Each state’s computed styles, pseudos too, transitions finished, at 1440×900, 390×844, 844×390, motion reduced and not. It prints `smallest text: <px>`; `--against`, `N differences (order: <o>)` and `size|motion|map|state|element|pseudo property: before -> after` lines, exit 1 on any.
- [ ] **Step 2: Baseline.** `T=t25; mkdir -p "$S/$T"; node scripts/flight-hud-style-check.mjs --write "$S/$T/style.json"`: `smallest text: 11.2px`; `--against` it: `0 differences (order: last)`, `0 differences (order: first)`.
- [ ] **Step 3: Move the rules.** `flight.css`: a header; `:522-695`; `:1288-1291` in `@media (max-width: 767px)`; `:1316-1319` in `@media (prefers-reduced-motion: reduce)`; the kill X last. A selector not starting `.universe-hud` gains `:where(.universe-hud) `; one starting `.universe-hud` stays (wrapped, it would reorder).
- [ ] **Step 4: Run to pass.** `--against`: `0 differences` both orders. Four gates green; `grep -l ':where(.universe-hud) .universe-reticle' dist/assets/*.css | wc -l`: `1`.
- [ ] **Step 5: Browser.** Universe gate as Task 24’s, and `shot-compare "$S/t24/$q" "$S/t25/$q"` with the floor `within the floor`; galaxy gate; three sizes as Task 24’s.
- [ ] **Step 6: Commit.** `git add src/runtime/hud/flight/{flight.css,FlightHud.jsx} src/components/universe/universe.css src/components/galaxy/flight.css scripts/flight-hud-style-check.mjs`; `The flight overlay's CSS is the HUD kit's, under :where(.universe-hud)`; body: “No computed value moved.”

### Task 26: Every part of the HUD on both maps (C4)

**Files:**
- Modify: K/`flight/{FlightHud.jsx,flightHud.js,frame.js,flight.css}`, `src/components/galaxy/{cluster.js,cluster.test.js,flight.css,GalaxyView.jsx,scene.js}`, `src/components/universe/{UniverseMap.jsx,scene.js}`, `scripts/{galaxy-hud-check,universe-check}.mjs`. Delete: `src/components/galaxy/FlightCluster{,.test}.jsx`. Test: K/`flight/{FlightHud.test.jsx,flightHud.test.js,frame.test.js}`.

**Interfaces:** Consumes Tasks 6 to 8’s radar, `FlightOverlay`, `fillFlight`; `sight.foes` (R22). Produces `createFlightHud({ distText, draw = drawRadar })`, US `state.kills`, `state.killMark`, and:
  ```
  FlightHud({ hudRef, crosshair, flying = true, foot = false, className = '', vitalsIcon = null, speedIcon = null,
    armsKeys = false, powers = null, row = null, over = null, overlay = null, after = null, clusterRef = null })
  // frame parts, made once; null leaves one as it is (target null: none)
  cluster: clusterView's out; speed: { v, top, boosting }; kills; alt: { on, alt, moving };
  wanted: { on, stars, word, search, bounty }; radar: { points, range, dpr }; target: { name, dist, hp } | null
  ```

- [ ] **Step 1: Styles before.** `T=t26; mkdir -p "$S/$T"; node scripts/flight-hud-style-check.mjs --write "$S/$T/style.json" --parts cluster`.
- [ ] **Step 2: Failing tests.**
  - `FlightHud.test.jsx` (`GameIcon` from `'../GameIcon'`, `const ref = { current: null };`, R31): FlightCluster.test’s case moves, rendering `<FlightHud hudRef={ref} vitalsIcon={<svg className="fc-shield-icon" aria-hidden="true" />} speedIcon={<GameIcon name="hud:speed" className="fc-speed-icon" />} />`. New:
    ```jsx
    it('has every part on both maps', () => {
      const html = renderToStaticMarkup(<FlightHud hudRef={ref} />);
      for (const c of ['fc-radar', 'fc-speed-n', 'fc-kills-n', 'fc-target', 'fc-target-name', 'fc-target-dist', 'fc-target-hp', 'universe-wanted', 'universe-wanted-word', 'universe-alt', 'universe-hud']) expect(html).toContain(c);
    });
    it('says Shields in a ship and Health on foot', () => {
      expect(renderToStaticMarkup(<FlightHud hudRef={ref} />)).toMatch(/<span class="hud-label">Shields<\/span>/);
      const foot = renderToStaticMarkup(<FlightHud hudRef={ref} foot />);
      expect(foot).toMatch(/<span class="hud-label">Health<\/span>/);
      for (const c of ['fc-radar', 'fc-speed-n', 'fc-target-name']) expect(foot).not.toContain(c);
    });
    it('puts the world’s slots where they go', () => {
      const html = renderToStaticMarkup(<FlightHud hudRef={ref} powers={<i className="powers-slot" />} row={<i className="row-slot" />} over={<i className="over-slot" />} overlay={<i className="overlay-slot" />} after={<i className="after-slot" />} />);
      expect(html).toContain('<div class="hud-cluster-over"><i class="over-slot"></i></div>');
      const at = (s) => html.indexOf(s);
      expect(at('powers-slot')).toBeGreaterThan(at('fc-target-hp'));
      expect(at('row-slot')).toBeGreaterThan(at('powers-slot'));
      expect(at('overlay-slot')).toBeGreaterThan(at('universe-nav-dist'));
      expect(at('after-slot')).toBeGreaterThan(at('overlay-slot'));
    });
    it('with no ship, only the overlay slot', () => expect(renderToStaticMarkup(<FlightHud flying={false} overlay={<i className="o" />} />)).toBe('<i class="o"></i>'));
    ```
  - `flightHud.test.js`, `describe('the cluster’s parts (moved from galaxy/cluster.test.js)')` (R31): `clusterEl` (cluster.test’s `el`), `PARTS` with `.universe-alt`, `.universe-wanted`, `.universe-wanted-word`, `.universe-wanted-bounty`, `.fc-radar`, `MANY` with `'.universe-wanted-stars i': 5`, `clusterDom` (`dom`, `.hud-cluster` being itself), `laser`,
    ```js
    const mapOverlay = (map) => ({ ...clusterEl(), parentElement: map, querySelector: () => null, querySelectorAll: () => [] });
    const fv = (frame, o = {}) => {
      const x = { on: true, shield: 82, low: false, speed: 6, top: 12, boosting: false, kills: 3, lock: null, arms: laser, ...o };
      frame.cluster = { on: x.on, vitals: { value: x.shield, max: 100, low: x.low }, arms: x.arms, abilities: null };
      frame.speed = { v: x.speed, top: x.top, boosting: x.boosting };
      frame.kills = x.kills;
      frame.target = x.lock;
      return frame;
    };
    ```
    The seven cases move, their act now `createFlightHud({ distText }).place(mapOverlay(root), fv(createFrame(), o))`. New `'writes the altitude and wanted parts, and leaves a null one'`: `alt = { on: true, alt: 0.25, moving: true }` → `.universe-alt` `data-on`, `data-moving`, `--alt` `'0.250'`; `wanted = { on: true, stars: 2, word: 'Wanted', search: false, bounty: 450 }` → `data-on`, 2 of 5 stars `data-lit`, `'Wanted'`, `'450 ¢'`; `alt = null` → `'0.250'`, `writes` 0. New `'draws the radar only when its part is there'`: `draw = (...a) => calls.push(a)`, `radar = { points: P, range: 40, dpr: 1 }` → `[[root.querySelector('.fc-radar'), P, { range: 40, dpr: 1 }]]`; `null` → none.
  - `frame.test.js` `'fills the target card from the lock it brackets'`: `f = createFrame()`, `f.cluster = { on: true }`, `fillFlight(f, view({ lock: { id: 't', at: P(720, 450, 14.2), size: 1, hp: 1, hpMax: 2 }, lockName: 'TIE Interceptor' }), project)` → `f.target` `{ name: 'TIE Interceptor', dist: 14.2, hp: 0.5 }`, the same object filled twice; `hpMax: 1` → `hp: null`; `f.cluster.on = false` → `null`.
  - `galaxy-hud-check.mjs`: `the deflectors read …` → `the shields read …`; `the vitals say Shields (${word})` from `.fc-ship .hud-label`; after `three effects are three chips`, `the chips and the jump button take the galaxy’s sheet` (R3): `.fc-buffs` `display: flex`, `.galaxy-page` `--fc-left: 176px`.
  - `universe-check.mjs`: a gated pose fails unless `.fc-target-name` reads as `.universe-lock-name`, `.fc-speed-n` as `/^SPD \d+$/`, and `.fc-radar` has 300 pixels of alpha ≥ 8.
- [ ] **Step 3: Run to fail.** `npx vitest run src/runtime/hud/flight/{FlightHud.test.jsx,flightHud.test.js,frame.test.js}`: the new and moved cases fail. `SIZES=1440x900 OUT="$S/t26-fail" node scripts/galaxy-hud-check.mjs`: `FAIL 1440x900: the vitals say Shields (Deflectors)`.
- [ ] **Step 4: Implement.**
  1. FlightHud.jsx: `!flying` → `<>{overlay}</>`; else UM’s `.universe-alt`; `Cluster` (`rootRef={clusterRef}`, `className={`fc ${className}`.trim()}`, `label` `Flight`/`On foot`, `over`) round FlightCluster.jsx’s row (Vitals `Shields`/`Health`, `vitalsIcon`, `speedIcon`, `<Arms keys={armsKeys} />`; on foot no radar, speed or card) and `{powers}{row}`; UM’s `.universe-wanted`; `<FlightOverlay …/>`; `{overlay}{after}`.
  2. flightHud.js finds the parts under `root.parentElement`; writes `cluster` by the kit’s `createFlightCluster()`, then while on `speed`, `kills`, `target` as galaxy `cluster.js` writes them today (from `const k = v.top > 0 ? Math.min(1, Math.abs(v.speed) / v.top) : 0;` to `if (tough) put(els.tHp, 'thp', Math.round(t.hp * 50), WRITE.hull);`), `alt` and `wanted` on change in US’s strings, `draw(…)` for `frame.radar`; counts its DOM writes.
  3. frame.js: `fillFlight` fills one `frame.target` (a module `WeakMap`), `{ name: v.lockName, dist, hp: (lock.hpMax ?? 1) > 1 ? lock.hp / lock.hpMax : null }`, while `frame.cluster?.on` and locked, else `null`.
  4. `galaxy/flight.css`’s `.fc-speed > span {` to `.fc-radar { width: 132px;` and `/* a laptop's width:` to `(max-height: 779px)`’s close go to K/`flight/flight.css`, `.galaxy-page` kept (R28).
  5. GV: `import './flight.css';` after `import '../universe/universe.css';` (R3), `{ PowerBar }` from `'../universe/shared/powerBar'`; `radar`, props `cluster,` `radar,` go; after `<div ref={tags} …/>`, `{on && <FlightHud flying={Boolean(ship)} hudRef={hud} clusterRef={cluster} … />}` with FlightCluster’s icons, `over` and `powers`, and the WarHud and StarfighterHud lines as `overlay`.
  6. GS: the `radarDraw` import goes (flightHud draws the radar); `placeShield` → `fillShield`, which drops `cluster.place(root, v)` and keeps `cluster.buffs(props.buffs?.current ?? null, v.on ? buffsNow() : NO_BUFFS)`, and `clusterNow`, `clusterLock` and the `range` uses go (`frame.cluster` with `vitals: { value: state.shield, max: 100, low: state.shield < 35 }`, `speed`, `kills`; `alt`, `wanted` `null`); `placeRadar` → `fillRadar`, ending `frame.radar = radar.due(state.clock) ? radarPart : null`, `radarPart` holding `radar.points(radar.range)`, `radar.range` and its `dpr` line.
  7. UM: `alt`, `wantedEl`, the props `alt,` `cluster,` `wanted: wantedEl,` go; `<div ref={alt}` to the `.universe-siege` div becomes a FlightHud with Task 8’s props, `clusterRef={cluster}`, `className="universe-cluster"`, `foot={onFoot}`, `vitalsIcon={<RiShieldLine aria-hidden="true" />}`, `armsKeys`, the PowerBar and Abilities lines (conditions kept) as `powers` and `row`, the siege div as `overlay`.
  8. US: `kills: 0, killMark: 0,` after `hitMark: 0,`; `state.kills = 0;` in the `if (!same) {` with `traffic?.setCrew(`; `state.kills += 1; state.killMark = 1;` only in `hunterShot`’s `if (hh.down) {` and `pilotShot`’s `if (ph.down) {` (R16); killMark decays as GS’s (`dt / 0.35`) after the hitMark decay and keeps the frame busy; `hudIn` `kill: state.killMark > 0`. `placeAlt`, `placeWanted`, `placeCluster` → `fill…`, rules and `wantedWas` kept, speed `top: SHIP.boost`. `fillRadar` as GS’s (`createRadar`, `'../../lib/combat/flight/radar'`): `sight.foes`, threatening `pilots.targets`; `pilots.mates`, live `wingmen.ships` (`w.pos`), `front?.battle?.fighters` on `front.joined` (`f.seen ?? f.pos`); the nav goal. Fills run before `placeHud()`.
  9. `git rm src/components/galaxy/FlightCluster{,.test}.jsx`; `cluster.js` keeps `buffChips` and `buffs`: `createCluster()` returns `{ buffs }` alone, and the `createFlightCluster` import, `WRITE`, `text`, `num`, `speedText`, `bar` and `flag` go with `place`; `cluster.test.js` loses `describe('flight cluster')`, its helpers.
- [ ] **Step 5: Run to pass.** Step 3’s files and `src/components/galaxy/cluster.test.js` (`Tests 4 passed (4)`) pass; four gates green; boundary-breaks one under Task 25’s.
- [ ] **Step 6: Browser.** `--against "$S/$T/style.json" --parts cluster --order last`: `0 differences`. Universe gate (`OVER` as Task 25’s), galaxy gate, three sizes; `node scripts/flight-probe.mjs order --url http://127.0.0.1:5188` ends `kills +1)`; with `--line 2`, `ok   one torpedo kill counts once`.
- [ ] **Step 7: Commit.** `git add src/runtime/hud/flight src/components/galaxy src/components/universe/{UniverseMap.jsx,scene.js} scripts/{galaxy-hud-check,universe-check}.mjs`; `Both maps fly with every part of the HUD`; body: “Each map had half the parts.”

### Task 27: One thumbs grid, one stick, one jump button, one cluster height (C5)

**Files:**
- Create: K/`flight/thumbs{,.test}.js`. Modify: K/`flight/FlightHud{.jsx,.test.jsx}`, UM, GV (as Task 22 left it), `src/components/universe/{universe,thumbs}.css`, `src/components/galaxy/{galaxy,flight}.css`, `scripts/galaxy-hud-check.mjs` (`ASKED` into `SIZES`), at Step 3’s lines.

**Interfaces:** Consumes Task 22’s `HeldButton({ on, off, onHold, … })`. Produces props `stickRef`, `jump: { className, name, onPress, accent?, course? } | null`, `controls: { fire, boost, climb, view, weapon | null } | null`, `thumbs`, `onThumbsFit` (`clusterRef` goes); `clusterHeight(row, over) → px` (R10).

- [ ] **Step 1: Failing tests.** `thumbs.test.js`:
  ```js
  import { describe, expect, it } from 'vitest';
  import { clusterHeight } from './thumbs.js';
  describe('the cluster’s height', () => {
    it('is the row, and the strip over it with the grid’s gap', () => {
      expect(clusterHeight({ offsetHeight: 120 }, null)).toBe(120);
      expect(clusterHeight({ offsetHeight: 120 }, { offsetHeight: 30 })).toBe(156);
      expect(clusterHeight(null, null)).toBe(0);
    });
  });
  ```
  `FlightHud.test.jsx`, a new describe with `const c = { fire() {}, boost() {}, climb() {}, view() {}, weapon() {} };`:
  ```jsx
  it('draws only kbd.hud-cap key caps', () => {
    const caps = renderToStaticMarkup(<FlightHud hudRef={ref} armsKeys controls={c} jump={{ className: 'universe-jump', name: 'Endor', onPress() {} }} />).match(/<kbd[^>]*>/g);
    expect(caps).toHaveLength(9); // T, Q, T on the card; R 1 2 3 R on the arms; J
    for (const k of caps) expect(k).toMatch(/^<kbd class="hud-cap"/);
  });
  it('has one jump button, its key first', () => {
    expect(renderToStaticMarkup(<FlightHud hudRef={ref} controls={c} jump={{ className: 'galaxy-jumpbtn', course: true, name: 'Endor', accent: '#f80', onPress() {} }} />)).toContain('<button type="button" class="galaxy-jumpbtn" data-course="" style="--star:#f80"><kbd class="hud-cap" aria-hidden="true">J</kbd><span class="universe-jump-label">Jump to Endor</span></button>');
  });
  it('holds Fire, Boost and the climbs with HeldButton, in one grid', () => {
    const html = renderToStaticMarkup(<FlightHud hudRef={ref} controls={c} />);
    expect(html.match(/class="universe-thumbs"/g)).toHaveLength(1);
    expect(html).toContain('<button type="button" class="hud-touch-btn universe-fire">Fire</button>');
    expect(html).toContain('<button type="button" class="hud-touch-btn universe-boost" data-size="primary">Boost</button>');
    expect(html).toContain('<button type="button" class="hud-touch-btn universe-climb" data-size="small" aria-label="Nose up">');
  });
  ```
- [ ] **Step 2: Run to fail.** `npx vitest run src/runtime/hud/flight/{thumbs.test.js,FlightHud.test.jsx}`: `Failed to resolve import "./thumbs.js"`; the three new cases fail.
- [ ] **Step 3: Implement.**
  - `thumbs.js`: `export const clusterHeight = (row, over) => (row?.offsetHeight ?? 0) + (over?.offsetHeight ? over.offsetHeight + 6 : 0);`.
  - FlightHud.jsx: UM’s stick first (`stickRef`); after `{after}`, `jump &&` the test’s button (`data-course` for `course`, `--star` for `accent`, `onClick={jump.onPress}`); `controls &&` `.universe-thumbs`: `{thumbs}`, `.universe-climbs` (HeldButtons `on={1}`, not on foot `on={-1}`, `off={0}`, `onHold={controls.climb}`, UM’s labels and svgs), UM’s View (`Switch` on foot) and Weapon, Fire and Boost HeldButtons (Boost `size={76}`, `Run` on foot). One effect (deps `[foot]`) sets `--hud-cluster-h` = `clusterHeight(row, over.firstElementChild)` on the map, observing both, removed on cleanup; UM’s thumbs effect moves here, `onThumbsFit?.()` for `refit`.
  - UM: the effects from `// The cluster's height on the map (--hud-cluster-h)` and `// The thumbs' size`, the `cluster`, `thumbs` refs, `const hold` to `climbButton`, the stick, jump and thumbs markup go; it passes `stickRef={stick}`, `controls` (`view.current?.fire`, `boost`, `climb`, `swap` on foot else `seat`, `weapon` or `null` on foot), `jump` (`'universe-jump'`, `aim.name ?? 'it'`, `travel(aim.id, 'hyper')`, while `!onFoot && aim`), `onThumbsFit` (`refit`), `thumbs` (touch PowerBar, Abilities, portal gun, Board, Phone), `after` (prompt, way in).
  - GV: the effect from `// The cluster's height on the map (--fc-h)`, the `cluster` ref, `const climbButton`, the stick, `<div className="universe-climbs">` to the Boost `HeldButton` and both `.galaxy-jumpbtn` blocks go; `controls` as UM’s (`seat`, `weapon` always); `jump` from `aimed` (`'galaxy-jumpbtn'`, `name`, `accent`, `jump(aimed.id)`), else `courseSys` with `course: true`; the PowerBar is `thumbs` (no `placement`) under `useMediaQuery('(pointer: coarse)')`, else `powers`; `.galaxy-mapbtn` in `after`.
  - CSS: `.universe-jump kbd { border-color …}` goes, the coarse `.universe-jump kbd {` → `.universe-jump .hud-cap {`; galaxy.css `:93` → `padding: 0.45rem 1.05rem;`, `:105-116` (`.galaxy-jumpbtn-k`) goes, `:118`’s `.galaxy-jumpbtn-k` → `.galaxy-jumpbtn .hud-cap` and its `padding-left: 1.05rem;` goes; galaxy/flight.css `--fc-h` → `--hud-cluster-h`, with `thumbs.css`’s three `:root .universe-page:not(.galaxy-page)` token blocks on `.galaxy-page` (`var(--panel-w, 0px)`, `var(--hud-pad-b, 12px)`, `var(--sheet-h, 0px)`); `thumbs.css:21-24`’s comment.
- [ ] **Step 4: Run to pass.** All passed (`thumbs.test.js` `Tests 1 passed (1)`); four gates green; kbd-styles `66`.
- [ ] **Step 5: Browser.** In `scripts/galaxy-hud-check.mjs`, `[844, 390, true]` joins `SIZES` after `[375, 667, true]`, and `const ASKED` and its `only ? [...SIZES, ...ASKED] : SIZES` loop go, so the loop runs over `SIZES`. Universe gate as Task 26’s; galaxy gate, its “no two parts meet” and drift lines `ok` at eight sizes (main’s four 844×390 `meet` FAILs gone); three sizes.
- [ ] **Step 6: Commit.** `git add src/runtime/hud/flight/{thumbs.js,thumbs.test.js,FlightHud.jsx,FlightHud.test.jsx} src/components/universe/{UniverseMap.jsx,universe.css,thumbs.css} src/components/galaxy/{GalaxyView.jsx,galaxy.css,flight.css} scripts/galaxy-hud-check.mjs`; `One thumbs grid, one jump button and one cluster height on both maps`; body: “kbd-styles 68 to 66.”

### Task 28: The worlds’ tints, tokens only (C6)

**Files:**
- Create: K/`flight/tints.test.js`.
- Modify: K/`cluster.css:27` (`:where(.hud-cluster):not(hud-none)`) and K/`flight/flight.css`’s `.universe-hud`: `font-family: var(--font-mono);` → `font-family: var(--hud-flight-face, var(--font-mono));`; its reticle’s `border: 1.5px solid` → `border: var(--hud-reticle-line, 1.5px) solid`.
- Modify: `src/components/universe/desk.css:65` → `.universe-page:not(.galaxy-page) { --hud-reticle-line: 1px; }`; `src/components/galaxy/flight.css`’s `.galaxy-page {` gains `--hud-flight-face: var(--font-bf-hud, var(--font-mono));` and `--hud-key-face: var(--font-bf-hud, var(--font-mono));`; GV imports `'../../lib/bf2017/fonts.css'`.

**Interfaces:** Produces `--hud-flight-face`, `--hud-reticle-line`.

- [ ] **Step 1: Failing test.**
  ```js
  import { readFileSync } from 'node:fs';
  import { describe, expect, it } from 'vitest';
  const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8'); // (from src/)
  const FLIGHT = [...'hud reticle foot-reticle lock lock-name lock-dist lock-hp lead nav nav-name nav-dist threat mate mate-name'.split(' ').map((c) => `universe-${c}`), ...'radar ship sub speed speed-n speed-lead speed-icon kills-n target target-name target-dist target-hp none shield-icon'.split(' ').map((c) => `fc-${c}`)];
  const NAMED = new RegExp(`\\.(${FLIGHT.join('|')})(?![\\w-])`);
  const rules = (p) => [...read(p).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, b]) => ({ sel: s.trim(), decls: b.split(';').map((d) => d.trim()).filter(Boolean) }));
  describe('the flight HUD’s tints', () => {
    it.each('universe/universe universe/hud universe/thumbs universe/desk galaxy/flight galaxy/galaxy'.split(' '))('%s sets only custom properties on the flight parts', (p) => {
      expect(rules(`components/${p}.css`).filter((r) => NAMED.test(r.sel) && r.decls.some((d) => !d.startsWith('--'))).map((r) => r.sel)).toEqual([]);
    });
    it('the galaxy wears the Battlefront face', () => {
      expect(rules('components/galaxy/flight.css').find((r) => r.sel === '.galaxy-page').decls).toEqual(expect.arrayContaining(['--hud-flight-face: var(--font-bf-hud, var(--font-mono))', '--hud-key-face: var(--font-bf-hud, var(--font-mono))']));
    });
    it('the kit takes its face and reticle line from the world', () => {
      for (const p of ['runtime/hud/cluster.css', 'runtime/hud/flight/flight.css']) expect(read(p)).toContain('font-family: var(--hud-flight-face, var(--font-mono))');
      expect(read('runtime/hud/flight/flight.css')).toContain('border: var(--hud-reticle-line, 1.5px) solid');
    });
  });
  ```
- [ ] **Step 2: Run to fail.** `npx vitest run src/runtime/hud/flight/tints.test.js`: desk.css gives `['.universe-page:not(.galaxy-page) .universe-reticle']`; the galaxy’s and kit’s strings are missing.
- [ ] **Step 3: Implement.** First `T=t28; mkdir -p "$S/$T"; node scripts/flight-hud-style-check.mjs --write "$S/$T/style.json" --maps universe`; then the edits.
- [ ] **Step 4: Run to pass.** `Tests 8 passed (8)`. Four gates green. `--against "$S/$T/style.json" --maps universe`: `0 differences` both orders.
- [ ] **Step 5: Browser.** Universe gate as Task 27’s; galaxy gate; three sizes.
- [ ] **Step 6: Commit.** `git add src/runtime/hud/flight/tints.test.js src/runtime/hud/cluster.css src/runtime/hud/flight/flight.css src/components/universe/desk.css src/components/galaxy/{flight.css,GalaxyView.jsx}`; `Each map tints the one flight HUD with custom properties alone`; body: “The galaxy wears its face by token.”

### Task 29: Final gates, hand-offs and evidence

**Files:**
- Create: K/`flight/flightCore.scenario.test.js` (outside `npm test`), `vitest.flight.config.js`.
- Modify: `docs/health/budgets.json`, `src/data/health/` (the ratchet); `docs/superpowers/HANDOFF-universe.md` (Landed after `- **Checks.**`; `` `kbd-styles` is at 68 `` → 66; Left), `HANDOFF-galaxy.md` (Recent above `**Pull request #1234**`; Left), `evidence/flight-core/README.md`.

**Interfaces:** Consumes Tasks 6 to 9’s factories, `track`, Task 2’s numbers.

- [ ] **Step 1: The scenario.** `vitest.flight.config.js`: `defineConfig({ test: { include: ['src/runtime/hud/flight/*.scenario.test.js'], execArgv: ['--expose-gc', '--max-semi-space-size=64'] } })`. A frame (60 candidates, 40 bolts, a lock): `sight.update` → `guns.step(dt, [() => false])` → `fillFlight` (Task 8’s `v` with `cands`) → `place` on stand-ins. Cases:
  - `'a frame takes 0.3 ms at the 95th'`: 600 frames after 120, `p95 <= 0.3`.
  - `'a locked frame writes 6 times at most, the map view none'`: `max(writes) <= 6`; after one frame of `hudIn.on = false`, `writes` `0`.
  - `'frame, flightHud and guns allocate nothing'`: `global.gc()`, then one synchronous loop each, `heapUsed` up under 4096 bytes: `fillFlight` and `guns.step` over the moving 600-frame fight; `flightHud.place` over 600 repeats of one unchanged frame (0 writes, so no strings made). The sight’s growth over the same 600 frames is no more than a baseline loop calling only `track(ship, cands, lock, dt, { cycle: 0, ring })` as `sight.update` calls it, plus 1024 bytes.
  - `'a radar draw takes 0.5 ms at the 95th'` (R19): `drawRadar`, a no-op `Proxy` 2D context, 60 points from `createRadar()`, 600 draws, `p95 <= 0.5`.
- [ ] **Step 2: Run it.** `npx vitest run --config vitest.flight.config.js`: `Tests 4 passed (4)`; a failure goes back to the task owning the code.
- [ ] **Step 3: Gates.** Four gates green; `node scripts/health.mjs --check --skip build --json`: boundary-breaks 475, kbd-styles 66, big-files ≤ 22, cycles ≤ 5; both scenes under 6409 and 3092, deltas against −250 and −230. `git diff --name-only --diff-filter=A <Task 2's sha>..HEAD | xargs wc -l`: every new file under 400 lines; the list goes in the README.
- [ ] **Step 4: Ratchet.** `npm run build && node scripts/health.mjs --ratchet --pr 1242`: `budgets: … boundary-breaks 489 → 475, … kbd-styles 70 → 66, …`.
- [ ] **Step 5: Measure.** `T=t29`: universe gate (calls, triangles as run1’s), galaxy gate, three sizes.
- [ ] **Step 6: Evidence.** README `## After (<short sha>)`: measure | before | after | holds to, every Step 2 to 5 number beside Task 2’s.
- [ ] **Step 7: Hand-offs.** Universe Landed: PR #1242, lane 1 of 4, the core and kit folders, B1 to B13; Left: lanes 2 to 4, the phone radar’s place, `guide/pages.js:140`’s “deflectors”. Galaxy Recent: PR #1242, the shared core and HUD, `difficultyOf`, the Battlefront face; Left: wanted (lane 4), the missile warning (lane 3).
- [ ] **Step 8: Commit.** `git add src/runtime/hud/flight/flightCore.scenario.test.js vitest.flight.config.js docs/health/budgets.json src/data/health docs/superpowers/{HANDOFF-universe.md,HANDOFF-galaxy.md,evidence/flight-core/README.md}`; `Lane 1's numbers: the hand-offs, the evidence and the budgets at the new floor`; body: “boundary-breaks 484 to 475, kbd-styles 68 to 66.”
