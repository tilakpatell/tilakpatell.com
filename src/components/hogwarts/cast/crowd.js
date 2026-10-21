// The school as a crowd (the design’s §4.10 and §4.14): the Great Hall’s
// four tables full, the station’s platform streaming with students. A few
// hundred skinned figures, each with its own mixer, would cost a frame; so
// each body is cut down once (meshoptimizer’s edge collapse, from three’s
// libraries: the skin’s weights and the uvs ride along, so a figure
// across a hall keeps its face with a fifth of its triangles), posed through
// a clip of the library, a handful of moments of it baked into still meshes
// (the skin applied on the CPU), and the crowd drawn instanced: a mesh a body, a
// moment and a phase group, the groups stepping through the moments out of
// step with each other, so a table breathes and shifts and nobody moves in
// unison. A table cheers by moving its places onto the cheer’s moments.
//
//   decimate(geometry, cell) → geometry   (pure geometry: the clusters of a
//     cell, each a vertex at their mean, a seam’s two sides kept apart by
//     their uv, the triangles that collapse dropped)
//   bakePose(root) → geometry: every skinned mesh under root as posed now, merged, in root’s frame
//   createCrowd({ rt, spots, bodies, clips, tier }) → { group, ready, cheer(match, seconds), set({ visible }), step(dt), info(), dispose() }
//     spots: [{ at: [x, y, z], yaw, body?, tag?, sit? }] (y: the seat’s top, or the floor’s)
//     clips: { idle, cheer } library names (the seated ones: 'sit.idle', 'sit.cheer')
//     cheer(match, seconds): the places whose tag `match` returns true cheer for a while

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { createAnimator } from '../../../lib/three/animator';
import { heightOf, loadFigure } from './figures';

export async function cut(geometry, triangles, { permissive = true } = {}) {
  const index = geometry.index;
  const have = index ? index.count / 3 : geometry.attributes.position.count / 3;
  if (!index || have <= triangles) return geometry;
  await MeshoptSimplifier.ready;
  const pos = geometry.attributes.position;
  const n = pos.count;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) positions.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
  // (the normals and the uvs weigh in, so a collapse that would smear the
  // face or tear the shading costs more; ‘Permissive’ lets it cross a uv
  // seam when it must: Meshy’s atlases are in many islands, and locked
  // seams stopped the cut at twice the triangles asked)
  const nrm = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const stride = (nrm ? 3 : 0) + (uv ? 2 : 0);
  const attrs = new Float32Array(n * Math.max(1, stride));
  const weights = [...(nrm ? [0.25, 0.25, 0.25] : []), ...(uv ? [0.6, 0.6] : [])];
  for (let i = 0, o = 0; i < n; i++) {
    if (nrm) {
      attrs[o++] = nrm.getX(i);
      attrs[o++] = nrm.getY(i);
      attrs[o++] = nrm.getZ(i);
    }
    if (uv) {
      attrs[o++] = uv.getX(i);
      attrs[o++] = uv.getY(i);
    }
  }
  const target = Math.max(3, Math.floor(triangles) * 3);
  const src = index.array instanceof Uint32Array ? index.array : Uint32Array.from(index.array);
  const flags = permissive ? ['Permissive'] : [];
  const [indices] = stride ? MeshoptSimplifier.simplifyWithAttributes(src, positions, 3, attrs, stride, weights, null, target, 1, flags) : MeshoptSimplifier.simplify(src, positions, 3, target, 1, flags);
  // (only the vertices still used, every attribute carried: the skin’s weights among them)
  const [remap, unique] = MeshoptSimplifier.compactMesh(indices);
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geometry.attributes)) {
    const a = geometry.getAttribute(name);
    const b = new THREE.BufferAttribute(new a.array.constructor(unique * a.itemSize), a.itemSize, a.normalized);
    for (let i = 0; i < remap.length; i++) {
      const t = remap[i];
      if (t === 0xffffffff) continue;
      for (let k = 0; k < a.itemSize; k++) b.setComponent(t, k, a.getComponent(i, k));
    }
    out.setAttribute(name, b);
  }
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  out.computeBoundingSphere();
  return out;
}

const _v = new THREE.Vector3();

export function bakePose(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.skeleton?.update();
    const src = o.geometry;
    const n = src.attributes.position.count;
    const out = new Float32Array(n * 3);
    const to = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < n; i++) {
      o.getVertexPosition(i, _v);
      _v.applyMatrix4(to);
      out[i * 3] = _v.x;
      out[i * 3 + 1] = _v.y;
      out[i * 3 + 2] = _v.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(out, 3));
    if (src.attributes.uv) {
      const uv = src.attributes.uv;
      const u = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        u[i * 2] = uv.getX(i);
        u[i * 2 + 1] = uv.getY(i);
      }
      g.setAttribute('uv', new THREE.BufferAttribute(u, 2));
    }
    if (src.index) g.setIndex(Array.from(src.index.array));
    parts.push({ g, material: o.material });
  });
  if (!parts.length) return null;
  const g = parts.length === 1 ? parts[0].g : mergeGeometries(parts.map((p) => p.g));
  return { geometry: g, material: parts[0].material };
}

const FRAMES = { low: 4, mid: 6, high: 8, ultra: 10 };
const PHASES = { low: 2, mid: 3, high: 3, ultra: 4 };
const FPS = 7; // the moments a second a phase group steps through
// the triangles a figure in the crowd is cut to, by the tier: across the
// hall (its seams let go), and within NEAR metres of the eye (its seams kept,
// so a face at the next table is a face)
const CUT = { low: 700, mid: 1100, high: 1500, ultra: 2600 };
const CUT_NEAR = { low: 0, mid: 3500, high: 4500, ultra: 7000 };
const NEAR = 7.5; // m
const RELOD = 0.4; // s between looks at who is near
const cuts = new Map(); // `${body}|${triangles}` → Promise<[geometry]> (each skinned mesh’s, cut)

// a body’s clip baked: the template posed through the animator (as every
// figure on the site is: its sits go in through their way down, its clips are
// fitted to its hips and its facing), at FRAMES moments of the clip, each cut down
const BAKE_STEP = 1 / 30;
async function cutFigure(tpl, triangles, permissive) {
  const key = `${tpl.name}|${triangles}|${permissive}`;
  if (!cuts.has(key)) {
    const meshes = [];
    tpl.scene.traverse((o) => o.isSkinnedMesh && meshes.push(o));
    const share = triangles / Math.max(1, meshes.length);
    cuts.set(key, Promise.all(meshes.map((m) => cut(m.geometry, share, { permissive }))));
  }
  return cuts.get(key);
}

async function bakeClip(tpl, { base = null, play = null }, { frames, height, triangles, permissive = true }) {
  const model = cloneSkinned(tpl.scene);
  // (the cut skin in place of the whole one: the bones and the weights are the same)
  const cutGeos = await cutFigure(tpl, triangles, permissive);
  let mi = 0;
  model.traverse((o) => {
    if (o.isSkinnedMesh && cutGeos[mi]) o.geometry = cutGeos[mi++];
  });
  const k = height / Math.max(tpl.top, 1e-3);
  const anim = createAnimator(model, { clips: tpl.own, hipsY: tpl.hipsY, up: tpl.up, key: `hogwarts:${tpl.name}`, seed: 1 });
  const still = { move: 0, speed: 0, side: 0, turn: 0, down: 0, air: 0 };
  const frame = { forward: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) };
  const step = (dt) => {
    anim.locomote(still);
    anim.update(dt);
    anim.after(dt, still, frame);
  };
  // (into the pose first: a sit through its way down, settled; then the clip played over it)
  let there = !base;
  if (base) anim.base(base, { fade: 0.05 }).then((r) => (there = r === 'done'));
  for (let i = 0; i < 400 && !there; i++) {
    step(0.05);
    if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
  }
  if (play) {
    let playing = false;
    anim.play(play, { layer: 'full', loop: true, fade: 0.05 });
    for (let i = 0; i < 200 && !playing; i++) {
      step(0.02);
      playing = anim.playing('full') === play;
      if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
    }
    there = there && playing;
  }
  step(0.3);
  const name = play ?? base;
  const clip = anim.actions?.[name]?.getClip?.() ?? null;
  const span = clip?.duration ?? 2;
  const out = [];
  let seat = null;
  const hips = model.getObjectByName('Hips');
  const root = new THREE.Matrix4();
  for (let f = 0; f < frames; f++) {
    if (f) for (let t = 0; t < span / frames - 1e-6; t += BAKE_STEP) step(BAKE_STEP);
    model.updateMatrixWorld(true);
    const baked = bakePose(model);
    if (!baked) break;
    const g = baked.geometry.scale(k, k, k).translate(0, -tpl.ground * k, 0);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    // (where the hips sit in the baked figure: a sat one’s are well behind its feet)
    if (seat == null && hips) {
      root.copy(model.matrixWorld).invert();
      hips.getWorldPosition(_v).applyMatrix4(root);
      seat = [_v.x * k, (_v.y - tpl.ground) * k, _v.z * k];
    }
    out.push({ geometry: g, material: baked.material });
  }
  anim.dispose();
  return { frames: there ? out : [], hips: seat ?? [0, height * 0.5, 0] };
}

export function createCrowd({ rt = null, spots = [], bodies = ['student'], clips = { idle: 'sit.idle', cheer: 'sit.cheer' }, tier = 'high', height = null, sit = true }) {
  const group = new THREE.Group();
  group.name = 'hogwarts:crowd';
  const frames = FRAMES[tier] ?? FRAMES.high;
  const phases = PHASES[tier] ?? PHASES.high;
  const lods = [{ lod: 'far', triangles: CUT[tier] ?? CUT.high, permissive: true }, ...((CUT_NEAR[tier] ?? 0) ? [{ lod: 'near', triangles: CUT_NEAR[tier], permissive: false }] : [])];
  // each place: its body, its phase group, what it is doing, how near the eye it is
  const places = spots.map((s, i) => ({ ...s, body: s.body ?? bodies[i % bodies.length], phase: (i * 7) % phases, doing: 'idle', until: 0, lod: 'far' }));
  const sets = new Map(); // `${body}|${doing}|${lod}` → { frames, hips, meshes: [phase] }
  const materials = new Set();
  let gone = false;
  let t = 0;
  let tick = -1;

  const matrices = (set, clip, body, lod) => {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let g = 0; g < phases; g++) {
      const mesh = set.meshes[g];
      let n = 0;
      for (const p of places) {
        // (a place drawn near, if its near set has come; else far)
        const at = p.lod === 'near' && sets.has(`${body}|${clip}|near`) ? 'near' : 'far';
        if (p.body !== body || p.phase !== g || p.doing !== clip || at !== lod) continue;
        q.setFromAxisAngle(up, p.yaw ?? 0);
        // (sat: the baked hips put on the seat, turned as the place faces)
        if (sit) {
          const [hx, hy, hz] = set.hips;
          const c = Math.cos(p.yaw ?? 0);
          const sn = Math.sin(p.yaw ?? 0);
          _v.set(p.at[0] - (hx * c + hz * sn), p.at[1] - hy + 0.17, p.at[2] - (-hx * sn + hz * c));
        } else _v.set(p.at[0], p.at[1], p.at[2]);
        m4.compose(_v, q, new THREE.Vector3(1, 1, 1));
        mesh.setMatrixAt(n++, m4);
      }
      mesh.count = n;
      mesh.visible = n > 0;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  };

  const ready = (async () => {
    const want = [...new Set(places.map((p) => p.body))];
    for (const body of want) {
      const tpl = await loadFigure(body, rt);
      if (!tpl || gone) continue;
      const h = height ?? heightOf(body);
      let mat = null;
      for (const { lod, triangles, permissive } of lods)
        for (const [doing, name] of Object.entries(clips)) {
          // (a sat crowd’s cheer is played over its sit; a standing one’s idle is a state of its own)
          const how = doing === 'idle' ? { base: name } : { base: sit ? clips.idle : null, play: name };
          const baked = await bakeClip(tpl, how, { frames, height: h, triangles, permissive }).catch(() => ({ frames: [] }));
          if (!baked.frames.length || gone) continue;
          const src = baked.frames[0].material;
          if (!mat) {
            mat = new MeshStandardNodeMaterial({ map: src?.map ?? null, color: src?.color ?? new THREE.Color(0xffffff), roughness: 0.85, metalness: 0 });
            materials.add(mat);
          }
          const cap = places.filter((p) => p.body === body).length;
          const meshes = Array.from({ length: phases }, () => {
            const m = new THREE.InstancedMesh(baked.frames[0].geometry, mat, Math.max(1, cap));
            m.count = 0;
            m.visible = false;
            m.castShadow = false;
            m.receiveShadow = true;
            group.add(m);
            return m;
          });
          const set = { frames: baked.frames.map((f) => f.geometry), hips: baked.hips, meshes };
          sets.set(`${body}|${doing}|${lod}`, set);
          relayout();
        }
    }
    tick = -1;
    return !gone;
  })();

  function relayout() {
    for (const [key, set] of sets) {
      const [body, doing, lod] = key.split('|');
      matrices(set, doing, body, lod);
    }
  }
  const eye = new THREE.Vector3();
  let sinceLod = RELOD;

  return {
    group,
    ready,
    places,
    cheer(match, seconds = 6) {
      let changed = false;
      for (const p of places) {
        if (!match(p) || !sets.has(`${p.body}|cheer|far`)) continue;
        p.doing = 'cheer';
        p.until = t + seconds * (0.8 + ((p.phase * 37) % 10) / 25);
        changed = true;
      }
      if (changed) relayout();
    },
    set({ visible } = {}) {
      if (visible != null) group.visible = Boolean(visible);
    },
    // ctx.camera: the eye, so the places near it are drawn from the finer cut
    step(dt, ctx = {}) {
      t += dt;
      let back = false;
      for (const p of places)
        if (p.doing !== 'idle' && t > p.until) {
          p.doing = 'idle';
          back = true;
        }
      if (ctx.camera && lods.length > 1 && (sinceLod += dt) >= RELOD) {
        sinceLod = 0;
        group.updateWorldMatrix(true, false);
        group.worldToLocal(eye.copy(ctx.camera.position));
        for (const p of places) {
          const lod = Math.hypot(p.at[0] - eye.x, p.at[2] - eye.z) < NEAR ? 'near' : 'far';
          if (lod !== p.lod) {
            p.lod = lod;
            back = true;
          }
        }
      }
      if (back) relayout();
      const k = Math.floor(t * FPS);
      if (k === tick) return;
      tick = k;
      // each phase group a few moments on from the last, so no two tables breathe together
      for (const set of sets.values())
        set.meshes.forEach((m, g) => {
          m.geometry = set.frames[(k + g * Math.max(1, Math.floor(set.frames.length / phases))) % set.frames.length];
        });
    },
    info() {
      let draws = 0;
      let triangles = 0;
      for (const set of sets.values())
        for (const m of set.meshes)
          if (m.visible) {
            draws++;
            triangles += (m.geometry.index.count / 3) * m.count;
          }
      return { draws, triangles, places: places.length };
    },
    dispose() {
      gone = true;
      for (const set of sets.values()) {
        for (const g of set.frames) g.dispose();
        for (const m of set.meshes) m.dispose?.();
      }
      for (const m of materials) m.dispose();
      group.removeFromParent();
    },
  };
}
