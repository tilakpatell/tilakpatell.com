// Lane 4a's things in space drawn near, through lane 2's `drawers` hook
// (expanse/scene/nearThings.js): a drawer a kind, each one InstancedMesh a
// part of the kind's shape (shapes.js), its instances placed by layout.js
// and the shared clock. Nothing is made until a kind is first near; each
// mesh made goes through `prepare` once, as lane 2's own do.
//
// Every entry fades in over the last fifth of its reach (its weight, w): a
// lit part is scaled by w about its own middle, a glowing part dimmed by it,
// so a storm or a herd with no far-layer disc never pops in, and a thing with
// a disc grows in as its disc fades. Each mesh sits at an anchor near what it
// draws (layout.js's anchorOf of its first entry), its instances written from
// there, so a rock millions out keeps its place within a pixel.
//
// createThingDrawers({ budget, tier }) → { drawers: { [kind]: (group, { prepare }) → { update(entries,
//   camera, t), dispose() } }, drawn() → { [kind]: instances shown } }
//   budget: a thunk giving universe/budget.js's row (thingKinds' counts cap a field's rocks, a
//   debris field's pieces and a herd's or swarm's creatures)
// The gargantuans' meshes are gargantuans.js's, added to the same map.

import * as THREE from 'three';
import { fleetLayout, traitsOf } from '../../expanse/shared/gen';
import { levelWeights } from '../../expanse/shared/levels';
import { anchorOf, beamDirs, blink, cometParts, fieldRocks, herdBodies, rigHaulers, seededRng } from './layout';
import { DRAWN, partsOf } from './shapes';
import { GIANT_KINDS, createGiantDrawer } from './gargantuans';

const ENTRIES = 24; // (a kind's entries near at once, at most: lane 2's cap is thingsNear, 32 on mid)
const PER = { rocks: null, pieces: null, bodies: null, haulers: 5, ships: 7, puffs: 28, sparks: 6, motes: 24, beams: 2 };
const TAU = 2 * Math.PI;
const frac = (x) => x - Math.floor(x);
const Y = new THREE.Vector3(0, 1, 0);

const weightOf = (e) => {
  if (!(e.share > 0)) return 1;
  return levelWeights(e.d, { reach: e.d / e.share }).full;
};

function perOf(many, budget, row) {
  const k = budget()?.thingKinds ?? {};
  if (many === 'rocks') return k.rocks ?? 96;
  if (many === 'pieces') return k.pieces ?? 32;
  if (many === 'bodies') return Math.min(row?.bodies ?? 8, k.bodies ?? 8);
  if (many === 'motes') return Math.min(24, (k.bodies ?? 8) * 3);
  return PER[many] ?? 1;
}

// what each entry puts in each part: calls put(partName, x, y, z, quaternion, sx, sy, sz, glow)
const q = new THREE.Quaternion();
const e3 = new THREE.Euler();
const v = new THREE.Vector3();
const spin = (seed, t, rate = 0.02) => {
  const r = seededRng(seed);
  const a = r();
  return e3.set(a * TAU, r() * TAU + TAU * frac((t * rate * (r() - 0.5)) / TAU), r() * TAU);
};

function place(kind, e, t, w, budget, put, names) {
  const { at, size, row } = e;
  const seed = row?.seed ?? 1n;
  const s = size * w;
  q.setFromEuler(spin(seed, t, 0));
  if (kind === 'comet') {
    const c = cometParts(row, t);
    q.setFromEuler(spin(seed, t, 0.05));
    put('nucleus', c.head, q, s, s, s);
    put('coma', c.head, q, c.coma, c.coma, c.coma, w);
    q.setFromUnitVectors(Y, v.set(...c.tail.dir));
    put('tail', c.head, q, c.coma * 0.7, c.tail.length * size, c.coma * 0.7, w);
    return;
  }
  if (kind === 'field' || kind === 'icefield') {
    const n = perOf('rocks', budget);
    const k = size / 60;
    for (const r of fieldRocks(row, n)) {
      q.setFromEuler(e3.set(r.x, r.y + t * 0.01 * (r.shape - 1), r.z));
      put(kind === 'field' ? 'rocks' : 'shards', [at[0] + r.x, at[1] + r.y, at[2] + r.z], q, r.r * k * w, r.r * k * w, r.r * k * w);
    }
    return;
  }
  if (kind === 'rig') {
    put('rock', at, q, s * 0.8, s * 0.8, s * 0.8);
    q.identity();
    for (const p of ['tower', 'lights']) put(p, at, q, s, s, s, p === 'lights' ? w : 1);
    for (const h of rigHaulers(row, PER.haulers, t)) {
      q.setFromAxisAngle(Y, h.heading);
      put('haulers', h.at, q, s * 0.25, s * 0.25, s * 0.25);
    }
    return;
  }
  if (kind === 'debris') {
    const r = seededRng(seed);
    for (let i = 0, n = perOf('pieces', budget); i < n; i++) {
      const p = [at[0] + (r() * 2 - 1) * size, at[1] + (r() * 2 - 1) * size * 0.4, at[2] + (r() * 2 - 1) * size];
      q.setFromEuler(e3.set(r() * TAU + t * 0.01, r() * TAU, r() * TAU));
      const k = size * (0.04 + 0.1 * r()) * w;
      put('pieces', p, q, k, k, k);
    }
    return;
  }
  if (kind === 'fleet') {
    for (const sh of fleetLayout(row, at)) {
      q.setFromAxisAngle(Y, sh.heading);
      put('ships', sh.at, q, sh.length * w, sh.length * w, sh.length * w);
    }
    return;
  }
  if (kind === 'storm') {
    const r = seededRng(seed);
    for (let i = 0; i < PER.puffs; i++) {
      // (a flattened drift of puffs, each breathing on its own clock)
      const p = [at[0] + (r() * 2 - 1) * size * 0.7, at[1] + (r() * 2 - 1) * size * 0.25, at[2] + (r() * 2 - 1) * size * 0.7];
      const k = size * (0.35 + 0.35 * r());
      const breathe = 0.65 + 0.35 * Math.sin(TAU * frac(t / (5 + 6 * r())) + i);
      put('puffs', p, q, k, k, k, w * breathe);
    }
    for (let i = 0; i < PER.sparks; i++) {
      // (lightning: a spark here, then gone, then somewhere else)
      const f = frac(t / (0.7 + r()) + r());
      const p = [at[0] + (r() * 2 - 1) * size * 0.5, at[1] + (r() * 2 - 1) * size * 0.2, at[2] + (r() * 2 - 1) * size * 0.5];
      const k = size * 0.12;
      put('sparks', p, q, k, k, k, f < 0.08 ? w : 0);
    }
    return;
  }
  if (kind === 'herd') {
    for (const b of herdBodies(row, perOf('bodies', budget, row), t)) {
      q.setFromAxisAngle(Y, b.heading);
      put('bodies', b.at, q, size * b.k * w, size * b.k * w, size * b.k * w);
    }
    return;
  }
  if (kind === 'swarm') {
    const r = seededRng(seed);
    for (let i = 0, n = perOf('motes', budget); i < n; i++) {
      const a = TAU * frac(t / (20 + 30 * r()) + r());
      const d = size * (0.5 + r());
      const k = size * 0.05;
      put('motes', [at[0] + Math.cos(a) * d, at[1] + (r() - 0.5) * size, at[2] + Math.sin(a) * d], q, k, k, k, w);
    }
    return;
  }
  if (kind === 'pulsar' || kind === 'magnetar') {
    put('star', at, q.identity(), s, s, s);
    put('halo', at, q, size * 1.2, size * 1.2, size * 1.2, w);
    const tr = traitsOf(row);
    for (const d of beamDirs(tr, t)) {
      q.setFromUnitVectors(Y, v.set(...d));
      put('beams', at, q, size * 2, size * tr.beam, size * 2, w);
    }
    return;
  }
  if (kind === 'wormhole') {
    q.setFromEuler(e3.set(0.3, TAU * frac(t / 40), 0));
    for (const p of ['throat', 'swirl', 'halo']) put(p, at, q, s, s, s, p === 'throat' ? 1 : w);
    return;
  }
  if (kind === 'beacon') {
    put('body', at, q, s, s, s);
    const b = blink(seed, t) * w;
    put('lamp', at, q, size * 1.6, size * 1.6, size * 1.6, b);
    return;
  }
  // (one of each part at its place: an outpost, a relay, a monolith, a forming star, a shipyard)
  for (const p of names) put(p, at, q, s, s, s, w);
}

function createKindDrawer(kind, group, { prepare, tier, budget }) {
  const parts = partsOf(kind, tier);
  const names = parts.map((p) => p.name);
  const meshes = new Map(); // part name → { mesh, part, cap, n }
  const colour = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let anchor = [0, 0, 0];
  let shown = 0;
  const meshOf = (name, need) => {
    let m = meshes.get(name);
    if (m && m.cap >= need) return m;
    const part = parts.find((p) => p.name === name);
    if (m) {
      m.mesh.removeFromParent();
      m.mesh.dispose();
    }
    const cap = Math.max(need, (m?.cap ?? 8) * 2);
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, cap);
    mesh.name = `things:${kind}:${name}`;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.setColorAt(0, colour.setRGB(1, 1, 1));
    group.add(mesh);
    prepare?.(mesh);
    m = { mesh, part, cap, n: 0 };
    meshes.set(name, m);
    return m;
  };
  const facing = new THREE.Quaternion(); // (the camera's turn: a glow's quad faces it)
  const put = (name, at, quat, sx, sy, sz, glow = 1) => {
    const m = meshOf(name, 1);
    if (m.n >= m.cap) return;
    pos.set(at[0] - anchor[0], at[1] - anchor[1], at[2] - anchor[2]);
    m4.compose(pos, m.part.billboard ? facing : quat, sc.set(sx, sy, sz));
    m.mesh.setMatrixAt(m.n, m4);
    if (m.part.additive) colour.setScalar(glow);
    else if (m.part.tint) colour.set(m.part.tint).offsetHSL(0, 0, ((m.n * 0.618) % 1 - 0.5) * 0.12);
    else colour.setRGB(1, 1, 1);
    m.mesh.setColorAt(m.n, colour);
    m.n++;
  };
  return {
    update(entries, camera, t) {
      // (room for this frame's instances, grown before writing so none is dropped)
      const list = entries.slice(0, ENTRIES);
      for (const p of parts) if (p.many) meshOf(p.name, list.length * perOf(p.many, budget, list[0]?.row));
      for (const m of meshes.values()) m.n = 0;
      if (list.length) anchor = anchorOf(list[0].at);
      if (camera?.getWorldQuaternion) camera.getWorldQuaternion(facing);
      shown = 0;
      for (const e of list) {
        const w = weightOf(e);
        if (!(w > 0.001)) continue;
        place(kind, e, t, w, budget, put, names);
        shown++;
      }
      for (const m of meshes.values()) {
        m.mesh.position.set(anchor[0], anchor[1], anchor[2]);
        m.mesh.count = m.n;
        m.mesh.visible = m.n > 0;
        m.mesh.instanceMatrix.needsUpdate = true;
        if (m.mesh.instanceColor) m.mesh.instanceColor.needsUpdate = true;
      }
    },
    shown: () => shown,
    dispose() {
      for (const m of meshes.values()) {
        m.mesh.removeFromParent();
        m.mesh.dispose();
      }
      meshes.clear();
      for (const p of parts) {
        p.geometry.dispose();
        p.material.dispose();
      }
    },
  };
}

export function createThingDrawers({ budget = () => null, tier = 'mid' } = {}) {
  const made = new Map(); // kind → its drawer
  const drawers = {};
  for (const kind of DRAWN)
    drawers[kind] = (group, { prepare } = {}) => {
      const d = createKindDrawer(kind, group, { prepare, tier, budget });
      made.set(kind, d);
      return d;
    };
  for (const kind of GIANT_KINDS)
    drawers[kind] = (group, { prepare } = {}) => {
      const d = createGiantDrawer(kind, group, { prepare, budget });
      made.set(kind, d);
      return d;
    };
  return {
    drawers,
    drawn: () => Object.fromEntries([...made].map(([k, d]) => [k, d.shown()])),
  };
}
