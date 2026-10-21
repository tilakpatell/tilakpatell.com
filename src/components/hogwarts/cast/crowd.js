// The school as a crowd (the design’s §4.10 and §4.14): the Great Hall’s
// four tables full, the station’s platform streaming with students. A few
// hundred skinned figures, each with its own mixer, would cost a frame; so
// each body is cut down once (meshoptimizer’s edge collapse, from three’s
// libraries: the skin’s weights and the uvs ride along, so a figure
// across a hall keeps its face with a fifth of its triangles), posed through
// a clip of the library, a handful of moments of it baked into still meshes
// (the skin applied on the CPU), and the crowd drawn instanced: one mesh a body
// and a clip, its moments morph targets, every place reading its own moment
// of the clip from the instance morph texture (blended between the two
// nearest, at its own pace and offset), so a table breathes and shifts and
// nobody moves in unison, and nothing is swapped a frame. A table cheers by
// moving its places onto the cheer’s mesh.
//
//   decimate(geometry, cell) → geometry   (pure geometry: the clusters of a
//     cell, each a vertex at their mean, a seam’s two sides kept apart by
//     their uv, the triangles that collapse dropped)
//   bakePose(root) → geometry: every skinned mesh under root as posed now, merged, in root’s frame
//   createCrowd({ rt, spots, bodies, clips, tier }) → { group, ready, cheer(match, seconds), move(spots), set({ visible }), step(dt), info(), dispose() }
//     move(spots): the places moved where `spots` (by index) now are: a boat’s crew carried with it
//   prebake(rt, bodies, clips, { tier, sit }): the far bakes begun ahead of the crowd that wants them
//   forgetCrowds(): the shared bakes let go, as the world goes
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
// fitted to its hips and its facing), at FRAMES moments of the clip, each cut down.
// (the animator counts a tenth of a second at most a step: the clip is walked in those)
const BAKE_STEP = 0.1;

// The bakes, shared: every crowd that wants a body doing a clip at a cut gets
// the same frames (the boats’ first-years and the hall’s school share their
// sits), kept until the world goes (forgetCrowds). And the work done a few
// milliseconds a frame, one bake after another, so a hall filling up never
// takes the frame rate down with it.
const bakes = new Map(); // key → Promise<{ frames, hips }>
const BUDGET = 5; // ms of baking a frame
let queue = Promise.resolve();
let sliceStart = 0;
const nextFrame = () => new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
async function slice() {
  if (now() - sliceStart < BUDGET) return;
  await nextFrame();
  sliceStart = now();
}
function bakeShared(tpl, how, opts) {
  const key = `${tpl.name}|${how.base}|${how.play}|${opts.frames}|${opts.height.toFixed(2)}|${opts.triangles}|${opts.permissive}`;
  if (!bakes.has(key)) {
    const job = queue.then(async () => {
      sliceStart = now();
      return bakeClip(tpl, how, opts);
    });
    queue = job.catch(() => {});
    bakes.set(key, job);
    job.then((b) => !b?.frames?.length && bakes.get(key) === job && bakes.delete(key)).catch(() => bakes.delete(key));
  }
  return bakes.get(key);
}
// a crowd’s far bakes started before it is made (the hall’s school while the
// boats are still on the lake), so it fills its benches as it’s shown
export async function prebake(rt, bodies, clips = { idle: 'sit.idle', cheer: 'sit.cheer' }, { tier = 'high', sit = true, height = null } = {}) {
  const frames = FRAMES[tier] ?? FRAMES.high;
  for (const body of bodies) {
    const tpl = await loadFigure(body, rt);
    if (!tpl) continue;
    const h = height ?? heightOf(body);
    for (const [doing, name] of Object.entries(clips)) {
      const how = doing === 'idle' ? { base: name, play: null } : { base: sit ? clips.idle : null, play: name };
      bakeShared(tpl, how, { frames, height: h, triangles: CUT[tier] ?? CUT.high, permissive: true }).catch(() => {});
    }
  }
}

// (the shared frames let go with the world)
export function forgetCrowds() {
  for (const p of bakes.values()) p.then((b) => b?.frames?.forEach((f) => f.geometry.dispose())).catch(() => {});
  bakes.clear();
  cuts.clear();
}
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
    await slice();
  }
  if (play) {
    let playing = false;
    anim.play(play, { layer: 'full', loop: true, fade: 0.05 });
    for (let i = 0; i < 200 && !playing; i++) {
      step(0.02);
      playing = anim.playing('full') === play;
      await slice();
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
    if (f) for (let t = 0; t < span / frames - 1e-6; t += BAKE_STEP) step(Math.min(BAKE_STEP, span / frames - t));
    await slice();
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
  // (the cut skin was the template’s to share; the clone’s own bones go with it)
  return { frames: there ? out : [], hips: seat ?? [0, height * 0.5, 0], span };
}

// a bake’s moments as one geometry: the first its base, the rest morph
// targets relative to it (the same vertices posed again), shared by every
// crowd drawing that bake
const morphs = new WeakMap(); // baked → geometry
function morphOf(baked) {
  if (morphs.has(baked)) return morphs.get(baked);
  const [first, ...rest] = baked.frames.map((f) => f.geometry);
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) if (first.attributes[name]) g.setAttribute(name, first.attributes[name]);
  g.setIndex(first.index);
  const deltas = (name) =>
    rest.map((f) => {
      const a = f.attributes[name].array;
      const b = first.attributes[name].array;
      const d = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) d[i] = a[i] - b[i];
      return new THREE.Float32BufferAttribute(d, 3);
    });
  g.morphAttributes.position = deltas('position');
  g.morphAttributes.normal = deltas('normal');
  g.morphTargetsRelative = true;
  g.computeBoundingSphere();
  // (the moments move the figure a little off its first pose: room in the bounds for that)
  if (g.boundingSphere) g.boundingSphere.radius *= 1.25;
  morphs.set(baked, g);
  return g;
}

export function createCrowd({ rt = null, spots = [], bodies = ['student'], clips = { idle: 'sit.idle', cheer: 'sit.cheer' }, tier = 'high', height = null, sit = true }) {
  const group = new THREE.Group();
  group.name = 'hogwarts:crowd';
  const frames = FRAMES[tier] ?? FRAMES.high;
  const lods = [{ lod: 'far', triangles: CUT[tier] ?? CUT.high, permissive: true }, ...((CUT_NEAR[tier] ?? 0) ? [{ lod: 'near', triangles: CUT_NEAR[tier], permissive: false }] : [])];
  // each place: its body, where it is in its clip and how fast it goes
  // through it (no two breathe together), what it is doing, how near the eye
  const places = spots.map((s, i) => {
    const h = Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453) % 1;
    return { ...s, body: s.body ?? bodies[i % bodies.length], offset: h, pace: 0.88 + ((h * 7) % 1) * 0.24, doing: 'idle', until: 0, lod: 'far' };
  });
  const sets = new Map(); // `${body}|${doing}|${lod}` → { mesh, hips, span, n, len, morph, slots: [place] }
  const materials = new Set();
  let gone = false;
  let t = 0;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const matrices = (set, clip, body, lod) => {
    const mesh = set.mesh;
    let n = 0;
    set.slots.length = 0;
    for (const p of places) {
      // (a place drawn near, if its near set has come; else far)
      const at = p.lod === 'near' && sets.has(`${body}|${clip}|near`) ? 'near' : 'far';
      if (p.body !== body || p.doing !== clip || at !== lod) continue;
      q.setFromAxisAngle(up, p.yaw ?? 0);
      // (sat: the baked hips put on the seat, turned as the place faces)
      if (sit) {
        const [hx, hy, hz] = set.hips;
        const c = Math.cos(p.yaw ?? 0);
        const sn = Math.sin(p.yaw ?? 0);
        _v.set(p.at[0] - (hx * c + hz * sn), p.at[1] - hy + 0.17, p.at[2] - (-hx * sn + hz * c));
      } else _v.set(p.at[0], p.at[1], p.at[2]);
      m4.compose(_v, q, one);
      mesh.setMatrixAt(n, m4);
      set.slots.push(p);
      n++;
    }
    // (never a lone instance: the node renderer reads each instance’s moment
    // only when there are two or more, so a lone place has a spare, unseen)
    if (n === 1 && mesh.instanceMatrix.count > 1) {
      mesh.setMatrixAt(1, m4.makeScale(0, 0, 0));
      set.slots.push(set.slots[0]);
    }
    mesh.count = n === 1 && mesh.instanceMatrix.count > 1 ? 2 : n;
    mesh.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  // each instance its own moment of the clip, blended between the two nearest
  // (the base is the first moment; a target each of the rest, relative to it)
  const pose = (set) => {
    const { len, n, span, morph } = set;
    morph.fill(0, 0, set.mesh.count * len);
    set.slots.forEach((p, i) => {
      const u = (((((t * p.pace) / span + p.offset) % 1) + 1) % 1) * n;
      const f = Math.floor(u) % n;
      const g = (f + 1) % n;
      const a = u - Math.floor(u);
      const o = i * len;
      morph[o] = 1;
      if (f > 0) morph[o + f] += 1 - a;
      if (g > 0) morph[o + g] += a;
    });
    set.mesh.morphTexture.needsUpdate = true;
  };

  const templates = new Map(); // body → template
  const mats = new Map(); // body → the crowd’s material for it
  // a body doing its clips at a cut, baked (or taken from the shared bakes) and drawn
  const want = async (body, lod) => {
    const tpl = templates.get(body) ?? (await loadFigure(body, rt));
    if (!tpl || gone) return;
    templates.set(body, tpl);
    const spec = lods.find((l) => l.lod === lod);
    if (!spec) return;
    const h = height ?? heightOf(body);
    for (const [doing, name] of Object.entries(clips)) {
      const key = `${body}|${doing}|${lod}`;
      if (sets.has(key)) continue;
      // (a sat crowd’s cheer is played over its sit; a standing one’s idle is a state of its own)
      const how = doing === 'idle' ? { base: name, play: null } : { base: sit ? clips.idle : null, play: name };
      const baked = await bakeShared(tpl, how, { frames, height: h, triangles: spec.triangles, permissive: spec.permissive }).catch(() => null);
      if (!baked?.frames?.length || gone || sets.has(key)) continue;
      if (!mats.has(body)) {
        const src = baked.frames[0].material;
        const m = new MeshStandardNodeMaterial({ map: src?.map ?? null, color: src?.color ?? new THREE.Color(0xffffff), roughness: 0.85, metalness: 0 });
        materials.add(m);
        mats.set(body, m);
      }
      const cap = Math.max(2, places.filter((p) => p.body === body).length + 1);
      const mesh = new THREE.InstancedMesh(morphOf(baked), mats.get(body), cap);
      // (no influences of its own: the instances’ come from the texture, and the
      // targets are relative, so the base needs none either. An array here
      // the node renderer makes a uniform array of that the texture’s path
      // never sets up, and its update then fails every frame on a null buffer)
      mesh.morphTargetInfluences = null;
      const n = baked.frames.length;
      // (the base’s column, then one for each moment after the first)
      const len = n;
      const morph = new Float32Array(len * cap);
      mesh.morphTexture = new THREE.DataTexture(morph, len, cap, THREE.RedFormat, THREE.FloatType);
      mesh.count = 0;
      mesh.visible = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      group.add(mesh);
      sets.set(key, { mesh, hips: baked.hips, span: baked.span ?? 2, n, len, morph, slots: [] });
      relayout();
    }
  };
  const nearAsked = new Set();
  const askNear = (body) => {
    if (nearAsked.has(body) || !lods.some((l) => l.lod === 'near')) return;
    nearAsked.add(body);
    want(body, 'near').catch(() => {});
  };
  const ready = (async () => {
    for (const body of [...new Set(places.map((p) => p.body))]) await want(body, 'far');
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
        p.until = t + seconds * (0.8 + p.offset * 0.4);
        changed = true;
      }
      if (changed) relayout();
    },
    move(next) {
      next.forEach((s, i) => {
        const p = places[i];
        if (!p || !s) return;
        p.at = s.at;
        if (s.yaw != null) p.yaw = s.yaw;
      });
      relayout();
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
          if (lod === 'near') askNear(p.body);
          if (lod !== p.lod) {
            p.lod = lod;
            back = true;
          }
        }
      }
      if (back) relayout();
      if (!group.visible) return;
      for (const set of sets.values()) if (set.mesh.count) pose(set);
    },
    info() {
      let draws = 0;
      let triangles = 0;
      for (const set of sets.values())
        if (set.mesh.visible) {
          draws++;
          triangles += (set.mesh.geometry.index.count / 3) * set.mesh.count;
        }
      return { draws, triangles, places: places.length };
    },
    dispose() {
      gone = true;
      // (the geometry is the shared bakes’: forgetCrowds lets it go with the world)
      for (const set of sets.values()) {
        set.mesh.morphTexture?.dispose();
        set.mesh.morphTexture = null;
        set.mesh.dispose?.();
      }
      for (const m of materials) m.dispose();
      group.removeFromParent();
    },
  };
}
