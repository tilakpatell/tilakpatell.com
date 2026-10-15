# Engine floor, lane FL2: a world onto the runtime

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One world, the session’s argument, drawn by the runtime’s renderer and loop as a `'glsl'` world module, pixel-identical to before, no slower, its own renderer, loop, watchdog and post chain gone.

**Architecture:** The world’s stage (its `WebGLRenderer`, `requestAnimationFrame`, watchdog and `EffectComposer`) is replaced by `module.js`’s `create(rt, props)` on `rt.gfx.renderer`, `step`/`draw` under the runtime’s loop, `lowerQuality(level)` under its governor and `rt.gfx.post(passes)` for the chain; the page mounts it with `useWorld` and listens on `rt.events`. The shading stays `'glsl'` so the picture is the classic renderer’s own and parity is exact; the port to `'nodes'` is lane FL3’s second pull request by the same session.

**Tech Stack:** `src/runtime` (`createRuntime`, `useWorld`, `fromScene`, `gfx.post`), three r186, Vitest, `scripts/autopilot-check.mjs`, `scripts/perf-probe.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-15-engine-floor-design.md`, §4.1 to §4.3 and §5.

## The worlds, one session each

| world | routes | stage today | its renderer sites | its check | after it, the stage file goes? |
| --- | --- | --- | --- | --- | --- |
| the universe map | `/`, `/universe/:id?` | `lib/three/useScene` (`universe/UniverseMap.jsx:87`, `universe/scene.js:482`); the shipyard’s showroom (`universe/shipyard/showroom.js`) | 1 (showroom) | `scripts/universe-check.mjs`, `navmap-check.mjs`, `shipyard-check.mjs`, `online-check.mjs` | no (`useScene` has eleven more users) |
| Middle-earth | `/middle-earth/:place?` | `lib/stage3d.js` (the towns), `middleearth/MapBackdrop3D.js` (the map) | 1 (the map) | `scripts/props-check.mjs`, `leaves-check.mjs`, `door-check.mjs` where they name it; `autopilot-check` on every place | `lib/stage3d.js` when the Caribbean, the music room and the Rick and Morty worlds have left it |
| Rick and Morty | `/c-137`, `/c-137/citadel`, `/c-137/:planet` | `lib/stage3d.js`, `rickmorty/cruiser3d.js`, `rickmorty/GalaxyBackdrop.jsx`, `rickmorty/swirl.js`, `rickmorty/wardrobe/preview.js` | 3 | `scripts/sector-check.mjs`, `foot-portal-check.mjs` | as above |
| the Avengers and Invincible | `/avengers`, `/invincible` | `avengers/hq/engine.js` (one live at a time) | 1 | `scripts/hq-world-check.mjs`, `inv-world-check.mjs` | yes, `avengers/hq/engine.js` |
| Cybertron | `/cybertron` | `useScene`, `lib/stage3d`, `cybertron/game/scene.js`, `cybertron/world/CybertronBackdrop3D.js` | 2 | `autopilot-check` | no |
| Scranton and Albuquerque | `/scranton`, `/albuquerque` | `office/stage3d.js`, `albuquerque/metherria/scene.js` | 1 | `autopilot-check` | yes, `office/stage3d.js` |
| the Death Star | `/deathstar` | `deathstar/DeathStar3D.js`, `deathstar/Trench3D.js` | 2 | `scripts/deathstar-check.mjs` | the two files’ renderer code |
| the Caribbean, the music room, Dickansh, Dot Matrix | `/caribbean`, `/music`, `/dickansh`, `/dot-matrix` | `lib/stage3d`, `useScene` | 0 | `autopilot-check` | `lib/stage3d.js` if last |
| the page scenes | `/home`, `/experience`, `/projects`, `/contact`, `/travel`, the ambience | `useScene` | 0 (`lib/three/renderer.js`) | `autopilot-check` on the core pages | `useScene.js`, `lib/three/renderer.js`’s make: lane FL4’s |
| Battlefront’s backdrop and the Collection’s hero stage | `/battlefront` | `battlefront/backdrop/scene.js`, `galaxy/surface/heroStage.js` | 2 | `scripts/battlefront-check.mjs`, `bf-landing-check.mjs` | after #1000 to #1004 merge |

The universe map’s session starts from `claude/perf-p2-universe` (lane P2’s branch; merge `origin/main` into it first) and reads P2’s ten gaps in `HANDOFF-performance-lanes.md`.

## Global Constraints

- The world’s picture does not change: every route shot before and after, compared pixel for pixel (`RULES.md`, “A repair changes no pixel”). A difference is a bug in the move, never a tolerance.
- `shading: 'glsl'` in this lane. The flip is FL3.
- No world file reaches another world’s file (`RULES.md`, islands); the world’s folder, its page, its route and the stage file it is the last user of are the lane’s; nothing else.
- `src/runtime/` is not edited except `useWorld.js`’s near-the-viewport option (the universe map’s session only; the others take it as landed).
- No content changes; no new dependency; no test skipped.
- The four checks before the pull request; `git checkout public/github.json` after a build.

## Review Focus

1. A world’s own quality steps (its watchdog’s order: pixel ratio, then shadows, then bloom) must map onto `lowerQuality(level)` in the same order, so a slow chip sees the same picture at each step as before.
2. A world that reads `renderer.info` or resets it (`info.autoReset`) must read the runtime’s renderer’s and leave `autoReset` as the runtime has it.
3. A world that changes `toneMapping` or `toneMappingExposure` on its own renderer must pass `toneMapping` and `exposure` through its module (`createWebGL(canvas, { toneMapping, exposure })` reads the module’s) and not set them on the shared renderer mid-frame while another world is handed over.
4. A world with a touch layout must be shot with `--phone` too.
5. A world with two canvases (the universe map and its nav map; the Rick and Morty page’s portal and backdrop) must decide one module with one canvas, or two modules in two hosts sharing the renderer (§4.3 of the design), and write the rule into `useWorld.js`’s header the first time it is met.

---

### Task 1: The before

**Files:**
- Create: `docs/superpowers/evidence/engine-floor/FL2-<world>/README.md`

- [ ] **Step 1:** `git fetch origin main && git checkout -B main origin/main && npm ci`; `git checkout -b claude/engine-floor-fl2-<world> main` (or from `claude/perf-p2-universe` for the universe map).
- [ ] **Step 2:** On `main`’s build: `node scripts/autopilot-check.mjs --skip lint,test --routes <every route of the world, comma-separated> --shots fl2-<world> --before` (the first route; then once per further route with `--shots fl2-<world>-<n> --before`); keep the WebPs under `FL2-<world>/before/` (not `public/changes/`: this is not a ship’s-log entry; move them there and `git add` nothing from `public/changes`).
- [ ] **Step 3:** `QUALITY=low node scripts/perf-probe.mjs <journey>` where `scripts/lib/perf-routes.mjs` has one (the universe, Middle-earth, c137, the Avengers, the Death Star), else `node scripts/perf-probe.mjs --list` for a journey to add to `scripts/lib/perf-routes.mjs` (a journey is this lane’s to add; its test holds the route to `App.jsx`); the table into the README.
- [ ] **Step 4:** The world’s own check(s) green on `main`; the output into the README.
- [ ] **Step 5: Commit** `FL2 <world>: the before` (the README and pictures).

### Task 2: The module

**Files:**
- Create: `src/components/<world>/module.js`
- Modify: the world’s scene file(s) (the ones that make the renderer and the loop), the stage file’s users
- Test: `src/components/<world>/module.test.js` (`validateModule(module)` passes; `create` on a fake `rt` (the pattern of `src/runtime/runtime.test.js`’s fakes and `src/components/earth/module.test.js`) returns a world with `resize`, `draw`, `dispose`; `step` with the input snapshot moves what the keys moved; `lowerQuality(level)` steps what the watchdog stepped)

**Interfaces:**
- Consumes: `rt` from `createRuntime` (`src/runtime/runtime.js`’s header: `rt.gfx.renderer`, `rt.gfx.compile(root, camera, scene)`, `rt.gfx.upload(root)`, `rt.gfx.post(passes)` → `{ render, setSize, compile, dispose }`, `rt.gfx.size`, `rt.gfx.ratio`, `rt.input` (`step(dt, input)`’s snapshot: `input.keys`, `input.pressed`, `input.pointer`, `input.pad`, `input.stick`, `input.axis(name)`, `input.action(name)`, `input.bind(KEYS, { axes })`), `rt.saves.get/set`, `rt.audio.bus()`, `rt.audio.context()`, `rt.assets`, `rt.events.emit(type, data)`, `rt.host`, `rt.invalidate()`, `rt.lost()`); `fromScene(id, create, opts)` from `src/runtime/module.js` for a `useScene` scene.
- Produces: `export default { id: '<world>', shading: 'glsl', mb: <WORLD_MB’s number for the route>, label, create(rt, props) → world }` where `world` is `{ ready?, resize(w, h), step(dt, input, now), draw({ dt, now }), wants(), update(props), setVisible(on), lowerQuality(level), warmUp?(timeLeft), prepare?(onProgress, { alive }), handoff?(), anchor?(), tune?(), dispose() }` (`src/runtime/module.js`’s `validateWorld`); `world.view(name)` in DEV for the parity views (the earth module’s pattern), named after the world’s fixed camera spots (`'open'` at least).

- [ ] **Step 1: Write the failing test** `module.test.js`: the three asserts above with the spec’s values (the module’s `mb` equals `WORLD_MB[route]`; `src/components/worlds/worlds.test.js` already checks a module’s `mb` against the table for modules it knows: add this one to its list).
- [ ] **Step 2: Run** `npx vitest run src/components/<world>/module.test.js` → fails.
- [ ] **Step 3: Implement** `module.js`: for a `useScene` scene, `fromScene('<world>', create, { mb, label, ratio, sharpness })` and nothing else (the scene file unchanged); for a stage world, `create(rt, props)` builds the scene the stage built on `rt.gfx.renderer`, keeps the stage’s own camera, lights and post description (`[{ kind: 'render', scene, camera }, { kind: 'bloom', strength, radius, threshold }, { kind: 'shader', material: GRADE_MATERIAL }, { kind: 'output' }]` where the stage had `UnrealBloomPass` and a grade `ShaderPass`), returns `step` (the stage’s per-frame update, reading `input`) and `draw` (the chain’s `render()`), `lowerQuality(level)` running the watchdog’s steps in order up to `level`, `dispose` freeing what `create` made. The stage’s `onLost` path goes (the runtime remounts); its `onSlow` is the governor’s.
- [ ] **Step 4: Run** the test → passes.
- [ ] **Step 5: Commit** `FL2 <world>: the module`.

### Task 3: The page

**Files:**
- Modify: the world’s `*World.jsx` or `src/pages/<World>.jsx` (the stage made where `useWorld(module, { props, enabled, onEvent })` is called now; `<WorldHost ref={host} />` where the canvas was; the callbacks the stage took become `onEvent` cases; the page’s calls into the world go through `world.current` as `useWorld` returns it)
- Modify: `src/App.jsx` only if the route’s element changes
- Test: the page’s existing test if it has one; `src/pages/Worlds.test.jsx` unchanged

- [ ] **Step 1:** Replace the stage’s make with `useWorld`; keep the HUD as it is; remove the stage’s imports.
- [ ] **Step 2:** `npm run dev` and open every route of the world; the console clean beyond `scripts/lib/noise.mjs`’s known noise; the keys, the pad and the touch controls work as before.
- [ ] **Step 3:** Delete the stage file if this world was its last user (`grep -rn "<stage file>" src` → none); `lib/three/useScene.js` stays until FL4.
- [ ] **Step 4:** `npx vitest run src/components/<world> src/pages` → green; `node scripts/health.mjs --only renderers,loops` → down by the world’s sites.
- [ ] **Step 5: Commit** `FL2 <world>: on the runtime, the stage gone`.

### Task 4: The after, and the gates

- [ ] **Step 1:** `node scripts/autopilot-check.mjs --routes <the same routes> --shots fl2-<world>` (and `--phone` for a touch world); compare each after picture to its before: `node -e` over the two WebPs with `sharp` (a devDependency) counting differing pixels → 0 for every route; the counts into the README. A non-zero count is a bug: find it (the pixel ratio, the tone mapping, the clear colour, the frame the shot was taken on) and fix it; never widen the tolerance.
- [ ] **Step 2:** `QUALITY=low node scripts/perf-probe.mjs <journey>` → the main thread’s ms and the worst 1 % no worse than the before (the container’s SwiftShader rows; the owner’s machines fill the real ones).
- [ ] **Step 3:** The world’s checks green; `npx vitest run src/runtime/shading.test.js` green (a `'glsl'` module may have GLSL in its closure).
- [ ] **Step 4:** `git fetch origin main && git merge origin/main`; `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`; `git checkout public/github.json`.
- [ ] **Step 5: Commit** `FL2 <world>: the after` (the README’s tables); push `claude/engine-floor-fl2-<world>`; open the pull request (the before and after pictures as images from the branch’s raw URL, the probe table, the checks run); FL2’s row for the world in `docs/superpowers/HANDOFF-engine-floor.md`; merge when CI is green.
- [ ] **Step 6:** Continue in the same session with lane FL3’s plan for this world (`2026-10-15-engine-floor-laneFL3-ports.md`), from the merged `main`.
