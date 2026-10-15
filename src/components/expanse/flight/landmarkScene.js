// One POI's buildings drawn: a group in the scene, relative to the floating
// origin, its placements (./landmarks.js's) put by a galaxy placer
// (galaxy/surface/placer.js: a catalog model, a kit model, or the kind's
// code-built prop), and a plain block where nothing comes, so the POI never
// stands empty for a file that won't load (said once a landmark, no retry:
// the placer's loaders keep their own caches, and a file that failed isn't
// asked for again till the page is).
//
// Freed whole: the placer's group out of the scene, its kits disposed of,
// and the geometry it drew handed back to the graphics chip, unless another
// landmark still draws it (the placer's model cache shares a file's
// geometry between every copy, so a count is kept across landmarks). A
// model that comes in after the landmark has gone is freed as it lands.
//
//   createLandmark(scene, { list, placer: (group) → placer, origin })
//     → { group, ready, stats() → { placed, standIns }, update(t, dt) (its
//         still meshes merged a second's frames after it is in: ./landmarkMerge.js),
//         reanchor(at), dispose() }
//   galaxyPlacer({ kit, house, create }) → (group) → a galaxy placer over it, its
//     things stood at their own heights (`abs`), nothing solid
//   createLandmarks(scene, { spec, heightAt, placer, prefetch, house }) → {
//     update(ship, at (the origin), dt), live() → ids, ready(), dispose() }:
//     the POIs' landmarks streamed round the ship (./landmarkStream.js's
//     plan), each one's placements worked out once a flight; the galaxy's
//     prop kit made at the first one wanted (painted, no scans: the flight's
//     look), and the files of the ones ahead fetched into the placer's own
//     model cache (prefetchModels), so a landmark wanted is a landmark drawn

import * as THREE from 'three';
import { SURFACE_MODELS, clusterSpecs, createKit, createPlacer, loadModel, usesModel } from '../../galaxy/shared/models';
import { planetField } from '../../../lib/land/flight/field';
import { placementsFor } from './landmarks';
import { landmarkPlan } from './landmarkStream';
import { createMerge } from './landmarkMerge';

const users = new Map(); // geometry → how many live landmarks draw it

function own(object) {
  const got = [];
  object.traverse((o) => o.geometry && got.push(o.geometry));
  for (const g of got) users.set(g, (users.get(g) ?? 0) + 1);
  return got;
}

function letGo(geometries) {
  for (const g of geometries) {
    const n = (users.get(g) ?? 1) - 1;
    if (n > 0) users.set(g, n);
    else {
      users.delete(g);
      g.dispose();
    }
  }
}

// the stand-in: a grey block about a hut's size, its foot on the ground
const BLOCK = { w: 8, h: 6 };

export function createLandmark(scene, { list, placer: makePlacer, origin = [0, 0, 0], name = 'landmark' }) {
  const group = new THREE.Group();
  group.name = name;
  scene.add(group);
  const placer = makePlacer(group);
  const geometries = []; // one entry a mesh drawn: the count is by draws, not files
  const stats = { placed: 0, standIns: 0 };
  const missing = new Set(); // the kinds blocks stand in for, to name in the warning
  let block = null; // { geometry, material }, made at the first stand-in
  let gone = false;
  let merge = null; // (its still meshes merged once all its things are in: ./landmarkMerge.js)

  const standIn = (p) => {
    if (gone) return;
    block ??= { geometry: new THREE.BoxGeometry(BLOCK.w, BLOCK.h, BLOCK.w).translate(0, BLOCK.h / 2, 0), material: new THREE.MeshLambertMaterial({ color: '#8a8f96', flatShading: true }) };
    const m = new THREE.Mesh(block.geometry, block.material);
    m.name = 'landmark-stand-in';
    m.position.set(p.at[0], p.y, p.at[1]);
    m.rotation.y = p.yaw ?? 0;
    group.add(m);
    stats.standIns++;
    missing.add(p.model ?? p.kind);
  };

  const reanchor = (at) => group.position.set(0 - at[0] || 0, 0 - at[1] || 0, 0 - at[2] || 0);
  reanchor(origin);

  const ready = Promise.all(
    list.map((p) =>
      Promise.resolve()
        .then(() => placer.put(p))
        .then(
          (o) => {
            if (!o) return standIn(p);
            const got = own(o);
            if (gone) return letGo(got);
            geometries.push(...got);
            stats.placed++;
          },
          () => standIn(p),
        ),
    ),
  ).then(() => {
    if (stats.standIns && !gone) console.warn(`${name}: ${stats.standIns} of ${list.length} things won't load (${[...missing].join(', ')}); blocks stand in`);
    if (!gone) merge = createMerge(group);
  });

  return {
    group,
    ready,
    stats: () => ({ ...stats }),
    update(t, dt) {
      if (gone) return;
      placer.update?.(t, dt);
      merge?.tick();
    },
    reanchor,
    dispose() {
      if (gone) return;
      gone = true;
      placer.dispose?.();
      merge?.dispose();
      group.removeFromParent();
      letGo(geometries);
      geometries.length = 0;
      block?.geometry.dispose();
      block?.material.dispose();
    },
  };
}

// (a placer's world: the heights are the placements' own, nothing is walked on)
const WORLD = { heightAt: () => 0, normalAt: () => [0, 1, 0], solids: { circle() {}, box() {} }, floors: [] };

// (a cluster of models, a pile of crates, the placer puts member by member
// and answers null for; put here one by one, it answers with what came, so
// it's counted as drawn and its geometry freed with the landmark)
export const galaxyPlacer =
  ({ kit, house = null, create = createPlacer }) =>
  (group) => {
    const placer = create({ parent: group, kit, world: { ...WORLD, floors: [] }, house });
    const put = placer.put.bind(placer);
    placer.put = (spec) => {
      const members = !spec.model && SURFACE_MODELS[spec.kind]?.cluster;
      if (!members) return put(spec);
      return Promise.all(clusterSpecs(spec, members).map(put)).then((got) => {
        const came = got.filter(Boolean);
        return came.length ? { traverse: (fn) => came.forEach((o) => o.traverse(fn)) } : null;
      });
    };
    return placer;
  };

// a placement list's catalog models fetched and parsed into the placer's
// cache ahead of their landmark (a kit model's file is small, and fetched
// with its landmark)
const fetchedKinds = new Set();
export function prefetchModels(list) {
  for (const p of list) {
    if (p.model || fetchedKinds.has(p.kind) || !usesModel(p)) continue;
    fetchedKinds.add(p.kind);
    Promise.resolve(loadModel(p.kind)).catch(() => {});
  }
}

export function createLandmarks(scene, { spec, heightAt = null, placer = null, prefetch = prefetchModels, house = null }) {
  // (a POI the planet's own `landmarks` build, the flight module draws: one set of buildings a place)
  const built = new Set((spec?.landmarks ?? []).map((l) => l.at));
  const pois = (spec?.pois ?? []).filter((p) => !built.has(p.id));
  const height = heightAt ?? planetField(spec).heightAt;
  const lists = new Map(); // POI id → its placements, worked out once
  const listOf = (poi) => {
    if (!lists.has(poi.id)) lists.set(poi.id, placementsFor(spec, poi, { heightAt: height }).list);
    return lists.get(poi.id);
  };
  const byId = new Map(pois.map((p) => [p.id, p]));
  const live = new Map(); // POI id → its landmark
  const fetched = new Set();
  let kit = null;
  let makePlacer = placer;
  // (the prop kit paints its maps on a canvas: with no page, in Node, nothing is drawn)
  const drawable = Boolean(placer) || typeof document !== 'undefined';
  // (the house, or a getter of it: the flight makes its house after its scene)
  const placerOf = () => (makePlacer ??= galaxyPlacer({ kit: (kit = createKit({ seed: 31, scans: false })), house: typeof house === 'function' ? house() : house }));
  let t = 0;

  return {
    live: () => [...live.keys()],
    ready: () => Promise.all([...live.values()].map((l) => l.ready)),
    update(ship, at, dt = 0) {
      t += dt;
      const { want, prefetch: ahead } = landmarkPlan(pois, ship, new Set(live.keys()));
      for (const [id, lm] of live)
        if (!want.includes(id)) {
          lm.dispose();
          live.delete(id);
        }
      for (const id of want) {
        if (live.has(id) || !drawable) continue;
        fetched.add(id);
        live.set(id, createLandmark(scene, { list: listOf(byId.get(id)), placer: placerOf(), origin: at, name: `landmark:${id}` }));
      }
      for (const id of ahead) {
        if (fetched.has(id)) continue;
        fetched.add(id);
        prefetch(listOf(byId.get(id)));
      }
      for (const lm of live.values()) {
        lm.reanchor(at);
        lm.update(t, dt);
      }
      kit?.tick?.(dt);
    },
    dispose() {
      for (const lm of live.values()) lm.dispose();
      live.clear();
      kit?.dispose();
    },
  };
}
