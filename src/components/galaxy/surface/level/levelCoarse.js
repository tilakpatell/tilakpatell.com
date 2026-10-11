// The coarse horizon grid drawn (lane N4): each 512 m cell's merged proxy
// (scripts/bf2017-horizon.mjs's <key>.glb, through the level's loader, so its
// colour maps are the shared cache's) and, on the node renderer, one
// impostor mesh an atlas holding the cards of the cells shown
// (lib/three/impostor.js). A cell stands in for the fine path until the fine
// path has every mesh it holds (lib/level/priority.js's coarseHidden), then
// hides; it shows again if one goes. The proxies draw a little behind
// (polygon offset), so while both stand at the swap the fine surface wins.
//
//   createCoarse({ parent, index, makeImpostors }) → { addCell(key, gltf), setAtlas(mesh, { albedo, normal }),
//     update({ loaded(mesh), drawn(mesh, key) }), stats() → { cells, shown, cards }, dispose() }
//   (makeImpostors: impostor.js's createImpostors, null on the classic renderer)

import { coarseHidden } from '../../../../lib/level/priority.js';

export function createCoarse({ parent, index, makeImpostors = null }) {
  const cells = new Map(); // key → { group, meshes }
  const atlases = new Map(); // mesh → impostors

  const shownKeys = () => [...cells].filter(([, c]) => c.group.visible).map(([k]) => k);
  const recordsOf = (mesh, keys) => keys.flatMap((k) => index.cells?.[k]?.impostors?.[mesh] ?? []);

  function refreshCards() {
    const keys = [...cells.keys()].filter((k) => cells.get(k).group.visible);
    for (const [mesh, imp] of atlases) imp.setRecords(recordsOf(mesh, keys));
  }

  return {
    addCell(key, gltf) {
      if (!gltf?.scene || cells.has(key)) return;
      const g = gltf.scene;
      g.name = `coarse:${key}`;
      g.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [o.material].flat()) {
          m.polygonOffset = true;
          m.polygonOffsetFactor = 2;
          m.polygonOffsetUnits = 2;
        }
        o.castShadow = false;
        o.receiveShadow = true;
      });
      const cell = { group: g, meshes: index.cells?.[key]?.meshes ?? [] };
      g.visible = true;
      cells.set(key, cell);
      parent.add(g);
      refreshCards();
    },
    setAtlas(mesh, { albedo, normal = null }) {
      if (!makeImpostors || atlases.has(String(mesh)) || !albedo) return;
      const all = Object.keys(index.cells ?? {});
      const imp = makeImpostors({ albedo, normal, views: index.views ?? 16, records: recordsOf(String(mesh), all) });
      imp.mesh.name = `impostors:${mesh}`;
      atlases.set(String(mesh), imp);
      parent.add(imp.mesh);
      refreshCards();
    },
    update({ loaded, drawn }) {
      let changed = false;
      for (const [key, c] of cells) {
        const show = !coarseHidden(c.meshes, { loaded, drawn: (m) => drawn(m, key) });
        if (c.group.visible !== show) {
          c.group.visible = show;
          changed = true;
        }
      }
      if (changed) refreshCards();
    },
    stats: () => ({ cells: cells.size, shown: shownKeys().length, cards: [...atlases.values()].reduce((s, a) => s + a.count, 0) }),
    dispose() {
      for (const c of cells.values()) {
        parent.remove(c.group);
        c.group.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          // (the maps are the loader's cache's: only the materials are ours)
          for (const m of [o.material].flat()) m.dispose();
        });
      }
      for (const imp of atlases.values()) {
        parent.remove(imp.mesh);
        imp.dispose();
      }
      cells.clear();
      atlases.clear();
    },
  };
}
