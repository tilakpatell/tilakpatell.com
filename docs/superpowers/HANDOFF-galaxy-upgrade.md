# Handoff: the galaxy upgrade, Phase 1

The plan is `docs/superpowers/plans/2026-10-05-galaxy-upgrade-phase-1.md`, and the spec, with the baseline, is `docs/superpowers/specs/2026-10-05-galaxy-upgrade-design.md`. Work happens on `claude/sharp-carson-h9c6mp`.

## Done

These merged together in one PR (the branch `claude/sharp-carson-h9c6mp`):

- **Task 1.** `lib/three/glass.js` (`dropTransmission`), `lib/three/gltfCache.js` (`loadGLTF`, `cloneScene`: one parse per file, loaded through `lib/three/gltf.js`'s loader and sharpened once), and `post.lite()`.
- **Task 2.** In space, no canvas multisampling. The Falcon's glass has no transmission pass. Planet detail follows `post.sharpness`, and point sizes follow the live pixel ratio.
- **Task 3.** The crash shockwave plays. Small hits use `flashes`. The bolts start with instance colours. `STAND_IN`. The Death Star loads only where there is one.
- **Task 4.** The galaxy's models, the fleets and the planets' models share one parse per GLB.
- **Task 5.** The sky is baked into a cube once per system, with three nebulae a system (`nebulaeOf`).
- **Task 6.** `kindsIn` and `models.prebuild`. The tunnel builds the next system (`enter`) and dresses it (`dressSystem`) a frame later.
- **Task 7.** Rocks tumble in the vertex shader. Their matrices are written once, and small rocks get a coarser bucket.
- **Task 8.** No per-frame garbage in space. `starAhead` reads the sky's bearings.
- **Task 9.** `scripts/galaxy-lod.mjs` and `public/models/galaxy/lod/*.glb` (22 kinds, 7–34 KB each). A slot without a tint is a `THREE.LOD`: the full model, then the LOD past 45× its size, then nothing past 900×.
- **Task 10.** On the surface:
  - no canvas multisampling;
  - lamps are hidden outdoors, and the warm-up compiles both light layouts;
  - the sun's shadow is snapped to texels (`surface/shadow.js`);
  - `lowerQuality()` turns off the sun's shadow and calls `post.lite()`.

## Left, in order

1. **Task 8b: the Sketchfab ships.** This is blocked. The branch `claude/galaxy-assets-wip` (commits 6ef170b and 35c9484) was never pushed. It exists only on the machine of the account that made it. Push it from there, then follow the plan's Task 8b. It's done when the TIEs, Munificents and Razor Crest are those models and `models.test.js` passes. Then run `node scripts/galaxy-lod.mjs <the new kinds>`, so the new ships get LODs too.
2. **Task 11: near shadow casters, and zones hide the outdoors.** Half done, on `claude/galaxy-perf-task11-wip`.
   - Done there: `surface/near.js` with its tests, and `placer.js`. The placer gives each scatter part a caster `InstancedMesh` on `SHADOW_LAYER`, holding the instances within 48 m. It also puts a `zone` spec into a `rooms` group and has `setZone`.
   - Not done:
     - `sun.shadow.camera.layers.enable(SHADOW_LAYER)` in `surface/scene.js`. Without it, scatter casts no shadow at all, so don't merge that branch without it.
     - Pass `me().st` as the third argument to `placer.update`.
     - Add `zone: true` to the zone builds' `placer.put`.
     - Give `actors.js` an outdoor and a zone group with `setZone`, and skip actors in a hidden group.
     - Call `placer.setZone`, `life.setZone`, `ground.visible` and `shipHolder.visible` from `lighting(z)`.
   - It's done when Endor is at most 1.0M triangles, tree shadows still show near the player, and inside the cantina the counts fall to the room.
3. **Tasks 12–14,** as written in the plan: surface sharing, surface CPU, and surface bugs.
4. **Task 15: the evidence write-up.**
5. **Phase 2.** It has its own plan and goes in its own PR.

When the world-runtime branch (`claude/world-runtime-galaxy`) lands, the galaxy and surface scenes draw on the runtime's shared renderer. After that, don't call `createRenderer` in them, and put back in `dispose` anything you set on the renderer, such as `shadowMap` or `toneMapping`.

## Checking it

- Start the dev server: `npx vite --port 5188 --strictPort --host 127.0.0.1`.
- Count a frame: `OUT=<dir> node scripts/galaxy-check.mjs space|surface <ids>`, with `JSON=1` for a file. On Windows, add `CHROME="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"`; the script's default is a Linux Chromium path.
- In space, the check pins the ship and its camera (`__galaxyDebug.pin`), so a view counts the same every run.
- Under software GL a frame takes over a second. A surface's landing and "getting out" run on frame time capped at 0.05 s a frame, so they take minutes. Press Space after the first 0.6 s of game time to skip the landing.
- To walk into a zone: teleport to its door (`__surfaceDo('teleport', x, z)`, where `siteOf(id).zones[].door.at` gives the door), wait for the walk phase, then press E.
- Numbers on 6 October, high tier, X-wing:

  | View | Calls | Triangles |
  | --- | --- | --- |
  | Space, Endor | 43 | 178k |
  | Space, Coruscant | 40 | — |
  | Space, Hoth | 39 | — |
  | Space, Naboo | 48 | — |
  | Surface, Tatooine | 427 | 1.08M |
  | Surface, Hoth | 292 | 1.09M |

  131k of Endor's 178k triangles are the player's own HD X-wing (`xwing-hd.glb`, the hangar's file, which stays), so Endor's 170k target can't be reached from the galaxy side alone.
- Gotchas on Windows:
  - `src/data/changes.test.js` and `src/runtime/shading.test.js` build paths with `URL.pathname` (`/C:/…`), so they fail on Windows only.
  - `vite build` fails on Windows in `prerender-routes` (no `dist/index.html`), on main too.
  - CI runs on Linux and passes both.
- `@gltf-transform/functions` pulls in ndarray-pixels' own sharp 0.35, next to the site's 0.34. Two libvips builds in one process break each other's decoding, which is why `galaxy-lod.mjs` quantizes by hand.
