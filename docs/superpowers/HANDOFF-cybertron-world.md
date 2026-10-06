# Handoff: Cybertron's world (`#/cybertron`)

Spec: `docs/superpowers/specs/2026-10-05-cybertron-world-design.md`.
Plan: `docs/superpowers/plans/2026-10-05-cybertron-world.md`.
Code: `src/components/cybertron/game/`. The rules are in `rules.js`
(tested by `rules.test.js`), the areas are in `areas/` (tested by
`areas.test.js`), `sim.js` puts them together (tested by `sim.test.js`,
including a run through every mission), `scene.js` and `stage/*.js` draw
them, and `GameWorld.jsx` drives them.

The owner's asks:
- Make the Transformers world properly 3D and better.
- Use models from the era: the Aligned continuity, High Moon's War for
  Cybertron and Fall of Cybertron, and Transformers: Prime. Search for
  models first and generate only if none can be found.
- Make the planet look like Cybertron at war: concentric megastructures,
  molten seams and energon cracks.
- Iacon at war, with Team Prime's base and Jasper linked to it by bridges.
- Make PRs and merge them to main regularly.

## Done (all merged)
- **The planet at war** (PR #178). The hero globe and the universe
  map's Cybertron share `skin.js` (energon, fire and city lights) and
  `war.js` (bursts over the fighting). The maps come from
  `scripts/build-cybertron-planet.mjs`.
- **The world** (PR #217):
  - 35 Sketchfab models under CC BY: `catalog.js`,
    `scripts/sketchfab-cybertron.mjs`, credited as `cybertron-<kind>`.
  - Three areas: Iacon, Team Prime's base and Jasper.
  - Seven missions, each with an achievement.
  - The transformation in `chunks.js`.
  - The autorig for the Prime robots that came without a skeleton.
- **The universe map's orbit** (PR #226). The orbiting Optimus and Megatron
  are now War for Cybertron's and Fall of Cybertron's, frozen in a pose by
  the import script's `pose`. They also stand on the landing.
- **Megatron's tank** (PR #235). He spends 12 s as a robot, then changes
  for 2.1 s, then spends 6.5 s as a tank charging and shelling, then changes
  back for 1.6 s (`MEGATRON` in `rules.js`). The change is drawn with his
  model's own clip (`catalog.js` `clips.toVehicle`/`toRobot`). Also in this
  PR: the campaign test, and a "transform to talk" prompt when you're in the
  truck.
- **Iacon's look** (PR #239):
  - Fall of Cybertron towers built from `prism`, `wedge` and ribs.
  - Collars and crowns on the towers.
  - Slit lights (`platedMaterial({ lights: 'slits' })`).
  - Every outdoor area's metal is lit by a PMREM of its own sky.
- **Phones** (PR #243): while playing, the world takes the whole screen. The touch
  buttons fit their labels. The guide's `?` and the scroll saber hide.
- **Metroplex and Barricade** (PR #246):
  - When the beacons are driven, Metroplex wakes on the skyline: his eyes
    and chest light up, he turns toward the city, and a searchlight sweeps
    from his head.
  - Barricade joins the gate's last wave. He changes into his car on his
    own clip (robot→car 4.15–5.8 s, car→robot 14.2–16 s) and rams.
  - Every Decepticon who changes now uses one table, `rules.js` `FORMS`.
    To add another, give it an entry there and `clips.toVehicle` /
    `vehicle` / `toRobot` in `catalog.js`. Find the clip's times from a
    contact sheet of its frames (a gitignored `lab/sheet.html` taking
    `file@time@yaw`).

- **The Matrix of Leadership**: an eighth mission (Iacon, from Zeta
  Prime, after the bridge is held). Stop Shockwave in the Hall's plaza (a
  boss with a slow, heavy cannon: `ENEMY_KINDS.shockwave`), then take up
  the Matrix (its own model, glowing on the steps; `scene.js`
  `matrixModel`). A mission's `say` is what its giver says as it starts.
  The boss bar and the compass name whichever boss it is.
- **Everyone's models in use**: Bumblebee's car and Bulkhead's truck are
  parked in the base (solids too), Bumblebee's War for Cybertron car by
  HQ, and Prime's Soundwave watches the mine from the rocks
  (`stage.watcher`).
- A Decepticon's mission beacon is a thin shaft over his head now, not a
  column round him.

- **Kaon and Megatron** (PR #252): a city, four missions and a side to
  pick on the start screen. Megatron changes on his own clip. Optimus's
  gun is held right; shots leave the muzzle. Hit marker, damage edge,
  camera jolts, a key light over the hero.
- **More of Fall of Cybertron's cast**: Starscream (Kaon, who gives the
  Zeta Prime mission), Skywarp's and Thundercracker's jets over Kaon,
  Ironhide, Warpath and Ratchet among Kaon's raiders, and Ultra Magnus
  in Iacon. They're hafid.quispe's Sketchfab uploads, each holding a
  robot and its vehicle in one file. The import script splits them by
  node, and `skinnedOnly` drops the other form's loose parts. The High
  Moon robots keep their rigs. Ultra Magnus is `still`, because the
  auto-rig can't read his arm guns.
- **Hardening** (PR #258): `fuzz.test.js` drives every area with random
  input for 9,000 frames on three seeds. Every frame it checks the
  invariants: values stay finite and in bounds, nobody goes into a solid,
  and hp, boost and shots stay sane. Two bugs it led to are fixed:
  - Crossing a bridge while down no longer carries the death across.
  - Megatron no longer stays stuck in his tank pose after a respawn.

  Hp now mends after 4 s out of the fight (`MEND`), energon heals a
  little, and Decepticons flinch when hit.
- **Finding more**: search the Sketchfab API (`/v3/search?type=models&
  downloadable=true`, whose results give the licence, faces and texture
  size) and check each candidate's thumbnail. The same uploader also has Fall of Cybertron's
  Sideswipe, Skywarp and Thundercracker robots, Hound, Perceptor, Sludge,
  Snarl, Swoop and the Combaticons. flotick64 has the whole Fall of
  Cybertron multiplayer roster with vehicle forms, if more are wanted.

## Checking it
- Dev only: `#/cybertron?quality=high&autoplay` starts playing.
- `window.__CY__.go('base' | 'jasper' | 'iacon' | 'kaon')` crosses to an area.
  `window.__CY__.sim` is the sim: move `sim.player`, push enemies, or set
  a mission. The camera follows `window.__CY__.ctl.current.view` (`yaw`,
  `pitch`), not the player's yaw.
- Under the headless software renderer, a frame takes about a second.
  After teleporting the player, wait 20–30 s before a screenshot, because
  the chase camera eases in.

## Left
- **Out of scope in the spec, still open**: online players in the world
  (`useTravellers`, as Avengers HQ does).
- Prime's Optimus stands with his upper arms a little out, because his
  shoulder armour is broad. A per-model `stand` pose in `catalog.js` would
  fix it if it bothers anyone.
- Iacon could take more Fall of Cybertron detail:
  - pipes and conduits between the towers
  - a few huge ring structures, as on the planet
  - the deck's trenches
