// The four house-points hourglasses by the great doors (the design’s §4.4):
// tall glasses on stone plinths in brass frames, rubies for Gryffindor,
// emeralds for Slytherin, sapphires for Ravenclaw and topazes for
// Hufflepuff. The count is drawn as a fill height in the lower bulb (its
// top cut where the points reach, the surface a disc of stones) and the
// top few stones as instances heaped on it; the upper bulb holds what is
// left. When the points change the stones run down (or back up) the neck
// for a moment, as they do when a teacher says the words.
//
//   GEMS: { house: colour }   PROFILE: the glass’s half-silhouette, [r, y]
//   radiusAt(y) → the glass’s inner radius at a height (pure)
//   fillFor(points, max) → 0…1 of the lower bulb (pure; a square root, so a
//     few points show and a full term’s still fits)
//   createHourglasses({ spots: [{ house, at }], kit, max, tier }) → { group, set(points), step(dt), dispose() }
//     points: { house: n } (Lane F’s rules/points.js, once it exists; a prop until then)

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { Discard, Fn, If, floor, hash, positionLocal, positionWorld, pow, sin, time, uniform, vec3 } from 'three/tsl';

export const GEMS = { gryffindor: '#c0122a', slytherin: '#13a05a', ravenclaw: '#2353d6', hufflepuff: '#f0a81c' };

const BULB = 1.15; // m, each bulb’s height
const NECK = 0.055; // m, the neck’s radius
const WIDE = 0.42; // m, the bulbs’ widest
const PLINTH = 0.7; // m of stone under the frame
const BASE = 0.12; // m of brass base
export const GLASS_H = BULB * 2;

// the glass’s inner half-silhouette from its foot (y 0) to its top: a bulb, the neck, a bulb
export const PROFILE = (() => {
  const pts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const k = i / N; // up the lower bulb
    pts.push([NECK + (WIDE - NECK) * Math.sin(Math.PI * Math.min(1, k * 0.92 + 0.08)) ** 0.7 * (k < 0.1 ? 0.9 + k : 1), k * BULB]);
  }
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    pts.push([NECK + (WIDE - NECK) * Math.sin(Math.PI * Math.min(1, (1 - k) * 0.92 + 0.08)) ** 0.7, BULB + k * BULB]);
  }
  return pts;
})();

export function radiusAt(y) {
  if (y <= PROFILE[0][1]) return PROFILE[0][0];
  for (let i = 1; i < PROFILE.length; i++) {
    const [r1, y1] = PROFILE[i];
    const [r0, y0] = PROFILE[i - 1];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
  }
  return PROFILE.at(-1)[0];
}

export const fillFor = (points, max) => Math.max(0, Math.min(1, Math.sqrt(Math.max(0, points) / Math.max(1, max))));

const STONES = { low: 0, mid: 18, high: 36, ultra: 48 };

export function createHourglasses({ spots, kit, max = 600, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'hogwarts:hourglasses';
  const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  // the frame and the plinths are static: the kit merges them with the room
  for (const { at } of spots) {
    const [x, , z] = at;
    kit.box('ashlar', x, 0, z, 1.25, PLINTH, 1.25);
    kit.box('stonedark', x, PLINTH - 0.06, z, 1.38, 0.08, 1.38);
    kit.cyl('brass', x, PLINTH, z, 0.56, 0.6, BASE, { seg: 24 });
    kit.cyl('brass', x, PLINTH + BASE + GLASS_H, z, 0.6, 0.56, BASE, { seg: 24 });
    kit.cyl('brass', x, PLINTH + BASE * 2 + GLASS_H, z, 0.12, 0.3, 0.16, { seg: 16 });
    // four posts, a little twisted ring at their middles
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      kit.cyl('brass', x + Math.cos(a) * 0.52, PLINTH + BASE, z + Math.sin(a) * 0.52, 0.028, 0.028, GLASS_H, { seg: 8 });
      kit.cyl('brass', x + Math.cos(a) * 0.52, PLINTH + BASE + BULB - 0.06, z + Math.sin(a) * 0.52, 0.045, 0.045, 0.12, { seg: 8 });
    }
  }
  const foot = PLINTH + BASE;

  // the glass: one shared lathe, drawn last, faintly
  const glassGeo = lathe(PROFILE.map(([r, y]) => [r + 0.012, y]), 32);
  const glass = new MeshStandardNodeMaterial({ color: new THREE.Color('#e6eef2'), roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });

  const lowerPts = PROFILE.filter(([, y]) => y <= BULB + 1e-6);
  const upperPts = PROFILE.filter(([, y]) => y >= BULB - 1e-6);
  const lowerGeo = lathe(lowerPts.map(([r, y]) => [r * 0.97, y]), 24);
  const upperGeo = lathe(upperPts.map(([r, y]) => [r * 0.97, y]), 24);
  const capGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  const stoneGeo = new THREE.OctahedronGeometry(0.035, 0);
  const n = STONES[tier] ?? STONES.high;

  const glasses = spots.map(({ house, at }) => {
    const colour = new THREE.Color(GEMS[house]);
    const uFill = uniform(0); // m up the lower bulb
    const uTop = uniform(BULB * 2); // m: the upper bulb’s stones reach this high
    const gem = new MeshStandardNodeMaterial({ color: colour, roughness: 0.25, metalness: 0.2, side: THREE.DoubleSide });
    // facets: each little cell of the heap its own shade, now and then a glint
    const cell = floor(positionWorld.mul(38));
    const h = hash(cell.x.add(500).add(cell.y.add(500).mul(57)).add(cell.z.add(500).mul(3011)));
    gem.colorNode = vec3(colour.r, colour.g, colour.b).mul(h.mul(0.7).add(0.55));
    gem.emissiveNode = vec3(colour.r, colour.g, colour.b).mul(pow(h, 24).mul(sin(time.mul(2).add(h.mul(60))).mul(0.5).add(0.5)).mul(1.6).add(0.06));
    // (the heap cut where the points reach: above it the glass is empty)
    const cut = (limit) => {
      const m = new MeshStandardNodeMaterial({ color: colour, roughness: 0.25, metalness: 0.2, side: THREE.DoubleSide });
      const base = gem.colorNode;
      m.colorNode = Fn(() => {
        If(positionLocal.y.greaterThan(limit), () => {
          Discard();
        });
        return base;
      })();
      m.emissiveNode = gem.emissiveNode;
      return m;
    };
    const lowerMat = cut(uFill);
    const upperMat = cut(uTop);
    const g = new THREE.Group();
    g.position.set(at[0], foot, at[2]);
    const lower = new THREE.Mesh(lowerGeo, lowerMat);
    const upper = new THREE.Mesh(upperGeo, upperMat);
    const cap = new THREE.Mesh(capGeo, gem);
    const topCap = new THREE.Mesh(capGeo, gem);
    // the stream down the neck while the count is moving
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6, 1, true), gem);
    stream.visible = false;
    const shell = new THREE.Mesh(glassGeo, glass);
    shell.renderOrder = 5;
    const stones = n ? new THREE.InstancedMesh(stoneGeo, gem, n) : null;
    g.add(lower, upper, cap, topCap, stream, shell);
    if (stones) g.add(stones);
    group.add(g);
    return { house, g, uFill, uTop, cap, topCap, stream, stones, mats: [gem, lowerMat, upperMat], shown: 0, want: 0, seed: house.length * 977 };
  });

  // the heap’s top: the cap’s disc at the fill’s height and the stones scattered on it
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const place = (gl) => {
    const y = Math.max(0.002, gl.shown * BULB);
    gl.uFill.value = y;
    const r = radiusAt(y) * 0.96;
    gl.cap.position.y = y;
    gl.cap.scale.setScalar(r);
    gl.cap.visible = gl.shown > 0.002;
    // (what the lower has, the upper has lost: its heap sinks toward the neck)
    const left = 1 - gl.shown;
    const ty = BULB + Math.max(0.002, left * BULB * 0.85);
    gl.uTop.value = ty;
    gl.topCap.position.y = ty;
    gl.topCap.scale.setScalar(radiusAt(ty) * 0.96);
    gl.topCap.visible = left > 0.01;
    if (!gl.stones) return;
    let s = gl.seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < gl.stones.count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * r * 0.92;
      e.set(rnd() * 3, rnd() * 3, rnd() * 3);
      m4.compose(new THREE.Vector3(Math.cos(a) * d, y + 0.01 + rnd() * 0.02, Math.sin(a) * d), q.setFromEuler(e), new THREE.Vector3().setScalar(gl.shown > 0.002 ? 0.7 + rnd() * 0.6 : 0));
      gl.stones.setMatrixAt(i, m4);
    }
    gl.stones.instanceMatrix.needsUpdate = true;
  };
  glasses.forEach(place);

  return {
    group,
    set(points = {}) {
      for (const gl of glasses) gl.want = fillFor(points[gl.house] ?? 0, max);
    },
    // (the stones run at a pace: a big award takes a couple of seconds to fall)
    step(dt) {
      for (const gl of glasses) {
        const d = gl.want - gl.shown;
        if (Math.abs(d) < 1e-4) {
          if (gl.stream.visible) gl.stream.visible = false;
          continue;
        }
        gl.shown += Math.sign(d) * Math.min(Math.abs(d), dt * 0.12);
        const y = gl.shown * BULB;
        gl.stream.visible = true;
        gl.stream.scale.y = Math.max(0.01, BULB - y);
        gl.stream.position.y = y + (BULB - y) / 2;
        place(gl);
      }
    },
    // (the check’s: the fill shown, 0…1, a glass)
    shown: () => Object.fromEntries(glasses.map((g) => [g.house, g.shown])),
    jump(points = {}) {
      for (const gl of glasses) {
        gl.want = gl.shown = fillFor(points[gl.house] ?? 0, max);
        place(gl);
      }
    },
    dispose() {
      for (const gl of glasses) {
        for (const m of gl.mats) m.dispose();
        gl.stream.geometry.dispose();
        gl.stones?.dispose?.();
      }
      for (const geo of [glassGeo, lowerGeo, upperGeo, capGeo, stoneGeo]) geo.dispose();
      glass.dispose();
      group.removeFromParent();
    },
  };
}
