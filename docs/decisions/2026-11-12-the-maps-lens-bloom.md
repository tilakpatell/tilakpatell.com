# The universe map’s bloom is a lens’s mip chain, and what’s on its sky stays put as the camera rolls

**Date:** 2026-11-12 · **Status:** accepted · **Where:** `src/lib/three/bloomChain.js`, `src/lib/three/upright.js`, `src/components/universe/post.js` (`chain`), `src/components/universe/look.js` (`CHAIN`), `src/components/universe/{deepspaceShaders,landmarks,sun,scene}.js`

## Context

The owner asked for the map to read as AAA: better bloom, lighting and textures, nebulae that don’t spin as you fly, and space that feels alive. Measured on `main` (headless, 1280 × 720, high):

- The nebulae’s puffs took their angle from the screen (`atan` of the tangent as it lay on the screen, plus a slow spin on the clock), the landmark nebulae were quads square to the screen, and the suns’ coronas copied the camera’s turn. A 35° roll of the camera at the Cradle rearranged its wisps instead of turning them with the view (`scripts/universe-check.mjs`’s poses and a roll probe: the same view, rolled, then turned back).
- The environment metal reflects was made once in the world’s axes while the whole map turns under the camera (`map.rotation.y`), so a hull’s glint slid against the light as you steered.
- Bloom was three’s `UnrealBloomPass`: a hard cut at 1.7, five Gaussian levels, the light over the line spread about 2.4 times over. Lone hot pixels (stars, a bolt’s tip) shimmered in it as they moved, and nothing under the line had any veil.
- A Frostbite-style renderer’s post (`bf2-engine-src`, read for its technique): no threshold, a Gaussian pyramid of `log2(height) − 1` levels so a bloom’s size is an angle, per-level weights integrated under `(2·(1 − sharpness))^(20x)·(1 − x)²` and summed to one, added at 5 % of the scene before exposure; a hue-preserving shoulder; a quadratic limb law on the sun.

## Decision

- **Facing the eye, upright to the world** (`lib/three/upright.js`): a glow, a corona or a cloud turns toward the camera’s place and stays square to the world’s up, never its roll. The puffs, the landmark nebulae, deep space’s star glows and the home sun’s corona all take it. A star’s own glare and rays stay square to the screen: they are the lens’s.
- **The environment turns with the map** (`scene.environmentRotation.y = state.yaw`, made in the map’s axes).
- **The map’s bloom is a mip chain** (`lib/three/bloomChain.js`): thirteen taps down (Jimenez, Call of Duty: Advanced Warfare) with Karis’s average on the first level, a tent back up, each level at the integrated weight, the light kept. Two parts in one chain: a veil of 4.5 % of all the light and a glare of what’s over 1.7, eased over a 0.6 knee, at 2.1. Only the map asks for it (`createPost`’s `chain`); the galaxy and Cybertron keep three’s pass and their picture.
- **Alive**: each puff swells, drifts and billows on its own slow beat; the landmark nebulae flow; the far galaxies turn in their planes; Ember’s and Halcyon’s worlds go round them (Kepler’s periods, ten minutes at 320 out, their solids moved each frame as the Twins’ are).
- **Finer surfaces**: the sun’s limb by the quadratic law with a granule net and hotter patches whiter; the rocks’ cracks and grit at finer scales, each faded under a couple of pixels; the puffs’ second, finer grain.

## Consequences

- Flying round a nebula, its clouds hold their shape; banking, the sky turns as one.
- The chain is about the old pass’s cost (seven small levels at 720p, fourteen passes of a few taps); its first level reads thirteen taps. The bloom’s look moved on purpose: a softer, wider halo, a tighter core on engines, and no square flicker on stars.
- `bloomGroups`’ strength slider reaches twice the pass’s strength where that’s over 1.5 (the chain’s 2.1).
- The node twins (`sunNodes.js`, `rockNodes.js`) don’t have the new surfaces yet; they aren’t drawn until the map moves to the node renderer.

## Revisit when

- The map moves to the node renderer: the chain is `lib/three/light/post.js`’s to carry, and the twins take the new surfaces.
- A screenshot on a real chip shows the veil lifting a dark sky more than the toe holds down.
