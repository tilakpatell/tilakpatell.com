# Handoff: the world runtime (one world per session)

The runtime is built and Earth flies on it. Each session from here moves one world onto it, merges, and stops. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-06-world-runtime-design.md` (the design: the contract, the services, the handover)
2. `src/runtime/index.js`, `runtime.js`, `module.js` (the code is short; the headers say what each does)
3. `src/components/earth/module.js` and `EarthWorld.jsx` (the reference migration: a world module and the component over it)
4. `docs/superpowers/plans/2026-10-06-world-runtime.md` (how Earth was done, task by task)

## The rules (don't break)

- **Nothing a visitor can do is lost.** Every key, chip, dialog, save key, achievement, sound, ghost, dev hook and gimmick of a world works after as before. The universe map's crashes into planets, the fall into the Maw, the hunters, the traffic, the director's events, the landings on foot: untouched. A migration moves the renderer, the loop, input, audio, saves and assets. It does not rewrite gameplay.
- **Save keys keep their names.** `rt.saves` is a front over `localStorage`; a key that was `tp-abq-driving` stays `tp-abq-driving`.
- **Every module is `shading: 'glsl'`** until its shaders are TSL (`src/runtime/shading.test.js` enforces the `'nodes'` promise). Don't flip it early.
- **One world per session, merged on its own.** Branch `claude/<name>`, PR to `main`, CI green, merge commit. Never merge red, never force-push.
- **Before the PR:** `npx eslint .`, `npx vitest run`, `npx vite build`, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes <the world's routes>` (software WebGL in headless Chromium: a canvas must draw, no console error). Then a real flight in dev mode: the pattern is in the plan's Task 9 and below.
- Keep output terse. Commits end with the harness's attribution lines; no model names in code or docs.

## What the runtime gives a module

```js
rt.gfx       // backend, renderer, canvas, size, ratio, compile(), upload(), post(passes), snapshot()
rt.input     // bind(actions, { axes }); the frame's snapshot comes into step(dt, input, now)
rt.quality   // tier, budget, level, scale, ratio, on(fn)
rt.saves     // get, set, remove, session, watch, register
rt.assets    // texture, gltf, audio, prefetch, retain, release (owned by the module, dropped with it)
rt.audio     // context(), bus() (a gain per module, faded at unmount), output
rt.events    // emit(type, data) to the page; useWorld forwards to onEvent({ type, ...data })
rt.invalidate(), rt.host, rt.current, rt.status
rt.handover(module, props, host, { fade, held, after }) → true once the new world draws (false: failed, or something newer came; the old world stays)
             // the old world draws on, seen, until the new one is ready and `after` (its own last moment) is done; its last frame then fades out over it
```

A module: `{ id, shading, mb, label?, create(rt, props) → world }` (`label`: what the canvas shows, for a screen reader; the runtime puts it on the canvas as `role="img"`). A world: `{ ready?, resize, step?, draw, wants?, update?, setVisible?, lowerQuality?, warmUp?, handoff?, dispose }`. `fromScene(id, create, { mb })` wraps a `useScene` scene module unchanged.

The page: `const { host, status, rt } = useWorld(module, { props, onEvent, attempt })` and `<WorldHost world={{ host }} className="...">{hud}</WorldHost>`. Status is `useScene`'s (`loading | ready | on | failed | lost`); the host carries `data-gl="loading|on"`.

Dev hooks: `window.__RUNTIME__` (the runtime) and whatever the world sets (`window.__EARTH__`).

## How to migrate a world (the checklist)

1. **Wrap first.** `src/components/<world>/module.js`: `export default fromScene('<id>', () => import('./scene').then((m) => m.create), { mb: WORLD_MB['/<route>'] })` for a world whose scene is a `useScene` module; for one that makes its own renderer in a React effect (Earth was), write `create(rt, props)` by hand as Earth's. Mount it with `useWorld` where `useScene` or the effect was. Run the world. Nothing else changes yet. Commit.
2. **The renderer.** The scene takes `rt.gfx.renderer` instead of calling `createRenderer`; its `dispose` leaves the renderer alone; its `resize` sets cameras and sizes, not the renderer (the runtime sizes it). Its post chain goes through `rt.gfx.post([...])` where it built an `EffectComposer` by hand (a `kind: 'shader'` pass for its own materials). `precompile` stays, or `rt.gfx.compile`.
3. **Input.** `rt.input.bind(KEYS, { axes })`; the scene reads the snapshot in `step` (`input.action`, `input.axis`, `input.pad`, `input.tapped`, `input.pointer`, `input.stick`); the page's touch stick writes `rt.input.setStick`. The component keeps only its dialogs' keys and the `audioContext()` wake on a bound key (iOS needs it in the key's own event). The universe's `controls.js` settings stay the module's: they shape the snapshot into its own stick, as today.
4. **Audio.** The world's `sounds.js` gets `setBus(gain)` and connects to it instead of `output()` (Earth's pattern); the module calls `sounds.setBus(rt.audio.bus())` in `create`.
5. **Saves.** Readers and writers take a `store` (`rt.saves`) with the key unchanged (Earth's `stamps.js`). Hooks the page uses keep `local` as their default.
6. **Assets.** `rt.assets.texture/gltf` where the scene called `loadTexture`/`loadGltf` directly; `rt.assets.retain` for what the next world will want too (the ship models, the crew). Prefetch what a handover will need (`rt.assets.prefetch`).
7. **Events.** `rt.events.emit` where the scene called an `onEvent` prop; the HUD's numbers at the rate the scene throttled them already.
8. **Tests.** A `module.test.js` with a fake `rt` (Earth's is the pattern): the module is whole, `step` moves the world, the keys do what they did, `dispose` writes what it should. Keep every `rules.test.js`.
9. **Checks.** Lint, tests, build, smoke, a dev-mode flight (keys pressed, state read from the dev hook, leave and come back). Compare against `main` in the same browser if anything looks different.
10. **Docs.** One paragraph in `docs/architecture.md`'s "The world runtime" list; the module's `mb` equals `WORLD_MB` (its test checks).
11. **Merge.** PR, CI, merge commit. Update the status table below in the same PR.

## The order, and what each world needs

| # | World | Route(s) | Lines | Notes |
|---|---|---|---|---|
| 1 | Earth | `/earth` | 2,800 | **Done.** The reference. |
| 2 | Galaxy + surfaces | `/galaxy/:id`, `/galaxy/:id/surface` | 30,000 | **Done.** Both scenes `fromScene` (`galaxy/module.js`, `galaxy/surface/module.js`), on the runtime's renderer (each puts back what it set on it at dispose: `info.autoReset`, the shadow map, the canvas's attributes); the runtime's quality drives their sharpness. The trip is flown (`galaxy/travel.js`): `E` dives the ship on the planet (scene `dive()`, `'dove'` event) while `pages/Galaxy.jsx` has the surface module built behind it (`rt.handover` with `held`, fade 900, `after`: the dive's end), then navigates (the surface page, seeing the runtime's world is its own, shows the glow going); the surface's climb out (`takeOff()` on the scene, from the link too) has the galaxy built behind it, taking over 3.4 s in under the sky's glare (the galaxy page shows it going), the galaxy starting with the ship climbing off the planet (`LAUNCH_KEY`, as before). Without 3D flying: the old fade and page. Kept: `tp:hyperspace`, the interdiction, the missions, the peers. Check: `scripts/travel-check.mjs` (the round trip in headless Chromium). Left for later: the `rt.input`/`rt.saves`/`rt.audio` steps of the checklist (both scenes still bind their own keys and sounds, as `fromScene` allows). |
| 3 | Universe map (the hub) | `/`, `/universe/:id` | 40,000 | `fromScene` first; nothing inside `scene.js` changes in that session. Then renderer/input/audio/saves. The gimmicks list in the spec's "What it is not" must all still work: check each in a browser (`crash.js`: fly into a planet; `maw.js`/`infall.js`: into the black hole; `director.js` events; hunters; traffic; `G` landing and `footScene.js`; the siege). Last, the gate into the galaxy as a handover (`state.through` + `portal` event in `scene.js` ~2834; `pages/Universe.jsx` navigates today). |
| 4 | Death Star | `/deathstar` | 4,800 | A composer with bloom: the first `rt.gfx.post` user. |
| 5 | Dot Matrix | `/dot-matrix` | 4,000 | The dither is a last pass over a render target (`dither.js`): a `kind: 'shader'` pass, or keep its own target and draw through `rt.gfx.renderer`. |
| 6 | Invincible | `/invincible` | 9,500 | Runs on `avengers/hq/engine.js`: migrate the engine's renderer once, both worlds follow. |
| 7 | Avengers HQ | `/avengers` | 35,700 | The compound world plus each building's game (`Place.jsx`): the games keep their own scenes for now (they open over the page); the compound is the module. Photo mode reads the canvas in the same task as its draw: `rt.gfx.snapshot` does the same. |
| 8 | Albuquerque | `/albuquerque` | 13,600 | The driving settings (`tp-abq-driving`) through `rt.saves`; the town's games as Avengers'. |
| 9 | Dimension C-137 + Citadel | `/c-137`, `/c-137/citadel` | 34,700 | Two modules; the garage portal to Blips and Chitz stays inside the first. `shipVoice.js` is speech synthesis, not Web Audio: leave it. |
| 10 | Middle-earth | `/middle-earth/:place?` | 85,600 | The biggest: one module per place (the Shire, Bree, Rivendell…), each wrapped with `fromScene`; the map between them stays React. Towns' travellers (`useTravellers`) unchanged. |
| 11 | Cybertron | `/cybertron` | 12,700 | Roll out's `GpuGate` stays over it. |
| 12 | Scranton | `/scranton` | 11,400 | |
| 13 | Music room | `/music` | 6,200 | Its instruments are Web Audio already: onto the bus. |
| 14 | Caribbean | `/caribbean` | 4,400 | |

Then the TSL ports, world by world, smallest first (Earth's globe shader is one `ShaderMaterial`): rewrite each `ShaderMaterial` as a `NodeMaterial` with `three/tsl`, each `onBeforeCompile` as a node (`positionNode`, `colorNode`), each composer as `rt.gfx.post` data; flip the module to `shading: 'nodes'`; `shading.test.js` must stay green; check it in a WebGPU browser **and** with `?gpu=webgl`. Counts today: 130 files with a `ShaderMaterial`, 60 with `onBeforeCompile`, 30 with a composer.

## Decisions already made (don't reopen)

- Page scenes (ambience, stages, cartridges, the travel globe, the contact plane) stay on `useScene`.
- One canvas per runtime, reparented into the host; a backend of the other kind replaces it (a cut covered by the snapshot). Two live backends at once were considered and dropped: the case exists only mid-migration.
- The phone download gate stays where it is (`WorldGate` on the route, `Hold3D`): `useWorld` mounts only when `use3D().on`.
- A world draws every frame while on screen unless its `wants()` says no; off screen, hidden tab or covered page (`html[data-covered]`) stops the loop.
- The handover's cover is a 2D snapshot (one `drawImage`), not a GPU crossfade.

## Status

| World | Session | Branch | Merged |
|---|---|---|---|
| Runtime + Earth | this one | `claude/blissful-galileo-3sbomr` | yes |

## A dev-mode flight check (the pattern)

```js
// node scripts/.cache/<world>-check.mjs (scripts/.cache is git-ignored and eslint-ignored; playwright resolves from there)
import { chromium } from 'playwright-core';
// start `vite --port 5199`, launch /opt/pw-browsers/chromium-*/chrome-linux/chrome with --use-angle=swiftshader,
// addInitScript: localStorage.setItem('tp-worlds', JSON.stringify('load')) (past the download gate),
// goto http://127.0.0.1:5199/#/<route>, waitForFunction(() => window.__RUNTIME__?.status === 'on'),
// press the world's keys, read its dev hook, go to #/home and back, assert no pageerror and no console error
// (the noise list is scripts/autopilot-check.mjs's NOISE), screenshot.
```
