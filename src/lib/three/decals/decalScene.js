// A level's placed decals drawn cell by cell (the surfaces design, §5, lane
// Q4), from the decals.json beside its pack (scripts/bf2017-decals.mjs).
//
//   createDecals({ scene, pack, loader, tier, backend, volumes = true, three? }) → {
//     cell(cx, cz, targets) → Promise, drop(cx, cz), stats() → { draws, decals, textures, fallback },
//     setVisible(on), dispose() }
//
// - pack: decals.json ({ cells: { "cx,cz": [decal] }, files: { texture: path } })
// - loader(texture, file) → Promise<Texture>: once per texture, shared by
//   every cell
// - targets: what the cell's projected decals are cut from, [{ geometry,
//   matrix }] (its static instances: lane L's packCell draws with their
//   instance matrices)
// - backend: light/three.js's backendOf(renderer). Decals are node materials:
//   the classic renderer ('webgl') draws none. A volume decal draws as a box
//   that reads the depth where volume.js's VOLUME_BACKENDS say it can and
//   `volumes` is not false, else it is projected over its box like the rest
//   (Review Focus 3)
//
// One draw per texture per cell for the projected and one for the volume
// boxes (Review Focus 4). Low draws none.

import { decalNodes, lookOf } from './look.js';
import { DECAL_ORDER, buildProjected, groupByTexture, loadDecalThree } from './projected.js';
import { volumeBatch, volumeMaterial, volumeOk } from './volume.js';

// the tiers that draw decals (low keeps the GLB's surfaces only)
export const DECAL_TIERS = ['mid', 'high', 'ultra'];
// the projected decals' polygon offset, factor and units: pulled toward the
// camera past the surface they were cut from (Review Focus 5)
export const POLYGON_OFFSET = -4;
// a decal's roughness: the game's decal shaders bind no roughness of their
// own here; a scorch or a streak is matte
const DECAL_ROUGHNESS = 0.8;

export function createDecals({ scene, pack, loader, tier = 'high', backend = 'webgpu', volumes: boxes = true, three = null }) {
  const on = DECAL_TIERS.includes(tier) && backend !== 'webgl' && !!pack?.cells;
  const ready = three ? Promise.resolve(three) : loadDecalThree();
  const cells = new Map(); // "cx,cz" → { promise, done: { meshes, decals, fallback } once built, dropped }
  const textures = new Map(); // name → Promise<Texture>
  const materials = new Map(); // key → material
  let root = null;
  let box = null;
  let disposed = false;

  const textureOf = (name) => {
    if (!textures.has(name)) textures.set(name, Promise.resolve(loader(name, pack.files?.[name] ?? null)));
    return textures.get(name);
  };

  function materialOf(key, make) {
    if (!materials.has(key)) materials.set(key, make());
    return materials.get(key);
  }

  async function build(key, targets) {
    const t = await ready;
    const { THREE } = t;
    const list = pack.cells[key] ?? [];
    const volumes = boxes && volumeOk(backend) ? list.filter((d) => d.kind === 'volume') : [];
    const flat = list.filter((d) => !volumes.includes(d));
    const maps = new Map(await Promise.all([...new Set(list.map((d) => d.texture))].map(async (n) => [n, await textureOf(n)])));
    if (disposed) return { meshes: [], decals: 0, fallback: 0 };
    root ??= Object.assign(new THREE.Group(), { name: 'decals' });
    if (!root.parent) scene.add(root);
    const projectedMaterial = (name) =>
      materialOf(`p|${name}`, () => {
        const m = new THREE.MeshStandardNodeMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: POLYGON_OFFSET, polygonOffsetUnits: POLYGON_OFFSET, roughness: DECAL_ROUGHNESS });
        const nodes = decalNodes(maps.get(name), lookOf(name), t.tsl.uv(), 1, t.tsl);
        m.colorNode = nodes.colorNode;
        m.opacityNode = nodes.opacityNode;
        return m;
      });
    const { meshes } = buildProjected(flat, targets, { ...t, materialFor: projectedMaterial });
    if (volumes.length) box ??= new THREE.BoxGeometry(1, 1, 1);
    for (const [name, group] of groupByTexture(volumes)) {
      const m = materialOf(`v|${name}`, () => volumeMaterial(maps.get(name), t, lookOf(name)));
      const mesh = volumeBatch(group, m, box, t);
      mesh.renderOrder = DECAL_ORDER;
      meshes.push(mesh);
    }
    for (const m of meshes) root.add(m);
    return { meshes, decals: list.length, fallback: list.filter((d) => d.kind === 'volume').length - volumes.length };
  }

  // a cell's draws out of the scene, their geometry freed (the cuts, and the
  // volume batches' box copies with their instanced attributes)
  function free({ meshes }) {
    for (const m of meshes) {
      root?.remove(m);
      m.geometry.dispose();
      if (m.isInstancedMesh) m.dispose();
    }
  }

  return {
    cell(cx, cz, targets = []) {
      const key = `${cx},${cz}`;
      if (!on || !pack.cells[key]?.length) return Promise.resolve();
      if (!cells.has(key)) {
        const c = { done: null, dropped: false };
        c.promise = build(key, targets).then((r) => {
          c.done = r;
          if (c.dropped) free(r);
          return r;
        });
        cells.set(key, c);
      }
      return cells.get(key).promise;
    },
    drop(cx, cz) {
      const key = `${cx},${cz}`;
      const c = cells.get(key);
      if (!c) return;
      cells.delete(key);
      c.dropped = true;
      // (a built cell goes now; one still building goes when it lands)
      if (c.done) free(c.done);
    },
    setVisible(on) {
      if (root) root.visible = on;
    },
    stats() {
      const out = { draws: 0, decals: 0, textures: textures.size, fallback: 0 };
      for (const c of cells.values()) {
        if (!c.done) continue;
        out.draws += c.done.meshes.length;
        out.decals += c.done.decals;
        out.fallback += c.done.fallback;
      }
      return out;
    },
    dispose() {
      disposed = true;
      for (const key of [...cells.keys()]) this.drop(...key.split(',').map(Number));
      for (const m of materials.values()) m.dispose();
      box?.dispose();
      root?.removeFromParent();
    },
  };
}
