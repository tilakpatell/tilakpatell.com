// A level's lighting rulebook (lane 0's maps/<level>.lighting.json, its
// `rows`) into the shapes this stack takes (apply.js): a weather's
// VisualEnvironment components as `entry.record` (the fields readEntry
// reads, by the game's names), and the placed lights as lights.json binned
// by 128 m cell in the export's frame (placed.js). Pure. Moved here from
// the Battlefront world's weather.js (which re-exports it) so the galaxy
// surface draws Hoth under the same records.
//
//   unflatten(raw) → { Field: number | [x, y, z(, w)] }: a record's flat
//     `Field.x` keys folded back, its transform and source left out
//   entryFor(lighting, name) → { name, record }
//   readLightRow(row) → { kind: 'point' | 'spot', pos, color, candela, range, cone?, dir? } | null
//     (null for a lamp the frame never draws: off, or the bounce's only, lighting neither the
//     diffuse nor the specular; its Dimmer and ExposureCompensation scale its lumens)
//   lightsJsonOf(rows, { cell }) → { format: 1, cell, cells }
//   prefabRows(lighting) → the lamps inside the lighting prefabs (Hoth: 414 placed), each in the
//     export's frame by its placement's whole turn (the rulebook's `basis`), as rows
//   lampRows(lighting) → the level's lamps: its own and its prefabs'

import { lumensToCandela } from './placed.js';

const AXES = ['x', 'y', 'z', 'w'];
const RAD = Math.PI / 180;
export const CELL = 128; // m: lane L's cell, placed.js's

export function unflatten(raw = {}) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_') || k.startsWith('Transform.')) continue;
    const m = /^(.+)\.([xyzw])$/.exec(k);
    if (!m) {
      out[k] = v;
      continue;
    }
    const arr = Array.isArray(out[m[1]]) ? out[m[1]] : (out[m[1]] = []);
    arr[AXES.indexOf(m[2])] = v;
  }
  return out;
}

export function entryFor(lighting, name) {
  const w = lighting.weathers[name] ?? lighting.weathers[lighting.default];
  const tone = unflatten(w.bloom?.raw);
  return {
    name: w.ve,
    record: {
      OutdoorLightComponentData: [unflatten(w.sun?.raw)],
      SkyComponentData: [unflatten(w.sky?.raw)],
      // (Enable and HeightFogEnable are in the record's field flags, not its
      // fields: Hoth's three weathers have both on, as the extras say)
      FogComponentData: [{ ...unflatten(w.fog?.raw), Enable: true, HeightFogEnable: true }],
      TonemapComponentData: [{ ...tone, EV: w.exposure?.ev ?? tone.EV, ExposureCompensation: w.exposure?.compensation ?? tone.ExposureCompensation, ClampEV: w.exposure?.clampEv ?? tone.ClampEV, MinEV: w.exposure?.minEv ?? tone.MinEV, MaxEV: w.exposure?.maxEv ?? tone.MaxEV, AutomaticExposure: true }],
      ColorCorrectionComponentData: [{ ColorGradingMaxHdrValue: w.grading?.maxHdr ?? 1 }],
      ...(w.ao?.raw ? { DynamicAOComponentData: [unflatten(w.ao.raw)] } : {}),
    },
  };
}

// the row's forward (lane 0: yaw = atan2(f.x, f.z), pitch = asin(f.y))
const forward = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];

// The lamp's strength as the live image's LightRenderDB.cpp::convertToLightInfo
// makes it (bf2-re findings 60 §4): FUN_146f63040 multiplies the record's
// Color, as held, by Φ / (area · π), the area FUN_146f63430's 4 for a
// punctual light (SphereRadius / DiscRadius 0: every lamp on Hoth), so
// each channel is Color × Intensity / 4π candela, a spot's as a sphere's
// (its cone masks the light; it does not gather it). Read so, the lamps'
// direct light over each of Echo Base's six reflection volumes comes to 7 to
// 58 nits against the game's own captures of the same rooms, 90 to 370
// (the captures hold the bounce too); with the colour taken as a tint over
// its brightest channel it came to 0.1 to 15 (lightsBaseCheck in the test).
// Three takes the colour over its brightest channel and that channel's
// candela. A spot shines along its −forward. Dimmer and
// ExposureCompensation scale the lumens (hand: the renderer's last multiplier,
// the light's +0x8c, is not tied to either; Hoth's lamps have EC 0 and two
// a Dimmer of 0.753).
export function readLightRow(row) {
  if (row.enabled === false || (row.affect && row.affect.diffuse === false && row.affect.specular === false)) return null;
  const colour = row.colour ?? [1, 1, 1];
  const peak = Math.max(...colour);
  const lm = peak > 0 ? (row.intensity ?? 0) * (row.dimmer ?? 1) * 2 ** (row.ec ?? 0) : 0;
  if (!(lm > 0)) return null;
  const base = { pos: row.at.slice(), color: colour.map((c) => c / peak), range: row.radius ?? 10, candela: lumensToCandela(lm, 'point') * peak };
  if (row.kind === 'spot') {
    const outer = (row.outer ?? 60) * RAD;
    const inner = Math.min(outer, (row.inner ?? 0) * RAD);
    const f = forward(row.yaw ?? 0, row.pitch ?? 0);
    return { ...base, kind: 'spot', cone: [inner, outer], dir: f.map((v) => -v) };
  }
  return { ...base, kind: 'point' };
}

export function lightsJsonOf(rows, { cell = CELL } = {}) {
  const cells = {};
  for (const row of rows) {
    const l = readLightRow(row);
    if (!l) continue;
    (cells[`${Math.floor(l.pos[0] / cell)},${Math.floor(l.pos[2] / cell)}`] ??= []).push(l);
  }
  return { format: 1, cell, cells };
}

// a placement's 3×3 (right, up, forward) on a vector; a placement without one turns by its yaw
const turnBy = (basis, yaw, v) =>
  basis
    ? [0, 1, 2].map((k) => basis[0][k] * v[0] + basis[1][k] * v[1] + basis[2][k] * v[2])
    : [v[0] * Math.cos(yaw ?? 0) + v[2] * Math.sin(yaw ?? 0), v[1], -v[0] * Math.sin(yaw ?? 0) + v[2] * Math.cos(yaw ?? 0)];

export function prefabRows(lighting) {
  const out = [];
  for (const p of lighting?.prefabs ?? []) {
    for (const l of lighting.prefabLights?.[p.name] ?? []) {
      const at = turnBy(p.basis, p.yaw, l.at).map((v, k) => v + p.at[k]);
      const f = turnBy(p.basis, p.yaw, forward(l.yaw ?? 0, l.pitch ?? 0));
      out.push({ ...l, id: `${p.id}/${l.id}`, at, yaw: Math.atan2(f[0], f[2]), pitch: Math.asin(Math.max(-1, Math.min(1, f[1]))) });
    }
  }
  return out;
}

export const lampRows = (lighting) => [...(lighting?.lights ?? []), ...prefabRows(lighting)];
