// The mode part's table split (map/doors.js's `controlled`): the instances
// the doors and the state props move or switch, taken out of the pack's far
// table (the still mode art the level scene draws) and out of its cells (the
// fixed shapes the collision builds), so map/doorsScene.js draws and moves
// them itself. Pure: lane L's 32-byte records in, the same out.
//
//   matcher(pack, controlled) → (mesh index, [x, y, z]) → the controlled row, or null
//     (by the mesh's name and its place in the pack's frame, within 2 cm)
//   splitTable(pack, bin, match) → { bin, draws, rows }: the far table without them
//     (draws with their offsets and cells counted again) and them, each
//     { mesh, mirrored, position, quaternion, scale, is } (is: the controlled row)
//   splitCell(draws, bin, match) → [{ mesh, position, quaternion, scale }]: a cell's
//     instances without them (lane P0's createLevelPhysics takes such a list)

import { readInstances, writeInstances } from '../../../lib/level/instances.js';
import { instancesOf } from '../../galaxy/shared/level.js';

const NEAR = 0.02; // m

export function matcher(pack, controlled) {
  const byName = new Map();
  for (const c of controlled) (byName.get(c.mesh) ?? byName.set(c.mesh, []).get(c.mesh)).push(c);
  const names = (pack.meshes ?? []).map((m) => m.name);
  return (mesh, p) => {
    for (const c of byName.get(names[mesh]) ?? []) if (Math.abs(c.at[0] - p[0]) < NEAR && Math.abs(c.at[1] - p[1]) < NEAR && Math.abs(c.at[2] - p[2]) < NEAR) return c;
    return null;
  };
}

// the cell each instance of a draw is in (its `cells`: key → [first, count] within it)
function cellsOf(d) {
  const out = new Array(d.count).fill(null);
  for (const [key, [first, count]] of Object.entries(d.cells ?? {})) for (let k = first; k < first + count && k < d.count; k++) out[k] = key;
  return out;
}

export function splitTable(pack, bin, match) {
  const inst = readInstances(bin);
  const keep = [];
  const draws = [];
  const rows = [];
  for (const d of pack.far?.draws ?? []) {
    const cells = cellsOf(d);
    const kept = [];
    for (let i = d.offset; i < d.offset + d.count && i < inst.count; i++) {
      const position = Array.from(inst.position.subarray(i * 3, i * 3 + 3));
      const is = match(d.mesh, position);
      if (is) rows.push({ mesh: d.mesh, mirrored: d.mirrored, position, quaternion: Array.from(inst.quaternion.subarray(i * 4, i * 4 + 4)), scale: Array.from(inst.scale.subarray(i * 3, i * 3 + 3)), is });
      else kept.push([i, cells[i - d.offset]]);
    }
    if (!kept.length) continue;
    const draw = { ...d, offset: keep.length, count: kept.length };
    if (d.cells) {
      // (the kept rows stay in their cells' order: each cell's run counted again)
      const runs = {};
      kept.forEach(([, key], k) => {
        if (!key) return;
        if (!runs[key]) runs[key] = [k, 0];
        runs[key][1]++;
      });
      draw.cells = runs;
    }
    draws.push(draw);
    for (const [i] of kept) keep.push(i);
  }
  const out = { count: keep.length, position: new Float32Array(keep.length * 3), quaternion: new Float32Array(keep.length * 4), scale: new Float32Array(keep.length * 3) };
  keep.forEach((i, j) => {
    out.position.set(inst.position.subarray(i * 3, i * 3 + 3), j * 3);
    out.quaternion.set(inst.quaternion.subarray(i * 4, i * 4 + 4), j * 4);
    out.scale.set(inst.scale.subarray(i * 3, i * 3 + 3), j * 3);
  });
  return { bin: writeInstances(out), draws, rows };
}

export function splitCell(draws, bin, match) {
  return instancesOf(draws, bin).filter((i) => !match(i.mesh, i.position));
}
