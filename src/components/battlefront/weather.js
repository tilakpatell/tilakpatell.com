// Lane 0's lighting rulebook (maps/<level>.lighting.json) into the shapes
// lane R's light stack takes (src/lib/three/light/apply.js): a weather's
// VisualEnvironment components as `entry.record` (the fields readEntry
// reads, by the game's names), and the placed lights as lights.json binned
// by 128 m cell in the export's frame (placed.js). Pure.
//
//   unflatten(raw) → { Field: number | [x, y, z(, w)] }: a record's flat
//     `Field.x` keys folded back, its transform and source left out
//   entryFor(lighting, name) → { name, record }
//   readLightRow(row) → { kind: 'point' | 'spot', pos, color, candela, range, cone?, dir? } | null
//   lightsJsonOf(rows, { cell }) → { format: 1, cell, cells }

import { lumensToCandela } from '../../lib/three/light/placed.js';

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
      TonemapComponentData: [{ ...tone, EV: w.exposure?.ev ?? tone.EV, ExposureCompensation: w.exposure?.compensation ?? tone.ExposureCompensation, MinEV: w.exposure?.minEv ?? tone.MinEV, MaxEV: w.exposure?.maxEv ?? tone.MaxEV, AutomaticExposure: true }],
      ColorCorrectionComponentData: [{ ColorGradingMaxHdrValue: w.grading?.maxHdr ?? 1 }],
      ...(w.ao?.raw ? { DynamicAOComponentData: [unflatten(w.ao.raw)] } : {}),
    },
  };
}

// the row's forward (lane 0: yaw = atan2(f.x, f.z), pitch = asin(f.y))
const forward = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];

// The record's Intensity is the lumens and its colour the tint: lane 0's
// rows carry colours up to 1,200 (a hangar spot's (497, 829, 1181)), which
// the extras reader (scripts/lib/bf2017-lights.mjs) folds into the strength;
// read that way here a hangar spot is 30,000 cd against the sun's 9 and
// the hangar draws white. The lumens go to candela over the sphere or the
// cone; a spot shines along its −forward
export function readLightRow(row) {
  const colour = row.colour ?? [1, 1, 1];
  const peak = Math.max(...colour);
  const lm = peak > 0 ? (row.intensity ?? 0) : 0;
  if (!(lm > 0)) return null;
  const base = { pos: row.at.slice(), color: colour.map((c) => c / peak), range: row.radius ?? 10 };
  if (row.kind === 'spot') {
    const outer = (row.outer ?? 60) * RAD;
    const inner = Math.min(outer, (row.inner ?? 0) * RAD);
    const f = forward(row.yaw ?? 0, row.pitch ?? 0);
    return { ...base, kind: 'spot', cone: [inner, outer], dir: f.map((v) => -v), candela: lumensToCandela(lm, 'spot', outer) };
  }
  return { ...base, kind: 'point', candela: lumensToCandela(lm, 'point') };
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
