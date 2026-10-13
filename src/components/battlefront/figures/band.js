// Where a soldier stops being a figure and becomes a row (figures.js hands
// it to lib/three/figureRows): past the distance at which the game puts a
// character on its last mesh LOD. From there the game itself runs only a
// soldier's locomotion and weapon pose (ant/layers/3P.Soldier.Layer.json:
// every other layer is off by 57.5 m) and casts no shadow from it (the
// character LOD group's ShadowDistance, 80 m), so nothing a figure has that
// a row lacks is seen out there.
//
// ROWS_FROM is the game's last character LOD distance, 52 m
// (LodGroups/LodGroupCharacters.json, Lod6Distance), times Mesh.GlobalLodScale
// at each preset: 0.425, 0.75, 1.2, 1.75 (Low to Ultra). That the scale
// multiplies the table is two notes' reading and not yet read in the game's
// code; this table is the one place it is used.
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
