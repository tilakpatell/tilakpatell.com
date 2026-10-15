// Where a soldier stops being a figure and becomes a row (figures.js hands
// it to lib/three/figureRows). The distance is the site's own economy, not
// the game's: the game turns a far soldier into nothing else. It draws a
// trooper's last mesh LOD, skinned, from 42 m at Ultra until its size cull
// near 500 m (the reading of its code in D:\bf2-ghidra\lod64\DECISIONS.md,
// 2026-10-13).
//
// ROWS_FROM is the character LOD group's sixth table distance, 52 m
// (LodGroups/LodGroupCharacters.json, Lod6Distance), times
// Mesh.GlobalLodScale at each preset: 0.425, 0.75, 1.2, 1.75 (Low to Ultra).
// A trooper's mesh has five LODs and never reads that entry, so the number
// is a choice of where the site stops paying for a figure, taken from a
// table the game holds. What makes it a fair place: past 57.5 m the game
// itself runs only a soldier's locomotion, weapon pose and deploy
// (ant/layers/3P.Soldier.Layer.json), and a character casts no shadow once
// its sphere is 80 m from the camera at Ultra, so nothing a figure has that
// a row lacks is something the game shows out there.
//
// The distance is from the eye to the soldier's feet, times the game's own
// field-of-view factor, tan(fovY / 2) / tan(27.5°) (zoomOf): 1 at the 55°
// every soldier camera here has today, less through a lens, so a soldier
// seen enlarged is a figure and not a row seen enlarged. The game measures
// to the body's sphere (about a metre nearer than its feet); that is not
// taken off here.
//
// A soldier is a row past ROWS_FROM and a figure again inside BACK of it, so
// one walking the line does not change every step. Only the living on their
// feet are rows: a soldier dying, down, or in any state not named in
// ON_FEET is a figure, with its ragdoll, its death clip and whatever a new
// state brings.
//
// A page draws rows at all only when its address says ?rows=on, and only
// on a backend that can (lib/three/figureRows's canDrawRows: the node
// renderer on WebGPU, never on its WebGL 2 fallback). Every visitor's
// soldiers are figures until the owner's own GPU has shown that a row is the
// picture of the figure with the post chain on, and what rows save at 24 a
// side (docs/superpowers/plans/2026-10-13-far-soldiers-as-rows.md, the
// owner's ruling of 2026-10-15).
//
//   rowsFrom(level) → metres
//   zoomOf(fovDegrees) → the factor a distance is scaled by (1 at 55°, and for no field of view)
//   bandOf(distance, was, from) → 'figure' | 'row'
//   onFeet(entity) → boolean
//   wantsRows(flags: URLSearchParams | null, renderer) → boolean

import { canDrawRows } from '../../../lib/three/figureRows/rows.js';

export const ROWS_FROM = { low: 22, mid: 39, high: 62, ultra: 91 };
export const BACK = 0.9;
export const REFERENCE_FOV = 55; // degrees, vertical: the game's reference for its LOD distances
const halfTan = (degrees) => Math.tan((degrees * Math.PI) / 360);
export const zoomOf = (fov) => (fov > 0 && fov < 180 ? halfTan(fov) / halfTan(REFERENCE_FOV) : 1);
export const ON_FEET = new Set(['alive', 'stand', 'crouch', 'roll']);

export const rowsFrom = (level) => ROWS_FROM[level] ?? ROWS_FROM.high;

export function bandOf(distance, was, from) {
  if (!(from > 0) || !Number.isFinite(distance)) return 'figure';
  if (was === 'row') return distance < from * BACK ? 'figure' : 'row';
  return distance > from ? 'row' : 'figure';
}

export const onFeet = (e) => ON_FEET.has(e?.state);

export const wantsRows = (flags, renderer) => flags?.get('rows') === 'on' && canDrawRows(renderer);
