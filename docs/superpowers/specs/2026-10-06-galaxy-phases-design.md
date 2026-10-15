# The Star Wars galaxy, in phases — design

## Intent

What the owner said (6 October 2026): the Star Wars planets' landscapes and
features can be much better: better foliage (there is earlier research),
waves, and bases with higher quality textures that are more accurate to the
films and shows. Improve the rest of the Star Wars universe too. Use
Wookieepedia, and plan in phases the way the Rick and Morty multiverse is
planned (`2026-10-06-rick-and-morty-multiverse-design.md`). Add models and
AI NPCs. Make the galaxy feel like a galaxy, with smart, robust AI. Keep
working (no checkpoint questions; the owner's standing rule).

Read as: a phased programme across the galaxy's two halves, the surfaces
(`/galaxy/:id/surface`) and space (`/galaxy/:id`). Each phase ships on its
own PR, merged as it finishes. This session writes the programme and builds
Phase 1.

## What is there now (pointers, not repeats)

- Surfaces: `HANDOFF-galaxy.md`. Seventeen worlds have quests,
  missions, heroes, sabers, guns and enemies that burst, strafe, shield and
  parry. The ground wears photo scans up close.
- Foliage: `2026-10-06-foliage-landscape-design.md` (checkpoints F0–F19).
  It is in flight on `claude/sharp-carson-h9c6mp` (PR #383: Naboo's Lake
  Country, Varykino's cypresses, Yavin's undergrowth, Mustafar's rock).
- Space: `HANDOFF-galaxy.md`, `HANDOFF-galaxy.md`. The roam
  director runs the hunt, the Star Destroyer and the bounty hunter (Phase 1
  "Outlaws", merged as #403). The owner has already decided the order of
  the expansion: traffic and events, then named NPCs, then open systems,
  then journeys.
- Water: `surface/water.js` is one flat plane with noise normals. It has
  no wave shape, no shore and no depth. This is the weakest thing on the
  sea worlds.

## Lanes other sessions hold (don't duplicate)

| Lane | Who | What |
| --- | --- | --- |
| Galaxy fixes | `claude/galaxy-bugs` session | hull solids for ships and stations, the Death Star II model, bloom and chromatic aberration down, ship textures and scale, sabers and guns for every crew on surfaces |
| Foliage | `claude/sharp-carson-h9c6mp` | the F-plan, world by world |
| Fleet war | `claude/fleet-war-capitals` (#410) | capital ships' close-up cut |
| WebGPU | #371 | uncharted systems and living worlds on WebGPU (a design, not built) |

This programme touches their files only where a phase needs a hook. Each
hook is kept small and placed away from their edits, and trial-merged
against their branches before each PR.

## What Wookieepedia says (fetched through its MediaWiki API, `scripts/galaxy-refs.mjs`'s route)

- **Scarif**: tropical volcanic island chains rising from clear, shallow
  oceans; deeper water round rocky archipelagos; tranquil sandy beaches
  running into jungle (areca palms, the giant peetalex sea grape). The
  Citadel Tower, an angular tower at the centre of the Imperial Center of
  Military Research.
- **Kamino**: all ocean, savage storms and lightning through a thick
  atmosphere, a long rainy season. Tipoca City is stilt domes, each
  streamlined to shed water and wind, with static discharge towers against
  the storms. Aiwhas ride under the water and surface near their
  destination.
- **Naboo**: grassy plains and waterfalls; swampy lakes fed by a network
  of deep water tunnels; Lake Paonga with Otoh Gunga under it. Theed sits
  on the cliffs and banks of the Solleu River, which runs into waterways
  and caves. Its seas hold the opee sea killer, the sando aqua monster and
  the colo claw fish.
- **Dagobah**: swamp and forest. **Sorgan**: forested swamp with dense
  swamps and lakes.
- **Echo Base**: carved out of a glacier (a wampa clan's den first);
  artificial corridors with structural supports; natural caverns expanded.
  Outpost Beta held the ion cannon.

## Decisions (own picks, per the owner's standing rule)

1. **Phase order:** seas, then bases, then ground AI, then the living
   lanes, then named NPCs, then open systems and journeys. Foliage stays in
   its own lane. Seas come first because water is the weakest visible
   thing and no lane touches it.
2. **Models:** sourcing follows the planets overhaul's ladder: first an
   existing site asset or a code build, then Sketchfab CC BY (or CC0),
   then Meshy from a film still. Every model passes the R&M accuracy gate.
   Meshy credits are quoted once per batch, with the total, before
   spending.
3. **Per-world sea looks live in `surface/ocean.js`** (`SEAS[id]`), not in
   the site files that the foliage lane edits. A site's `water` keeps its
   level, colour and kind. `SEAS` adds the swell, the shallows and the
   shore.
4. **Every phase passes the budget gate:** `galaxy-check.mjs` with
   `BUDGET=lab/baseline/surface-merged.json` (+10%, never over 600 calls or
   2.5M triangles) for surfaces; `/galaxy` stays under 8 MB.
5. **The owner's standing rules hold:** no sequel trilogy; every planet has
   things to do; merge as it finishes; terse output.

## Phases

### Phase 1: Seas (this session)

The sea worlds get real water: a camera-following disc of Gerstner waves.
Each world gets its own swell. A depth map baked from the terrain gives
shallows, the waves shoal and break on the beaches, and foam washes up the
sand.

- `surface/ocean.js` (pure, tested):
  - `SEAS[id]` presets:
    - Scarif `lagoon`: a long low swell; turquoise over the sand, darker
      over reef and deep; breakers and swash on the beaches.
    - Kamino `storm`: tall steep swells, whitecaps everywhere, slate grey.
    - Naboo `lake`: calm, wind ripples, the sky mirrored.
    - Kashyyyk `surf`: grey-green shallows under the karst, small breakers.
    - Dagobah and Yavin `swamp`: near still, murky, slow ripples.
  - `wavesFor(preset)`: the wave set, steepness summed under 1.
  - `heightAt(x, z, t, waves, depth)`: the same Gerstner sum as the shader,
    damped by depth, so a later phase can float things and keep the camera
    out of the water.
  - `bakeDepth(heightAt, level, { half, n })`: the water's depth over the
    reach, as a Float32 grid.
- `surface/water.js`: sea and swamp draw on a radial disc that follows the
  camera (fine rings near, coarse to the horizon), displaced by the waves
  in the vertex shader. Short waves fade with distance. The depth texture
  colours shallows and deep, damps the swell toward the shore, lifts the
  crests where they break, and draws foam lines that run up the beach.
  The fragment shader adds the sky by Fresnel (zenith and horizon), the
  sun's glitter, light through the crests, and foam from crest pinch, the
  shore and the preset's whitecaps. Lava and cloud keep today's plane.
- `surface/scene.js`: one call change, `createWater(site, sunDir,
  sunColor, { heightAt, small })`, with the camera given in `update`.
- **Done when:** the tests pass; headless Chromium shots of Scarif's beach,
  Kamino's platform edge and Naboo's lake, before and after, show waves,
  shallows and shore foam; the budget gate passes on those worlds; the
  low tier draws a coarser disc.

### Phase 2: Bases

The films' bases, accurate and better textured. Each base keeps the built
one's solids and floors. Only its look changes.

- Echo Base: the hangar's glacier mouth and its ice-carved corridors (with
  the supports Wookieepedia describes), the ion cannon at Outpost Beta,
  trench lines.
- Scarif: the Citadel Tower, the landing pads (Pad 9), the shield gate,
  bunkers in the palms.
- Yavin 4: the Great Temple's hangar floor and its X-wings.
- Theed: the hangar, the plaza, the palace's domes and green roofs.
- Kamino: Tipoca City's platform deck, its domes and discharge towers.
- Textures: CC0 PBR sets from Poly Haven and ambientCG (concrete, panelled
  metal, ice, sandstone), plus decals for scorch marks, Imperial and Rebel
  markings, and grime. Sketchfab CC BY first for set pieces; Meshy from
  stills for façades (quoted once).

### Phase 3: Ground AI

Pure, tested `surface/ai/` modules that `activity.js` and `actors.js` run:

- perception: sight cones with line of sight through the solids, hearing
  shots and footsteps, memory of where you were last seen;
- squads: a leader, cover points taken from props' solids, flanking,
  suppressing fire, retreat at low health, calls for reinforcements;
- searching: go to where you were last seen, then sweep;
- civilians: daily routines, fleeing a fight, cowering;
- a utility scorer that picks each agent's action every few hundred ms,
  budgeted per frame.

### Phase 4: The living lanes

Space feels lived in. The `traffic` lists in `systems.js` are read at last.
New `ROAM_EVENTS`, each played the way the universe map's `happen` plays
its own:

- convoys with escorts;
- distress calls;
- purrgil migrations;
- meteor showers;
- patrols flying in formation;
- pirate ambushes.

A ship AI scores patrol, trade, flee, pursue, escort and dogfight, with
formation flight and memory of the player. This extends `galaxy/roam.js`
and the director.

### Phase 5: Named NPCs

In the owner's order: Lando and Fett first, then Wedge, Bossk, Hondo,
Din Djarin and Hera. Each has:

- a ship;
- lines;
- a standing with you and a memory, reusing the universe map's `npcs` and
  `standing`;
- meetings in space, plus a place on a surface where they can be found.

Models come from the crew rig where possible.

### Phase 6: Open systems and journeys

`EDGE` goes from 900 to about 3,000, with super speed and three to six
places to find in each system. A route finder runs over `LANES`, with
deep-space stops. There is no seamless flight between systems (the owner's
decision).

## Success criteria

- Each phase's "done when" is met, with before and after shots and the
  budget gate's numbers in its PR.
- Nothing from the sequel trilogy appears anywhere.
- No regression in the suite, lint, build or health.

## Out of scope

- The sequel trilogy.
- Seamless flight between systems.
- WebGPU (its own lane).
- Foliage (its own lane), except a hook a phase needs.
