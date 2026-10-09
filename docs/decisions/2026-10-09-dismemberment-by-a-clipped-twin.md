# Dismemberment by a clipped twin, not by cutting the mesh

Date: 2026-10-09. The long version: `docs/superpowers/specs/2026-10-09-saber-forms-force-dismemberment-design.md` (§8).

## Context

The owner asked whether a lightsaber could take a limb or a head off an NPC, and for it to look real. Nothing on the site cuts a mesh. What was measured in the session (gltf-transform over the crew and troop files): every galaxy humanoid is one mesh node with one 24-joint skin in one to six primitives by material, meshopt-compressed, no morph targets in the file; the geometry is shared by every clone (`SkeletonUtils.clone`), and armed figures draw `grip.js`’s curl geometry whose index is the source’s. Dominant-joint skinning is clean at the neck (98 % of Luke’s head vertices on `Head`) and fair at the wrist and forearm, but ragged on the torso and thighs (41 % of Luke’s body vertices carry three or more bones; 57 % of a stormtrooper’s).

The ways to a cut:

| way | cost | what it looks like |
| --- | --- | --- |
| split the geometry at runtime by dominant joint, hide the piece on the body, bake a loose piece | a per-figure geometry (the shared one cannot change), the curl geometry carried over, a stump cap; a scan of 12–22 k vertices a cut | clean at the neck and wrist, torn at the waist and thigh |
| pre-cut every figure offline into limb primitives | 62 files re-encoded after the rigging lane rewrites their skins; every copy, cut or not, draws 6–10 primitives instead of 1–6 | clean everywhere the cut is pre-planned |
| scale the cut bone to zero and show a proxy limb | nothing on the geometry; the mixer rewrites the bone each frame; mixed-weight vertices spike toward the joint | a spike at the thigh and hip |
| a clipped twin: the body’s materials cloned with a clipping plane through the cut bone, a second clone of the figure with the opposite plane as the piece, its subtree posed by a two- or three-point Verlet body, a glowing disc on each side | one extra skeleton and 1–6 extra draws a sever; no geometry touched; the pattern already in `portalFx.js`, `localClippingEnabled` already on | a flat cut, square to the bone, on every clone and every model, with the death clip still playing |

A lightsaber cut in the films is flat, cauterised and bloodless, which is exactly what a plane gives.

## Decision

A sever is a clipped twin. `lib/three/combat/sever.js` clones the body’s materials with one world-space plane through the cut bone, clones the figure once more with the opposite plane, freezes every bone of the twin but the cut subtree, drives that subtree from `ragdollPhysics.createBody`, and puts a cauterised disc on each side that cools over 1.5 s. The cut is decided by a pure rule (`lib/combat/limb.js`): a lethal stroke, inside its contact window, whose nearest bone segment is a neck, forearm, upper arm or shin. Three at once at most, on the high tier within 40 m, off by a Menu setting.

## Consequences

- Every model and every clone can be cut today, with no file re-encoded and nothing shared changed; the rigging lane’s finger and twist bones do not matter to it (the subtree is read from the live skeleton by name).
- A cut is square to the bone, not sculpted; a waist cut is not offered (the plane would show the torso’s interior as a flat disc wider than reads well).
- A sever costs a full extra skeleton and up to six extra draws while the piece rests, then nothing; the cap and the tier gate keep a crowd fight honest.
- The body keeps its `die.*` clip, so a severed figure falls as it would have; the piece alone is physics.
- NPC deaths are not replicated online, so a peer sees neither your kills nor your severs; that is unchanged.

## Revisit when

- A world wants a cut that is not flat (a creature bitten in two): then the runtime split by dominant joint, with a sculpted cap, is the next step, and the skinning measure above says where it will tear.
- NPC deaths go online: a sever then needs a slot in the protocol.
- The high tier’s frame time on Kashyyyk with three severs is over the surface’s budget: lower the cap before lowering the tier.
