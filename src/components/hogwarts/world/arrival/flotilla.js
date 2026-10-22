// The boats across the Black Lake (the design’s §4.2, beat two): Hagrid
// alone in the lead, his lantern the brightest thing on the water, and the
// first-years four to a boat behind him in a loose double file, each boat
// with a lantern on a pole at its bow and its light lying on the water as a
// long broken streak toward whoever is looking. Clinker boats: the strakes
// lapped, a stem post, three thwarts, the oars shipped (nobody rows: the
// boats know the way). They glide on the arrival’s spline (shots.js’s
// route), each on its own slow rock and heave.
//
//   hullGeometry({ len, beam, depth, strakes }) → { outer, inner } geometries, the bow to −z, the keel at y 0
//   createFlotilla({ rt, kit, tier, route, water }) → { group, crowd, hagrid, lights,
//     place(lead, t, camera), set({ visible }), dispose() }
//     place(lead, t): the lead boat `lead` metres along the route at `t` seconds; the rest follow

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, float, length, mix, sin, smoothstep, time, uniform, uv, vec3 } from 'three/tsl';
import { createCrowd } from '../../cast/crowd';
import { CROWD, figure } from '../../cast/figures';

// a clinker hull by its rings, stern (+z) to bow (−z): its half-width, its
// sheer rising to the bow, the strakes each lapped a little over the next
export function hullGeometry({ len = 4.3, beam = 1.4, depth = 0.6, strakes = 5, U = 30, inset = 0 } = {}) {
  const V = strakes * 4;
  const pos = [];
  const idx = [];
  const lerp = (a, b, k) => a + (b - a) * k;
  for (let i = 0; i <= U; i++) {
    const u = i / U; // 0 the stern, 1 the bow
    const z = (0.5 - u) * len;
    // (clamped: at the bow the cosine comes out a hair under nothing, and a power of that is NaN)
    const shape = u < 0.42 ? lerp(0.66, 1, Math.sin((u / 0.42) * (Math.PI / 2))) : Math.max(0, Math.cos(Math.min(1, (u - 0.42) / 0.58) * (Math.PI / 2))) ** 0.85;
    const w = Math.max(0.004, (beam / 2) * shape - inset);
    const sheer = depth + 0.16 * Math.max(0, (u - 0.55) / 0.45) ** 2 + 0.05 * Math.max(0, (0.25 - u) / 0.25) ** 2;
    const rocker = 0.1 * Math.max(0, (u - 0.6) / 0.4) ** 2 + 0.04 * Math.max(0, (0.2 - u) / 0.2) ** 2;
    const bottom = rocker + inset * 0.8;
    const top = sheer - inset * 0.2;
    for (let j = 0; j <= V; j++) {
      const v = j / V;
      const a = (v - 0.5) * Math.PI; // −π/2 one gunwale, 0 the keel, π/2 the other
      const side = Math.abs(v - 0.5) * 2; // 0 at the keel, 1 at the gunwale
      // (each strake stands a little proud at its lower edge: the lap)
      const lap = inset ? 0 : 0.018 * (1 - ((side * strakes) % 1)) * Math.min(1, side * 4);
      const x = Math.sin(a) * (w + lap * shape);
      const y = bottom + (top - bottom) * (1 - Math.cos(a)) ** 0.75 / 1;
      pos.push(x, Math.min(y, top), z);
    }
  }
  for (let i = 0; i < U; i++)
    for (let j = 0; j < V; j++) {
      const a = i * (V + 1) + j;
      const b = a + V + 1;
      if (inset) idx.push(a, a + 1, b, b, a + 1, b + 1);
      else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// the stern’s flat transom: the hull’s last ring closed
function transomGeometry(len, beam, depth) {
  const w = (beam / 2) * 0.66;
  const s = new THREE.Shape();
  const N = 12;
  for (let j = 0; j <= N; j++) {
    const a = (j / N - 0.5) * Math.PI;
    const y = 0.04 + (depth + 0.05 - 0.04) * (1 - Math.cos(a)) ** 0.75;
    if (j === 0) s.moveTo(Math.sin(a) * w, Math.min(y, depth + 0.05));
    else s.lineTo(Math.sin(a) * w, Math.min(y, depth + 0.05));
  }
  s.closePath();
  return new THREE.ShapeGeometry(s).translate(0, 0, len / 2);
}

// where the boats sail, by the lead’s metres: [side (m, + right), back (m)]
const FILE = [
  [-3.1, 9],
  [3.3, 12.5],
  [-2.6, 20],
  [3.0, 24],
  [-3.4, 31.5],
  [2.7, 35],
];
const CREW = [
  [-0.32, 0.55],
  [0.32, 0.5],
  [-0.3, -0.35],
  [0.3, -0.42],
];

export function createFlotilla({ rt = null, kit, tier = 'high', route, water = 0 }) {
  const group = new THREE.Group();
  group.name = 'arrival:flotilla';
  const LEN = 4.3;
  const BEAM = 1.4;
  const DEPTH = 0.6;
  // one boat’s static parts, merged into the kit in the boat’s own frame and
  // then instanced: the hull, the inside, the thwarts, the stem, the pole
  const parts = createParts(kit, { LEN, BEAM, DEPTH });
  const n = FILE.length + 1;
  const hulls = parts.map(({ geometry, material }) => {
    const m = new THREE.InstancedMesh(geometry, material, n);
    m.castShadow = false;
    m.receiveShadow = true;
    m.frustumCulled = false;
    group.add(m);
    return m;
  });
  // the lanterns: a warm glass box on each pole (instanced) and its flame as a soft card
  const glassGeo = new THREE.BoxGeometry(0.16, 0.22, 0.16);
  const glass = new MeshBasicNodeMaterial({ color: new THREE.Color(1.0, 0.62, 0.3).multiplyScalar(3.2), fog: false });
  glass.userData.noHouse = true;
  const lamps = new THREE.InstancedMesh(glassGeo, glass, n);
  lamps.frustumCulled = false;
  group.add(lamps);
  const haloGeo = new THREE.PlaneGeometry(1.6, 1.6);
  const uFlick = uniform(1);
  const halo = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  halo.userData.noHouse = true;
  const r = length(uv().sub(0.5)).mul(2);
  halo.colorNode = vec3(1.0, 0.58, 0.25).mul(smoothstep(1, 0, r).pow(2.6)).mul(0.55).mul(uFlick);
  // the streak each lantern lays on the water toward the eye: long, broken by the ripples
  const streakGeo = new THREE.PlaneGeometry(0.9, 14).rotateX(-Math.PI / 2).translate(0, 0, -7);
  const streak = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  streak.userData.noHouse = true;
  const p = uv();
  const across = abs(p.x.sub(0.5)).mul(2);
  const broken = sin(p.y.mul(90).add(time.mul(2.4))).mul(0.5).add(0.5).mul(sin(p.y.mul(37).sub(time.mul(1.3)).add(p.x.mul(6))).mul(0.5).add(0.5));
  streak.colorNode = vec3(1.0, 0.55, 0.22).mul(smoothstep(1, 0.1, across).mul(smoothstep(0.0, 0.25, p.y)).mul(smoothstep(1.0, 0.75, p.y))).mul(mix(float(0.15), float(0.9), broken)).mul(0.7);
  const halos = [];
  const streaks = [];
  for (let i = 0; i < n; i++) {
    const h = new THREE.Mesh(haloGeo, halo);
    h.renderOrder = 7;
    const s = new THREE.Mesh(streakGeo, streak);
    s.renderOrder = 6;
    group.add(h, s);
    halos.push(h);
    streaks.push(s);
  }
  // three real lights: Hagrid’s, and two among the first-years’ boats (one on mid, none on low)
  const lights = [];
  const count = { low: 0, mid: 1, high: 3, ultra: 3 }[tier] ?? 2;
  for (let i = 0; i < count; i++) {
    const l = new THREE.PointLight(0xffa860, i === 0 ? 26 : 9, i === 0 ? 22 : 12, 1.8);
    l.userData.boat = [0, 2, 5][i];
    l.userData.power = l.intensity;
    lights.push(l);
    group.add(l);
  }

  // the first-years, four to a boat, sat on the thwarts and carried with them
  const spots = [];
  for (let b = 1; b < n; b++) for (const [x, z] of CREW) spots.push({ at: [0, 0, 0], yaw: 0, boat: b, seat: [x, z], tag: 'crew' });
  // (the school’s own bodies: the bakes are the hall’s too)
  const crowd = createCrowd({ rt, spots, bodies: CROWD, clips: { idle: 'sit.idle', cheer: 'sit.cheer' }, tier });
  group.add(crowd.group);
  // Hagrid, alone in the lead boat (it sits low under him)
  const hagrid = figure('hagrid', { rt, seed: 7 });
  hagrid.set({ base: 'sit.idle' });
  group.add(hagrid.group);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const big = new THREE.Vector3(1.25, 1.12, 1.18);
  const boats = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }));
  const lantern = (b) => {
    // (the pole at the bow, the lantern hung off its top: in the boat’s frame)
    const k = b === 0 ? 1.18 : 1;
    const c = Math.cos(boats[b].yaw);
    const s = Math.sin(boats[b].yaw);
    const lx = 0;
    const lz = -LEN * 0.42 * k;
    return [boats[b].x + lx * c + lz * s, boats[b].y + 1.32 * k, boats[b].z - lx * s + lz * c];
  };
  const crewAt = [];
  let sinceCrew = 1;
  return {
    group,
    crowd,
    hagrid,
    lights,
    ready: Promise.all([crowd.ready, hagrid.ready]),
    place(lead, t, camera = null, dt = 0) {
      for (let b = 0; b < n; b++) {
        const [side, back] = b === 0 ? [0, 0] : FILE[b - 1];
        const m = Math.max(-40, lead - back);
        const pt = route.at(Math.max(0, m));
        // (before the route’s start, still at the jetty: along the first leg, backward)
        const extra = Math.min(0, m);
        const x = pt.x - pt.tz * side + pt.tx * extra;
        const z = pt.z + pt.tx * side + pt.tz * extra;
        const ph = b * 1.37;
        const bo = boats[b];
        bo.x = x;
        bo.z = z;
        bo.y = water - 0.24 + Math.sin(t * 0.9 + ph) * 0.03;
        bo.yaw = Math.atan2(-pt.tx, -pt.tz);
        bo.pitch = Math.sin(t * 0.63 + ph) * 0.018;
        bo.roll = Math.sin(t * 0.81 + ph + 1) * 0.035;
        e.set(bo.pitch, bo.yaw, bo.roll, 'YXZ');
        q.setFromEuler(e);
        v.set(x, bo.y, z);
        m4.compose(v, q, b === 0 ? big : one);
        for (const h of hulls) h.setMatrixAt(b, m4);
        const [lx, ly, lz] = lantern(b);
        m4.compose(v.set(lx, ly, lz), q, one);
        lamps.setMatrixAt(b, m4);
        halos[b].position.set(lx, ly, lz);
        if (camera) halos[b].quaternion.copy(camera.quaternion);
        // (the streak from under the lantern toward the eye, on the water)
        streaks[b].position.set(lx, water + 0.02, lz);
        if (camera) streaks[b].rotation.set(0, Math.atan2(lx - camera.position.x, lz - camera.position.z), 0);
      }
      for (const h of hulls) h.instanceMatrix.needsUpdate = true;
      lamps.instanceMatrix.needsUpdate = true;
      for (const l of lights) {
        const [lx, ly, lz] = lantern(l.userData.boat);
        l.position.set(lx, ly + 0.05, lz);
        l.intensity = l.userData.power * (0.86 + 0.1 * Math.sin(t * 8.3 + l.userData.boat) + 0.04 * Math.sin(t * 19 + l.userData.boat * 2));
      }
      uFlick.value = 0.9 + 0.1 * Math.sin(t * 9.1);
      // Hagrid in the lead, a little aft of the middle, facing the bow
      const h = boats[0];
      hagrid.group.position.set(h.x + Math.sin(h.yaw) * -0.35, h.y + 0.3, h.z + Math.cos(h.yaw) * -0.35);
      hagrid.group.rotation.set(0, h.yaw + Math.PI, 0);
      hagrid.tick(dt);
      // the crew carried a few times a second (each is a relayout of the crowd’s instances)
      if ((sinceCrew += dt) > 1 / 20) {
        sinceCrew = 0;
        crewAt.length = 0;
        for (const s of spots) {
          const bo = boats[s.boat];
          const c = Math.cos(bo.yaw);
          const sn = Math.sin(bo.yaw);
          const [sx, sz] = s.seat;
          crewAt.push({ at: [bo.x + sx * c + sz * sn, bo.y + 0.24, bo.z - sx * sn + sz * c], yaw: bo.yaw + Math.PI });
        }
        crowd.move(crewAt);
      }
      crowd.step(dt, { camera });
    },
    set({ visible } = {}) {
      if (visible != null) group.visible = Boolean(visible);
    },
    dispose() {
      crowd.dispose();
      hagrid.dispose();
      for (const h of hulls) h.dispose?.();
      lamps.dispose?.();
      for (const g of [glassGeo, haloGeo, streakGeo]) g.dispose();
      for (const m of [glass, halo, streak]) m.dispose();
      for (const pt of parts) pt.geometry.dispose();
      group.removeFromParent();
    },
  };
}

// the boat’s parts, one geometry a material, in the boat’s own frame
function createParts(kit, { LEN, BEAM, DEPTH }) {
  const out = [];
  const outer = hullGeometry({ len: LEN, beam: BEAM, depth: DEPTH });
  const inner = hullGeometry({ len: LEN, beam: BEAM, depth: DEPTH, inset: 0.035 });
  const transom = transomGeometry(LEN, BEAM, DEPTH);
  const bits = [];
  // the thwarts, the stem post, the gunwale’s rubbing strake, the bow pole and its arm
  const box = (w, h, d, x, y, z, rx = 0) => bits.push(new THREE.BoxGeometry(w, h, d).rotateX(rx).translate(x, y, z));
  for (const [z, w] of [
    [0.85, 1.12],
    [-0.05, 1.3],
    [-0.95, 1.0],
  ])
    box(w, 0.05, 0.24, 0, DEPTH * 0.62, z);
  box(0.07, 0.42, 0.09, 0, DEPTH + 0.12, -LEN / 2 + 0.02, -0.25);
  bits.push(new THREE.CylinderGeometry(0.025, 0.03, 1.1, 6).translate(0, DEPTH + 0.45, -LEN * 0.42));
  box(0.04, 0.04, 0.28, 0, DEPTH + 0.98, -LEN * 0.42 - 0.12);
  // two oars shipped along the thwarts
  for (const x of [-0.42, 0.42]) bits.push(new THREE.CylinderGeometry(0.022, 0.022, 2.6, 5).rotateX(Math.PI / 2).translate(x, DEPTH * 0.66, 0.1));
  const clean = (g) => {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    return g.index ? g.toNonIndexed() : g;
  };
  const merge = (geos) => {
    const list = geos.map(clean);
    const total = list.reduce((a, g) => a + g.attributes.position.count, 0);
    const posA = new Float32Array(total * 3);
    const nrmA = new Float32Array(total * 3);
    let o = 0;
    for (const g of list) {
      posA.set(g.attributes.position.array, o * 3);
      nrmA.set(g.attributes.normal.array, o * 3);
      o += g.attributes.position.count;
      g.dispose();
    }
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(posA, 3));
    m.setAttribute('normal', new THREE.BufferAttribute(nrmA, 3));
    return m;
  };
  out.push({ geometry: merge([outer, transom]), material: kit.paint('#3b2a1e', { rough: 0.7, scan: 'wood', metres: 0.9, strength: 0.55 }) });
  out.push({ geometry: merge([inner, ...bits]), material: kit.paint('#5e4430', { rough: 0.8, scan: 'wood', metres: 0.9, strength: 0.55 }) });
  return out;
}
