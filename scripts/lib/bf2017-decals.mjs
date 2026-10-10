// A level's placed decals, from the game's map extras to the site's
// decals.json (the surfaces design, §5, lane Q4).
//
// The input is `web/maps/<level>/<name>.extras.json`'s `decals[]`, as the
// bucket's maps README describes them: every one a box, the unit cube
// scaled by `scale`, at `position` and `quaternion` (x, y, z, w) in the
// models' frame, with `sub` (the manifest's subworld). Two kinds:
// - `projected` (3,332 across the drop): `shader` names the decal shader,
//   whose textures are the extras' `shaderTextures[shader]`; `atlasTile`
//   picks a tile of the texture (its indices counting from 1);
// - `volume` (10,652): `template` names an EnvironmentDecalVolumeTemplateData
//   in `decalTemplates` (its `Shader.Shader` binds the textures), `row` and
//   `column` a cell of its atlas, `alpha`, `enabled`.
// `textureFiles` maps each texture name to its KTX2 in the bucket's web
// build.
//
// The output, per cell of the level pack's frame (lane L's 128 m):
//   { format: 1, cell, count, kinds, skipped, textures: [name], files: { name: ktx2 },
//     cells: { "cx,cz": [{ kind, position, quaternion, size, normal, texture,
//       opacity, tile?, shader?, template? }] } }
// `normal` is the axis the box projects along (AXIS) turned into the pack's
// frame; its sign is not the record's to give (Naboo_01's projected boxes
// point it up and down alike), so the drawing pushes off the surface's own
// normal, not this.
//
// What the site draws is the decal's colour: a decal whose shader binds no
// colour map (the normal-only volume decals bind T_DefaultBlack) is left
// out and counted as `texture`.
//
// readDecal(raw, extras) → decal | { skip } ; rebaseDecal(decal, origin, yaw) ;
// colourOf(textureNames) → name | null ; decalsOf(extras, pack, { subworlds }) → json

import { CELL, cellOf, keepSub } from './bf2017-lights.mjs';

// The box's axis a decal projects along, by kind (the records do not say;
// read from them on 2026-10-10): a projected decal's X, since on
// Naboo_01's floors local X is the vertical axis of 30 of the 41 streaks
// and their Y × Z faces have the streak sheet's tall tiles' shape (1 : 2 to
// 1 : 3); a volume decal's Y, since Endor_01's ground boxes are thin in Y
// (10.9 × 1.51 × 10.9 m) and 19 of its 23 have Y up
export const AXIS = { projected: [1, 0, 0], volume: [0, 1, 0] };

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// a texture bound only for the shader's own maths, not the decal's colour:
// the engine's defaults, the black-body ramps, the noise arrays, masks
const NOT_COLOUR = /(^|\/)shaders\/|T_Default|Ramp|Noise|Perlin|_M$/i;
// the colour maps' suffixes in the drop (`_RGB`, `_RGBA`, `_C`, `_CS`, `_D`)
const COLOUR = /_(RGBA?|C|CS|D)(_\d+)?$/i;

export function colourOf(names = []) {
  const left = names.filter((n) => !NOT_COLOUR.test(n));
  return left.find((n) => COLOUR.test(n)) ?? left[0] ?? null;
}

// a vector turned by a unit quaternion [x, y, z, w]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function turn(v, [x, y, z, w]) {
  const q = [x, y, z];
  const t = cross(q, v).map((c) => 2 * c);
  const u = cross(q, t);
  return [v[0] + w * t[0] + u[0], v[1] + w * t[1] + u[1], v[2] + w * t[2] + u[2]];
}
// a · b for quaternions [x, y, z, w]
const qmul = ([ax, ay, az, aw], [bx, by, bz, bw]) => [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];

export function readDecal(raw, extras = {}) {
  if (!raw || raw.enabled === false) return { skip: 'off' };
  const quaternion = (raw.quaternion ?? [0, 0, 0, 1]).map(Number);
  const base = { kind: raw.type, position: raw.position.map(Number), quaternion, size: (raw.scale ?? [1, 1, 1]).map((s) => Math.abs(Number(s))), normal: turn(AXIS[raw.type] ?? AXIS.projected, quaternion) };
  if (raw.type === 'projected') {
    const texture = colourOf(extras.shaderTextures?.[raw.shader]);
    if (!texture) return { skip: 'texture' };
    const out = { ...base, texture, opacity: 1, shader: raw.shader };
    // (TileIndex counts from 1: Naboo_01's streaks name 2, 2 of a 2 × 2
    // sheet; 0 is read as the first)
    const a = raw.atlasTile;
    const first = (i, n) => Math.min(n - 1, Math.max(0, Math.round(i) - 1));
    if (a && (a.TileCountX > 1 || a.TileCountY > 1)) out.tile = [first(a.TileIndexX, a.TileCountX), first(a.TileIndexY, a.TileCountY), a.TileCountX, a.TileCountY];
    return out;
  }
  if (raw.type === 'volume') {
    const shader = extras.decalTemplates?.[raw.template]?.Shader?.Shader;
    const texture = colourOf(extras.shaderTextures?.[shader]);
    if (!texture) return { skip: 'texture' };
    return { ...base, texture, opacity: Number(raw.alpha ?? 1), template: raw.template, ...(raw.row || raw.column ? { cellRC: [raw.row ?? 0, raw.column ?? 0] } : {}) };
  }
  return { skip: 'kind' };
}

// The game's frame to the pack's: the origin taken away, then turned by yaw
// (radians) about +Y, as lane L's rebase does the instances and
// bf2017-lights.mjs the lights
export function rebaseDecal(decal, origin = [0, 0, 0], yaw = 0) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  const yawQ = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  return { ...decal, position: rot(decal.position.map((v, i) => v - origin[i])), quaternion: qmul(yawQ, decal.quaternion), normal: rot(decal.normal) };
}

const tidy = (d) => {
  const out = { kind: d.kind, position: d.position.map(r2), quaternion: d.quaternion.map(r4), size: d.size.map(r2), normal: d.normal.map(r4), texture: d.texture, opacity: r2(d.opacity) };
  for (const k of ['tile', 'cellRC', 'shader', 'template']) if (d[k] != null) out[k] = d[k];
  return out;
};

// pack: lane L's level.json, or { origin, yaw, cell, arena } (arena: the
// half-size kept round the origin, a cell's margin added; none keeps all)
export function decalsOf(extras, pack = {}, { subworlds = null } = {}) {
  const cell = pack.cell ?? CELL;
  const reach = pack.arena ? pack.arena + cell : Infinity;
  const skipped = {};
  const kinds = { projected: 0, volume: 0 };
  const cells = {};
  const textures = new Set();
  let count = 0;
  const skip = (why) => (skipped[why] = (skipped[why] ?? 0) + 1);
  for (const raw of extras?.decals ?? []) {
    if (subworlds && !keepSub(subworlds[raw.sub])) {
      skip('sub');
      continue;
    }
    const d = readDecal(raw, extras);
    if (d.skip) {
      skip(d.skip);
      continue;
    }
    const at = rebaseDecal(d, pack.origin, pack.yaw);
    if (Math.abs(at.position[0]) > reach || Math.abs(at.position[2]) > reach) {
      skip('outside');
      continue;
    }
    (cells[cellOf(at.position, cell)] ??= []).push(tidy(at));
    textures.add(at.texture);
    kinds[at.kind]++;
    count++;
  }
  const names = [...textures].sort();
  const files = Object.fromEntries(names.map((n) => [n, extras?.textureFiles?.[n] ?? null]));
  return { format: 1, cell, count, kinds, skipped, textures: names, files, cells };
}
