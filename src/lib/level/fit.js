// Holding a level to its budget row (lane L): the rows do not move. Each
// instance draws the LOD its size and distance give it (lod.js), out to K
// times its radius; K is the farthest reach for which every place you can
// stand sees no more than its share of the row (90%: the people, the effects
// and the sky have the rest). A reach is in radii, so the small things
// (snow debris, cables, clutter) go first and the hangar and the ridges
// last. Where even the nearest reach is over, the lightest meshes (instances
// × bounding volume over the whole arena) go entirely, one at a time; a mesh
// marked `keep` (the map's own buildings, the level script's --keep: an Ewok
// village's decks and huts, lighter than the trees they hang in) only once
// no other is left at the worst place. The parts of one thing (`group`: a
// tree's trunk, crown and addons) go together.
//
//   costAt(inst, meshes, [x, z], tier, K, skip) → { tris, calls }
//   fitCull(inst, meshes, row, tier, { positions, share = 0.9, kMin = 4, kMax = 1000 }) → { K, dropped, worst }
//
// inst: { x, z, r, mesh, mirrored } typed arrays; meshes[m]: { lods (each
// LOD's triangles), mats, weight, keep?, group? (the parts of one thing,
// dropped together), upTo? (the first LOD not drawn: past it, nothing) }. A call is one mesh, LOD and side drawn
// (the scene's InstancedMesh), times its materials.

import { lodAt, seenAt } from './lod.js';

export function costAt(inst, meshes, [px, pz], tier, K, skip = null, who = null) {
  let tris = 0;
  const calls = new Map();
  for (let i = 0; i < inst.x.length; i++) {
    const m = inst.mesh[i];
    if (skip?.has(m)) continue;
    const d = Math.hypot(inst.x[i] - px, inst.z[i] - pz);
    if (!seenAt(d, inst.r[i], K)) continue;
    const n = lodAt(meshes[m].lods, d, inst.r[i], tier);
    // (a mesh drawn only up to a LOD, its far LODs' maps not in the bucket, is not drawn past it)
    if (n >= (meshes[m].upTo ?? Infinity)) continue;
    tris += meshes[m].lods[n];
    calls.set(`${m}|${n}|${inst.mirrored[i]}`, meshes[m].mats ?? 1);
    who?.add(m);
  }
  let c = 0;
  for (const v of calls.values()) c += v;
  return { tris, calls: c };
}

export function fitCull(inst, meshes, row, tier, { positions, share = 0.9, kMin = 4, kMax = 1000 } = {}) {
  const max = { tris: row.tris * share, calls: row.calls * share };
  const skip = new Set();
  for (let m = 0; m < meshes.length; m++) if (meshes[m].skip) skip.add(m);
  const worstAt = (K) => {
    let w = { tris: 0, calls: 0, at: null, by: 0 };
    for (const p of positions) {
      const c = costAt(inst, meshes, p, tier, K, skip);
      const by = Math.max(c.tris / max.tris, c.calls / max.calls);
      w = { tris: Math.max(w.tris, c.tris), calls: Math.max(w.calls, c.calls), at: by > w.by ? p : w.at, by: Math.max(w.by, by) };
    }
    return w;
  };
  const fits = (w) => w.by <= 1;
  let K = kMax;
  if (!fits(worstAt(kMax))) {
    // the farthest reach that fits, to a metre a radius
    let lo = kMin;
    let hi = kMax;
    while (hi - lo > 1) {
      const mid = (lo + hi) / 2;
      if (fits(worstAt(mid))) lo = mid;
      else hi = mid;
    }
    K = Math.floor(lo);
    // and if even that is over, the lightest meshes at the worst place go
    for (let w = worstAt(K); !fits(w); w = worstAt(K)) {
      const who = new Set();
      costAt(inst, meshes, w.at, tier, K, skip, who);
      // (a mesh the map keeps, its own buildings, after every other: then the lightest of those)
      const lighter = (m, p) => meshes[m].weight < meshes[p].weight || (meshes[m].weight === meshes[p].weight && m < p);
      let pick = -1;
      for (const m of who) if (pick < 0 || (!meshes[m].keep && meshes[pick].keep) || (Boolean(meshes[m].keep) === Boolean(meshes[pick].keep) && lighter(m, pick))) pick = m;
      if (pick < 0) break;
      skip.add(pick);
      // (and the rest of its thing: a tree's crown goes with its trunk)
      if (meshes[pick].group != null) for (let m = 0; m < meshes.length; m++) if (meshes[m].group === meshes[pick].group) skip.add(m);
    }
  }
  const w = worstAt(K);
  return { K, dropped: [...skip].filter((m) => !meshes[m].skip), worst: { tris: w.tris, calls: w.calls } };
}
