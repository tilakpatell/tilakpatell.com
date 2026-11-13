// The nearest generated systems, built whole: the star, a ball of its own
// light that lights what's near it; its planets on their orbits on the
// shared clock (orbits.js), each lit from it; their moons; a ring for each
// ring band. Built when the camera comes inside a system's build reach (its
// reach and AHEAD of its biggest body's radius more, so no planet of a system
// not built is a disc past 512 px, where a chip's point size can cap it), the
// budget's `systemsBuilt` nearest at most, and let go past 1.3 × its
// reach; between, its bodies are the far layer's discs (discs.js), the
// same size in the same place. Every new mesh is readied (`prepare`: its
// shaders made, its pictures sent) before it's shown.
//
// TYPE_LOOK: a planet type → a look (galaxy/bodies.js's LOOKS)
// STAR_STRENGTH: how strongly a star of a class lights what's near it
// createNear(group, { budget, tier, build = buildBody, prepare = null, perFrame = 1 }) → {
//   update(systems, cam, t, camera): systems are addBodies'd rows in the map's space,
//   built() → Set of system ids drawn whole (every body made and readied; till then its discs show),
//   stars() → [{ id, at, r, colour, strength, reach }] (one array, reused),
//   solids() → [{ id, at, r, reach }] (one array, its rows' `at` moved in place),
//   setStep(step): the pace's quality step, 0 to 3: fewer octaves on the ground,
//   dispose() }

import * as THREE from 'three';
import { buildBody } from '../../galaxy/bodies';
import { hot } from '../../../lib/three/canvasTexture';
import { moonAt, orbitAt } from '../gen/orbits';

export const TYPE_LOOK = {
  rock: 'moon-dust',
  ice: 'hoth',
  gas: 'yavin',
  ringed: 'bespin',
  lava: 'mustafar',
  ocean: 'kamino',
  forest: 'endor',
  desert: 'tatooine',
};
export const STAR_STRENGTH = { O: 0.9, B: 0.9, A: 0.9, F: 0.9, G: 0.9, K: 0.7, M: 0.7, 'white dwarf': 0.4, neutron: 0.4 };
const LET_GO = 1.3;
export const AHEAD = 7; // (radii: a ball r across is 512 px at 7 r on a 1,080 px screen at flight.js's field of view)
// how near the camera comes before a system's built whole
export const buildReach = (s) => {
  let most = s.star.size;
  for (const p of s.planets) most = Math.max(most, p.radius);
  return s.reach + AHEAD * most;
};
const STAR_GLOW = 3; // (over the bloom's threshold: a star is the brightest thing near it)

const BALL = new THREE.SphereGeometry(1, 32, 20); // (shared, never disposed)

const RING_VERT = /* glsl */ `
  varying float vR;
  void main() {
    vR = length(position.xy);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const RING_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uInner;
  uniform float uOuter;
  uniform float uSeed;
  varying float vR;
  float h(float x) { return fract(sin(x * 127.1 + uSeed * 311.7) * 43758.5453); }
  void main() {
    float u = (vR - uInner) / (uOuter - uInner);
    // bands: a few broad ones, finer ones over them, and gaps
    float b = h(floor(u * 9.0)) * 0.6 + h(floor(u * 37.0) + 50.0) * 0.4;
    float gap = step(0.18, h(floor(u * 23.0) + 9.0));
    float edge = smoothstep(0.0, 0.04, u) * smoothstep(1.0, 0.94, u);
    float a = (0.25 + 0.55 * b) * gap * edge;
    gl_FragColor = vec4(uColor * (0.6 + 0.5 * b), a);
  }
`;

// the way round a planet's orbit (orbits.js's turning axis), for its ring's plane
const axisOf = (p) => {
  const r0 = [p.at[0] - p.centre[0], p.at[1] - p.centre[1], p.at[2] - p.centre[2]];
  const yx = [r0[2], 0, -r0[0]];
  const m = [r0[1] * yx[2] - r0[2] * yx[1], r0[2] * yx[0] - r0[0] * yx[2], r0[0] * yx[1] - r0[1] * yx[0]];
  const l = Math.hypot(m[0], m[1], m[2]);
  return l > 0 ? new THREE.Vector3(m[0] / l, m[1] / l, m[2] / l) : new THREE.Vector3(0, 1, 0);
};
const Z = new THREE.Vector3(0, 0, 1);

export function createNear(group, { budget, tier = 'mid', build = buildBody, prepare = null, perFrame = 1 } = {}) {
  const most = Math.max(1, budget?.systemsBuilt ?? 1);
  const built = new Map(); // system id → { system, star, bodies: [{ row, body, kind, planet? }], rings, solids, queue, pending }
  const ids = new Set(); // (the systems whole and shown: their discs give way)
  const starList = [];
  const solidList = [];
  let step = 0;

  // a mesh shown once it's readied; the system counts it till then
  const show = (o, sys) => {
    o.visible = false;
    sys.pending++;
    const done = () => {
      o.visible = true;
      sys.pending--;
    };
    const p = prepare?.(o);
    if (p?.then) p.then(done, done);
    else done();
  };

  // A system's star at once (it lights what's near it from the first); its
  // planets, moons and rings a few a frame (perFrame), so a system of fifteen
  // bodies isn't made in one frame. Till every one is made and shown, the
  // system isn't in built() and its bodies are the far layer's discs.
  const buildSystem = (s) => {
    const g = new THREE.Group();
    g.name = `system:${s.id}`;
    group.add(g);
    const starMat = new THREE.MeshBasicMaterial({ color: hot(s.star.color, STAR_GLOW), toneMapped: false });
    const star = new THREE.Mesh(BALL, starMat);
    star.name = `star:${s.id}`;
    star.position.set(...s.at);
    star.scale.setScalar(s.star.size);
    g.add(star);
    const sys = { system: s, group: g, star, starMat, bodies: [], rings: [], entry: null, solids: [], queue: [], pending: 0 };
    show(star, sys);
    sys.entry = { id: s.id, at: s.at, r: s.star.size, colour: s.star.color, strength: STAR_STRENGTH[s.star.class] ?? 0.7, reach: s.reach * 3 };
    sys.solids.push({ id: s.id, at: s.at, r: s.star.size, reach: s.star.size * 1.2 });
    for (const p of s.planets) {
      sys.queue.push(() => {
        const body = build(TYPE_LOOK[p.type] ?? TYPE_LOOK.rock, { r: p.radius, tier });
        body.group.name = `planet:${p.id}`;
        body.setDetail?.(1 - step * 0.25);
        g.add(body.group);
        show(body.group, sys);
        const solid = { id: p.id, at: [0, 0, 0], r: p.radius, reach: (body.reach ?? p.radius) * 1.02 };
        sys.bodies.push({ row: p, body, kind: 'planet', solid });
        sys.solids.push(solid);
        if (p.ringBand) {
          const { inner, outer } = p.ringBand;
          const geo = new THREE.RingGeometry(inner, outer, 96, 1);
          const mat = new THREE.ShaderMaterial({
            vertexShader: RING_VERT,
            fragmentShader: RING_FRAG,
            uniforms: { uColor: { value: new THREE.Color(p.color ?? '#c8b89a') }, uInner: { value: inner }, uOuter: { value: outer }, uSeed: { value: Number(BigInt.asUintN(20, BigInt(p.seed ?? 0))) / 1048576 } },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const ring = new THREE.Mesh(geo, mat);
          ring.name = `ring:${p.id}`;
          ring.quaternion.setFromUnitVectors(Z, axisOf(p));
          g.add(ring);
          show(ring, sys);
          sys.rings.push({ planet: p, ring, geo, mat });
        }
      });
      for (const m of p.moonList ?? []) {
        sys.queue.push(() => {
          const mb = build(m.type === 'icy' ? 'hoth' : 'moon-grey', { r: m.radius, small: true, tier });
          mb.group.name = `moon:${m.id}`;
          mb.setDetail?.(1 - step * 0.25);
          g.add(mb.group);
          show(mb.group, sys);
          const ms = { id: m.id, at: [0, 0, 0], r: m.radius, reach: m.radius * 1.05 };
          sys.bodies.push({ row: m, body: mb, kind: 'moon', planet: p, solid: ms });
          sys.solids.push(ms);
        });
      }
    }
    built.set(s.id, sys);
  };

  const letGo = (id) => {
    const sys = built.get(id);
    if (!sys) return;
    for (const b of sys.bodies) b.body.dispose();
    for (const r of sys.rings) {
      r.geo.dispose();
      r.mat.dispose();
    }
    sys.starMat.dispose();
    sys.group.removeFromParent();
    built.delete(id);
    ids.delete(id);
  };

  const sunDir = new THREE.Vector3();
  const sunColour = new THREE.Color();
  const sun = [{ dir: sunDir, color: sunColour }];
  const d2 = (a, c) => (a[0] - c[0]) ** 2 + (a[1] - c[1]) ** 2 + (a[2] - c[2]) ** 2;
  const want = [];

  return {
    update(systems, cam, t, camera) {
      // let go what's left behind; then the nearest whose reach holds the camera, up to the budget
      for (const [id, sys] of built) if (d2(sys.system.at, cam) > (buildReach(sys.system) * LET_GO) ** 2) letGo(id);
      want.length = 0;
      for (const s of systems) {
        if (built.has(s.id)) continue;
        const d = d2(s.at, cam);
        const r = buildReach(s);
        if (d <= r * r) want.push(s);
      }
      if (want.length && built.size < most) {
        want.sort((a, b) => d2(a.at, cam) - d2(b.at, cam));
        for (const s of want) {
          if (built.size >= most) break;
          buildSystem(s);
        }
      }
      // a few more bodies made, then whole systems marked so (their discs give way)
      let made = 0;
      for (const sys of built.values()) {
        while (sys.queue.length && made < perFrame) {
          sys.queue.shift()();
          made++;
        }
        if (!sys.queue.length && sys.pending === 0) ids.add(sys.system.id);
      }
      // everything on its orbit, now
      starList.length = 0;
      solidList.length = 0;
      for (const sys of built.values()) {
        const s = sys.system;
        sunColour.set(s.star.color);
        for (const b of sys.bodies) {
          const at = b.kind === 'planet' ? orbitAt(b.row, t) : moonAt(b.row, b.planet, t);
          b.body.group.position.set(at[0], at[1], at[2]);
          b.solid.at[0] = at[0];
          b.solid.at[1] = at[1];
          b.solid.at[2] = at[2];
          sunDir.set(s.at[0] - at[0], s.at[1] - at[1], s.at[2] - at[2]).normalize();
          b.body.setSuns(sun);
          b.body.update(t, camera);
        }
        for (const r of sys.rings) {
          const at = orbitAt(r.planet, t);
          r.ring.position.set(at[0], at[1], at[2]);
        }
        starList.push(sys.entry);
        for (const so of sys.solids) solidList.push(so);
      }
    },
    built: () => ids,
    stars: () => starList,
    solids: () => solidList,
    setStep(k) {
      step = Math.max(0, Math.min(3, k | 0));
      for (const sys of built.values()) for (const b of sys.bodies) b.body.setDetail?.(1 - step * 0.25);
    },
    dispose() {
      for (const id of [...built.keys()]) letGo(id);
      starList.length = 0;
      solidList.length = 0;
    },
  };
}
