// The tunnel to fly down (../tunnel.js) on the node renderer: the same
// path, the same keeping-in and the same drawn tube, its walls’ shader line
// for line in TSL on a MeshBasicNodeMaterial with the GLSL’s uniforms on
// `material.uniforms` (nodes, under the same names, so `.value` writes them
// as before). The path’s pure functions are copied, not imported: tunnel.js
// holds the walls’ ShaderMaterial, and importing it would bring the GLSL in.
// The walls are not tone mapped (the GLSL had no tone-mapping chunk), and
// take no fog (a ShaderMaterial never did).
//
// Pure, tested: tunnelPath(seed, { length, turns, bend, steps, ctrl }) → { pts,
// tans, cum, length } in the tunnel's own frame (the mouth at the origin,
// in along +z); nearestOn(path, p) → { s, off, at, tan }; keepIn({ path,
// radius, chamber }, p, margin) → { p, bumped, where: 'tube' | 'chamber' |
// 'out' (back out of its mouth) | 'away' (nowhere near it) }; frameOf(origin, fwd, up) → { toLocal, toWorld, dirToWorld }.
// Drawn: buildTunnel(path, { radius, chamber, look }) → { group (in the
// tunnel's frame: place it), core (the reactor), centre, update(t, hot),
// dispose() }.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { Fn, abs, dot as dotN, float, floor, fract, mix, sin, smoothstep, uniform, uv, vec2, vec3 } from 'three/tsl';
import { seeded } from '../gcw';
import { rev } from '../surface/nodes/common';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// a Catmull-Rom curve through the controls, `steps` points along it
function catmull(ctrl, steps) {
  const P = [sub(ctrl[0], sub(ctrl[1], ctrl[0])), ...ctrl, add(ctrl[ctrl.length - 1], sub(ctrl[ctrl.length - 1], ctrl[ctrl.length - 2]))];
  const out = [];
  const spans = ctrl.length - 1;
  for (let i = 0; i < steps; i++) {
    const u = (i / (steps - 1)) * spans;
    const k = Math.min(spans - 1, Math.floor(u));
    const t = u - k;
    const [p0, p1, p2, p3] = [P[k], P[k + 1], P[k + 2], P[k + 3]];
    const t2 = t * t;
    const t3 = t2 * t;
    out.push([0, 1, 2].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
  }
  return out;
}

export function tunnelPath(seed, { length = 60, turns = 3, bend = 0.5, steps = 72, ctrl: given = null } = {}) {
  if (given) return pathThrough(given, steps);
  const rand = seeded(`tunnel-${seed}`);
  const gap = length / (turns + 1);
  const ctrl = [
    [0, 0, 0],
    [0, 0, length * 0.12],
  ];
  // (a walk sideways from one control to the next, a step of no more than
  // bend × a third of the gap, so it winds but never kinks)
  let x = 0;
  let y = 0;
  for (let j = 1; j <= turns; j++) {
    const z = length * (0.12 + (0.88 * j) / turns);
    x = Math.max(-bend * gap, Math.min(bend * gap, x + (rand() - 0.5) * 0.7 * bend * gap));
    y = Math.max(-0.7 * bend * gap, Math.min(0.7 * bend * gap, y + (rand() - 0.5) * 0.5 * bend * gap));
    ctrl.push([x, y, z]);
  }
  return pathThrough(ctrl, steps);
}

// (the path through given controls: a Star Destroyer's hangar shaft is laid by hand)
function pathThrough(ctrl, steps) {
  const pts = catmull(ctrl, steps);
  pts[0] = [...ctrl[0]];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  const tans = pts.map((_, i) => unit(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - (i === pts.length - 1 ? 1 : 0))])));
  tans[0] = unit(sub(pts[1], pts[0]));
  return { pts, tans, cum, length: cum[cum.length - 1] };
}

export function nearestOn(path, p) {
  let best = null;
  for (let i = 0; i < path.pts.length - 1; i++) {
    const a = path.pts[i];
    const ab = sub(path.pts[i + 1], a);
    const l2 = dot(ab, ab) || 1e-9;
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
    const at = add(a, ab, t);
    const off = len(sub(p, at));
    if (!best || off < best.off) best = { s: path.cum[i] + t * Math.sqrt(l2), off, at, tan: unit(ab) };
  }
  return best;
}

// the chamber at the far end: its middle, a little past the tube's end
export const chamberAt = (tube) => add(tube.path.pts[tube.path.pts.length - 1], tube.path.tans[tube.path.tans.length - 1], tube.chamber * 0.8);

export function keepIn(tube, p, margin = 0.15) {
  const { path, radius, chamber } = tube;
  // back out of its mouth: free
  if (dot(sub(p, path.pts[0]), path.tans[0]) < 0 && len(sub(p, path.pts[0])) < radius * 3) return { p, bumped: false, where: 'out' };
  const C = chamberAt(tube);
  const dc = len(sub(p, C));
  if (dc < chamber - margin) return { p, bumped: false, where: 'chamber' };
  const n = nearestOn(path, p);
  if (n.off <= radius - margin) return { p, bumped: false, where: 'tube' };
  // nowhere near it (put somewhere else, out of a crash, by a pin): not in it at all
  if (n.off > radius * 4 && dc > chamber * 1.6) return { p, bumped: false, where: 'away' };
  // into a wall: back inside, to whichever's nearer, the tube or the chamber
  const toTube = n.off > 1e-9 ? add(n.at, unit(sub(p, n.at)), radius - margin) : n.at;
  const toRoom = add(C, unit(sub(p, C)), chamber - margin);
  return len(sub(toRoom, p)) < len(sub(toTube, p)) ? { p: toRoom, bumped: true, where: 'chamber' } : { p: toTube, bumped: true, where: 'tube' };
}

export function frameOf(origin, fwd, up) {
  const z = unit(fwd);
  let x = cross(up, z);
  if (len(x) < 1e-6) x = cross([0, 1, 0], z);
  if (len(x) < 1e-6) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  return {
    origin,
    x,
    y,
    z,
    toLocal: (w) => {
      const d = sub(w, origin);
      return [dot(d, x), dot(d, y), dot(d, z)];
    },
    toWorld: (l) => [origin[0] + x[0] * l[0] + y[0] * l[1] + z[0] * l[2], origin[1] + x[1] * l[0] + y[1] * l[1] + z[1] * l[2], origin[2] + x[2] * l[0] + y[2] * l[1] + z[2] * l[2]],
    dirToWorld: (l) => [x[0] * l[0] + y[0] * l[1] + z[0] * l[2], x[1] * l[0] + y[1] * l[1] + z[1] * l[2], x[2] * l[0] + y[2] * l[1] + z[2] * l[2]],
  };
}

// ── drawn ──
// the walls: panels and their seams, strips of light running along it
// (tunnel.js's WALL_FRAG, line for line; TSL's dot is dotN here, the path's
// own dot being the arrays' one above)
const hash = Fn(([p]) => fract(sin(dotN(p, vec2(127.1, 311.7))).mul(43758.5453))).setLayout({ name: 'tunnelHash', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

function wallMaterial(L) {
  const u = { uMetal: uniform(new THREE.Color(...L.metal)), uLight: uniform(new THREE.Color(...L.light)), uAlarm: uniform(0), uTime: uniform(0) };
  const wall = Fn(() => {
    const vUv = uv();
    // along the tube (u, in metres-ish) and round it (v)
    const g = vec2(vUv.x.mul(220), vUv.y.mul(12));
    const cell = floor(g);
    const f = fract(g);
    const shade = hash(cell).mul(0.45).add(0.55);
    const seam = smoothstep(0, 0.06, f.x).mul(smoothstep(0, 0.06, f.y)).mul(rev(1, 0.94, f.x)).mul(rev(1, 0.94, f.y));
    const c = u.uMetal.mul(shade).mul(seam.mul(0.65).add(0.35)).toVar();
    // four strips of light round it, and every so often a band
    const strip = rev(0.035, 0, abs(fract(vUv.y.mul(4)).sub(0.5)));
    const band = rev(0.08, 0, abs(fract(vUv.x.mul(18)).sub(0.5)));
    const flick = sin(u.uTime.mul(9).add(cell.x)).mul(0.25).add(0.75);
    const light = mix(u.uLight, vec3(3, 0.5, 0.25), u.uAlarm.mul(sin(u.uTime.mul(8)).mul(0.5).add(0.5)));
    c.addAssign(light.mul(strip.mul(1.4).add(band.mul(0.6))).mul(flick));
    return c;
  }, 'vec3');
  const mat = new MeshBasicNodeMaterial({ side: THREE.BackSide, toneMapped: false, fog: false });
  mat.colorNode = wall();
  mat.opacityNode = float(1);
  mat.uniforms = u;
  return mat;
}

const LOOKS = {
  ds2: { metal: [0.32, 0.35, 0.4], light: [2.4, 1.3, 0.55], core: [0.45, 1.05, 1.9] },
  isd: { metal: [0.42, 0.43, 0.46], light: [2.2, 2.3, 2.6], core: [1.7, 1, 0.35] },
};

export function buildTunnel(path, { radius = 2, chamber = 6, look = 'ds2', small = false } = {}) {
  const L = LOOKS[look] ?? LOOKS.ds2;
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(path.pts.map((p) => new THREE.Vector3(...p)));
  const tubeGeo = new THREE.TubeGeometry(curve, small ? 120 : 220, radius, small ? 10 : 14, false);
  const wallMat = wallMaterial(L);
  const tube = new THREE.Mesh(tubeGeo, wallMat);
  group.add(tube);
  // ribs every few units: what makes the speed show
  const ribs = Math.floor(path.length / 3);
  const ribGeo = new THREE.TorusGeometry(radius * 0.97, radius * 0.045, 6, small ? 16 : 24);
  const ribMat = new MeshStandardNodeMaterial({ color: new THREE.Color(...L.metal).multiplyScalar(0.8), metalness: 0.6, roughness: 0.5 });
  const rib = new THREE.InstancedMesh(ribGeo, ribMat, Math.max(1, ribs));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  for (let i = 0; i < ribs; i++) {
    const u = (i + 0.5) / ribs;
    curve.getPointAt(u, pos);
    curve.getTangentAt(u, tan);
    q.setFromUnitVectors(Z, tan);
    rib.setMatrixAt(i, m.compose(pos, q, new THREE.Vector3(1, 1, 1)));
  }
  group.add(rib);
  // the chamber, and the reactor in it
  const C = chamberAt({ path, chamber });
  const roomGeo = new THREE.SphereGeometry(chamber, small ? 20 : 32, small ? 14 : 22);
  const room = new THREE.Mesh(roomGeo, wallMat);
  room.position.set(...C);
  group.add(room);
  const columnGeo = new THREE.CylinderGeometry(chamber * 0.16, chamber * 0.22, chamber * 1.9, 16, 1, true);
  const columnMat = new MeshStandardNodeMaterial({ color: '#30343c', metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide });
  const column = new THREE.Mesh(columnGeo, columnMat);
  column.position.set(...C);
  group.add(column);
  const coreGeo = new THREE.SphereGeometry(chamber * 0.26, 24, 16);
  const coreMat = new MeshBasicNodeMaterial({ color: new THREE.Color(...L.core), toneMapped: false });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.set(...C);
  group.add(core);
  // the mouth: a ring of light round it, to find it by
  const mouthGeo = new THREE.TorusGeometry(radius * 1.15, radius * 0.08, 8, 32);
  const mouthMat = new MeshBasicNodeMaterial({ color: new THREE.Color(...L.light).multiplyScalar(1.2), toneMapped: false });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  group.add(mouth);
  return {
    group,
    core,
    centre: C,
    // hot: the reactor's been hit (it flares, and the lights go red)
    update(t, hot = 0) {
      wallMat.uniforms.uTime.value = t % 1000;
      wallMat.uniforms.uAlarm.value = hot;
      const k = 1 + 0.2 * Math.sin(t * 6) + hot * 0.8;
      core.scale.setScalar(1 + 0.06 * Math.sin(t * 11) + hot * 0.3);
      coreMat.color.setRGB(L.core[0] * k, L.core[1] * k, L.core[2] * k);
    },
    dispose() {
      group.removeFromParent();
      for (const g of [tubeGeo, ribGeo, roomGeo, columnGeo, coreGeo, mouthGeo]) g.dispose();
      for (const mat of [wallMat, ribMat, columnMat, coreMat, mouthMat]) mat.dispose();
      rib.dispose();
    },
  };
}
