// rv.js on the node renderer, its first part: the measures of the cab and
// the road, how the drive goes, the loaders and the geometry helpers,
// copied line for line (rvNodes.js is the face; the cab, the coach, the
// land and the wings are its other parts). Nothing here draws with a
// shader of its own, so nothing differs from the original but that it is
// exported for the other parts.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { gltfLoader } from '../../../lib/three/gltf';
import { loadTexture } from '../../../lib/three/textures';

export const TAU = Math.PI * 2;
export const V3 = THREE.Vector3;
export const EYE = [-0.6, 1.22, 0.22];
export const REST = [-0.2, -0.14]; // where you look, at rest: a little right and down

// the road: under the cab's floor, its centre line to your left (you keep
// to the right-hand lane), and how its textures repeat (metres)
export const ROAD_Y = -1.06;
export const LANE = -1.8;
export const ROAD_W = 7.4;
export const ROAD_TILE = 4;
export const LINE_TILE = 24;
export const GROUND_TILE = 6;
export const POLE_GAP = 50;
export const POLE_X = LANE + 13;
export const POST_GAP = 5;

// the sun: its bearing right of dead ahead (radians), and its height and
// place in the photographed sky (degrees, and across the photograph)
export const SUN_BEARING = 0.62;
export const SUN_EL = 8.17;
export const SKY_U = 0.6077;

// the windshield: its foot on the dash, its top under the header, its outer
// ends a little further back than the middle (a shallow V)
export const WS = { x: 1.12, y0: 0.985, z0: -1.32, y1: 1.84, z1: -1.09, v: 0.05 };
// the wheel: its hub, the column's angle up from level, its radius
export const WHEEL_AT = [-0.6, 0.8, -0.36];
export const WHEEL_TILT = 0.73;
export const WHEEL_R = 0.225;
// the gauges' face: tilted back to face your eyes
export const FACE_AT = [-0.6, 0.915, -0.862];
export const FACE_TILT = 0.25;
export const FACE = { w: 0.56, h: 0.2, px: 1024, py: 366 };

// the drive: how fast at the end of the wind-up (m/s), the top of the
// time-lapse, and how the push builds
export const V0 = 2.5;
export const VMAX = 220;
export const PUSH = 1.8;

// How far you've gone and how fast, `lt` ms into the launch; `k` is how far
// through the drive (0 when it starts, 1 at the peak).
export function driveAt(p, lt) {
  if (lt <= 0) return { d: 0, v: 0, k: 0 };
  const ts = p.spool / 1000;
  if (lt < p.spool) {
    const u = lt / p.spool;
    return { d: V0 * ts * (u ** 3 - u ** 4 / 2), v: V0 * u * u * (3 - 2 * u), k: 0 };
  }
  const tg = (p.peak - p.spool) / 1000;
  const k = Math.min(1.2, (lt - p.spool) / (p.peak - p.spool));
  return { d: V0 * ts * 0.5 + V0 * tg * k + (VMAX * tg * k ** (PUSH + 1)) / (PUSH + 1), v: V0 + VMAX * k ** PUSH, k: Math.min(1, k) };
}

// ── loading ──

// (decoded off the main thread, as sharp at a slant as the device's tier
// allows, and shared with the worlds that use the same scans)
export function loadTex(url, { srgb = true, repeat = true } = {}) {
  return loadTexture(url, { color: srgb, wrap: repeat }).catch(() => null);
}

// a CC0 surface: its colour, and its normal and ARM maps where they're worth it
export function loadSet(dir, { normal = true, arm = false } = {}) {
  return Promise.all([loadTex(`${dir}/color.webp`), normal ? loadTex(`${dir}/normal.webp`, { srgb: false }) : null, arm ? loadTex(`${dir}/arm.webp`, { srgb: false }) : null]).then(([color, nrm, armMap]) => ({ color, normal: nrm, arm: armMap }));
}

// a crew member’s clip on its own (the HTTP cache has it from loadCrew),
// noting the hips it was made on (for another figure of theirs to sit on)
export function loadClip(name) {
  const l = gltfLoader();
  return l
    .loadAsync(`/models/cockpit/${name}.glb`)
    .then((g) => {
      const c = g.animations[0] ?? null;
      if (c) c.userData = { ...c.userData, hips: g.scene.getObjectByName('Hips')?.position.y };
      return c;
    })
    .catch(() => null);
}

// A clip played gently back and forth through a calm stretch of it, from
// `a` round to `b` seconds (wrapping past its end), instead of all of it:
// Jesse's sitting clip leans him forward to talk with his hands for most of
// its length, Walt's idle turns him half round. `pose` turns bones after.
export function calmly(crew, clip, a, b, speed, pose) {
  if (!crew) return null;
  const hip = crew.bones.Hips;
  const rest = hip?.position.clone();
  let mixer = null;
  let act = null;
  if (clip) {
    mixer = new THREE.AnimationMixer(crew.model);
    act = mixer.clipAction(clip);
    act.play();
  }
  const dur = clip?.duration ?? 1;
  const len = (b - a + dur) % dur;
  return (t) => {
    if (act) {
      act.time = (a + len * (0.5 - 0.5 * Math.cos(t * speed))) % dur;
      mixer.update(0);
    }
    if (hip) {
      hip.position.x = rest.x;
      hip.position.z = rest.z;
    }
    pose?.(crew.bones, t);
  };
}

export function loadEnv(pmrem) {
  return new HDRLoader()
    .loadAsync('/games/hdri/jasper.hdr')
    .then((hdr) => {
      const env = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
      return env;
    })
    .catch(() => null);
}

// ── geometry helpers ──

// a box from a to b, `w` wide and `d` deep, its width lying along `side`
export function beam(a, b, w, d, side) {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(w, d, len);
  const m = new THREE.Matrix4();
  const z = new V3().subVectors(b, a).normalize();
  const x = side.clone().sub(z.clone().multiplyScalar(side.dot(z))).normalize();
  const y = new V3().crossVectors(z, x);
  m.makeBasis(x, y, z).setPosition(a.clone().add(b).multiplyScalar(0.5));
  return g.applyMatrix4(m);
}

// a quad through four corners (counter-clockwise from its front), uv 0…1
export function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  g.computeVertexNormals();
  return g;
}

// A side profile in (z, y), run across the cab from x0 to x1. Points are
// [z, y], or ['q', cz, cy, z, y] for a curve through a control point.
export function across(points, x0, x1, { bevel = 0, curve = 8 } = {}) {
  const s = new THREE.Shape();
  points.forEach((p, i) => {
    if (p[0] === 'q') s.quadraticCurveTo(-p[1], p[2], -p[3], p[4]);
    else if (i === 0) s.moveTo(-p[0], p[1]);
    else s.lineTo(-p[0], p[1]);
  });
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0 - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curve });
  g.rotateY(Math.PI / 2);
  g.translate(x0 + bevel, 0, 0);
  return g;
}

// a cylinder lying along z
export const rod = (r0, r1, len, segs = 12) => new THREE.CylinderGeometry(r1, r0, len, segs).rotateX(Math.PI / 2);

// UVs projected from whichever axis a face looks along, `size` metres to
// one repeat, so every part of a merged surface shares one texel density
// (`swap` turns the texture a quarter, for grain that runs along x)
function triUV(geo, size, swap = false) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  const a = new V3();
  const b = new V3();
  const c = new V3();
  const n = new V3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    n.subVectors(c, b).cross(new V3().subVectors(a, b));
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    [a, b, c].forEach((v, k) => {
      let u;
      let w;
      if (ax >= ay && ax >= az) [u, w] = [v.z, v.y];
      else if (ay >= az) [u, w] = [v.x, v.z];
      else [u, w] = [v.x, v.y];
      if (swap) [u, w] = [w, u];
      uv[(i + k) * 2] = u / size;
      uv[(i + k) * 2 + 1] = w / size;
    });
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Smooth normals for a triangle soup, except across edges sharper than
// `crease` (radians): at each corner, the normals of the faces that meet
// there within that angle of its own, each counted by its area. So a big
// flat face keeps its own normal right to its rim (and stays flat) while the
// little faces of a rounded edge or a curved profile take each other's and
// read as one curve. Corners meet where they're within a tenth of a
// millimetre (the cab's smallest parts are a couple of millimetres across).
const CREASE = 0.7;
function creased(geo, crease) {
  const pos = geo.attributes.position;
  const faces = pos.count / 3;
  const fn = new Float32Array(faces * 3); // each face's normal, its length the face's area
  const at = new Map();
  const a = new V3();
  const b = new V3();
  const c = new V3();
  const n = new V3();
  const key = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const keys = new Array(pos.count);
  for (let f = 0; f < faces; f++) {
    a.fromBufferAttribute(pos, f * 3);
    b.fromBufferAttribute(pos, f * 3 + 1);
    c.fromBufferAttribute(pos, f * 3 + 2);
    n.subVectors(c, b).cross(a.sub(b));
    fn[f * 3] = n.x;
    fn[f * 3 + 1] = n.y;
    fn[f * 3 + 2] = n.z;
    for (let k = 0; k < 3; k++) {
      const h = (keys[f * 3 + k] = key(f * 3 + k));
      const list = at.get(h);
      if (list) list.push(f);
      else at.set(h, [f]);
    }
  }
  const cos = Math.cos(crease);
  const out = new Float32Array(pos.count * 3);
  for (let f = 0; f < faces; f++) {
    const x = fn[f * 3];
    const y = fn[f * 3 + 1];
    const z = fn[f * 3 + 2];
    const len = Math.hypot(x, y, z);
    for (let k = 0; k < 3; k++) {
      let sx = 0;
      let sy = 0;
      let sz = 0;
      if (len > 0)
        for (const o of at.get(keys[f * 3 + k])) {
          const ox = fn[o * 3];
          const oy = fn[o * 3 + 1];
          const oz = fn[o * 3 + 2];
          const ol = Math.hypot(ox, oy, oz);
          if (ol > 0 && (x * ox + y * oy + z * oz) / (len * ol) > cos) {
            sx += ox;
            sy += oy;
            sz += oz;
          }
        }
      const sl = Math.hypot(sx, sy, sz);
      const i = (f * 3 + k) * 3;
      // (a sliver with no area keeps the normal it came with)
      if (sl > 0) {
        out[i] = sx / sl;
        out[i + 1] = sy / sl;
        out[i + 2] = sz / sl;
      } else {
        out[i] = geo.attributes.normal?.getX(f * 3 + k) ?? 0;
        out[i + 1] = geo.attributes.normal?.getY(f * 3 + k) ?? 1;
        out[i + 2] = geo.attributes.normal?.getZ(f * 3 + k) ?? 0;
      }
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return geo;
}

// Static parts gathered by material and merged at the end, one draw each.
// A material's userData.tri = { size, swap } gives its parts triUV's UVs.
export function partsBin() {
  const bins = new Map();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new V3();
  const s = new V3();
  const put = (mat, geo) => {
    if (!bins.has(mat)) bins.set(mat, []);
    bins.get(mat).push(geo);
    return geo;
  };
  return {
    add(mat, geo, at = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
      q.setFromEuler(e.set(rot[0], rot[1], rot[2], rot[3] ?? 'XYZ'));
      m4.compose(p.set(at[0], at[1], at[2]), q, typeof scale === 'number' ? s.setScalar(scale) : s.set(scale[0], scale[1], scale[2]));
      return put(mat, geo.applyMatrix4(m4));
    },
    // already placed, or placed by a matrix (a part of a tilted group)
    put(mat, geo, matrix) {
      return put(mat, matrix ? geo.applyMatrix4(matrix) : geo);
    },
    build(parent, { cast = true, receive = true } = {}) {
      const out = [];
      for (const [mat, list] of bins) {
        const geos = list.map((g) => {
          const n = g.index ? g.toNonIndexed() : g;
          if (n !== g) g.dispose();
          for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
          // an extrusion comes with a normal per face, so its rounded corners
          // and curved profiles show every facet: smooth across the gentle
          // edges, keep the sharp ones
          if (g.type === 'ExtrudeGeometry') creased(n, CREASE);
          if (mat.userData.tri) triUV(n, mat.userData.tri.size, mat.userData.tri.swap);
          return n;
        });
        const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
        geos.forEach((g) => g.dispose());
        mesh.castShadow = cast && !mat.transparent;
        mesh.receiveShadow = receive;
        parent.add(mesh);
        out.push(mesh);
      }
      bins.clear();
      return out;
    },
  };
}
