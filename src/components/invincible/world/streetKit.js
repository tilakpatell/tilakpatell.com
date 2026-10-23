// The city's street furniture and its brick tenements, drawn from
// ./streetPlan.js: Quaternius's Street Pack (the lamps, the traffic lights,
// the stop signs) and Downtown City MegaKit (manholes, bollards, planters,
// air-conditioning units and the tenements themselves), both CC0, out of
// public/kit/ through the kit's loader (lib/three/kit). The furniture goes
// through the kit's pools, streamed by tile round the camera (a tile's items
// set as it comes within reach, freed as it goes); the street trees are the
// city's own (./city.js's trunk and crown) in one draw of the tiles in
// reach. The tenements are every one of the outer city's low brick blocks:
// far off, the kit's LOD1, a box wearing pictures of its own sides, all of
// them in a draw a model; near, the whole building, for the nearest few
// (each taken out of the far draw while it is near). The towers' own boxes
// for those blocks are hidden under them once the far draw is in
// (./city.js's `hideUnder`), and come back whenever one is hurt: the
// facade's cracks and soot are the box's (./demolish.js).
//
//   createStreetKit(world, { tier, calm }) → { group, ready, update(camera, dt),
//     setNight(k), hide(id), show(id), ids, stats, dispose() }

import * as THREE from 'three';
import { createPool, loadKit } from '../../../lib/three/kit';
import { KIT, furnitureIn, roofUnits, tenementTiles, tilesNear } from './streetPlan';

// The Street Pack is modelled about a quarter of real size (its lamp 1.09
// high): each is drawn at the size a street has it.
const SIZE = { Streetlight_Single: 4.3, TrafficLight_2: 4.2, Sign_Stop: 4.4, Prop_ACUnit: 1.6, Prop_ManholeCover: 1, Prop_Bollard: 1, Prop_Planter_Single: 0.75 };
// what each of the plan's lists is drawn as, from which pack, and how far
const FURNITURE = [
  { list: 'lamps', pack: 'street', model: 'Streetlight_Single' },
  { list: 'lights', pack: 'street', model: 'TrafficLight_2' },
  { list: 'stops', pack: 'street', model: 'Sign_Stop' },
  { list: 'manholes', pack: 'city', model: 'Prop_ManholeCover', reach: 0.6 },
  { list: 'bollards', pack: 'city', model: 'Prop_Bollard' },
  { list: 'planters', pack: 'city', model: 'Prop_Planter_Single' },
];
// by tier: the streamed reach (the roof units', seen from over the roofs; the street's own go
// to the LOD1's band's end, past which a lamp is a line), the kit's bands [full, LOD1], how many
// tenements are whole at once and within what, how far their pictures go (past it, the towers'
// box tucked under each stands for it: from there the two are alike), and the street trees at
// once and their crowns' detail
const TIERS = {
  low: { reach: 220, bands: [25, 90], near: 50, whole: 2, far: 800, trees: 300, crown: 0 },
  mid: { reach: 420, bands: [40, 140], near: 70, whole: 3, far: 1000, trees: 500, crown: 0 },
  high: { reach: 600, bands: [60, 220], near: 100, whole: 10, far: 1600, trees: 900, crown: 1 },
  ultra: { reach: 800, bands: [100, 360], near: 140, whole: 16, far: Infinity, trees: 1300, crown: 1 },
};
const RESORT = 0.5; // seconds between the tenements' re-sorts (or 20 m of travel)
const MOVE = 20;
const ROOF = 1.1; // the kit's parapet over its roof, metres

export function createStreetKit(world, { tier = 'mid' } = {}) {
  const T = TIERS[tier] ?? TIERS.mid;
  const group = new THREE.Group();
  group.name = 'street-kit';
  const kits = { street: loadKit('street'), city: loadKit('city') };
  const pools = {};
  const live = new Set(); // the tiles whose furniture is set
  const cache = new Map(); // a tile's furniture, worked out once
  const stats = { tiles: 0, whole: 0, tenements: 0, far: 0 };
  let gone = false;
  let lights = []; // the materials that glow at night: [material, colour, strength, map?]
  const off = new Set(); // the blocks whose tenements are not drawn (hurt: their box stands instead)

  // the street trees: the city's own trunk and crown, the tiles in reach
  const TREES = T.trees;
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.9 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true });
  const greens = [0x3d6a2a, 0x4f7a2f, 0x35602c, 0x5b7d34, 0x46702b].map((c) => new THREE.Color(c));
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1, 5, 1, true).translate(0, 0.5, 0), bark, TREES);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, T.crown), leaf, TREES);
  for (const m of [trunks, crowns]) {
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = tier !== 'low';
    m.receiveShadow = true;
    group.add(m);
  }

  // ── the tenements ──
  const tiles = tenementTiles(world);
  const all = [...tiles.entries()].flatMap(([key, list]) => list.map((t) => Object.assign(t, { tile: key, drawn: false })));
  stats.tenements = all.length;
  const ids = new Set(all.map((t) => t.id));
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  const matrixOf = (t) => new THREE.Matrix4().compose(new THREE.Vector3(t.x, 0, t.z), Q.setFromAxisAngle(UP, t.yaw).clone(), new THREE.Vector3(t.sx, t.sy, t.sz));
  for (const t of all) t.m = matrixOf(t);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const byModel = { small: all.filter((t) => t.model === 'small'), medium: all.filter((t) => t.model === 'medium') };
  const far = {}; // model → [InstancedMesh a LOD1 part]
  const farLocal = {}; // model → [each LOD1 part's own matrix]
  const whole = {}; // model → [InstancedMesh a part], T.whole instances each
  let near = []; // the tenements drawn whole now
  let nearNow = new Set();
  let farTiles = new Set(); // the tiles whose tenements' pictures are drawn
  const last = { x: Infinity, z: Infinity, wait: 0 };
  const P = new THREE.Vector3();

  async function build() {
    await Promise.all([kits.street.manifest, kits.city.manifest]);
    if (gone) return;
    for (const f of FURNITURE) {
      const pool = createPool(kits[f.pack], f.model, { bands: T.bands, reach: T.bands[1] * (f.reach ?? 1), cap: 128, shadows: tier !== 'low' && f.list !== 'manholes' });
      pools[f.list] = pool;
      group.add(pool.group);
    }
    const units = createPool(kits.city, 'Prop_ACUnit', { bands: T.bands, reach: T.reach, cap: 256, shadows: false });
    pools.units = units;
    group.add(units.group);
    // the tenements' two levels
    await Promise.all(
      Object.entries(byModel).map(async ([model, list]) => {
        const name = KIT[model].name;
        const [full, lod] = await Promise.all([kits.city.model(name), kits.city.lod1(name)]);
        if (gone) return;
        farLocal[model] = lod.map((p) => p.local);
        far[model] = lod.map((p) => {
          const mesh = new THREE.InstancedMesh(p.geometry, p.material, Math.max(1, list.length));
          list.forEach((t, i) => {
            t.slot = i;
            mesh.setMatrixAt(i, ZERO); // (each drawn as its tile comes within the pictures' reach)
          });
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.name = `tenements:${model}`;
          // (one draw over the whole outer city, its instances coming and going: never culled whole)
          mesh.frustumCulled = false;
          group.add(mesh);
          stats.far += list.length;
          return mesh;
        });
        whole[model] = full.parts.map((p) => {
          const mesh = new THREE.InstancedMesh(p.geometry, p.material, T.whole);
          mesh.count = 0;
          mesh.frustumCulled = false;
          mesh.castShadow = tier !== 'low';
          mesh.receiveShadow = true;
          mesh.name = `tenement:${model}`;
          group.add(mesh);
          return mesh;
        });
      }),
    );
    // what glows at night: the lamps' globes and the traffic lights (the Street Pack's `Light`s),
    // the tenements' windows (the MegaKit's rooms behind them) and, faintly, their far pictures
    const glow = (pack, name, colour, k, map = false) => {
      try {
        const m = kits[pack].material(name);
        if (map && m.map) m.emissiveMap = m.map;
        m.needsUpdate = true;
        lights.push([m, new THREE.Color(colour), k]);
      } catch {
        // (a name the manifest has not got: nothing to light)
      }
    };
    for (const n of ['Light', 'Light.001', 'Light.002']) glow('street', n, 0xffd9a0, 3);
    for (const n of ['MI_FakeInterior_1', 'MI_FakeInterior_2', 'MI_FakeInterior_3', 'MI_FakeInterior_4']) glow('city', n, 0xffe0b0, 1, true);
    for (const model of Object.keys(byModel)) glow('city', `${KIT[model].name}_Facade`, 0xffd8a8, 0.32, true);
    setNight(night);
  }
  const ready = build().catch((e) => console.warn(`street kit: ${e?.message ?? e}`));

  // a tile's furniture into the pools, and its tenements' roof units (none on a hurt block's box)
  function setTile(key) {
    if (!cache.has(key)) {
      const f = furnitureIn(world, key);
      const blocks = [...new Set((tiles.get(key) ?? []).map((t) => t.id))];
      f.units = blocks.flatMap((id) => roofUnits(world.buildings[id]).map((u) => ({ ...u, id })));
      cache.set(key, f);
    }
    const f = cache.get(key);
    for (const d of FURNITURE) pools[d.list]?.set(key, f[d.list].map((p) => ({ x: p.x, y: 0, z: p.z, yaw: p.yaw, scale: SIZE[d.model] })));
    // (down off the kit's parapet onto its roof)
    pools.units?.set(key, f.units.filter((u) => !off.has(u.id)).map((u) => ({ x: u.x, y: u.y - ROOF, z: u.z, yaw: u.yaw, scale: SIZE.Prop_ACUnit })));
  }
  function stream(cx, cz) {
    const want = new Set(tilesNear(cx, cz, T.reach));
    let changed = false;
    for (const key of live) {
      if (want.has(key)) continue;
      for (const p of Object.values(pools)) p.free(key);
      live.delete(key);
      changed = true;
    }
    for (const key of want) {
      if (live.has(key) || !pools.lamps) continue;
      setTile(key);
      live.add(key);
      changed = true;
    }
    stats.tiles = live.size;
    if (changed) writeTrees();
    // the tenements' pictures within their reach, the rest left to the boxes under them
    if (!Object.keys(far).length) return;
    const farNow = new Set(tilesNear(cx, cz, Math.min(T.far, 1e5)).filter((k) => tiles.has(k)));
    if (T.far === Infinity) for (const k of tiles.keys()) farNow.add(k);
    const moved = [...farTiles].filter((k) => !farNow.has(k)).concat([...farNow].filter((k) => !farTiles.has(k)));
    farTiles = farNow;
    for (const k of moved) for (const t of tiles.get(k) ?? []) refresh(t);
  }
  function writeTrees() {
    let n = 0;
    for (const key of live) {
      for (const t of cache.get(key)?.trees ?? []) {
        if (n >= TREES) break;
        M.compose(P.set(t.x, 0, t.z), Q.identity(), new THREE.Vector3(1, t.s * 1.4, 1));
        trunks.setMatrixAt(n, M);
        M.compose(P.set(t.x, t.s * 2.1, t.z), Q.setFromAxisAngle(UP, n), new THREE.Vector3(t.s, t.s * 1.05, t.s));
        crowns.setMatrixAt(n, M);
        crowns.setColorAt(n, greens[n % greens.length]);
        n++;
      }
    }
    trunks.count = crowns.count = n;
    trunks.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  }

  // the nearest few tenements whole, the rest as their pictures
  function sortTenements(cx, cz) {
    const pick = [];
    for (const key of tilesNear(cx, cz, T.near + 30))
      for (const t of tiles.get(key) ?? []) {
        if (off.has(t.id)) continue;
        const d = Math.hypot(t.x - cx, t.z - cz);
        if (d < T.near) pick.push([d, t]);
      }
    pick.sort((a, b) => a[0] - b[0]);
    const next = pick.slice(0, T.whole).map(([, t]) => t);
    const was = near;
    nearNow = new Set(next);
    near = next;
    for (const t of [...was, ...next]) refresh(t);
    for (const model of Object.keys(whole)) {
      const list = near.filter((t) => t.model === model);
      for (const mesh of whole[model]) {
        list.forEach((t, i) => mesh.setMatrixAt(i, t.m));
        mesh.count = list.length;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    stats.whole = near.length;
  }
  // a tenement in the far draw or out of it, as it should be now: its tile within the pictures'
  // reach, not drawn whole, not hurt (its matrix there, or nothing; written only when it changes)
  function refresh(t) {
    const meshes = far[t.model];
    if (!meshes || t.slot == null) return;
    const on = farTiles.has(t.tile) && !nearNow.has(t) && !off.has(t.id);
    if (on === t.drawn) return;
    t.drawn = on;
    const parts = farLocal[t.model];
    meshes.forEach((mesh, i) => {
      mesh.setMatrixAt(t.slot, on ? M.multiplyMatrices(t.m, parts[i]) : ZERO);
      mesh.instanceMatrix.addUpdateRange(t.slot * 16, 16);
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
  // a block's tile set again (its roof units), and the whole ones sorted again, at the next update
  function relist(id) {
    const b = world.buildings[id];
    const key = b && [...live].find((k) => (tiles.get(k) ?? []).some((t) => t.id === id));
    if (key) setTile(key);
    last.wait = 0;
  }

  let night = 0;
  function setNight(k) {
    night = k;
    for (const [m, colour, strength] of lights) m.emissive?.copy(colour).multiplyScalar(k * strength);
  }

  return {
    group,
    ready,
    ids,
    stats,
    // each frame, with the camera in the city's own frame (./city.js: the mirror city's is turned)
    update(camera, dt = 0) {
      if (gone) return;
      const { x, z } = camera.position;
      stream(x, z);
      for (const p of Object.values(pools)) p.update(camera, dt);
      last.wait -= dt;
      if (Object.keys(whole).length && (last.wait <= 0 || Math.hypot(x - last.x, z - last.z) > MOVE)) {
        last.wait = RESORT;
        last.x = x;
        last.z = z;
        sortTenements(x, z);
      }
    },
    setNight,
    // a block's tenements gone (it is hurt: its box stands) or back
    hide(id) {
      if (!ids.has(id) || off.has(id)) return;
      off.add(id);
      for (const t of all) if (t.id === id) refresh(t);
      relist(id);
    },
    show(id) {
      if (!off.delete(id)) return;
      for (const t of all) if (t.id === id) refresh(t);
      relist(id);
    },
    dispose() {
      gone = true;
      group.removeFromParent();
      for (const p of Object.values(pools)) p.dispose();
      for (const list of [...Object.values(far), ...Object.values(whole)]) for (const m of list) m.dispose();
      for (const m of [trunks, crowns]) {
        m.geometry.dispose();
        m.dispose();
      }
      bark.dispose();
      leaf.dispose();
      for (const k of Object.values(kits)) k.dispose();
      lights = [];
    },
  };
}
