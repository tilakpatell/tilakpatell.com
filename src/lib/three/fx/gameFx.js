// The galaxy surface's effects in the game's look, one place for a scene to
// call: a bolt's impact by the surface it lands on (the game's scorch or
// metal mark, a hot ember in the bolt's colour, the surface's own
// chunks thrown up: snow and sand most), a blast by vehicle class (the
// game's burst and ring, its fire along the black-body ramp, its scorch,
// the class's own wreck flung out), and the Force push on Luke's
// half-sphere. Each part answers whether it drew: where the bucket lacks a
// sheet or a mesh it draws nothing and says so, and the scene's own effect
// (universe/gunfx.js's scorch and sparks) stands in. Particles scale by
// tier (./fxPlan); each kind is one instanced draw.
//
// Lights: none of its own. The muzzle flare and the saber's light are the
// scene's, as they were (the lighting lane's).
//
// createGameFx(parent, { level, groundAt, site, lit, look }) → {
//   ready: Promise, has(part),
//   impact(at, normal, { ground, colour, surface, family }) → { mark, debris }: what it drew
//     (`family` the material the game's grid said it struck, lane P4's
//     impactLook: it wins; else `surface` (metal | stone | snow | sand | wood);
//     else the world's own ground, fxPlan's surfaceOf)
//   explode(at, cls, { tint }) → boolean
//   push(from, dir, { colour, pull, reach }) → boolean
//   update(dt), clear(), dispose() }
// `look`: 'game' (the default) or 'site' (draw nothing: the dev hook's
// before, and what a visit gets if every sheet were missing).
//
// (Its workings are ./gameFxCore.js's, shared with gameFxNodes.js; the
// looks here are marks.js's and push.js's GLSL.)

import { createGameFxWith } from './gameFxCore';
import { createSheetFx } from './marks';
import { createPush } from './push';

export const createGameFx = (parent, opts) => createGameFxWith({ createSheetFx, createPush }, parent, opts);
