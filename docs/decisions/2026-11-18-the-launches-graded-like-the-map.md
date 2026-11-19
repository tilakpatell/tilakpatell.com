# The launches are graded like the map, reflect their own cabin, and the Falcon is flown by the game’s Han

**Date:** 2026-11-18 · **Status:** accepted · **Where:** `src/components/cockpit/{grade,cabin,lens,scene,pilot,hands,greebles}.js`, `src/components/cockpit/vehicles/{falcon,falconDetail,xwing}.js`

## Context

The owner found the Falcon and the other launches overbright and shiny. Shot at ultra (headless, 1280 × 720, `scripts/cockpit-shots.mjs`), three causes:

- **The curve.** The cockpit tone-mapped with three’s ACESFilmic, which multiplies the light by 1/0.6 before its curve and saturates on the way: a mid-grey panel came out about three times as bright as under the universe map’s curve, Chewie’s fur ran to yellow, and the tunnel’s blue to white.
- **The bloom.** Three’s UnrealBloomPass from 0.8 caught everything brighter than lit paint: every lit button wore a halo and each chrome lever a white bar; in the tunnel the whole console fogged.
- **The reflections.** Every cockpit reflected three’s RoomEnvironment, a white room hung with light panels of 17 to 100. At a cockpit’s 0.35 to 0.6, a polished toggle caught some thirty times the light of the paint beside it.

## Decision

- **The map’s curve.** Each launch takes a row in `grade.js`: the universe map’s shoulder (Khronos Neutral without its toe, hue kept; `lens.js` draws it where three would draw Neutral; the one pass uses three’s Neutral) at its own exposure. The cruiser’s cartoon keeps no curve.
- **The lens’s bloom.** `lib/three/bloomChain`’s mip chain (after a Frostbite-style renderer’s pyramid, `bf2-engine-src` read for its technique) at half the frame: a veil of 1.5–2.5 % of the light, and a glare only over 1.6–1.8. The white-out at the flash scales the chain (`whiteOutAt`).
- **A probe of the cabin.** `cabin.js` is what metal reflects: a sphere round the seat, the canopy showing the sky outside (dim), dark paint elsewhere and the consoles’ warm light low in front. The RV keeps its evening sky. The Falcon’s chrome is brushed (roughness 0.2 → 0.34), its lit buttons a step down (1.5 → 1.25) and the jump’s light on the cabin about two-thirds what it was.
- **Hands.** In the Falcon you are the game’s Han (`pilot.js`). He is the game’s light cut on its whole skeleton, sat by the X-34 driver’s clip as Chewie is, with his head bone folded away; the camera rides his eyes. His hands are on the yoke by two-bone IK. On the go he leans in, his right hand pushes the levers home beside Chewie’s paw (Chewie now reaches by IK too), and the jump presses him back (`hands.js`, tested). The yoke and the levers came forward into his reach (`YOKE_Z`, `LEVER_Z`). The universe map’s cockpit view goes without him (`pilot: true` is the launch’s alone).
- **Detail.** `greebles.js`: rivets, knobs and clamped conduit, each kind one draw; the Falcon’s set is `vehicles/falconDetail.js` (and its overhead switches join its switch draw), the X-wing’s is knobs and wall runs.

## Consequences

- The launches read as lit rooms: buttons hold their colour, the tunnel stays blue, the RV’s desert is no longer a haze, and the flash still burns into the white.
- The Falcon fetches the game’s Han (the light cut, about 3 MB, never the full one) beside Chewie, at every level but low.
- The X-wing was tried with the game’s Luke and dropped: its tub is too narrow for the game’s light cut, and the hands sit out of the view at rest.

## Revisit when

- The cockpit moves to the node renderer: `cabin.js`, the chain and the shoulder go with it, and `greebles.js` wants a node twin.
- A hand needs to be laid over a knob rather than round a handle (the X-wing’s throttle): `pilot.js` wants the hand turned as well as placed.
