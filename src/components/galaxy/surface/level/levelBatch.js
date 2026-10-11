// The level's static instances as BatchedMesh (fidelity lane U): one draw
// per material per band, where lane L's levelScene.js draws one
// InstancedMesh per LOD file, side and part. A part (a GLB mesh at one LOD,
// mirrored or not) joins the batch of its material's key and its band
// ('arena': the pack's far table, the whole arena; 'horizon': the horizon's
// table): its geometry is added once, and its instances are added to,
// moved in and deleted from the batch as the table is sorted, never with
// the batch's geometry built again. A batch's instance capacity grows by
// the pack's own count of the mesh's instances (`countOf`) as each mesh
// first joins it, and its vertex and index room double when a geometry
// does not fit (setGeometrySize copies; nothing is rebuilt from the GLBs).
//
// Two materials are one key when they draw the same: a classic material by
// its type, its maps (the pack's shared texture cache hands every LOD of a
// mesh the same texture objects) and its scalars; a node material only by
// itself, unless it carries userData.batchKey (a game material's recipe
// and maps would: lane Q1's to set). A part a batch cannot hold (an array
// of materials, geometry groups, attributes unlike the batch's) says so
// (`batchable` false) and stays on the InstancedMesh path.
//
//   createBatches(root, { countOf }) → { set(part, matrices, band) → boolean, clear(part, band?),
//     idsOf(part, band), meshOf(part, band), stats() → { calls, instances, batches, bands }, each(fn), dispose() }
//   (root(band) → the Object3D a band's batches go under)
//   materialKey(material) → string;  attributeKey(geometry) → string
//   batchable(part) → boolean

import * as THREE from "three";

// vertices and indices a new batch reserves before it first grows
const START_VERTS = 4096;
const SCALARS = [
  "color",
  "emissive",
  "emissiveIntensity",
  "roughness",
  "metalness",
  "opacity",
  "transparent",
  "alphaTest",
  "side",
  "vertexColors",
  "flatShading",
  "depthWrite",
  "normalScale",
  "aoMapIntensity",
  "envMapIntensity",
];

let ids = 0;
const own = new WeakMap(); // a material keyed by itself

export function materialKey(m) {
  if (m.userData?.batchKey) return `k:${m.userData.batchKey}`;
  if (m.isNodeMaterial) {
    if (!own.has(m)) own.set(m, `n:${++ids}`);
    return own.get(m);
  }
  const parts = [m.type];
  for (const [k, v] of Object.entries(m))
    if (v?.isTexture) parts.push(`${k}=${v.uuid}`);
  for (const k of SCALARS) {
    const v = m[k];
    if (v === undefined) continue;
    parts.push(
      `${k}=${v?.isColor ? v.getHexString() : v?.isVector2 ? `${v.x},${v.y}` : v}`,
    );
  }
  return parts.sort().join("|");
}

export function attributeKey(g) {
  return `${Object.keys(g.attributes).sort().join(",")}|${g.index ? "i" : "n"}`;
}

export function batchable(part) {
  const { geometry: g, material } = part;
  return (
    !Array.isArray(material) &&
    !(g.groups?.length > 1) &&
    Boolean(g.attributes.position)
  );
}

const vertsOf = (g) => g.attributes.position.count;
const indicesOf = (g) => (g.index ? g.index.count : 0);

export function createBatches(root, { countOf = () => 64 } = {}) {
  const batches = new Map(); // key → { mesh, geoms: Map(geometry → id), meshes: Set, verts, indices }
  const placed = new Map(); // part → Map band → { key, ids: [] }

  function batchFor(part, band) {
    const key = `${materialKey(part.material)}#${attributeKey(part.geometry)}#${band}`;
    let b = batches.get(key);
    if (!b) {
      const verts = Math.max(START_VERTS, vertsOf(part.geometry));
      const indices = Math.max(START_VERTS * 2, indicesOf(part.geometry));
      const mesh = new THREE.BatchedMesh(
        Math.max(8, countOf(part)),
        verts,
        indices,
        part.material,
      );
      mesh.name = `batch:${band}`;
      mesh.userData = { band };
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // (a batch spans the arena: its own sphere culls nothing, each instance is culled alone)
      mesh.frustumCulled = false;
      root(band).add(mesh);
      b = {
        key,
        band,
        mesh,
        geoms: new Map(),
        meshes: new Set(),
        verts,
        indices,
        usedVerts: 0,
        usedIndices: 0,
        capacity: 0,
      };
      batches.set(key, b);
    }
    return b;
  }

  function geometryIn(b, part) {
    const g = part.geometry;
    if (b.geoms.has(g)) return b.geoms.get(g);
    const v = vertsOf(g);
    const i = indicesOf(g);
    if (b.usedVerts + v > b.verts || b.usedIndices + i > b.indices) {
      while (b.usedVerts + v > b.verts) b.verts *= 2;
      while (b.usedIndices + i > b.indices) b.indices *= 2;
      b.mesh.setGeometrySize(b.verts, b.indices);
    }
    const id = b.mesh.addGeometry(g);
    b.usedVerts += v;
    b.usedIndices += i;
    b.geoms.set(g, id);
    return id;
  }

  // a part's instances out of its band's batch, or out of every band's
  function clear(part, band = null) {
    const bands = placed.get(part);
    if (!bands) return;
    for (const [k, at] of bands) {
      if (band && k !== band) continue;
      const b = batches.get(at.key);
      for (const id of at.ids) b.mesh.deleteInstance(id);
      bands.delete(k);
    }
    if (!bands.size) placed.delete(part);
  }
  const entryOf = (part, band) => placed.get(part)?.get(band) ?? null;

  return {
    // (matrices: the instances' world matrices, the part's local applied)
    set(part, matrices, band) {
      if (!batchable(part)) return false;
      if (!matrices.length) {
        clear(part, band);
        return true;
      }
      const b = batchFor(part, band);
      // (a material swapped since: out of the old batch)
      if (entryOf(part, band) && entryOf(part, band).key !== b.key)
        clear(part, band);
      let entry = entryOf(part, band);
      if (!entry) {
        if (!placed.has(part)) placed.set(part, new Map());
        placed.get(part).set(band, (entry = { key: b.key, ids: [] }));
      }
      const geom = geometryIn(b, part);
      if (!b.meshes.has(part.packMesh ?? part)) {
        b.meshes.add(part.packMesh ?? part);
        // (the batch holds every instance of each mesh in it, as the pack counts them)
        b.capacity += countOf(part);
        if (b.capacity > b.mesh.maxInstanceCount)
          b.mesh.setInstanceCount(b.capacity);
      }
      // (more than the pack counted: the batch grows; the count is a floor)
      const more = matrices.length - entry.ids.length;
      if (more > 0 && b.mesh.instanceCount + more > b.mesh.maxInstanceCount)
        b.mesh.setInstanceCount(
          Math.max(b.mesh.maxInstanceCount * 2, b.mesh.instanceCount + more),
        );
      while (entry.ids.length < matrices.length)
        entry.ids.push(b.mesh.addInstance(geom));
      while (entry.ids.length > matrices.length)
        b.mesh.deleteInstance(entry.ids.pop());
      matrices.forEach((m, i) => b.mesh.setMatrixAt(entry.ids[i], m));
      return true;
    },
    clear,
    // fn(mesh, band) for each batch
    each(fn) {
      for (const b of batches.values()) fn(b.mesh, b.band);
    },
    // a part's instance ids in a band's batch, for setVisibleAt (occlusion.js)
    idsOf: (part, band) => entryOf(part, band)?.ids ?? [],
    meshOf: (part, band) => batches.get(entryOf(part, band)?.key)?.mesh ?? null,
    stats() {
      let calls = 0;
      let instances = 0;
      const bands = {};
      for (const b of batches.values()) {
        const n = b.mesh.instanceCount;
        if (!n) continue;
        calls++;
        instances += n;
        bands[b.band] = (bands[b.band] ?? 0) + 1;
      }
      return { calls, instances, batches: batches.size, bands };
    },
    dispose() {
      for (const b of batches.values()) {
        b.mesh.parent?.remove(b.mesh);
        b.mesh.dispose();
      }
      batches.clear();
      placed.clear();
    },
  };
}
