# Cybertron, the world: design

Date: 2026-10-05. Route: `/cybertron`. Code: `src/components/cybertron/game/`.

## What the owner asked for

- "The Transformers world sucks. Really make it 3D and make it better."
- Models that match the era: the **Aligned continuity** — High Moon Studios' *War for Cybertron* / *Fall of Cybertron*, and *Transformers Prime*. Search for models first and generate only what can't be found.
- "Really make the planet look better." The reference image the owner sent shows Cybertron at war: concentric megastructures, orange molten seams over blue energon cracks, silver districts, explosions. The planet work is a separate piece (PR "Cybertron at war: the planet").
- Setting: **both, linked**. Iacon at war on Cybertron, and Team Prime's base and Jasper, Nevada on Earth, joined by a bridge.
- Models: Sketchfab first (the hosts are now open), Meshy for gaps, code-built only as a stand-in while a model loads.
- Work in PRs merged to main as each piece is finished.

## What it is

A walkable, drivable 3D world that opens the Cybertron page. It replaces the old hero and the 2D toys at the top; the old sections stay below it for now.

### Two areas, one engine

1. **Iacon at war (Cybertron, WFC/FOC look).** This is the Autobot capital under siege, at night, under the burning planet's sky.
   - The great boulevard runs to the Hall of Records, with Autobot HQ on its plaza.
   - Towers stand in plated metal, with energon in the gutters.
   - The Decepticons hold the gates.
   - The Ark sits on its launch pad.
   - Metroplex stands colossal on the skyline.
   - Fires and explosions burn, and Seekers fly over.
   - Optimus is played in his **Fall of Cybertron** design, with his **FOC CyberTruck** alt mode.
2. **Team Prime's base and Jasper (Earth, Prime look).**
   - The base is the Omega One silo: Teletraan-1's console, the ground bridge tunnel and Ratchet's bay.
   - Out the ground bridge lies the desert outside Jasper: mesas, the road, an energon mine.
   - Optimus is played in his **Prime** design. His alt mode is the **Prime truck**.

**The link.** In Iacon, the space bridge sends Optimus "forward" to the base, as in Prime: Teletraan-1's archive is Optimus's memory of the war. The base's space-bridge console sends him back. Inside the Earth area, the ground bridge links the base to the desert.

### Playing

**Robot mode:**

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Walk, camera-relative |
| `Shift` | Run |
| `Space` | Jump |
| `F` or click | Fire the blaster |
| `E` | Talk or use |

**Vehicle mode:**

| Key | Action |
| --- | --- |
| `W` / `S` | Throttle and brake |
| `A` / `D` | Steer |
| `Shift` | Boost |
| `F` | Vehicle guns |

**Transformation.** `Q` transforms between modes, on the ground only, taking about 0.9 s.

**Camera.** Drag or move the mouse to look, scroll to zoom. The chase camera sits behind the robot, and lower and further back behind the truck.

**Phones.** A stick, a look pad, and buttons for jump, fire, transform and use.

**The transformation.** The robot and the vehicle are different models, so a morph is impossible. Each is cut at load time into chunks of nearby triangles: about 60 on a desktop, 30 on a phone.
- The outgoing form's chunks fold inward, spinning, onto the incoming form's chunks, paired by where they sit along the body.
- Meanwhile the incoming chunks unfold from there into place.
- It is one draw per material: each chunk's pivot and offset live in vertex attributes, and the timing in uniforms.
- Sparks and the transformation sound play with it.

### People

**Iacon:**
- Bumblebee (WFC), Jazz, Grimlock and Jetfire (FOC), and Zeta Prime (WFC), to talk to.
- Decepticon troopers (FOC) at the gates and in waves, and Seekers overhead.
- Soundwave (FOC) on a rooftop, watching.
- Megatron (FOC) at the gates for the last mission.

**Base and Jasper:**
- Ratchet, Bulkhead, Arcee and Bumblebee (Prime).
- Vehicons at the mine.
- Megatron (Prime) as a set-piece.

### Missions

Each area has a few missions. A pure `rules.js` keeps them, with the compass and objective HUD.

**Iacon:**
1. *Hold the gates.* Waves of troopers; clear three.
2. *Energon run.* Collect energon cubes against the clock as the truck.
3. *Wake Metroplex.* Drive through his beacons.
4. *Defend the Ark.* Megatron comes to the pad; drive him off.

**Base and Jasper:**
1. *Report to Ratchet.* Talk to the team.
2. *Ground bridge.* Out to the desert.
3. *Energon mine.* Clear the Vehicons and collect energon.
4. *An Iacon relic.* Find it, which ties in with the page's Iacon database.

Achievements unlock for each mission (`Achievements.jsx`).

## How it's built

**`scripts/sketchfab-cybertron.mjs`.** It follows `sketchfab-surface.mjs`: download with the owner's token, metal-roughness materials, merge, simplify to a triangle budget, WebP maps, meshopt, stood on the ground in metres facing +z.
- Rigs are kept where they exist.
- Output goes to `public/models/cybertron/<kind>.glb`.
- Credits go into `src/data/modelCredits.json` as `cybertron-<kind>`, with `where: 'cybertron'`. The page shows `<ModelCredits where="cybertron">`.
- The catalogue is `src/components/cybertron/game/catalog.js`.

**`game/rules.js`** (pure, tested):
- Areas as data: ground heights, solids (boxes and circles with tops), spawn points, people, pickups, missions.
- The robot walker, including jumping and steps.
- The vehicle, an arcade truck: grip, boost, bump.
- The transformation state machine.
- Blaster shots, hits and health.
- Enemy brains: approach, strafe, fire, take cover.
- The mission steps.

**`game/areas/*.js`.** Each area's layout as data, read by both `rules.js` and the scene.

**`game/bots.js`.** Loads the models, cuts them into chunks for the transformation, drives the rigs' clips or poses them, and provides code-built stand-ins.

**`game/scene.js`.** The renderer:
- A HalfFloat target, bloom, a grade, and pacing (`lib/three/pace`).
- The areas' geometry: Iacon's towers come from the backdrop's kit (`world/CybertronBackdrop3D.js`), brought down to street level with CC0 plating (`lib/cc0`).
- Lights, the sky (Iacon: the planet's moons, fires, flak; Earth: a desert sky), effects and the camera.

**`game/World.jsx`.** The React wrapper:
- Keys, pointer and touch input.
- The HUD: health, energon, mission, compass and prompts.
- The area switch.
- The 2D fallback without WebGL: the old page's planet and toys.

**Assets and budget.**
- `WORLD_MB['/cybertron']` is raised to what is actually downloaded.
- On phones, `WorldGate` asks first.
- Models load after the first frame, with code-built stand-ins until then.

## Testing

- `game/rules.test.js` covers:
  - walking and collisions
  - the vehicle stops at walls
  - transformation only on the ground, and not mid-transform
  - shots hit and kill
  - mission steps advance
  - each area's spawn is clear of solids
- `src/data/modelCredits.test.js` gains `cybertron` in its `shown` map.
- Browser check: screenshots of each area, robot and truck, a transformation mid-way, and a mission.

## Out of scope for now

- Playing as Megatron (the Decepticon side), and Kaon. The page's side switch still recolours the HUD and the planet.
- Online players in the world. This is easy to add later with `useTravellers`, as Avengers HQ does.

## Amendment 1 (2026-10-06): Kaon, and Megatron to play

The owner asked for Kaon and for Megatron as a playable side. This moves the
first "out of scope" item in.

- **Picking a side.** The start screen offers Optimus (Iacon) or Megatron
  (Kaon). It defaults to the page's own side switch, and the choice is
  saved with the rest (`tp-cybertron-world`).
- **Megatron.** He plays Fall of Cybertron's `megatron-foc`. He changes
  with his own model's transformation clip, not the chunk effect, using
  the same `clips.toVehicle` / `vehicle` / `toRobot` timings his boss
  version uses, sped up to `TRANSFORM.time`. As a tank he drives with the
  truck's rules.
- **Kaon** (`areas/kaon.js`, `stage/kaon.js`) is the Decepticons'
  capital:
  - dark plating with red and violet light
  - Megatron's fortress to the north, its spire over the city
  - the arena (Kaon's pits) at the centre
  - a dark-energon refinery
  - the same megastructures on its skyline
  It has no bridges yet: Megatron's campaign is played there.
- **Kaon's people** are Soundwave, Shockwave, Barricade and a trooper
  captain. **Its enemies** are Autobot raiders, played by Bumblebee and
  Jazz (`ENEMY_KINDS.autobot`), and Zeta Prime as the boss
  (`ENEMY_KINDS.zeta`). Which model plays an enemy can now be set per
  area (`area.foes`).
- **Four missions**, each with an achievement:
  - The pits of Kaon: three waves in the arena.
  - Fuel the war machine: dark energon against the clock.
  - Run them down: the tank through checkpoints, then the raiders.
  - Zeta Prime's last stand: needs the other three; ends with the boss at
    the fortress gate.
- **Optimus's gun.** High Moon's weapon skeletons are held as the rest
  pose holds them (barrel along the forearm, grip at the hand) every
  frame, whatever the arm's pose or clip does.
- **Feel.**
  - a muzzle flash at the gun
  - a hit marker when your shots land
  - a red edge on the screen when you're hit
  - the camera shaking on heavy hits and explosions
