// Giving back what a room made. A room's rebuild (scene.js, build()) cleared
// its group and freed only the figures' geometries, so every rebuild leaked
// the walls', lids' and switches' geometries, the doors' cloned materials,
// the switches' canvas textures and the bots' bone textures. This frees each
// once, leaving whatever `keep` holds: the materials made once for every room.
// (lib/three/renderer.js's disposeTree frees shared materials too, and misses
// skeletons.) Pure and duck-typed: no three import.
//
// freeRoom(root, keep) → { geometries, materials, textures, skeletons }, the counts freed

export function freeRoom(root, keep = new Set()) {
  const seen = new Set();
  const n = { geometries: 0, materials: 0, textures: 0, skeletons: 0 };
  const free = (x, kind) => {
    if (!x || seen.has(x) || keep.has(x)) return false;
    seen.add(x);
    x.dispose();
    n[kind]++;
    return true;
  };
  root.traverse((o) => {
    free(o.geometry, 'geometries');
    if (o.isSkinnedMesh) free(o.skeleton, 'skeletons');
    for (const m of [o.material].flat()) {
      if (!free(m, 'materials')) continue;
      for (const v of Object.values(m)) if (v?.isTexture) free(v, 'textures');
    }
  });
  return n;
}
