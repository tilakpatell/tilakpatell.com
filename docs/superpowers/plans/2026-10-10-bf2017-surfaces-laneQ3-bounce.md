# Battlefront 2017 surfaces, lane Q3: the bounce, and the baked light's atlases. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 1 and 2 are the site's (a cloud session, after lane S of #836 merges: both touch `apply.js`'s params); Task 3 is the desktop's (the owner's machine, `C:\Users\tilak\Downloads\BF2_Extract`), a spike whose output is an answer.

**Goal:** The shade under the game's sun is lit the way the game's radiosity lit it: now, by the weather record's own bounce numbers in the light stack; next, if the desktop can read Enlighten's database, by the game's baked irradiance atlases through a per-instance chart.

**Architecture:** `src/lib/three/light/bounce.js` reads `EnlightenComponentData` from `entry.record` and gives the stack a ground-bounce hemisphere term, the ambient's zenith and nadir, a probe scale and SSGI's radius and strength; `applyGameLight` takes it behind the field. On the desktop, `tool/EnlightenResProbe.cs` reads a level's `StaticEnlightenData.DatabaseResource` and reports whether per-instance chart rectangles are findable.

**Tech Stack:** three `^0.186.1` TSL (`hemisphere` as a lighting node: `HemisphereLight` registered through lane R's `registerLights`, or a `Fn` added to `ambientOcclusion`-free indirect diffuse), lane R's `apply.js`, `probes.js`, `post.js` (`SSGI_RADIUS`), lane S's `calibrate.js` (the units); C# with FrostySdk on the desktop (`tool/bf2export.csproj`, the `TerrainResProbe.cs` pattern: `am.GetResEntry(rid)` and the res bytes).

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md` (§3 "The baked light", "Q3").

## Global Constraints

- **Files this lane owns**: `src/lib/three/light/bounce.js` (+ test), `src/lib/three/light/apply.js` (the `bounce` wiring: additive), `src/lib/three/light/fixtures/hoth.ve.json` (the `EnlightenComponentData` objects added to the pinned record, if absent), `scripts/light-fixture.mjs` (`--bounce`: additive), `docs/superpowers/evidence/bf2017-surfaces/Q3/`; on the desktop `tool/EnlightenResProbe.cs`, `tool/Program.cs` (an `enlightenprobe` command), `logs/enlighten_probe.log`.
- Units through lane S's `calibrate.js` (`GAME_TO_SITE` and the exposure): the bounce's colour is in the record's linear units times the sun's illuminance as the record scales it (`TerrainColor × sunIlluminance × BounceScale × SunScale`), then the one factor.
- Numbers with `_source`; constants named (`BOUNCE_SHARE = 0.5`: the hemisphere's lower half is the ground bounce, the upper the sky; from the record's `SkyBoxBlendMode_Lerp` and `SkyBoxBlend 1.0`).
- Files under 800 lines; tests beside; no network in tests; the gates.

## Review Focus

1. **Double counting**: the probe's cube already holds the sky and some ground; `bounce.js` scales the probe by `BounceScale` and adds only the ground's warm term the cube lacks (the cube is captured at one point; the ground bounce is per world normal). The fixture's shadowed sphere is compared at three settings (probe only, bounce only, both) and the PR shows the three.
2. **The sky's zenith and nadir** replace lane R's `AMBIENT` constants only when the record has them; the test asserts `AMBIENT` is used for an entry without the component.
3. **The spike reports, it does not build**: Task 3's output is `logs/enlighten_probe.log` and a paragraph in the hand-off; no exporter command beyond the probe is written in this lane.

---

### Task 1: `bounce.js`

- [ ] **Step 1: Failing tests**: `bounceOf(record) → { ground: [r,g,b], zenith, nadir, probeScale, ssgi: { radius, strength }, _source }` on Hoth Sunny's record (`TerrainColor 0.547, 0.594, 0.644`, `SkyBoxSkyColor 0.84, 1.58, 3.0`, `SkyBoxGroundColor 0.049`, `BounceScale 1`, `SunScale 0.5`, `CullRadius 1`); `null` for a record without the component.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the pure part and `createBounce(scene, bounce, { three, sun }) → { update(entry), dispose }`: a `HemisphereLight` (sky colour the zenith, ground colour the ground bounce) registered through the stack, intensity from the sun's illuminance through the units. **Step 4: Run** → PASS.

### Task 2: In the stack

- [ ] **Step 1**: `apply.js` creates it when `entry.record` has the component; `probes.js` takes `probeScale`; `post.js`'s SSGI preset takes the radius; `setWeather` updates it.
- [ ] **Step 2**: `node scripts/light-fixture.mjs --hoth --bounce` (WebGL 2 on the cloud): the three shots of Review Focus 1 in the evidence; the hand-off's row.

### Task 3: The atlas spike (desktop)

- [ ] **Step 1**: `EnlightenResProbe.cs`: for `Levels/MP/Hoth_01/Lighting/EN_Hoth_01_Static_Sunset`, get the res by `DatabaseResource` id, dump its size, its first 256 bytes as hex, a histogram of 4-byte values that parse as floats in `[0, 1]` (UV-like) and as small ints (ids), and any run of consecutive float pairs longer than 64 (a chart UV stream); search for the map's physics-part indices (lane L's `smg_transforms.jsonl` instance tags) as 4-byte ints.
- [ ] **Step 2**: report in the hand-off: readable (chart rects per instance found, with the stride) or not (what was found instead). If readable, the follow-up design item is `bf2export lightmapuv` and the pack's per-instance `uvRect`; the spec's §3 names what the material then samples.
