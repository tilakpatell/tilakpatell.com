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
// The distance is the plain one from the eye to the soldier's feet. The
// game measures to the body's sphere and scales by the field of view
// (tan(fovY / 2) / tan(27.5°), 1 at the 55° every soldier camera here has).
//
// A soldier is a row past ROWS_FROM and a figure again inside BACK of it, so
// one walking the line does not change every step. Only the living on their
// feet are rows: a soldier dying, down, or in any state not named in
// ON_FEET is a figure, with its ragdoll, its death clip and whatever a new
// state brings.
//
//   rowsFrom(level) → metres
//   bandOf(distance, was, from) → 'figure' | 'row'
//   onFeet(entity) → boolean

export const ROWS_FROM = { low: 22, mid: 39, high: 62, ultra: 91 };
export const BACK = 0.9;
export const ON_FEET = new Set(['alive', 'stand', 'crouch', 'roll']);

export const rowsFrom = (level) => ROWS_FROM[level] ?? ROWS_FROM.high;

export function bandOf(distance, was, from) {
  if (!(from > 0) || !Number.isFinite(distance)) return 'figure';
  if (was === 'row') return distance < from * BACK ? 'figure' : 'row';
  return distance > from ? 'row' : 'figure';
}

export const onFeet = (e) => ON_FEET.has(e?.state);
