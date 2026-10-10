// A level's volumetric light, from the game's records to the site's
// volumes.json (the fidelity design, "Lane V"; src/lib/three/light/
// volumetrics.js draws it).
//
// Two sources, either or both:
// - the level's `SimpleVolumetricsEntityData` (56 on Hoth), as lane L's
//   rulebook already reads them into `src/data/bf2017/maps/<level>.lighting.json`
//   (`rows.volumetrics[]`: `at`, `yaw` in radians, `size` (the transform's
//   axes' lengths, metres), `emission` (linear HDR), `exponent`, `scale`
//   (EmissionScale), `fade`, `_source`). A box whose glow falls off from
//   its centre by Exponent; Hoth's are cubes (7.2 m to 63 m on a side).
// - the map extras' `effects[]` (`web/maps/<level>/<name>.extras.json`):
//   each spawn's `effect` (the blueprint's name), `position`, `quaternion`
//   (x, y, z, w), `scale`, `sub`, `autoStart`. The ones named
//   `FX/.../FX_*LightCone*` (74 on Hoth: 62 `FX_Arctic_LightCone_04` and 12
//   `_02`, every one in the Content subworld, at the hangar's floor) are
//   cones. The game draws each as one quad (its ScalableEmitterDocument:
//   `EmittableType_Quad`, `EmittableAlignment_Direction` along world +Y,
//   `MaxCount 1`) textured with `T_LightCone_01_D`, so the cone here is the
//   volume that quad stands for: its base on the spawn, as wide as the
//   quad's `UpdateSizeXData`, its apex `UpdateSizeYData` above (the quad's
//   pivot is at its foot: `Pivot.y` -0.01), its colour the emitter's
//   `UpdateColorData`, its falloff across the width the
//   `UpdateAlphaLevelScaleData` exponent, faded out from
//   `CullFadeFarDistance − CullFadeFarRange` to `CullFadeFarDistance`
//   (coneShape). An effect whose emitter was not read is white at
//   CONE_EMISSION, a metre wide and CONE_HEIGHT tall.
//
// The output, per cell of the pack's frame:
//   { format: 1, cell, count, kinds, skipped, cells: { "cx,cz": [{ kind:
//     'cone' | 'box', pos, quat, scale, color, exponent, emission, fade?,
//     effect?, _source }] } }
// A cone's `scale` is [width, height, width] in metres, a box's its sides.
//
// coneShape(emitterAsset) → { width, height, color, exponent, fade, _source } ;
// readVolumetric(row) → volume ; readConeEffect(raw, shapes) → volume | { skip } ;
// rebase(volume, origin, yaw) ; volumesJson({ volumetrics, effects, shapes }, pack, { subworlds }) → json

import { keepSub } from './bf2017-lights.mjs';
import { cellOf as cellKey } from '../../src/lib/three/light/placed.js';

export const CELL = 128;
// A light cone's glow where the effect's emitters are not read yet: the
// level's own placed cones' most common EmissionScale (0.2 on Hoth, nine of
// 56), so a shaft is no brighter than the boxes beside it
export const CONE_EMISSION = 0.2;
// the cone's falloff across its width where the effect is not read: the
// volumetrics' Exponent on Hoth (2 on 49 of 56)
export const CONE_EXPONENT = 2;
export const CONE_HEIGHT = 5; // m: FX_Arctic_LightCone_04's quad, the commoner of Hoth's two
export const CONE_RE = /(^|\/)FX_[^/]*LightCone[^/]*$/i;

const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// [x, y, z, w] products
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const yawQuat = (yaw) => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];

export function readVolumetric(row) {
  return {
    kind: 'box',
    pos: row.at.map(Number),
    quat: yawQuat(Number(row.yaw ?? 0)),
    scale: (row.size ?? [1, 1, 1]).map(Number),
    color: (row.emission ?? [1, 1, 1]).map(Number),
    exponent: Number(row.exponent ?? 1),
    emission: row.scale == null ? 1 : Number(row.scale),
    ...(Array.isArray(row.fade) && row.fade[1] > 0 ? { fade: row.fade.map(Number) } : {}),
    _source: row._source ?? row.id ?? null,
  };
}

const byType = (asset, type) => (asset?.objects ?? []).filter((o) => o?.$type === type);
const refOf = (asset, v) => (v && typeof v.$ref === 'number' ? asset.objects[v.$ref] : null);
const valueOf = (asset, proc) => {
  const ev = refOf(asset, proc?.Pre);
  return ev?.Values ? Number(ev.Values.x) : null;
};

// A light cone's quad from its ScalableEmitterDocument (the asset as the
// bucket's data/ holds it): null when it is not one quad.
export function coneShape(asset) {
  const t = byType(asset, 'EmitterTemplateData')[0];
  if (!t || t.EmittableType !== 'EmittableType_Quad') return null;
  const base = valueOf(asset, byType(asset, 'UpdateSizeData')[0]) ?? 1;
  const w = valueOf(asset, byType(asset, 'UpdateSizeXData')[0]) ?? base;
  const h = valueOf(asset, byType(asset, 'UpdateSizeYData')[0]) ?? base;
  const c = byType(asset, 'UpdateColorData')[0]?.Color;
  const far = Number(t.CullFadeFarDistance ?? 0);
  return {
    width: w,
    height: h,
    color: c ? [c.x, c.y, c.z].map((v) => r4(Number(v))) : [1, 1, 1],
    exponent: Number(byType(asset, 'UpdateAlphaLevelScaleData')[0]?.Exponent ?? CONE_EXPONENT),
    fade: far > 0 ? [Math.max(0, far - Number(t.CullFadeFarRange ?? 0)), far] : null,
    _source: `${asset.name}#EmitterTemplateData`,
  };
}

const short = (name) => String(name).split('/').pop();

// shapes: { "FX_Arctic_LightCone_04": coneShape(...) } by the effect's short name
export function readConeEffect(raw, shapes = {}) {
  const name = String(raw?.effect ?? raw?.name ?? '');
  if (!CONE_RE.test(name)) return { skip: 'other' };
  if (!Array.isArray(raw.position)) return { skip: 'unplaced' };
  const s = Array.isArray(raw.scale) ? raw.scale.map(Number) : [1, 1, 1].map(() => Number(raw.scale ?? 1));
  const shape = shapes[short(name)] ?? null;
  const w = shape?.width ?? 1;
  const h = shape?.height ?? CONE_HEIGHT;
  return {
    kind: 'cone',
    pos: raw.position.map(Number),
    quat: (raw.quaternion ?? [0, 0, 0, 1]).map(Number),
    scale: [w * s[0], h * s[1], w * s[2]],
    color: shape?.color ?? [1, 1, 1],
    exponent: shape?.exponent ?? CONE_EXPONENT,
    emission: shape ? 1 : CONE_EMISSION,
    ...(shape?.fade ? { fade: shape.fade } : {}),
    effect: short(name),
    _source: shape?._source ?? name,
  };
}

// The game's frame to the pack's, as bf2017-lights.mjs rebases a light: the
// origin taken away, then turned by yaw about +Y (the orientation too).
export function rebase(v, origin = [0, 0, 0], yaw = 0) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const [x, y, z] = v.pos.map((p, i) => p - origin[i]);
  return { ...v, pos: [x * c + z * s, y, -x * s + z * c], quat: yaw ? qmul(yawQuat(yaw), v.quat) : v.quat };
}

const tidy = (v) => {
  const out = { kind: v.kind, pos: v.pos.map(r3), quat: v.quat.map(r4), scale: v.scale.map(r3), color: v.color.map(r4), exponent: v.exponent, emission: v.emission };
  if (v.fade) out.fade = v.fade;
  if (v.effect) out.effect = v.effect;
  out._source = v._source;
  return out;
};

// sources: { volumetrics: lighting.json's rows.volumetrics, effects: the
// extras' effects[], shapes: coneShape by effect name }; pack: lane L's level.json or { origin, yaw, cell, arena }
export function volumesJson({ volumetrics = [], effects = [], shapes = {} } = {}, pack = {}, { subworlds = null } = {}) {
  const cell = pack.cell ?? CELL;
  const reach = pack.arena ? pack.arena + cell : Infinity;
  const skipped = {};
  const kinds = { cone: 0, box: 0 };
  const cells = {};
  let count = 0;
  const count1 = (k) => (skipped[k] = (skipped[k] ?? 0) + 1);
  const put = (v) => {
    const at = rebase(v, pack.origin, pack.yaw);
    if (Math.abs(at.pos[0]) > reach || Math.abs(at.pos[2]) > reach) return count1('outside');
    (cells[cellKey(at.pos, cell)] ??= []).push(tidy(at));
    kinds[at.kind]++;
    count++;
  };
  for (const row of volumetrics) {
    if (!(row?.at?.length === 3)) count1('unplaced');
    else if (Number(row.scale ?? 1) <= 0 || !(row.emission ?? [1]).some((c) => c > 0)) count1('dark');
    else put(readVolumetric(row));
  }
  for (const raw of effects) {
    if (subworlds && raw?.sub != null && !keepSub(subworlds[raw.sub])) {
      if (CONE_RE.test(String(raw?.effect ?? raw?.name ?? ''))) count1('sub');
      continue;
    }
    const v = readConeEffect(raw, shapes);
    if (v.skip === 'other') continue; // (the other effects are lane X's)
    if (v.skip) count1(v.skip);
    else put(v);
  }
  return { format: 1, cell, count, kinds, skipped, cells };
}
