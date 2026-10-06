// Putting things on a world: a kind (a vaporator, a sandcrawler, an Ewok
// hut) at a spot, turned and scaled, stood on the ground there, and made
// solid where it's solid. A kind with a model (catalog/*.js, from
// Sketchfab) is that model; one without (or whose model won't load) is
// built in code (props/*.js); a kind that's neither is left out. Scattered
// kinds (rocks by the hundred, palms, huts) are drawn instanced: one draw
// for all of them.
//
// createPlacer({ parent, kit, world, warm }) → { put(spec), scatter(kind,
// items, opts), update(t, dt, you), signal(name, on) (to the built things that
// move when something happens: a trapdoor, a gate), setZone(inZone), ready (a
// promise: everything asked for so far is in), dispose() }
//   Given `shadowOnly` (near.js's createShadowPhase(…).only), scattered
//   things don't cast shadows themselves: a stand-in for each part, drawn
//   only into the sun's shadow, holds just the instances near `you`
//   (near.js), found again each NEAR.step metres you walk.
//   Things put with `zone` (a room's build) are drawn only while you're in a
//   zone, and everything else only while you're not (setZone).
//   spec: { kind, at: [x, z], yaw, pitch, roll (radians: a walker on its
//   side), scale, y (over the ground), sink (into it), abs (y is the height
//   itself, not over the ground), solid (false: walk through it; or { r } /
//   { box: [hw, hd] } in place of its own), model (false: its build, even
//   where there's a model), opts (for a built one), zone (it's a room's) }

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gltfLoader } from '../../../lib/three/gltf';
import { sharpenMaterial } from '../../../lib/three/textures';
import { detailLevel } from '../../../lib/detail';
import { SURFACE_MODELS, surfaceLodUrl, surfaceUrl } from './catalog';
import { withDetail } from './detail';
import { loadScan, scanOf } from './kit';
import { PROPS, SCATTER } from './props';
import { nearInstances, splitNear, zoneVisibility } from './near';

const NEAR = { r: 70, max: 512, step: 8 }; // metres (the shadow box's corner, ±42 m, and the shadows long trees throw into it); instances; metres walked before they're found again

const getLoader = () => gltfLoader();
const cache = new Map(); // url → promise of the gltf (shared by every world, while the page is up)
export function loadGlb(url) {
  if (!cache.has(url))
    cache.set(
      url,
      getLoader()
        .loadAsync(url)
        .catch(() => {
          cache.delete(url);
          return null;
        }),
    );
  return cache.get(url);
}
export const hasModel = (kind) => Boolean(SURFACE_MODELS[kind]);
// whether a placed thing is drawn as its kind's model: there is one, it
// wasn't asked to be built (model: false), and (an entry with `styles`) it's
// one of the styles the model is of (Theed's halls, not its towers)
export const usesModel = (spec) => hasModel(spec.kind) && spec.model !== false && (!SURFACE_MODELS[spec.kind].styles || SURFACE_MODELS[spec.kind].styles.includes(spec.opts?.style));

// A kind's model, and (its catalogue entry's `detail`: a scan's role) the
// scan laid over it up close (detail.js), on every tier but the lowest;
// resolves to the gltf, or null when it won't load
export function loadModel(kind, url = surfaceUrl(kind)) {
  const role = SURFACE_MODELS[kind]?.detail;
  const scan = role && detailLevel() !== 'low' ? loadScan(role) : null;
  return Promise.all([loadGlb(url), scan]).then(([gltf, got]) => {
    if (gltf && got && !gltf.scene.userData.detailed) {
      const { metres = 2 } = scanOf(role) ?? {};
      gltf.scene.traverse((o) => {
        if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) withDetail(m, got, { metres, ...SURFACE_MODELS[kind].detailLook });
      });
      gltf.scene.userData.detailed = true;
    }
    return gltf;
  });
}

// the model, ready to place: shadows on, its maps sharp at a slant
function prepared(gltf) {
  const root = gltf.scene;
  if (!root.userData.prepared) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) sharpenMaterial(m);
    });
    root.userData.prepared = true;
  }
  return root;
}
export const cloneModel = (gltf) => {
  const root = prepared(gltf);
  let skinned = false;
  root.traverse((o) => (skinned ||= o.isSkinnedMesh));
  return skinned ? cloneSkinned(root) : root.clone();
};

// a solid in the world from one in the thing's own frame
function addSolid(world, s, at, yaw, scale, top) {
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const tx = (x, z) => [at[0] + (x * c + z * sn) * scale, at[2] + (-x * sn + z * c) * scale];
  const opt = { top: s.top != null ? at[1] + s.top * scale : top, base: s.base != null ? at[1] + s.base * scale : null, tag: s.tag ?? null };
  if (s.circle) {
    const [x, z] = tx(s.circle[0], s.circle[1]);
    world.solids.circle(x, z, s.circle[2] * scale, opt);
  } else if (s.box) {
    const [x, z] = tx(s.box[0], s.box[1]);
    world.solids.box(x, z, s.box[2] * scale, s.box[3] * scale, yaw + (s.box[4] ?? 0), opt);
  }
}

export function createPlacer({ parent, kit, world, warm = (o) => Promise.resolve(o), shadowOnly = null }) {
  const group = new THREE.Group();
  group.name = 'things';
  parent.add(group);
  const rooms = new THREE.Group(); // (the zones' builds: hidden till you're in one)
  rooms.name = 'rooms';
  rooms.visible = false;
  parent.add(rooms);
  const casters = []; // { mesh (the stand-in), src (the matrices of the instanced mesh it casts for), xs, zs }
  const splits = []; // { full, low (each [{ mesh, src }]), xs, zs, r }: scattered models drawn near and far
  let nearAt = null; // where you were when the casters were last filled
  const updates = [];
  const signals = [];
  const pending = [];
  let dead = false;

  const groundY = (x, z) => world.heightAt(x, z);
  const spot = (spec) => {
    const [x, z] = spec.at;
    return [x, (spec.abs ? 0 : groundY(x, z)) + (spec.y ?? 0) - (spec.sink ?? 0), z];
  };

  // a built one (made once for each kind and options and copied after,
  // geometry and materials shared, unless it moves: its own update or signal)
  const builtCache = new Map();
  const make = (spec) => {
    const fn = PROPS[spec.kind];
    if (!fn) return null;
    const key = `${spec.kind}|${JSON.stringify(spec.opts ?? {})}`;
    const had = builtCache.get(key);
    if (had) return { ...had, object: had.object.clone() };
    const made = fn(kit, spec.opts ?? {});
    if (!made.update && !made.signal) builtCache.set(key, { ...made, object: made.object.clone() });
    return made;
  };
  const build = (spec, at) => {
    const made = make(spec);
    if (!made) return null;
    const o = made.object;
    o.position.set(...at);
    o.rotation.set(spec.pitch ?? 0, spec.yaw ?? 0, spec.roll ?? 0, 'YXZ');
    o.scale.setScalar(spec.scale ?? 1);
    (spec.zone ? rooms : group).add(o);
    applyBuilt(made, spec, at, world, { updates, signals, object: true });
    return o;
  };
  // a built one's walls and floors only, under its model (its meshes thrown
  // away: the model is drawn in its place)
  const builtSolids = (spec, at) => {
    const fn = PROPS[spec.kind];
    if (!fn) return;
    const made = fn(kit, spec.opts ?? {});
    applyBuilt(made, spec, at, world, { updates, signals, object: false });
    made.object.traverse((o) => o.geometry?.dispose());
  };

  // a model's own footprint, from its box: a circle for something small, a
  // box (a little inside its edges) for anything bigger
  const footprint = (o, spec, at) => {
    if (spec.solid === false) return;
    const yaw = spec.yaw ?? 0;
    if (spec.solid?.r) return world.solids.circle(at[0], at[2], spec.solid.r);
    if (spec.solid?.box) return addSolid(world, { box: [0, 0, ...spec.solid.box] }, at, yaw, 1, null);
    // (its box in its own frame: turned back square for the measuring)
    o.rotation.y = 0;
    o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o);
    o.rotation.y = yaw;
    o.updateMatrixWorld(true);
    const size = box.getSize(new THREE.Vector3());
    const w = size.x / 2;
    const d = size.z / 2;
    if (Math.max(w, d) < 1.6) world.solids.circle(at[0], at[2], Math.min(w, d) * 0.8, { top: size.y < 0.8 ? at[1] + size.y : null });
    else world.solids.box(at[0], at[2], w * 0.85, d * 0.85, yaw, { top: size.y < 1 ? at[1] + size.y : null });
  };

  return {
    group,
    // one thing; resolves to its object (or null)
    put(spec) {
      const at = spot(spec);
      if (usesModel(spec)) {
        const p = loadModel(spec.kind)
          .then((gltf) => {
            if (dead) return null;
            if (!gltf) return build(spec, at);
            const o = cloneModel(gltf);
            o.position.set(...at);
            o.rotation.set(spec.pitch ?? 0, spec.yaw ?? 0, spec.roll ?? 0, 'YXZ');
            o.scale.setScalar(spec.scale ?? 1);
            const holder = spec.zone ? rooms : group;
            holder.add(o);
            const entry = SURFACE_MODELS[spec.kind];
            if (entry.solids === 'built') builtSolids(spec, at);
            else footprint(o, spec, at);
            if (!entry.lod) return warm(o).then(() => o);
            // far off, its light model (fetched after the full one: the
            // first view doesn't wait for it)
            const lod = withLod(o, null, radiusOf(gltf) * (spec.scale ?? 1));
            holder.add(lod);
            loadModel(spec.kind, surfaceLodUrl(spec.kind)).then((low) => {
              if (dead || !low) return;
              const l = cloneModel(low);
              addLowLevel(lod, l, radiusOf(gltf) * (spec.scale ?? 1));
              warm(l);
            });
            return warm(o).then(() => lod);
          })
          .catch(() => null);
        pending.push(p);
        return p;
      }
      return Promise.resolve(build(spec, at));
    },
    // many of one kind: items [{ at: [x, z], yaw, scale, y }]; drawn instanced
    scatter(kind, items, { opts = {}, solid = true, model = true } = {}) {
      if (!items.length) return Promise.resolve(null);
      const mats = items.map((it) => {
        const at = spot({ ...it });
        const s = it.scale ?? 1;
        return { at, s, yaw: it.yaw ?? 0, m: new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.yaw ?? 0), new THREE.Vector3(s, s * (it.stretch ?? 1), s)) };
      });
      const xs = Float32Array.from(mats, (x) => x.at[0]);
      const zs = Float32Array.from(mats, (x) => x.at[2]);
      // each part an instanced mesh of every item (its matrices kept, `src`,
      // for the near shadow stand-ins and the near/far split to copy from)
      const instanceParts = (parts) =>
        parts.map((p) => {
          const mesh = new THREE.InstancedMesh(p.geometry, p.material, mats.length);
          mats.forEach((x, i) => mesh.setMatrixAt(i, p.local ? x.m.clone().multiply(p.local) : x.m));
          mesh.castShadow = !shadowOnly && p.shadow !== false; // (else its near stand-in casts for it)
          mesh.receiveShadow = true;
          mesh.computeBoundingSphere();
          group.add(mesh);
          const src = mesh.instanceMatrix.array.slice();
          if (shadowOnly && p.shadow !== false) casters.push({ mesh: casterFor(p, Math.min(NEAR.max, mats.length)), src, xs, zs });
          return { mesh, src };
        });
      const instance = (parts, radius) => {
        const made = instanceParts(parts);
        nearAt = null; // (found again on the next update, these with them)
        if (solid && radius) for (const x of mats) world.solids.circle(x.at[0], x.at[2], radius * x.s);
        return made;
      };
      if (model && hasModel(kind)) {
        const p = loadModel(kind).then((gltf) => {
          if (dead) return null;
          if (!gltf) {
            const made = SCATTER[kind]?.(kit, opts);
            if (made) instance(made.parts, made.radius);
            return null;
          }
          const root = prepared(gltf);
          root.updateMatrixWorld(true);
          const parts = [];
          root.traverse((o) => {
            if (o.isMesh && !o.isSkinnedMesh) parts.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone() });
          });
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const full = instance(parts, typeof solid === 'number' ? solid : Math.min(size.x, size.z) * 0.35);
          // far off, its light copy: the items past lodDistance drawn with it
          // instead (split again as you walk, with the shadow stand-ins)
          if (SURFACE_MODELS[kind].lod)
            loadModel(kind, surfaceLodUrl(kind)).then((lowGltf) => {
              if (dead || !lowGltf) return;
              const lowRoot = prepared(lowGltf);
              lowRoot.updateMatrixWorld(true);
              const lowParts = [];
              lowRoot.traverse((o) => {
                if (o.isMesh && !o.isSkinnedMesh) lowParts.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone(), shadow: false });
              });
              const low = instanceParts(lowParts);
              for (const l of low) l.mesh.castShadow = false; // (far off: past the shadow's reach)
              splits.push({ full, low, xs, zs, r: lodDistance(radiusOf(gltf)) });
              nearAt = null;
              warm(lowRoot);
            });
          return null;
        });
        pending.push(p);
        return p;
      }
      const made = SCATTER[kind]?.(kit, opts) ?? (PROPS[kind] ? { parts: partsOf(PROPS[kind](kit, opts)), radius: opts.radius ?? 0.5 } : null);
      if (made) instance(made.parts, typeof solid === 'number' ? solid : made.radius);
      return Promise.resolve(null);
    },
    get ready() {
      return Promise.all(pending);
    },
    update(t, dt, you = null) {
      for (const u of updates) u(t, dt);
      if (you && (casters.length || splits.length) && (!nearAt || Math.hypot(you.x - nearAt[0], you.z - nearAt[1]) > NEAR.step)) {
        nearAt = [you.x, you.z];
        for (const c of casters) fillCaster(c, you.x, you.z);
        for (const sp of splits) fillSplit(sp, you.x, you.z);
      }
    },
    // in a zone, its room and not the world outside; out, the other way round
    setZone(inZone) {
      const v = zoneVisibility(inZone);
      group.visible = v.outdoors;
      rooms.visible = v.zones;
    },
    // something happening to what's built (a trapdoor opening, a gate
    // coming down, a band starting up): each built thing that answers to
    // `name` does it
    signal(name, on = true) {
      for (const s of signals) s(name, on);
    },
    dispose() {
      dead = true;
      group.removeFromParent();
      rooms.removeFromParent();
      for (const c of casters) c.mesh.material.dispose();
    },
  };

  // a part's shadow stand-in: its geometry, in a material that keeps only what
  // the shadow pass reads (the cut-outs of leaves and fronds), drawn only in
  // the sun's shadow pass (shadowOnly), never in the view
  function casterFor(p, count) {
    const m = Array.isArray(p.material) ? p.material[0] : p.material;
    const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, map: m.alphaTest > 0 ? (m.map ?? null) : null, alphaMap: m.alphaMap ?? null, alphaTest: m.alphaTest ?? 0, side: m.side });
    const mesh = new THREE.InstancedMesh(p.geometry, material, count);
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    shadowOnly(mesh); // (and in the shadow pass, never culled: it's only what's round you, in the shadow camera's box)
    mesh.name = 'shadow-near';
    group.add(mesh);
    return mesh;
  }
  // the stand-in given the instances near (x, z): their matrices copied over
  function fillCaster(c, x, z) {
    const near = nearInstances(c.xs, c.zs, x, z, NEAR.r, c.mesh.instanceMatrix.count);
    copyInstances(c.mesh, c.src, near);
  }
  // a scattered model's items near (x, z) in its full meshes, the rest in its
  // light copy's
  function fillSplit(sp, x, z) {
    const { near, far } = splitNear(sp.xs, sp.zs, x, z, sp.r);
    for (const f of sp.full) copyInstances(f.mesh, f.src, near);
    for (const l of sp.low) copyInstances(l.mesh, l.src, far);
  }
}

// Far away, a model's light copy (<kind>.lod1.glb: a quarter of its
// triangles, its maps half the size). The switch is three times its radius
// out, and never nearer than 60 m.
export const lodDistance = (radius) => Math.max(60, 3 * radius);
// a THREE.LOD in the model's place: its position, turn and scale move up
// to the LOD, so either level is drawn in the same spot (`low` now, or
// later with addLowLevel)
export function withLod(full, low, radius) {
  const lod = new THREE.LOD();
  lod.name = full.name;
  lod.position.copy(full.position);
  lod.quaternion.copy(full.quaternion);
  lod.scale.copy(full.scale);
  full.parent?.remove(full);
  full.position.set(0, 0, 0);
  full.quaternion.identity();
  full.scale.set(1, 1, 1);
  lod.addLevel(full, 0);
  if (low) addLowLevel(lod, low, radius);
  return lod;
}
export function addLowLevel(lod, low, radius) {
  low.position.set(0, 0, 0);
  low.quaternion.identity();
  low.scale.set(1, 1, 1);
  lod.addLevel(low, lodDistance(radius));
}
// a model's radius (its bounding sphere's, measured once)
function radiusOf(gltf) {
  const root = gltf.scene;
  if (root.userData.radius == null) root.userData.radius = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere()).radius;
  return root.userData.radius;
}

// What a built thing (props/*.js: { object, solids, floors, update, signal })
// adds to the world, set where it stands (`at`), turned by spec.yaw and
// scaled by spec.scale: its walls (unless spec.solid is false) and the floors
// you walk on, and, when its own meshes are drawn (`object`), its moving
// parts (an update each frame, an answer to signals).
export function applyBuilt(made, spec, at, world, { updates, signals, object }) {
  const yaw = spec.yaw ?? 0;
  const k = spec.scale ?? 1;
  if (spec.solid !== false) for (const s of made.solids ?? []) addSolid(world, s, at, yaw, k, null);
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  for (const f of made.floors ?? []) {
    world.floors.push({ ...f, x: at[0] + (f.x * c + f.z * sn) * k, z: at[2] + (-f.x * sn + f.z * c) * k, y: at[1] + f.y * k, r: f.r != null ? f.r * k : undefined, hw: f.hw != null ? f.hw * k : undefined, hd: f.hd != null ? f.hd * k : undefined, yaw: f.r != null ? undefined : (f.yaw ?? 0) + yaw });
  }
  if (!object) return;
  if (made.update) updates.push(made.update);
  if (made.signal) signals.push(made.signal);
}

// the instances `which` of an instanced mesh, from its kept matrices `src`
function copyInstances(mesh, src, which) {
  const dst = mesh.instanceMatrix.array;
  for (let k = 0; k < which.length; k++) dst.set(src.subarray(which[k] * 16, which[k] * 16 + 16), k * 16);
  mesh.count = which.length;
  mesh.instanceMatrix.needsUpdate = true;
}

// a built prop's meshes as instancing parts (for scattering a built kind)
function partsOf(made) {
  const out = [];
  made.object.updateMatrixWorld(true);
  made.object.traverse((o) => {
    if (o.isMesh) out.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone(), shadow: o.castShadow });
  });
  return out;
}
