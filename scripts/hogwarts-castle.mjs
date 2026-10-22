// The castle cut from Jzax's voxel Hogwarts (Sketchfab, CC-BY): the one
// model whose plan is the films' (the Great Hall along the cliff, the clock
// tower's courtyard, the viaduct, the covered bridge, the boathouse and its
// stair, the greenhouses, the Owlery), where every generated castle came out
// a castle but not this one. scripts/hogwarts-models.mjs calls `voxelDoc`
// for each tier; the rest (the size, the cut, the credit) is its usual way.
//
// Each face's palette colour names its class (scripts/lib/voxel-castle.mjs),
// the windows are found in the walls, the corners welded, and the whole
// simplified with each class's vertices its own (voxelDoc), so the classes
// meet without a crack at every tier. The voxel steps are left as they are:
// smoothed toward their slopes, the one-voxel walls and pinnacles melted.
//
//   node scripts/hogwarts-castle.mjs sheet [tris] [name]   one cut in the
//     classes' colours to scripts/gen3d/cache/stage/<name>.glb, to look at
//     before anything is cut for the site
//   node scripts/hogwarts-castle.mjs ground   the ground the castle needs
//     under it, read off its cut: src/components/hogwarts/world/castle/heroGround.js

import { getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSES, classOf, compact, findWindows, footprintGrid, opened, rectangles, weldPositions } from './lib/voxel-castle.mjs';
import { writeFile } from 'node:fs/promises';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const CACHE = join(ROOT, 'scripts', 'gen3d', 'cache');

// sRGB → linear, for a material's colour factor
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// The palette colour of each primitive's triangles, read from its strip
async function paletteOf(prim) {
  const tex = prim.getMaterial()?.getBaseColorTexture();
  const { data, info } = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
  const uv = prim.getAttribute('TEXCOORD_0');
  return (i) => {
    const px = Math.min(info.width - 1, Math.floor(uv.getElement(i, [0, 0])[0] * info.width));
    return [0, 1, 2].map((k) => data[px * info.channels + k]);
  };
}

// The whole model as one welded mesh with a class a triangle, in the
// scene's frame (the export's root turn applied).
const memo = new Map();
export async function classed(nio, file, { step }) {
  const key = `${file}|${step}`;
  if (memo.has(key)) return memo.get(key);
  const doc = await nio.read(file);
  const all = [];
  const cls = [];
  const names = Object.keys(CLASSES);
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices().getArray();
      const colour = await paletteOf(prim);
      const v = [0, 0, 0];
      for (let t = 0; t < idx.length; t += 3) {
        cls.push(names.indexOf(classOf(colour(idx[t]))));
        for (let k = 0; k < 3; k++) {
          pos.getElement(idx[t + k], v);
          all.push(m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]);
        }
      }
    }
  }
  const { verts, remap } = weldPositions(Float32Array.from(all), step / 8);
  const tris = Array.from(remap);
  const found = findWindows(verts, tris, Uint8Array.from(cls), names, { step });
  const out = { verts, tris, cls: found, names };
  memo.set(key, out);
  return out;
}

// One tier: a fresh Document, a primitive a class (named for it, drawn in
// its sheet colour, no normals or UVs), simplified to `tris` in all.
//
// The classes are simplified together, as one mesh whose vertices are split
// where two classes meet: meshopt reads a split of that kind as a seam and
// keeps both sides on one line, so a window never parts from its wall, while
// the castle as a whole goes down to its budget (holding each class's edges
// instead stalled it: every window is an edge). The error is in voxels
// (ErrorAbsolute), raised a step at a time until the budget is met, and the
// specks under it pruned.
export async function voxelDoc(nio, spec, tris) {
  const { verts, tris: all, cls, names } = await classed(nio, join(CACHE, 'sketchfab', spec.from), spec.voxel);
  await MeshoptSimplifier.ready;
  const byClass = names.map(() => []);
  for (let t = 0; t < cls.length; t++) {
    const [a, b, c] = [all[t * 3], all[t * 3 + 1], all[t * 3 + 2]];
    if (a === b || b === c || a === c) continue; // (welding folded it)
    byClass[cls[t]].push(a, b, c);
  }
  // one mesh, each class's vertices its own
  const positions = [];
  const indices = [];
  const vertexClass = [];
  byClass.forEach((t, c) => {
    if (!t.length) return;
    const part = compact(verts, t);
    const base = positions.length / 3;
    for (const v of part.positions) positions.push(v);
    for (const i of part.indices) indices.push(base + i);
    for (let k = 0; k < part.positions.length / 3; k++) vertexClass.push(c);
  });
  const P = Float32Array.from(positions);
  const I = Uint32Array.from(indices);
  let kept = I;
  for (const voxels of [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48]) {
    [kept] = MeshoptSimplifier.simplify(I, P, 3, tris * 3, voxels * spec.voxel.step, ['ErrorAbsolute', 'Prune']);
    if (kept.length <= tris * 3 * 1.05) break;
  }
  const doc = (await import('@gltf-transform/core')).Document;
  const out = new doc();
  const buffer = out.createBuffer();
  const mesh = out.createMesh('castle');
  names.forEach((name, c) => {
    const mine = [];
    for (let t = 0; t < kept.length; t += 3) if (vertexClass[kept[t]] === c) mine.push(kept[t], kept[t + 1], kept[t + 2]);
    if (!mine.length) return;
    const { positions: p, indices: i } = compact(P, mine);
    const [r, g, b] = CLASSES[name].colour;
    const mat = out.createMaterial(name).setBaseColorFactor([linear(r), linear(g), linear(b), 1]).setRoughnessFactor(0.9).setMetallicFactor(0);
    if (name === 'lamp') mat.setEmissiveFactor([1, 0.8, 0.45]);
    if (name === 'glass') mat.setRoughnessFactor(0.15);
    mesh.addPrimitive(
      out
        .createPrimitive()
        .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(p).setBuffer(buffer))
        .setIndices(out.createAccessor().setType('SCALAR').setArray(i).setBuffer(buffer))
        .setMaterial(mat),
    );
  });
  out.createScene('castle').addChild(out.createNode('castle').setMesh(mesh));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'sheet') {
  const { io } = await import('./gen3d/web.mjs');
  const { HEROES } = await import('../src/components/hogwarts/world/heroes.js');
  const nio = await io();
  const [, , , tris = 400000, name = 'castle-classes'] = process.argv;
  const d = await voxelDoc(nio, HEROES.castle, Number(tris));
  console.log(getBounds(d.getRoot().listScenes()[0]));
  await nio.write(join(CACHE, 'stage', `${name}.glb`), d);
}

// The castle's floor (the height its courts and terraces stand at, the
// most of its flat stone and lawn between `from` and `to`) and the ground
// it needs under it: each part on its own feet (a hall on its walls', the
// north wing on its terrace, the Owlery on its crag), the bridges and the
// viaduct let go (they span gorges), as rectangles a level each in the
// cut's frame.
async function ground(nio, { from = 35, to = 65 } = {}) {
  const doc = await nio.read(join(ROOT, 'public', 'models', 'hogwarts', 'castle', 'castle.hq.glb'));
  const tris = [];
  const flat = new Map();
  let lo = [Infinity, Infinity];
  let hi = [-Infinity, -Infinity];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const name = prim.getMaterial().getName();
      if (name === 'rock') continue; // (the boathouse's hill is ground of its own, down to the water)
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices().getArray();
      const v = [0, 0, 0];
      const at = (i) => (pos.getElement(i, v), [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]);
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [at(idx[t]), at(idx[t + 1]), at(idx[t + 2])];
        tris.push(...a, ...b, ...c);
        for (const p of [a, b, c]) {
          lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[2])];
          hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[2])];
        }
        // (an upward face's area, by its height to the decimetre)
        const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
        const len = Math.hypot(...n);
        if (len > 0 && n[1] / len > 0.98 && a[1] > from && a[1] < to && (name === 'stone' || name === 'grass' || name === 'earth')) {
          const y = Math.round(a[1] * 10) / 10;
          flat.set(y, (flat.get(y) ?? 0) + len / 2);
        }
      }
    }
  }
  const floor = [...flat].sort((a, b) => b[1] - a[1])[0][0];
  const grid = opened(footprintGrid(Float32Array.from(tris), { cell: 2, floor, bounds: [lo[0] - 4, lo[1] - 4, hi[0] + 4, hi[1] + 4] }), 3);
  const rects = rectangles(grid, { step: 1 }).map((r) => r.map((v) => Math.round(v)));
  const out = join(ROOT, 'src', 'components', 'hogwarts', 'world', 'castle', 'heroGround.js');
  // (eight a line: the file stays a hundred lines however many there are)
  const rows = [];
  for (let i = 0; i < rects.length; i += 8) rows.push(`  ${rects.slice(i, i + 8).map((r) => `[${r.join(', ')}]`).join(', ')},`);
  await writeFile(
    out,
    `// The ground the hero castle needs under it, in its cut's frame (metres:
// public/models/hogwarts/castle/castle.glb as cut, its footprint's middle
// on the origin, its foot on y = 0, +z toward the boathouse), read off the
// cut by scripts/hogwarts-castle.mjs ground: written by it, not by hand.
//
//   FLOOR: the height its courts and terraces stand at
//   CELL: the grid the rectangles were read off, metres
//   GROUND: [[x0, z0, x1, z1, y, solid], …]: the ground each part stands
//     on (a court on its lawn, a hall on its walls' feet, the north wing on
//     its terrace, the Owlery on its crag; its bridges and its viaduct left
//     out: they span gorges), as rectangles, each at its height; solid (1)
//     where there is no floor to walk, inside a building or a wall

export const FLOOR = ${floor};
export const CELL = 2;

export const GROUND = [
${rows.join('\n')}
];
`,
  );
  console.log(`floor ${floor} m; ${rects.length} rectangles → ${out}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'ground') {
  const { io } = await import('./gen3d/web.mjs');
  await ground(await io());
}
