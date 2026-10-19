# Avengers HQ PR 2: the fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the HQ games that can be won without playing or that break as they run (Thwip, Repulsor Range, Trick Shot, Hold the Lawn, Ricochet), keep one stone table, make the copy true and let “Things to do” reach 8/8. This is PR 2 of the seven in spec §11.

**Architecture:** Each game fix lands in its pure, seeded `rules.js` behind a failing test. Ricochet’s fix goes in a new pure `ricochet/free.js`. The React and CSS edits are the few lines that show the new outcome. Stone names, halves and colours come from one table in `world/labels.js`. `progress()` (PR 1’s `world/rules/progress.js`) takes the unlocked achievements as a second argument, so the gate can be done without a stone. The only change under `hq/` is one CSS rule.

**Tech Stack:** React 19, three 0.186 (the HQ games’ `'glsl'` stage), Vitest 5 (node environment), playwright-core for the browser checks and the repo’s check scripts (`autopilot-check.mjs`, `hq-world-check.mjs`, `inv-world-check.mjs`, `health.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-18-avengers-hq-fix-and-hub-design.md`: §9 (the fixes), §6’s “Things to do reaches 8/8”, §7’s copy fixes, §11 step 2 and §12 (the checks). Where an earlier brief and the spec disagree, the spec wins. PR 2 of 7; the index is `docs/superpowers/plans/2026-10-18-avengers-hq.md`, and PR 1’s plan is `2026-10-18-avengers-hq-pr1-splits.md`.

## Global Constraints

- PR 2 of 7, merged in order. Branch from `origin/main` with PR 1 merged. This PR consumes only two of PR 1’s parts:
  - `src/components/avengers/world/rules/progress.js`: `progress(earned = [])`, re-exported unchanged by the `world/rules.js` barrel.
  - `src/components/avengers/world/scene/doors.js`: `buildMarkers(scene) → placeMarkers(s, clock)`, with the module-private `STONE_OF` and the `STONES` import moved there from `scene.js:38, :58, :1456`.
  - If PR 1 put them elsewhere, find them with `grep -rn "export function progress" src/components/avengers/world` and `grep -rn "m.gem.visible = won" src/components/avengers/world`.
- Line numbers are `main` at `ddb364bf`. PR 1 leaves every other file this PR edits at those lines. When a number is off, find the code by the quoted text.
- **Not in this PR.** §9’s “Repulsor Range: start waits for the stage” belongs to PR 4 (§5’s loading bullets), which uses this PR’s `.hq-game .btn:disabled`. Thwip’s hold-the-button exploit belongs to piece 3.
- **Content (§3).** Nothing here draws a figure, suit or mark of any Marvel character. The only new drawing is Trick Shot’s quiver ticks, laid out in two rows.
- **Copy (RULES.md UI 7).** British spelling, curly quotes (’ “ ”) inside strings, sentence case, no Oxford comma.
- **Keys and hooks (§3).**
  - Every `tp-hq-*` key keeps its name and shape.
  - The one new key is `tp-hq-lawn-boss`: raw `true` through `local.set`, unregistered with `runtime/saves`, as §6 reads the games’ keys.
  - `tp-hq-trickshot-best` keeps its shape. Old bests are on the 10-to-12-arrow scale, so they are easy to beat.
  - `__HQ__` and `__HQWORLD__` keep every name. `__HQ__.lawn.checkpoint()` is added.
- **Tests.** Pure and seeded, beside their file, each under one second, no network. No test is skipped, loosened or deleted. The one changed input (Trick Shot’s “ends a round when the arrows run out”) keeps its name and both assertions, and gains one.
- **Shared code.** `src/components/avengers/hq/` is shared with Invincible (ThinkMark, through `HQFrame`). The one change there, to `hq.css`, must leave `scripts/inv-world-check.mjs`’s pictures unchanged. ThinkMark has no `disabled` attribute anywhere (`grep -n disabled src/components/invincible/thinkmark/ThinkMark.jsx` prints nothing).
- **Limits.**
  - Every file stays under 800 lines (`HoldTheLawn.jsx` is 722 today).
  - No new dependency, renderer or animation loop.
  - No edit to `src/components/guide/pages.js` or `src/runtime/hud/*`: open draft #1028 owns them.
- **Commits.** A plain sentence as the subject. The body says why, with the measured numbers. End with the harness’s attribution lines. No model names anywhere. Never force-push.
- **What later PRs rely on.**
  - PR 3 keeps this PR’s tour sentence verbatim.
  - PR 4 rewrites `labels.test.js`’s `stoneById\('` assertion to `<Results\b`, builds its half wording from `HALF_OF` and passes Hold the Lawn’s checkpoint as `onward` with `againLabel="From wave 1"`.
  - PR 5 adds only `count` to `progress()`’s return, and imports `HALF_OF` and `stoneLine`.
  - PR 6 adds `recordTry('thor')` in `HoldTheLawn`’s `begin`.

## Review Focus

1. **School reached in the step the bell goes.** A player who crosses 2,000 m in the same 1/120 s step that the clock passes 100 s expects “Made it. Barely.”, not “Late for school.” The distance check comes before the bell. Pinned in Task 1 (“still counts school reached in the step the bell goes as made it”).
2. **Shooting through Prime on its way in.** A player who aims at a drone behind the approaching Ultron Prime expects to hit the drone. An unhittable Prime must not soak up the shot. Pinned in Task 2 (“lets a shot through Ultron Prime on its way in, to the drone behind it”).
3. **Restart at the boss after a lost game.** The checkpoint must carry nothing over: no enemies, bolts or spawns, the hammer in hand, five hearts, lightning empty, score 0. Pinned in Task 3 (“carries nothing over into the checkpoint from a game just lost”).
4. **Natasha’s half as well as Clint’s.** The half wording must name Natasha for `soul-natasha`, in both the won and the not-yet-won lines, and the whole `soul` id must read plainly as “Soul Stone”. Pinned in Task 5 (“says whose half a half is …”).
5. **Trick Shot on a phone.** At 390 × 844 the 44-tick quiver in two rows must not run under the wind gauge, the trick-arrow chips or the touch buttons. Pinned in Task 6’s browser script (`trickshot` part: no bounding-box intersections, exactly two rows).

---

### Before Task 1: the before numbers

- [ ] **Branch and check PR 1 is in:** `git fetch origin main && git switch -c <branch> origin/main && ls src/components/avengers/world/rules/progress.js src/components/avengers/world/scene/doors.js`. Expected: both paths print. `S` below is the session’s scratchpad directory (never under the repo).
- [ ] **Write the scratch browser script** `$S/hq-pr2-check.mjs` (not committed). It takes part names as arguments and prints `ok <part>` or `FAIL <part>: <why>` for each.
  - **Launch.** Copy the launch, context and init block of `scripts/hq-world-check.mjs:17-41`, with `W=1024 H=640`, then wait for `window.__HQWORLD__?.api` (the `disabled` part waits for the cards instead, since it runs with 3D off).
  - **Per-part storage.** Each part adds its own `localStorage` entries to the init script.
  - **`ricochet`:**
    - `__HQWORLD__.enter('cap')`, then wait for `__HQ__.ricochet?.view`.
    - Call `__HQ__.ricochet.setState('room1')` and wait 5 rAFs. Read `[geometries, textures]` from `__HQ__.ricochet.view.info()`.
    - Rebuild ten times in this order, 5 rAFs each: `room1, room1, room2, room1, room2, room1, room2, room1, room2, room1`. The first two are back-to-back rebuilds of the same room (the R restart). Then read again.
    - Print both pairs. Pass: the pairs are equal.
  - **`thwip`:**
    - `enter('spidey')`, wait for `__HQ__.thwip?.view`, call `__HQ__.thwip.start()`, set `__HQ__.thwip.state.t = 99.99` and wait 500 ms.
    - Pass: `.tw-title` reads `Late for school.` and a button reads `Again`.
  - **`lawn`** (init: `tp-hq-lawn-boss` = `'true'`):
    - `enter('thor')`, wait for `__HQ__.lawn?.view`, call `__HQ__.lawn.checkpoint()` and wait 2.5 s. The game’s `[role=status]` must contain `Wave 8.`
    - Set `__HQ__.lawn.state.enemies.find((e) => e.kind === 'cull').z = -1.7` and wait 500 ms. The overlay must show the buttons `Restart at the boss` and `From wave 1`.
    - Screenshot `.hq-screen` to `$S/lawn-checkpoint.png`.
    - Click `Restart at the boss`. The status must read `Wave 8.` again within 2.5 s.
  - **`trickshot`**, run at 1024 × 640 and again at 390 × 844 (`isMobile`, `hasTouch`):
    - `enter('hawkeye')`, wait for `__HQ__.trickshot?.view`, call `__HQ__.trickshot.setState('action')`.
    - Pass: `.ts-arrows span` count is 44, and the spans have exactly two distinct `getBoundingClientRect().top` values.
    - Pass: the `.ts-arrows` rect intersects none of the visible `.ts-wind`, `.ts-tricks` or `.ts-touch` rects.
    - Screenshot `.hq-screen` to `$S/trickshot-<w>.png`.
  - **`disabled`** (init, after the copied block: `tp-3d` = `'"off"'`, so `/avengers` shows the cards):
    - Click the card button `Lift it`, then run `document.querySelector('.hq-game .hold-btn').disabled = true`.
    - Pass: its computed `cursor` is `not-allowed`, and its computed `color` equals that of a probe `<span style="color: var(--muted)">` added to the page.
    - Repeat with `document.documentElement.dataset.theme = 'dark'`.
  - **`todo`** (init: `tp-hq-stones` = `JSON.stringify(['power','reality','mind','soul-clint','soul-natasha','soul','time','space'])` and `tp-achievements` = `'["spidey"]'`):
    - Open the HUD’s Menu (the button in `.cw-menu`). Pass: its item contains `Things to do · 8/8`.
    - Rerun with `tp-achievements` removed. Pass: the item contains `Things to do · 7/8`.
- [ ] **Shoot main.**
  - Run `node scripts/autopilot-check.mjs --skip lint,test --routes /avengers,/invincible --shots avhq-pr2 --before`. Expected: it ends `everything green` and writes `public/changes/avhq-pr2-before.webp`.
  - `mv public/changes/avhq-pr2-before.webp $S/`, then `git checkout public/github.json`.
- [ ] **World checks and measurements on main.**
  - Start `npx vite --port 5173 --strictPort` in the background.
  - Run `OUT=$S/inv-before node scripts/inv-world-check.mjs` and `OUT=$S/hq-before node scripts/hq-world-check.mjs`. The second prints `compound up in … s` and ends `no page errors`.
  - Run `node $S/hq-pr2-check.mjs ricochet todo | tee $S/check-before.txt`. Expected on main: `FAIL ricochet` (the second read is higher, by each room’s geometries and the bots’ bone textures) and `FAIL todo` (7/8 with the achievement).
  - Measure the closure into `$S/closure-before.txt` with Task 6 Step 2’s command.

---

### Task 1: Thwip: the bell ends the run, so doing nothing loses

**Files:**
- Modify: `src/components/avengers/thwip/rules.js:9-10` (header), `:278` (the street loss), `:307-315` (the win and the bell)
- Modify: `src/components/avengers/thwip/lines.js:12` (`SAYS.bell`)
- Modify: `src/components/avengers/thwip/Thwip.jsx:109-112` (`case 'bell'`), `:121` (the won result), `:124-127` (`case 'lost'`), `:347-353` (overlay title and text)
- Test: `src/components/avengers/thwip/rules.test.js`

**Interfaces:**
- Consumes: `BELL = 100`, `SCHOOL = 2000`, `distance(g) = -g.p[2]`, `stepRun(g, dt)`, `pilot(g)` (all in `thwip/rules.js`); the test file’s `run`, `types`, `started`, `DT = 1/120`.
- Produces: `stepRun` events. PR 4’s results card reads `why`.
  - `{ type: 'won', d: SCHOOL, time, score }`, with no `onTime`.
  - At `g.t > BELL` short of school, in one step: `{ type: 'bell' }`, then `{ type: 'lost', why: 'bell', d, score }`.
  - The street loss: `{ type: 'lost', why: 'street', d, score }`.
  - `g.rang` is gone.
  - Thwip’s result state: `{ won: false, why, d, score, got }`.

- [ ] **Step 1: Write the failing tests.**
  - Add `why: 'street'` to the street test, after its `expect(types(ev)).toContain('lost')`:

```js
expect(ev.find((e) => e.type === 'lost')).toMatchObject({ why: 'street' });
```

  - Add a new `describe('the bell', …)`:

```js
describe('the bell', () => {
  it('ends the run as a loss when he does nothing, on every seed: late for school', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const g = started(seed);
      const ev = run(g, BELL + 5);
      expect(g.phase).toBe('lost');
      expect(types(ev)).toContain('bell');
      expect(ev.find((e) => e.type === 'lost')).toMatchObject({ why: 'bell' });
      expect(distance(g)).toBeLessThan(SCHOOL);
      expect(g.t).toBeGreaterThan(BELL);
      expect(g.t).toBeLessThan(BELL + 2 * DT);
    }
  });
  it('still counts school reached in the step the bell goes as made it', () => {
    const g = started(1);
    g.t = BELL - DT / 2;
    g.p = [0, 30, -(SCHOOL - 0.05)];
    g.v = [0, 0, -20];
    const ev = stepRun(g, DT);
    expect(g.t).toBeGreaterThan(BELL);
    expect(g.phase).toBe('won');
    expect(types(ev)).not.toContain('bell');
    expect(ev.find((e) => e.type === 'won')).not.toHaveProperty('onTime');
  });
});
```

  - In `describe('the run to school, on the autopilot')`, add:

```js
it('still makes it before the bell, in 45 to 60 s, on seeds 1 to 4', () => {
  for (const seed of [1, 2, 3, 4]) {
    const g = started(seed);
    run(g, BELL + 5, (x) => pilot(x));
    expect(g.phase).toBe('won');
    expect(g.t).toBeGreaterThan(45);
    expect(g.t).toBeLessThan(60);
  }
}); // measured: 48.4, 54.6, 56.3, 49.2 s
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/thwip/rules.test.js`. Expected: 3 failed.
  - The idle test: `expected 'run' to be 'lost'` (he is still jogging at 105 s, at 920 m).
  - The same-step test: the won event still has `onTime`.
  - The street test: no `why`.
- [ ] **Step 3: Make the bell the limit** in `thwip/rules.js`.
  - At `:307-315`: if `distance(g) >= SCHOOL`, the win stays as it is, minus `onTime`. Otherwise, if `g.t > BELL`, set `g.phase = 'lost'` and push `{ type: 'bell' }` then `{ type: 'lost', why: 'bell', d: distance(g), score: Math.round(g.score) }`. The comparison is strict, so a finish at exactly 100 s still wins, as `onTime` allowed.
  - Drop `g.rang`.
  - At `:278`, add `why: 'street'` to the street loss.
  - Header `:9-10`: “The bell at BELL seconds ends the run: late for school.”
- [ ] **Step 4: Show the result** in `lines.js` and `Thwip.jsx`.
  - Delete `SAYS.bell` (`lines.js:12`). It is no longer true, and the result replaces it in the same step. `SPOKEN` shrinks by one, and `voicelines.test.js` checks only uniqueness.
  - `Thwip.jsx:109-112`: `case 'bell': play('ring'); break;`
  - `:121`: drop `onTime` from the result.
  - `:124-127`: `play('alarm')` only when `e.why !== 'bell'`, and the result gains `why: e.why`.
  - `:347` title: `res.won ? 'Made it. Barely.' : res.why === 'bell' ? 'Late for school.' : 'Taking the subway, then.'`. “Late again, Mr. Parker.” goes, since a late win no longer exists.
  - `:350-352`: the bell loss reads `` `The bell went with ${fmt(SCHOOL - res.d)} m still to go. Keep off the street and carry your speed over the cross streets.` ``. The street-loss text is unchanged.
- [ ] **Step 5: Run them to see them pass.**
  - `npx vitest run src/components/avengers/thwip/rules.test.js` → `Tests 13 passed (13)`, each under 1 s (the idle loop takes about 300 ms).
  - `npx vitest run src/components/avengers/voicelines.test.js && npx eslint src/components/avengers/thwip` → `Tests 4 passed (4)`, and eslint prints nothing.
- [ ] **Step 6: Commit.**
  - Subject: `Thwip: the bell ends the run, so doing nothing is late for school`.
  - Body: the idle jog reached school at 220 s and still won; now the bell at 100 s is a loss on seeds 1 to 8, and the autopilot still wins in 48–56 s.

### Task 2: Repulsor Range and Trick Shot: the boss fights back, and a round lasts its clock

**Files:**
- Modify: `src/components/avengers/repulsor/rules.js:231` (`spheres()`, Prime’s line), `:299-301` (`beamStep`, Prime’s branch)
- Test: `src/components/avengers/repulsor/rules.test.js` (`:2` import, new tests after `:95`)
- Modify: `src/components/avengers/trickshot/rules.js:10` (header), `:27` (`STONE_SCORE`), `:37, :50, :63` (`arrows`)
- Modify: `src/components/avengers/trickshot/trickshot.css:18` (`.ts-arrows`)
- Test: `src/components/avengers/trickshot/rules.test.js` (`:243-250`, new tests in `describe('Trick Shot: rounds')`)

**Interfaces:**
- Consumes: `repulsor/rules.js` (`rayHit(s, dir)`, `aimAt(eye, p)`, `unibeam(s)`, `WAVES`, `RANGE`, `EYE`, `newRange`, `startRange`) and its test’s `run`, `until` and `pilot(s)`. `trickshot/rules.js` (`ROUNDS`, `STONE_SCORE`, `newRange`, `startRound`) and its test’s `steps`, `shoot` and `archer(g, { noise })`.
- Produces:
  - Repulsor: an unarrived Prime is never returned by `rayHit` and never damaged by the beam. Exports are unchanged.
  - Trick Shot: every `ROUNDS[r].arrows === 44` (the module constant `QUIVER = 44`) and `STONE_SCORE === 625`.

- [ ] **Step 1: Write the failing Repulsor tests.**
  - Add `rayHit` to the import at `:2`.
  - Add, inside `describe('Repulsor Range')`:

```js
// wave 9 begun, nothing else on the range: Ultron Prime on its way in
const approaching = () => {
  const s = newRange({ seed: 1 });
  startRange(s);
  Object.assign(s, { enemies: [], spawns: [], wave: WAVES.length - 2, phase: 'break', breakT: 0 });
  run(s, 0.1);
  return [s, s.enemies.find((e) => e.kind === 'prime')];
};
const eye = (s) => ({ x: s.x, y: EYE, z: 0 });
const shoulderOf = (e) => ({ x: e.x + 0.82, y: e.y + 0.4, z: e.z });
const aimShoulder = (e) => (s) => (s.input.aim = aimAt(eye(s), shoulderOf(e)));
const touched = (ev, e) => ev.some((x) => x.id === e.id && (x.type === 'hit' || x.type === 'deflect'));

it('cannot touch Ultron Prime on its way in, by repulsor or unibeam, and can once it has arrived', () => {
  const [s, prime] = approaching();
  expect(prime.arrived).toBe(false);
  expect(rayHit(s, aimAt(eye(s), shoulderOf(prime)))).toBeNull();
  const hp = prime.parts.map((p) => p.hp);
  s.input.firing = true;
  let ev = run(s, 1, aimShoulder(prime));
  s.input.firing = false;
  s.charge = 100;
  expect(unibeam(s)).toBe(true);
  ev = ev.concat(run(s, RANGE.beam.dur + 0.1, aimShoulder(prime)));
  expect(touched(ev, prime)).toBe(false);
  expect(prime.parts.map((p) => p.hp)).toEqual(hp);
  until(s, () => prime.arrived, 15);
  expect(rayHit(s, aimAt(eye(s), shoulderOf(prime))).e).toBe(prime);
  s.energy = RANGE.energy;
  s.input.firing = true;
  expect(touched(run(s, 0.5, aimShoulder(prime)), prime)).toBe(true); // lands as 'deflect' on the armed core
});

it('lets a shot through Ultron Prime on its way in, to the drone behind it', () => {
  const [s, prime] = approaching();
  const at = shoulderOf(prime);
  s.enemies.push({ id: 801, kind: 'drone', x: at.x, y: at.y, z: prime.z - 6, vx: 0, vy: 0, vz: 0, hp: 1, r: RANGE.r.drone, t: 0, seed: 0, hold: true });
  expect(rayHit(s, aimAt(eye(s), at)).e.id).toBe(801);
});

for (const seed of [1, 2, 3, 4]) {
  it(`makes a sensible pilot face Prime’s volleys and summons before it falls (seed ${seed})`, () => {
    const s = newRange({ seed });
    startRange(s);
    const ev = run(s, 900, pilot);
    const end = ev.findIndex((e) => e.type === 'kill' && e.kind === 'prime');
    expect(end).toBeGreaterThan(-1);
    expect(ev.slice(0, end).some((e) => e.type === 'volley')).toBe(true);
    expect(ev.slice(0, end).some((e) => e.type === 'summon')).toBe(true);
    const boss = ev.findIndex((e) => e.type === 'boss');
    expect(ev.slice(0, boss).some((e) => e.type === 'hit' && e.kind === 'prime')).toBe(false);
  });
}
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/repulsor/rules.test.js`. Expected: 6 failed. `rayHit` returns Prime on its approach, and every pilot run kills Prime before any volley (0 volleys, 0 summons, 366 hits on Prime before `boss`).
- [ ] **Step 3: Guard Prime until it arrives** in `repulsor/rules.js`.
  - In `spheres(e)` (`:231`), an unarrived Prime returns `[]`. Comment why: on its way in it can’t be hit, so shots fly past it to whatever is behind, and the crosshair (`RepulsorRange.jsx:614`, which reads `rayHit`) doesn’t light.
  - In `beamStep` (`:299-301`), Prime’s branch runs its part loop only when `e.arrived`. An unarrived Prime is skipped, not absorbed.
  - `hitPrime` is unchanged.
- [ ] **Step 4: Run them to see them pass.** `npx vitest run src/components/avengers/repulsor/rules.test.js` → `Tests 20 passed (20)`. Each pilot run takes about 20–80 ms. Measured after the fix, on seeds 1 to 8: won at 175–182 s (130 s today), with 7–8 volleys and 3–4 summons before the kill.
- [ ] **Step 5: Commit.**
  - Subject: `Repulsor Range: Ultron Prime can’t be hurt until it has arrived`.
  - Body: a unibeam fired as wave 9 started killed Prime on its 9 s approach, so it never attacked; now the test pilot meets 7–8 volleys and 3–4 summons first.
- [ ] **Step 6: Write the failing Trick Shot tests.**
  - In “ends a round when the arrows run out” (`:243-250`), only the shot changes: `shoot(g, { x: 0, y: -0.3, z: -1 }, { fly: 0.2 })`. At the old 3.7 s a shot, 44 arrows would outlast the clock. Quick shots into the ground take 39.6 s for 44 arrows. After its two expectations, add `expect(g.s.time).toBeGreaterThan(0);`, so the test still proves the arrows ended the round.
  - Add, in `describe('Trick Shot: rounds')`:

```js
const FAIR = 0.0125; // the tests’ archer at about 71 % hits: §9’s “fair player”
const game = (seed, noise) => {
  const g = newRange({ seed });
  for (let r = 0; r < ROUNDS.length; r++) {
    startRound(g, r);
    steps(g, ROUNDS[r].time + 5, (q) => archer(q, { noise }));
  }
  return g;
};
const wins = (noise) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((seed) => game(seed, noise).total >= STONE_SCORE).length;

for (const noise of [0, FAIR]) {
  it(`keeps an archer shooting until the clock ends, every round (noise ${noise})`, () => {
    const g = newRange({ seed: 1 });
    for (let r = 0; r < ROUNDS.length; r++) {
      startRound(g, r);
      steps(g, ROUNDS[r].time + 5, (q) => archer(q, { noise }));
      expect(g.s.t).toBeGreaterThanOrEqual(40);
      expect(g.s.t).toBeGreaterThanOrEqual(ROUNDS[r].time);
      expect(g.s.arrows).toBeGreaterThan(0);
    }
  });
}
it('keeps the stone from an archer who does nothing', () => {
  const g = newRange({ seed: 1 });
  let ev = [];
  for (let r = 0; r < ROUNDS.length; r++) ev = ev.concat(startRound(g, r), steps(g, ROUNDS[r].time + 1));
  const end = ev.filter((e) => e.type === 'roundEnd').at(-1);
  expect(end.last).toBe(true);
  expect(end.stone).toBe(false);
  expect(g.total).toBe(0);
});
it('gives a fair archer the stone about once in two or three tries', () => {
  const n = wins(FAIR);
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(5); // 3 of 10 here; 16 of 40 over seeds 1–40
});
it('gives a steadier archer the stone on most seeds', () => {
  expect(wins(0.01)).toBeGreaterThanOrEqual(8); // 10 of 10: totals 640–841 over seeds 1–40
});
```

- [ ] **Step 7: Run them to see them fail.** Run `npx vitest run src/components/avengers/trickshot/rules.test.js --reporter=verbose`. Expected: both clock tests fail with `expected 11.1… to be greater than or equal to 40`, and the fair archer’s test fails on `n`.
- [ ] **Step 8: Size the quiver and set the stone** in `trickshot/rules.js` and `trickshot.css`.
  - Add `const QUIVER = 44;`. Comment: it holds more than the quickest hand looses in a round (the test archer looses at most 40 in 45 s over 40 seeds at noise 0 to 0.03), so a round lasts its clock.
  - Set `arrows: QUIVER` at `:37`, `:50` and `:63`. Time and wind stay at 45, 50 and 55 s.
  - Set `STONE_SCORE = 625` (`:27`). Comment: a fair archer (noise 0.0125) scores 518–704 over seeds 1–40 (median 616) and passes 625 on 16 of 40 seeds, so about one try in 2.5.
  - Header `:10`: “Three rounds against the clock (the quiver holds more than the quickest hand can loose in one).”
  - `trickshot.css:18`: `.ts-arrows { display: grid; grid-template-columns: repeat(22, max-content); gap: 3px; }`, commented “the 44-arrow quiver (rules.js QUIVER) in two rows of 22”. The phone rule at `:44` keeps its 4 × 18 px ticks.
  - `TrickShot.jsx` needs no change: it reads `R.arrows` and `STONE_SCORE`.
- [ ] **Step 9: Run them to see them pass.** `npx vitest run src/components/avengers/trickshot/rules.test.js` → `Tests 26 passed (26)`, each under 1 s (the slowest about 300 ms).
  - With 44 arrows, seed 1 ends its rounds at 45.0, 50.1 and 55.1 s, with 4, 5 and 7 arrows left.
  - The good archer (noise 0) still wins on every seed (1,683–1,977), so the existing stone tests pass unchanged.
- [ ] **Step 10: Commit.**
  - Subject: `Trick Shot: a 44-arrow quiver so a round lasts its clock, and the stone at 625`.
  - Body: rounds ended when the quiver emptied, 11–20 s into a 45–55 s clock; the threshold is where a fair archer wins 40 % of seeds.

### Task 3: Hold the Lawn: a checkpoint at Cull Obsidian

**Files:**
- Modify: `src/components/avengers/lawn/rules.js` (after `WAVES`, `:56`; after `skipLift`, `:97-103`)
- Modify: `src/components/avengers/lawn/HoldTheLawn.jsx`
  - `:13` the import
  - `:27-28` the keys
  - `:72` state
  - `:85-102` start and skip
  - `:113-114, :156` the dev hook
  - `:181-184` `case 'wave'`
  - `:277` `handle`’s deps
  - `:597-599` the overlay button
- Test: `src/components/avengers/lawn/rules.test.js` (`:2` import; `describe('Hold the Lawn: the waves')`, `:297-341`)

**Interfaces:**
- Consumes:
  - `lawn/rules.js`’s module-private `reset(g)`, plus `WAVES`, `LAWN.hearts = 5`, `newLawn`, `startLawn`, `skipLift`.
  - The test file’s `run(g, secs, brain)` and `thunderer(g)`.
  - `local.get` and `local.set` (`src/lib/hooks.js`).
  - `register(id, api)` (`hq/useStage.js`).
- Produces:
  - `export const BOSS_WAVE = WAVES.findIndex((w) => w.boss)` (= 7).
  - `export function startAtBoss(g) → [{ type: 'checkpoint', n: BOSS_WAVE + 1 }]`. It leaves `g.phase = 'break'`, `g.breakT = 1.2`, `g.wave = g.next = BOSS_WAVE`, five hearts, `g.charge = 0`, `g.score = 0`.
  - In `HoldTheLawn.jsx`:
    - `const BOSS = 'tp-hq-lawn-boss'`.
    - State `checkpoint` (boolean).
    - `begin(open)`, where `open` is `startLawn` or `startAtBoss`.
    - `start = () => begin(startLawn)` and `startBoss = () => begin(startAtBoss)`.
    - `__HQ__.lawn.checkpoint()` calls `startBoss`.
    - After a loss with the checkpoint reached, the overlay shows the buttons `Restart at the boss` (primary) and `From wave 1` (ghost).

- [ ] **Step 1: Write the failing tests.**
  - Add `BOSS_WAVE, startAtBoss` to the import at `:2`.
  - Add, in `describe('Hold the Lawn: the waves')`:

```js
it('starts again at Cull Obsidian from the checkpoint: five hearts, no lightning', () => {
  expect(BOSS_WAVE).toBe(WAVES.length - 1);
  expect(WAVES[BOSS_WAVE].boss).toBe(true);
  const g = newLawn({ seed: 1 });
  expect(startAtBoss(g)).toEqual([{ type: 'checkpoint', n: WAVES.length }]);
  expect([g.phase, g.thor.hp, g.charge, g.score]).toEqual(['break', LAWN.hearts, 0, 0]);
  const ev = run(g, 2);
  expect(ev.filter((e) => e.type === 'wave')).toEqual([expect.objectContaining({ n: WAVES.length, boss: true })]);
  expect(g.wave).toBe(BOSS_WAVE);
  expect(g.enemies.some((e) => e.kind === 'cull')).toBe(true);
});
it('loses the checkpoint to a Thor who does nothing', () => {
  const g = newLawn({ seed: 1 });
  startAtBoss(g);
  const ev = run(g, 300);
  expect(g.phase).toBe('lost'); // at about 36 s on seeds 1 to 3
  expect(ev.find((e) => e.type === 'lost').wave).toBe(WAVES.length);
});
it('lets a sensible Thor beat Cull Obsidian from the checkpoint', () => {
  const g = newLawn({ seed: 1 });
  startAtBoss(g);
  const ev = run(g, 300, (q) => thunderer(q));
  expect(g.phase).toBe('won'); // at 48–71 s on seeds 1 to 3
  expect(ev.find((e) => e.type === 'won').stone).toBe(true);
});
it('carries nothing over into the checkpoint from a game just lost', () => {
  const g = newLawn({ seed: 1 });
  startLawn(g);
  skipLift(g);
  run(g, 300);
  expect(g.phase).toBe('lost');
  startAtBoss(g);
  expect([g.enemies, g.bolts, g.spawns]).toEqual([[], [], []]);
  expect(g.hammer.state).toBe('held');
  expect([g.thor.hp, g.charge, g.score]).toEqual([LAWN.hearts, 0, 0]);
});
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/lawn/rules.test.js`. Expected: 4 failed, on `TypeError: startAtBoss is not a function` and `BOSS_WAVE` undefined.
- [ ] **Step 3: Implement `BOSS_WAVE` and `startAtBoss(g)`** in `lawn/rules.js`, beside `startLawn` and `skipLift`.
  - Set `g.score = 0`, call `reset(g)`, then set the wave, `next`, phase and `breakT` as in Produces.
  - Push the `checkpoint` event and return `g.queue.splice(0)`.
  - Comment: the lift is already done; five hearts, lightning empty.
  - It emits its own `checkpoint` event rather than `lifted`, whose message is wave 1’s line. The scene’s `fx` already ignores unknown types (`lawn/scene.js`, the `default:` case).
- [ ] **Step 4: Run them to see them pass.** `npx vitest run src/components/avengers/lawn/rules.test.js` → `Tests 28 passed (28)`. The new tests take about 15–85 ms each.
- [ ] **Step 5: Offer the checkpoint** in `HoldTheLawn.jsx`.
  - `:13`: import `startAtBoss`.
  - `:28`: add `const BOSS = 'tp-hq-lawn-boss'; // true once Cull Obsidian’s wave has been reached`.
  - `:72`: `const [checkpoint, setCheckpoint] = useState(() => local.get(BOSS, false) === true)`.
  - `:85-95`: today’s `start` body becomes `begin(open)`, which calls `open(game.current)` where it called `startLawn`. `start` and `startBoss` are thin callbacks over it. `start` stays a callback of no arguments, because it is an `onClick` handler and receives the click event.
  - `case 'wave'` (`:181-184`): when `e.boss && !checkpoint`, call `setCheckpoint(true)` and `local.set(BOSS, true)`. This mirrors how `tp-hq-lawn-lifted` is written on `lifted`.
  - Add `case 'checkpoint': play('thunder'); break;`.
  - Add `checkpoint` to `handle`’s deps at `:277`.
  - Dev hook (`:113-114`, deps at `:156`): `checkpoint: startBoss`.
  - Overlay (`:597-599`): when `res && !res.won && checkpoint`, render `<div className="mt-5 flex flex-wrap justify-center gap-3">`. Inside it go a `btn btn-primary` button “Restart at the boss” (`startBoss`) and a `btn btn-ghost` button “From wave 1” (`start`). `lawn.css:45` already skins `.tl-overlay .btn-ghost`. Otherwise keep today’s single button. The label is “From wave 1”, not “Again”: beside “Restart at the boss”, a bare “Again” is ambiguous.
  - `tp-hq-lawn-best` and `tp-hq-lawn-lifted` are untouched. The score restarts at 0, and the best moves only if beaten.
- [ ] **Step 6: Lint.** `npx eslint src/components/avengers/lawn` → no output (react-hooks/exhaustive-deps clean). `wc -l src/components/avengers/lawn/HoldTheLawn.jsx` → under 800.
- [ ] **Step 7: Commit.**
  - Subject: `Hold the Lawn: a checkpoint at Cull Obsidian, kept in tp-hq-lawn-boss`.
  - Body: a loss restarted at wave 1, about 4.3 minutes from the boss; once the boss wave has been reached, a loss offers “Restart at the boss” with five hearts and no lightning, and doing nothing there still loses (about 36 s).

### Task 4: Ricochet: a room’s rebuild gives back what the last one made

**Files:**
- Create: `src/components/avengers/ricochet/free.js`
- Test: `src/components/avengers/ricochet/free.test.js`
- Modify: `src/components/avengers/ricochet/scene.js:14-15` (imports), before `:176` (the kept set), `:303-311` (`build()`’s head)

**Interfaces:**
- Consumes: the shared materials made once in `create()`: `steel`, `capMat`, `hz`, `trimMat`, `matMat`, `glassMat`, `frameMat`, `doorMat`, `lidMat` (`:116-125`), `botMats` (`:129`), `armorMat` (`:134`) and `hostageMats` (`:135`). Also three’s `Skeleton.dispose()`, which disposes `boneTexture` and sets it to `null`.
- Produces: `export function freeRoom(root, keep = new Set()) → { geometries, materials, textures, skeletons }`, the counts it freed.

- [ ] **Step 1: Write the failing tests** in `ricochet/free.test.js`:

```js
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { freeRoom } from './free';

const room = () => {
  const freed = new Set();
  const watch = (x) => (x.addEventListener('dispose', () => freed.add(x)), x);
  const shared = watch(new THREE.MeshStandardMaterial({ map: watch(new THREE.Texture()) }));
  return { root: new THREE.Group(), freed, watch, shared };
};

describe('freeRoom', () => {
  it('gives back every geometry, owned material and texture under a room, and leaves the shared ones', () => {
    const { root, freed, watch, shared } = room();
    const own = watch(new THREE.MeshStandardMaterial({ map: watch(new THREE.Texture()) }));
    const trim = watch(shared.clone());
    trim.map = watch(shared.map.clone());
    root.add(...[shared, own, trim].map((m) => new THREE.Mesh(watch(new THREE.BoxGeometry()), m)));
    expect(freeRoom(root, new Set([shared, shared.map]))).toEqual({ geometries: 3, materials: 2, textures: 2, skeletons: 0 });
    expect(freed.has(shared) || freed.has(shared.map)).toBe(false);
    for (const x of [own, own.map, trim, trim.map]) expect(freed.has(x)).toBe(true);
  });
  it('gives back a figure’s skeleton and its bone texture', () => {
    const { root, freed, watch, shared } = room();
    const bone = new THREE.Bone();
    const skeleton = new THREE.Skeleton([bone]);
    const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), shared);
    mesh.add(bone);
    mesh.bind(skeleton);
    root.add(mesh);
    skeleton.computeBoneTexture();
    const bones = watch(skeleton.boneTexture);
    expect(freeRoom(root, new Set([shared])).skeletons).toBe(1);
    expect(freed.has(bones)).toBe(true);
    expect(skeleton.boneTexture).toBeNull();
  });
  it('gives each thing back once, however many meshes share it', () => {
    const { root } = room();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    let calls = 0;
    geometry.addEventListener('dispose', () => calls++);
    material.addEventListener('dispose', () => calls++);
    root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, [material]));
    expect(freeRoom(root)).toEqual({ geometries: 1, materials: 1, textures: 0, skeletons: 0 });
    expect(calls).toBe(2);
  });
});
```

- [ ] **Step 2: Run them to see them fail.** `npx vitest run src/components/avengers/ricochet/free.test.js` → `Failed to resolve import "./free"`.
- [ ] **Step 3: Implement `freeRoom(root, keep = new Set())`** in `ricochet/free.js`.
  - **Approach:** one `root.traverse` with a `seen` set, freeing each thing once:
    - `o.geometry`;
    - `o.skeleton` when `o.isSkinnedMesh`;
    - each material in `[o.material].flat()` that `keep` doesn’t hold. A kept material is skipped whole, textures included.
    - For a freed material, also free each of its values that `isTexture` and isn’t in `keep`.
  - No imports: it is pure and duck-typed.
  - Header comment: a room’s rebuild leaked geometries, cloned materials, canvas textures and the bots’ bone textures (`scene.js:303-311`). `lib/three/renderer.js`’s `disposeTree` isn’t used, because it frees shared materials and misses skeletons.
- [ ] **Step 4: Run them to see them pass.** `npx vitest run src/components/avengers/ricochet/free.test.js` → `Tests 3 passed (3)`, each under 50 ms.
- [ ] **Step 5: Free the last room in `build()`** (`ricochet/scene.js`).
  - Import `freeRoom` from `./free` beside `:14-15`.
  - Before `:176`, add `const shared = new Set([steel, capMat, hz, trimMat, matMat, glassMat, frameMat, doorMat, lidMat, armorMat, ...Object.values(botMats), ...Object.values(hostageMats)]);`, commented “made once above: a room’s rebuild keeps them”.
  - In `build()`, the figure loop becomes `scene.remove(f.root); freeRoom(f.root, shared);`, replacing the geometry-only traverse at `:306`.
  - Call `freeRoom(roomGroup, shared)` just before `roomGroup.clear()`. That frees:
    - the wall, lid and switch geometries;
    - each door trim’s `trimMat.clone()` and its `hz.clone()`;
    - the door light’s `MeshBasicMaterial`;
    - each switch face’s material and its `canvasTexture`.
  - No change to `dispose()` (`:596`) or to the rules.
- [ ] **Step 6: Lint.** `npx eslint src/components/avengers/ricochet` → no output. Read the `build()` diff against `wallMesh`, `switchMesh` and `botFigure` (`:184-301`): every material made once in `create()` and used there must be in `shared`. A missed one gets disposed and recompiled on the next frame, which is a hitch, not a leak, and `renderer.info` would not show it.
- [ ] **Step 7: Commit.**
  - Subject: `Ricochet: a room’s rebuild gives back what the last one made`.
  - Body: `build()` left every wall, lid and switch geometry, the doors’ cloned materials and textures, the switch faces’ canvas textures and the bots’ bone textures on the GPU, room after room; the browser read of `renderer.info.memory` (Task 6) now matches after ten rebuilds. Give the before and after pairs from `$S/check-before.txt` and Task 6.

### Task 5: One stone table, the copy fixes, a disabled button and Things to do at 8/8

**Files:**
- Modify: `src/components/avengers/world/labels.js:7-15`
- Test: `src/components/avengers/world/labels.test.js` (create)
- Modify: `src/components/avengers/world/Place.jsx:10` (the `STONES` import), `:153` (`STONE_OF`), `:176` (`stone`), `:178` (`half`)
- Modify, the seven win overlays (add the import beside line 5’s `hq/stones` import; replace the literal):

  | file | line | today | becomes |
  | --- | --- | --- | --- |
  | `repulsor/RepulsorRange.jsx` | 458 | `'#a24bff'` | `stoneById('power').color` |
  | `lawn/HoldTheLawn.jsx` | 575 | `'#e0242a'` | `stoneById('reality').color` |
  | `ricochet/Ricochet.jsx` | 297 | `'#ffd400'` | `stoneById('mind').color` |
  | `trickshot/TrickShot.jsx` | 539 | `'#ff8a00'` | `stoneById('soul-clint').color` |
  | `widow/Infiltration.jsx` | 480 | `'#ff8a3c'` | `stoneById('soul-natasha').color` |
  | `smash/SmashRun.jsx` | 417 | `'#2adf6a'` | `stoneById('time').color` |
  | `tesseract/TesseractRun.jsx` | 566 | `'#3d8bff'` | `stoneById('space').color` |

- Modify: `src/components/avengers/hq/hq.css` (after `:26`)
- Modify: `src/pages/Avengers.jsx:148, :219`
- Modify: `src/components/tour/chapters/player.js:57`
- Modify: `src/components/avengers/world/CompoundWorld.jsx:68` (the `progress` call), `:664` (the no-3D lead)
- Modify: `src/components/avengers/world/rules/progress.js` (PR 1’s part; today `world/rules.js:2088-2106`)
- Modify: `src/components/avengers/world/scene/doors.js` (PR 1’s part; today `world/scene.js:38, :58, :1455-1456, :1791`)
- Test: `src/components/avengers/world/rules.test.js` (`describe('The compound, the world: the heist')`, `:335-366`)

**Interfaces:**
- Consumes:
  - PR 1’s `progress(earned = [])` and `buildMarkers(scene) → placeMarkers(s, clock)`.
  - `STONES` (`src/components/interests/stones.js:3`: `{ id, name, color, … }`).
  - `useAchievements() → { unlock, notify, unlocked }` (`src/components/Achievements.jsx:409`; `useAchievements` is already imported at `CompoundWorld.jsx:11`). `Thwip.jsx:115` runs `unlock('spidey')` on a win.
- Produces:
  - In `world/labels.js`:
    - `export const STONE_OF = { 'soul-clint': 'soul', 'soul-natasha': 'soul' }`
    - `export const HALF_OF = { 'soul-clint': 'Clint’s', 'soul-natasha': 'Natasha’s' }`
    - `export const stoneById = (id) → STONES row | null`
    - `stoneFor(p)`, `stoneLine(p)` and `clock(t)` keep their names.
  - `progress(earned = [], unlocked = [])` returns the same shape. The gate is done when `unlocked.includes('spidey')`. `next`, `have`, `stones`, `portal`, `finished` and `objective` stay stone-only.
  - The gem guard `m.gem.visible = won && Boolean(p.stone)`.
  - `.hq-game .btn:disabled`.
  - The tour sentence (PR 3 keeps it verbatim).
  - `labels.test.js`’s `stoneById\('` assertion (PR 4 rewrites it).

- [ ] **Step 1: Write the failing tests.**
  - Create `world/labels.test.js`:

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STONES } from '../../interests/stones';
import { HALF_OF, STONE_OF, stoneById, stoneFor, stoneLine } from './labels';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const GAMES = ['../repulsor/RepulsorRange.jsx', '../lawn/HoldTheLawn.jsx', '../ricochet/Ricochet.jsx', '../trickshot/TrickShot.jsx', '../widow/Infiltration.jsx', '../smash/SmashRun.jsx', '../tesseract/TesseractRun.jsx'];

describe('the stones’ labels', () => {
  it('reads either half of the Soul Stone as the Soul Stone, from one table', () => {
    expect(STONE_OF).toEqual({ 'soul-clint': 'soul', 'soul-natasha': 'soul' });
    expect(HALF_OF).toEqual({ 'soul-clint': 'Clint’s', 'soul-natasha': 'Natasha’s' });
    expect(stoneById('soul-clint').id).toBe('soul');
    expect(stoneById('soul').name).toBe('Soul Stone');
    expect(stoneById('power').color).toBe(STONES.find((s) => s.id === 'power').color);
    expect(stoneById('nonsense')).toBeNull();
    expect(stoneFor({ stone: 'soul-natasha' }).name).toBe('Soul Stone');
    expect(stoneFor({ id: 'spidey' })).toBeNull();
  });
  it('says whose half a half is, and that a won gate is school', () => {
    expect(stoneLine({ stone: 'soul-clint', done: true })).toBe('Clint’s half of the Soul Stone: won back');
    expect(stoneLine({ stone: 'soul-natasha', done: true })).toBe('Natasha’s half of the Soul Stone: won back');
    expect(stoneLine({ stone: 'soul-clint', done: false })).toBe('Win it for Clint’s half of the Soul Stone');
    expect(stoneLine({ stone: 'power', done: true })).toBe('Power Stone: won back');
    expect(stoneLine({ stone: 'power', done: false })).toBe('Win it for the Power Stone');
    expect(stoneLine({ id: 'spidey', done: false })).toBe('No stone here: just Peter, and school');
    expect(stoneLine({ id: 'spidey', done: true })).toBe('No stone here: Peter made it to school');
  });
  it('gives every game’s stone badge the stone’s own colour, and keeps the table in one place', () => {
    for (const f of GAMES) {
      expect(read(f), f).not.toMatch(/'--glow': '#/);
      expect(read(f), f).toMatch(/stoneById\('/);
    }
    for (const f of ['./Place.jsx', './scene/doors.js']) expect(read(f), f).not.toMatch(/STONE_OF =/);
  });
  it('says only what is true: one figure on Titan, the Space Stone’s portal, stones won in 3D', () => {
    expect(read('../../../pages/Avengers.jsx')).not.toMatch(/army/);
    expect(read('../../tour/chapters/player.js')).toMatch(/the Space Stone opens a portal to Titan/);
    expect(read('./CompoundWorld.jsx')).not.toMatch(/wins an Infinity Stone back/);
  });
});
```

  - In `world/rules.test.js`, inside `describe('The compound, the world: the heist')`:

```js
it('counts the gate done once Thwip! has been won, so the list reaches 8/8', () => {
  const all = ['power', 'reality', 'mind', 'soul-clint', 'soul-natasha', 'soul', 'time', 'space'];
  expect(progress(all).places.filter((p) => p.done)).toHaveLength(7);
  const p = progress(all, ['spidey']);
  expect(PLACES).toHaveLength(8);
  expect(p.places.filter((q) => q.done)).toHaveLength(8);
  expect(p.done).toContain('spidey');
  expect(p.finished).toBe(true);
  const early = progress([], ['spidey']);
  expect(early.places.find((q) => q.id === 'spidey').done).toBe(true);
  expect([early.next, early.stones, early.finished]).toEqual(['stark', 0, false]);
  expect(progress(all, ['worthy']).places.filter((q) => q.done)).toHaveLength(7);
});
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/world/labels.test.js src/components/avengers/world/rules.test.js`. Expected:
  - `labels.test.js`: 4 failed (`stoneById is not a function`, `STONE_OF` undefined, the hex literals, `army`).
  - The 8/8 test: `expected [ …(7) ] to have a length of 8`.
- [ ] **Step 3: One table** in `world/labels.js`.
  - Export `STONE_OF` and `HALF_OF` as in Produces.
  - `stoneById = (id) => STONES.find((s) => s.id === (STONE_OF[id] ?? id)) ?? null`.
  - `stoneFor = (p) => (p.stone ? stoneById(p.stone) : null)`.
  - `stoneLine(p)`:
    - No stone: `p.done ? 'No stone here: Peter made it to school' : 'No stone here: just Peter, and school'`.
    - Done: `` `${HALF_OF[p.stone] ? `${HALF_OF[p.stone]} half of the ` : ''}${st.name}: won back` ``.
    - Not done: `` `Win it for ${HALF_OF[p.stone] ? `${HALF_OF[p.stone]} half of the` : 'the'} ${st.name}` ``.
    - §7 (“whose half it is … in the HUD list, the board and the game screen alike”) wins over the earlier brief, which left the not-done line saying “the half”.
- [ ] **Step 4: Use the table everywhere.**
  - `Place.jsx`: delete `:10` and `:153`. Then set `const stone = stoneFor(p)` and `const half = HALF_OF[p.stone] ? `${HALF_OF[p.stone]} half of the ` : 'the '`, importing `{ HALF_OF, stoneFor }` from `./labels`. The rendered text is unchanged.
  - The seven overlays: add `import { stoneById } from '../world/labels';` and make the swaps in the table under Files. The badge now takes the gauntlet’s colours (for example, Power `#8e2de2` for `#a24bff`): the intended change of §9.
  - `world/scene/doors.js`: delete the module-level `STONE_OF` and the `STONES` import. The gem colour becomes `const color = stoneFor(p)?.color ?? p.accent`, with `import { stoneFor } from '../labels'`. The colour is the same for every place (the gate falls to `p.accent` as before), so the compound stays pixel-identical.
- [ ] **Step 5: Things to do at 8/8.**
  - `world/rules/progress.js`: the signature becomes `progress(earned = [], unlocked = [])`.
  - Add a module-private `const GATE_WIN = 'spidey'; // the achievement Thwip.jsx unlocks on a win`.
  - A place is `done` when `p.stone ? has.has(p.stone) : p.id === 'spidey' && unlocked.includes(GATE_WIN)`.
  - Update the comment above it: the stones earned and the achievements unlocked; the gate is done once Thwip! is won, but it is never the next one for the heist.
  - `CompoundWorld.jsx:68`: `const { unlocked } = useAchievements();` then `const prog = progress(heist, unlocked);`.
  - `world/scene/doors.js`, `placeMarkers`: `m.gem.visible = won && Boolean(p.stone)`. At the gem’s comment (today `scene.js:1455`), write: the gate has no stone to win, so its gem never shows, even once Thwip! is won. Its beam still goes off once it is done, like any finished door.
  - `CompoundHud.jsx:29` counts `prog.places`’ `done`, so the Menu reads 8/8 with no edit there. PR 5 adds `count`.
- [ ] **Step 6: The copy and the disabled button.**
  - `Avengers.jsx:148` (the notify text): `'Every stone, won back on the compound. Thanos is dust; this page is not.'`
  - `Avengers.jsx:219`: `'You took every stone back from the compound. Set them, and this time the snap is Tony’s: Thanos turns to dust, and the page stays.'` Titan has one figure (`titan/scene.js`, Thanos only).
  - `player.js:57`, as text: `'You’re Spider-Man: swing, zip, perch. Each building is a game, most of them for an Infinity Stone, and the Space Stone opens a portal to Titan. Twelve backpacks and a ring course are hidden round the grounds.'` That is 37 words; `steps.test.js` allows 12 to 45. The player’s reading time goes from 596 s to 597 s against a budget of 660.
  - `CompoundWorld.jsx:664`, the lead: `Marvel, all of it. Every building on the compound belongs to someone, and each has a game (Spider-Man’s is at the front gate). The Infinity Stones are won in the 3D games; here, each building has a simpler one to try. {prog.objective}`
  - `hq.css`, after `:26`:
    - `.hq-game .btn:disabled { border-color: var(--border); background: var(--surface-2); color: var(--muted); cursor: not-allowed; }`
    - `.hq-game .btn:disabled:active { transform: none; }`
    - Comment: dimmed by colour, never faded (RULES.md UI 6); for the toys’ disabled `.btn` and, from PR 4, a Start that waits for its stage.
    - The games’ own buttons keep their own `:disabled` rules.
- [ ] **Step 7: Run them to see them pass.**
  - `npx vitest run src/components/avengers/world/labels.test.js src/components/avengers/world/rules.test.js src/components/tour/steps.test.js src/components/avengers` → all pass. `labels.test.js` has 4 tests, and `world/rules.test.js` has one more than before (90 if PR 1 left the file whole).
  - `grep -rn "STONE_OF =" src/components/avengers` → only `world/labels.js`.
  - `npx eslint src/components/avengers src/pages/Avengers.jsx src/components/tour` → no output.
- [ ] **Step 8: Commit.**
  - Subject: `Avengers HQ: one stone table, the stones’ own colours and Things to do at 8/8`.
  - Body:
    - `STONE_OF` and `HALF_OF` live once in `world/labels.js`, and the seven win badges take their colour from `STONES`.
    - Disabled HQ buttons dim by colour.
    - The gate counts as done once Thwip! is won, and its door grows no gem.
    - The copy says one figure turns to dust, the Space Stone opens the portal, a half is Clint’s or Natasha’s and the no-3D lead no longer promises stones for toys.

### Task 6: Verify the PR and open it

**Files:**
- Create: `docs/superpowers/evidence/avengers-hq/pr2/README.md`, plus the pictures it lists under `before/` and `after/`, as PR 1’s evidence folder does (`.webp` or `.png`, each under 1 MB, so committed rather than published to the bucket)

**Interfaces:**
- Consumes: everything Tasks 1–5 produce; `$S/hq-pr2-check.mjs` and the before files from “Before Task 1”.
- Produces: the pull request.

- [ ] **Step 1: The gates.**
  - Run `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`, then `git checkout public/github.json`.
  - Expected: lint clean, Vitest all green (Thwip 13, Repulsor 20, Trick Shot 26, Lawn 28, `free` 3, `labels` 4), build green and the health table `within budget`. There is no new big file, dependency, loop or key-cap rule.
  - Don’t ratchet a budget: the steward lowers budgets after the merge.
- [ ] **Step 2: The `/avengers` closure** (PR 1’s manifest one-liner):

```bash
npx vite build && node --input-type=module -e "import{readFileSync as r}from'node:fs';import{gzipSync as g}from'node:zlib';const m=JSON.parse(r('dist/.vite/manifest.json','utf8'));const seen=new Set(),rows=[];const v=(k)=>{const c=m[k];if(!c||seen.has(k)||c.isEntry)return;seen.add(k);for(const f of[c.file,...(c.css??[])]){const b=r('dist/'+f);rows.push([c.name??k,b.length,g(b).length,f])}(c.imports??[]).forEach(v)};v('src/pages/Avengers.jsx');const kb=(n)=>(n/1024).toFixed(0)+' kB';console.log('/avengers static closure, app entry left out:',rows.length,'files',kb(rows.reduce((s,x)=>s+x[1],0)),'raw',kb(rows.reduce((s,x)=>s+x[2],0)),'gzip');for(const x of rows.sort((a,b)=>b[1]-a[1]))console.log(' ',String(x[0]).padEnd(28),kb(x[1]).padStart(7),kb(x[2]).padStart(7),x[3])" | tee $S/closure-after.txt; git checkout public/github.json
```

  - Expected: within 1 kB of `$S/closure-before.txt` (about 707 kB raw and 260 kB gzip after PR 1). The games are lazy chunks, and `labels.js` was already in the closure. Zero files means the page key isn’t `src/pages/Avengers.jsx`: grep the manifest for it.
- [ ] **Step 3: The pages in a browser.**
  - Run `node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --shots avhq-pr2`, then `node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --phone`. Each must end `everything green`: no page error, and no console error beyond `scripts/lib/noise.mjs`’s noise.
  - Read `public/changes/avhq-pr2-a.webp` and `-b.webp` beside `$S/avhq-pr2-before.webp`. With no visitor state set, the compound must look the same as main’s.
  - Move all three into the evidence folder (`git mv` is not needed: they are untracked), then `git checkout public/github.json`.
- [ ] **Step 4: The worlds.** With `npx vite --port 5173 --strictPort` up:
  - Run `OUT=$S/inv-after node scripts/inv-world-check.mjs`. Its pictures must match `$S/inv-before` (ThinkMark draws no disabled `.btn`).
  - Run `OUT=$S/hq-after node scripts/hq-world-check.mjs`. It must print `compound up in` and end `no page errors`. Its nine shots must match `hq-before` by eye: the gate shows no gem, and the doors’ gems are the same colours.
- [ ] **Step 5: The fixes in a browser.** Run `node $S/hq-pr2-check.mjs ricochet thwip lawn trickshot disabled todo | tee $S/check-after.txt`. Expected: `ok` for every part, both Trick Shot sizes included.
  - Ricochet’s two `[geometries, textures]` pairs are equal. Record them beside `$S/check-before.txt`’s.
  - Read `$S/lawn-checkpoint.png` and the two `trickshot-*.png`: 44 ticks in two rows of 22, clear of the wind gauge, the trick chips and the touch buttons.
  - Copy them into the evidence folder.
- [ ] **Step 6: The evidence README** at `docs/superpowers/evidence/avengers-hq/pr2/README.md`.
  - One line per picture: what it shows, and its before or after.
  - The table of numbers:
    - Thwip idle: won at 220 s → lost at the bell (100 s) on seeds 1–8. Autopilot 48.4–56.3 s.
    - Repulsor pilot: 0 volleys and 0 summons before Prime fell → 7–8 and 3–4. Win time 130 s → 175–182 s.
    - Trick Shot: rounds ended 11–20 s into a 45–55 s clock → on the clock, with 4 or more arrows left. Stone 250 → 625, which a fair archer wins on 16 of 40 seeds.
    - Lawn: a loss restarted 4.3 min from the boss → “Restart at the boss”, with the boss wave in 1.2 s.
    - Ricochet: the before and after `renderer.info` pairs.
    - Things to do: 7/8 → 8/8.
    - The closure, before and after.
  - Commit: `Avengers HQ PR 2: the evidence`.
- [ ] **Step 7: Open the pull request.**
  - `git push -u origin <branch>`, then open the PR with base `main` and title `Avengers HQ 2 of 7: the fixes`.
  - The body:
    - one paragraph per fix (Tasks 1–5);
    - the numbers table from Step 6;
    - the checks that ran (Steps 1–5, with their outcomes);
    - the screenshots as images from `https://raw.githubusercontent.com/tilakpatell/tilakpatell.com/<branch>/docs/superpowers/evidence/avengers-hq/pr2/<file>`: the lawn checkpoint, the Trick Shot quiver at both sizes, Things to do 8/8 and the compound before and after;
    - a note that §9’s “Repulsor start waits for the stage” is PR 4’s;
    - the harness’s PR footer.
  - It is one PR, merged with a merge commit once CI is green; never force-push. If CI or review asks for a change, add a commit.

---

## Self-review against the spec

- **§9.** Thwip (Task 1); Repulsor’s Prime (Task 2); Ricochet’s leak (Task 4, unit tests and the browser’s `renderer.info`); Trick Shot (Task 2); Hold the Lawn (Task 3); one stone table and `:disabled` (Task 5). “Start waits for the stage” is named as PR 4’s in Global Constraints.
- **§6.** 8/8, the gem and one `progress()` (Task 5). The board is PR 5’s.
- **§7.** The `army` line, the tour, whose half and the no-3D lead (Task 5). The earned snap and the summary are PR 6’s.
- **§12.**
  - Vitest: `progress()` at 8/8, Thwip’s idle loss, Prime’s attacks before its death, Trick Shot’s round length and stone rate.
  - Browser: autopilot-check before, after and `--phone`; `hq-world-check`; `inv-world-check`, because `hq/hq.css` changed.
  - Before the PR: the four commands, `git checkout public/github.json`, the closure size and the screenshots read.
  - `hq-links-check.mjs` starts with PR 3.
