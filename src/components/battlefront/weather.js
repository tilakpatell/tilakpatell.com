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
//     (null for a lamp the frame never draws: off, or the bounce's only, lighting neither the
//     diffuse nor the specular; its Dimmer and ExposureCompensation scale its lumens)
//   lightsJsonOf(rows, { cell }) → { format: 1, cell, cells }
//   prefabRows(lighting) → the lamps inside the lighting prefabs (Hoth: 414 placed), each in the
//     export's frame by its placement's whole turn (the rulebook's `basis`), as rows
//   lampRows(lighting) → the level's lamps: its own and its prefabs'
//
// (the rulebook's reader is lib/three/light/lighting.js's, shared with the
// galaxy surface; the names here are kept)
//
//   packToWorld(pack, [x, y, z]) → the export's frame; probeVolumesOf(probes, pack) → probes.js's
//     volumes ({ min, max, id, faces }); volumesToWorld(json, pack) → volumes.json in the export's frame

import { CELL } from '../../lib/three/light/lighting.js';

export { CELL, entryFor, lampRows, lightsJsonOf, prefabRows, readLightRow, unflatten } from '../../lib/three/light/lighting.js';

// A pack's frame (lane L's: the origin taken away, turned by yaw) back to the export's
export function packToWorld(pack, [x, y, z]) {
  const [ox, oy, oz] = pack?.origin ?? [0, 0, 0];
  const c = Math.cos(pack?.yaw ?? 0);
  const s = Math.sin(pack?.yaw ?? 0);
  return [x * c - z * s + ox, y + oy, x * s + z * c + oz];
}

// a pack's reflection volumes (probes.json: a centre and three half axes) as probes.js's boxes
export function probeVolumesOf(probes, pack) {
  return (probes?.probes ?? []).map((p) => {
    const c = packToWorld(pack, p.centre);
    // (each half axis turned into the export's frame: packToWorld without the origin)
    const o = packToWorld(pack, [0, 0, 0]);
    const axes = p.axes.map((a) => packToWorld(pack, a).map((v, k) => v - o[k]));
    const half = [0, 1, 2].map((k) => axes.reduce((sum, a) => sum + Math.abs(a[k]), 0));
    // (and the cube's own radiance summary, the game's nits: lane G's zenith, horizon and ground)
    return { id: p.id, faces: p.faces, ultra: p.ultra ?? null, min: c.map((v, k) => v - half[k]), max: c.map((v, k) => v + half[k]), zenith: p.zenith ?? null, horizon: p.horizon ?? null, ground: p.ground ?? null };
  });
}

// volumes.json (scripts/bf2017-volumes.mjs: per 128 m cell of the pack's frame) in the export's frame
export function volumesToWorld(json, pack, { cell = CELL } = {}) {
  if (!json?.cells) return null;
  const yaw = pack?.yaw ?? 0;
  // (a yaw about +Y as a quaternion, for the cones' turn)
  const q = [0, -Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  const mul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const cells = {};
  for (const list of Object.values(json.cells)) {
    for (const v of list) {
      const pos = packToWorld(pack, v.pos);
      const out = { ...v, pos, ...(v.quat && yaw ? { quat: mul(q, v.quat) } : {}) };
      (cells[`${Math.floor(pos[0] / cell)},${Math.floor(pos[2] / cell)}`] ??= []).push(out);
    }
  }
  return { ...json, cell, cells };
}
