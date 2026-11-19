// Walt and Jesse's RV, from the driver's seat: the 1986 Fleetwood Bounder of
// Breaking Bad, a Class A motorhome. A wide dashboard of tan moulded plastic
// with dark brown and woodgrain trim, the hooded binnacle of gauges in front
// of you, the thin beige two-spoke wheel on its column with the shifter, the
// carpeted engine hump between the seats, Jesse in the passenger's seat and
// Mr. White standing in the aisle behind him in his yellow suit. Out of the
// two-pane windshield, the New Mexico high desert at the golden hour: a
// straight road to the horizon, scrub, a ranch fence, power poles and mesas.
//
// Going (click the wheel or the shifter): into drive, the RV pulls away and
// keeps gathering speed while the day goes by in a time-lapse: the sun sets,
// the stars come out, the headlights and the gauges come on. At dusk a pair
// of wings swings out of the RV's sides (you turn to watch the left one) and
// the jets under them catch; the road falls away and the RV rises into the
// night sky. Then you see it from outside, climbing for space with Walt's
// blue crystals spilling out of the back and Hank's SUV after it, lights
// going, and the peak is a fade through the dark into the universe.
//
// The cab's floor is y = 0, a metre above the road; you sit on the left,
// looking down −z. Units are metres.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { gltfLoader } from '../../../lib/three/gltf';
import { loadTexture } from '../../../lib/three/textures';
import { glassMat, glowSprite, glowTexture, painted, planarUV, rng, roundedBox, tubeAlong } from '../kit';
import { sky as starField } from '../space';
import { loadCrew, nudge, prefetchCrew } from '../crew';
import { retarget } from '../../rickmorty/portal/clips';
import { LOOK_KEY, bodyById, readLooks } from '../../rickmorty/wardrobe/looks';
import { dress } from '../../rickmorty/wardrobe/wear';
import { local } from '../../../lib/hooks';
import { createModels } from '../../../lib/models';
import { disposeTree } from '../../../lib/three/renderer';
import { clamp01, due, smooth } from '../timeline';
import { vehicleById } from '../vehicles';

const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
const EYE = [-0.6, 1.22, 0.22];
const REST = [-0.2, -0.14]; // where you look, at rest: a little right and down

// the road: under the cab's floor, its centre line to your left (you keep
// to the right-hand lane), and how its textures repeat (metres)
const ROAD_Y = -1.06;
const LANE = -1.8;
const ROAD_W = 7.4;
const ROAD_TILE = 4;
const LINE_TILE = 24;
const GROUND_TILE = 6;
const POLE_GAP = 50;
const POLE_X = LANE + 13;
const POST_GAP = 5;

// the sun: its bearing right of dead ahead (radians), and its height and
// place in the photographed sky (degrees, and across the photograph)
const SUN_BEARING = 0.62;
const SUN_EL = 8.17;
const SKY_U = 0.6077;

// the windshield: its foot on the dash, its top under the header, its outer
// ends a little further back than the middle (a shallow V)
const WS = { x: 1.12, y0: 0.985, z0: -1.32, y1: 1.84, z1: -1.09, v: 0.05 };
// the wheel: its hub, the column's angle up from level, its radius
const WHEEL_AT = [-0.6, 0.8, -0.36];
const WHEEL_TILT = 0.73;
const WHEEL_R = 0.225;
// the gauges' face: tilted back to face your eyes
const FACE_AT = [-0.6, 0.915, -0.862];
const FACE_TILT = 0.25;
const FACE = { w: 0.56, h: 0.2, px: 1024, py: 366 };

// the drive: how fast at the end of the wind-up (m/s), the top of the
// time-lapse, and how the push builds
const V0 = 2.5;
const VMAX = 220;
const PUSH = 1.8;

export function prefetch() {
  prefetchCrew(['jesse', 'jesse-sit', 'walt', 'walt-idle']);
  for (const url of [WING_URL, FLYER_URL, SUV_URL]) fetch(url).catch(() => {});
}

// How far you've gone and how fast, `lt` ms into the launch; `k` is how far
// through the drive (0 when it starts, 1 at the peak).
function driveAt(p, lt) {
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
function loadTex(url, { srgb = true, repeat = true } = {}) {
  return loadTexture(url, { color: srgb, wrap: repeat }).catch(() => null);
}

// a CC0 surface: its colour, and its normal and ARM maps where they're worth it
function loadSet(dir, { normal = true, arm = false } = {}) {
  return Promise.all([loadTex(`${dir}/color.webp`), normal ? loadTex(`${dir}/normal.webp`, { srgb: false }) : null, arm ? loadTex(`${dir}/arm.webp`, { srgb: false }) : null]).then(([color, nrm, armMap]) => ({ color, normal: nrm, arm: armMap }));
}

// a crew member’s clip on its own (the HTTP cache has it from loadCrew),
// noting the hips it was made on (for another figure of theirs to sit on)
function loadClip(name) {
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
function calmly(crew, clip, a, b, speed, pose) {
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

function loadEnv(pmrem) {
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
function beam(a, b, w, d, side) {
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
function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  g.computeVertexNormals();
  return g;
}

// A side profile in (z, y), run across the cab from x0 to x1. Points are
// [z, y], or ['q', cz, cy, z, y] for a curve through a control point.
function across(points, x0, x1, { bevel = 0, curve = 8 } = {}) {
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
const rod = (r0, r1, len, segs = 12) => new THREE.CylinderGeometry(r1, r0, len, segs).rotateX(Math.PI / 2);

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
function partsBin() {
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

// ── painted surfaces ──

// fine noise over what's drawn, the same in each channel (grain, fibres)
function grain(g, W, H, r, amp) {
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 2 * amp;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// soft blots of colour ('r,g,b,a'), for mottling and wear
function blots(g, W, H, r, n, colors, size) {
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = size * (0.3 + r());
    const c = colors[i % colors.length];
    const rgb = c.split(',').slice(0, 3).join(',');
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${c})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

// moulded plastic, the dash's and the trim's: a fine pebbled grain over a
// slightly mottled tan (other colours tint it)
function mouldedMaps(seed) {
  const r = rng(seed);
  const map = painted(
    512,
    512,
    (g, W, H) => {
      g.fillStyle = '#bc9f78';
      g.fillRect(0, 0, W, H);
      blots(g, W, H, r, 60, ['255,246,226,0.08', '96,70,42,0.07'], 80);
      grain(g, W, H, r, 5);
    },
    { repeat: [1, 1] },
  );
  const bump = painted(
    512,
    512,
    (g, W, H) => {
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 16000; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
        g.beginPath();
        g.arc(r() * W, r() * H, 0.7 + r() * 1.5, 0, TAU);
        g.fill();
      }
    },
    { srgb: false, repeat: [1, 1] },
  );
  return { map, bump };
}

// brown cut-pile carpet, worn paler in places
function carpetMaps(seed) {
  const r = rng(seed);
  const map = painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#5d4636';
      g.fillRect(0, 0, W, H);
      blots(g, W, H, r, 24, ['28,18,12,0.2', '130,104,80,0.1'], 50);
      grain(g, W, H, r, 24);
    },
    { repeat: [1, 1] },
  );
  const bump = painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      grain(g, W, H, r, 70);
    },
    { srgb: false, repeat: [1, 1] },
  );
  return { map, bump };
}

// rust-brown velour, in puffed channels stitched along their seams
function velourMaps(seed) {
  const r = rng(seed);
  const N = 7;
  const map = painted(
    512,
    512,
    (g, W, H) => {
      g.fillStyle = '#6f432b';
      g.fillRect(0, 0, W, H);
      const cw = W / N;
      for (let i = 0; i < N; i++) {
        const gr = g.createLinearGradient(i * cw, 0, (i + 1) * cw, 0);
        gr.addColorStop(0, 'rgba(24,12,6,0.55)');
        gr.addColorStop(0.16, 'rgba(255,214,170,0.05)');
        gr.addColorStop(0.5, 'rgba(255,214,170,0.15)');
        gr.addColorStop(0.84, 'rgba(255,214,170,0.05)');
        gr.addColorStop(1, 'rgba(24,12,6,0.55)');
        g.fillStyle = gr;
        g.fillRect(i * cw, 0, cw, H);
      }
      g.fillStyle = 'rgba(214,170,120,0.35)';
      for (let i = 0; i <= N; i++) for (let y = 0; y < H; y += 7) g.fillRect(i * cw - 3, y, 1.2, 3.5);
      grain(g, W, H, r, 8);
    },
    { repeat: [1, 1] },
  );
  const bump = painted(
    512,
    512,
    (g, W, H) => {
      const cw = W / N;
      for (let i = 0; i < N; i++) {
        const gr = g.createLinearGradient(i * cw, 0, (i + 1) * cw, 0);
        gr.addColorStop(0, '#202020');
        gr.addColorStop(0.2, '#9a9a9a');
        gr.addColorStop(0.5, '#c8c8c8');
        gr.addColorStop(0.8, '#9a9a9a');
        gr.addColorStop(1, '#202020');
        g.fillStyle = gr;
        g.fillRect(i * cw, 0, cw, H);
      }
      grain(g, W, H, r, 14);
    },
    { srgb: false, repeat: [1, 1] },
  );
  return { map, bump };
}

// the headliner: pale perforated vinyl
function linerMaps(seed) {
  const r = rng(seed);
  const dots = (g, W, H, c) => {
    g.fillStyle = c;
    for (let y = 4; y < H; y += 8) for (let x = (y % 16 ? 0 : 4) + 2; x < W; x += 8) g.fillRect(x, y, 1.6, 1.6);
  };
  const map = painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#d8cbb0';
      g.fillRect(0, 0, W, H);
      blots(g, W, H, r, 14, ['150,128,96,0.08'], 60);
      dots(g, W, H, 'rgba(90,74,54,0.28)');
      grain(g, W, H, r, 4);
    },
    { repeat: [1, 1] },
  );
  const bump = painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#909090';
      g.fillRect(0, 0, W, H);
      dots(g, W, H, '#303030');
    },
    { srgb: false, repeat: [1, 1] },
  );
  return { map, bump };
}

// an eighties curtain: mustard and brown stripes, hanging in folds
function curtainMaps(seed) {
  const r = rng(seed);
  const map = painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#b8873f';
      g.fillRect(0, 0, W, H);
      const bands = [
        [0.08, '#6d3f22'],
        [0.03, '#e9d3a3'],
        [0.15, '#b8873f'],
        [0.05, '#8f5228'],
        [0.03, '#e9d3a3'],
        [0.16, '#c99b4c'],
      ];
      let x = 0;
      while (x < W) for (const [w, c] of bands) {
        g.fillStyle = c;
        g.fillRect(x, 0, w * W + 1, H);
        x += w * W;
      }
      for (let i = 0; i < 4; i++) {
        const gr = g.createLinearGradient((i * W) / 4, 0, ((i + 1) * W) / 4, 0);
        gr.addColorStop(0, 'rgba(30,16,6,0.35)');
        gr.addColorStop(0.5, 'rgba(255,240,210,0.12)');
        gr.addColorStop(1, 'rgba(30,16,6,0.35)');
        g.fillStyle = gr;
        g.fillRect((i * W) / 4, 0, W / 4, H);
      }
      grain(g, W, H, r, 6);
    },
    { repeat: [1, 1] },
  );
  const bump = painted(
    256,
    256,
    (g, W, H) => {
      for (let i = 0; i < 4; i++) {
        const gr = g.createLinearGradient((i * W) / 4, 0, ((i + 1) * W) / 4, 0);
        gr.addColorStop(0, '#303030');
        gr.addColorStop(0.5, '#d0d0d0');
        gr.addColorStop(1, '#303030');
        g.fillStyle = gr;
        g.fillRect((i * W) / 4, 0, W / 4, H);
      }
    },
    { srgb: false, repeat: [1, 1] },
  );
  return { map, bump };
}

// sun-greyed wood, for the power poles and the fence posts
function weatheredMap(seed) {
  const r = rng(seed);
  return painted(
    128,
    512,
    (g, W, H) => {
      g.fillStyle = '#75624f';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 90; i++) {
        const x = r() * W;
        g.strokeStyle = r() < 0.5 ? `rgba(40,30,22,${0.2 + r() * 0.3})` : `rgba(190,176,156,${0.1 + r() * 0.15})`;
        g.lineWidth = 0.6 + r() * 1.6;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 8, H * 0.33, x + (r() - 0.5) * 8, H * 0.66, x + (r() - 0.5) * 4, H);
        g.stroke();
      }
      grain(g, W, H, r, 10);
    },
    { repeat: [1, 1] },
  );
}

// The road's markings over the tarmac, and the dirt along its edges: the
// overlay is the road and a metre and a bit each side, 24 m of it (two of
// the centre line's dashes), mostly see-through.
const MARK_W = ROAD_W + 2.6;
function markingsMap(seed) {
  const r = rng(seed);
  return painted(
    256,
    1024,
    (g, W, H) => {
      const px = W / MARK_W;
      const py = H / LINE_TILE;
      const edge = 1.3 * px; // where the tarmac starts
      g.clearRect(0, 0, W, H);
      // dirt washed onto the edges
      for (const side of [0, 1]) {
        const gr = g.createLinearGradient(side ? W : 0, 0, side ? W - edge - 0.7 * px : edge + 0.7 * px, 0);
        gr.addColorStop(0, 'rgba(158,122,86,1)');
        gr.addColorStop(0.55, 'rgba(150,116,82,0.85)');
        gr.addColorStop(1, 'rgba(140,108,76,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 900; i++) {
          const d = Math.pow(r(), 2.2) * (edge + 0.9 * px);
          const x = side ? W - d : d;
          g.fillStyle = `rgba(${120 + r() * 60},${90 + r() * 45},${60 + r() * 35},${0.25 + r() * 0.4})`;
          g.beginPath();
          g.arc(x, r() * H, 0.6 + r() * 2.2, 0, TAU);
          g.fill();
        }
      }
      // white edge lines, faded and broken
      for (const x of [edge + 0.3 * px, W - edge - 0.42 * px]) {
        for (let y = 0; y < H; y += 3) {
          const worn = Math.sin(y * 0.05 + x) * 0.5 + 0.5;
          g.fillStyle = `rgba(232,226,210,${0.38 + worn * 0.3 - r() * 0.2})`;
          g.fillRect(x, y, 0.12 * px, 3);
        }
      }
      // the centre: a faded yellow dash, three metres in every twelve
      const cx = edge + (ROAD_W / 2) * px;
      for (const y0 of [2, 14]) {
        for (let y = y0 * py; y < (y0 + 3) * py; y += 2) {
          g.fillStyle = `rgba(226,178,64,${0.62 + r() * 0.25})`;
          g.fillRect(cx - 0.06 * px, y, 0.12 * px, 2);
        }
        // worn through in spots
        for (let i = 0; i < 6; i++) {
          g.fillStyle = 'rgba(70,66,62,0.6)';
          g.fillRect(cx - 0.07 * px + r() * 2, (y0 + r() * 3) * py, 2 + r() * 2, 2 + r() * 6);
        }
      }
      // tar snakes: crack sealant squiggling along and across
      g.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        let x = edge + r() * ROAD_W * px;
        let y = r() * H;
        const along = r() < 0.6;
        g.strokeStyle = `rgba(14,13,12,${0.55 + r() * 0.3})`;
        g.lineWidth = 1.2 + r() * 1.8;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 10; k++) {
          x += along ? (r() - 0.5) * 6 : 6 + r() * 6;
          y += along ? 8 + r() * 14 : (r() - 0.5) * 10;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    },
    { repeat: [1, 1] },
  );
}

// a broad, soft variation in the ground's tone, so its tiling doesn't show
function macroMap(seed) {
  const r = rng(seed);
  return painted(
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      for (let pass = 0; pass < 2; pass++)
        for (let i = 0; i < 70; i++) {
          const x = r() * W;
          const y = r() * H;
          const rad = (pass ? 12 : 40) * (0.4 + r());
          const c = r() < 0.5 ? '255,255,255' : '0,0,0';
          for (const [ox, oy] of [
            [0, 0],
            [W, 0],
            [-W, 0],
            [0, H],
            [0, -H],
          ]) {
            const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
            gr.addColorStop(0, `rgba(${c},${0.18 + r() * 0.12})`);
            gr.addColorStop(1, `rgba(${c},0)`);
            g.fillStyle = gr;
            g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
          }
        }
    },
    { srgb: false, repeat: [1, 1] },
  );
}

// ── the instruments ──

// The gauges, on a canvas the shape of the cluster's face: the speedometer
// in the middle (to 85, the eighties' way, with 55 picked out), fuel and
// temperature to the left, oil and volts to the right. `lit`: only what the
// lamps behind the face light up, for its glow.
const DIALS = {
  speed: { x: 512, y: 176, r: 158, from: 0.75 * Math.PI, sweep: 1.5 * Math.PI },
  fuel: { x: 172, y: 106, r: 64, from: (7 / 6) * Math.PI, sweep: (2 / 3) * Math.PI },
  temp: { x: 172, y: 262, r: 64, from: (7 / 6) * Math.PI, sweep: (2 / 3) * Math.PI },
  oil: { x: 852, y: 106, r: 64, from: (7 / 6) * Math.PI, sweep: (2 / 3) * Math.PI },
  volts: { x: 852, y: 262, r: 64, from: (7 / 6) * Math.PI, sweep: (2 / 3) * Math.PI },
};
const FONT = 'Helvetica, Arial, sans-serif';
function paintCluster(g, W, H, lit) {
  const ink = lit ? '#ffffff' : '#eee8d8';
  if (lit) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
  } else {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#22201d');
    gr.addColorStop(1, '#0d0c0b');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  const at = (D, f, rr) => {
    const a = D.from + f * D.sweep;
    return [D.x + Math.cos(a) * rr, D.y + Math.sin(a) * rr];
  };
  const tick = (D, f, r0, r1, w, c) => {
    const [x0, y0] = at(D, f, r0);
    const [x1, y1] = at(D, f, r1);
    g.strokeStyle = c;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  const text = (s, x, y, size, c = ink, weight = 'bold') => {
    g.fillStyle = c;
    g.font = `${weight} ${size}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s, x, y);
  };
  for (const D of Object.values(DIALS)) {
    if (!lit) {
      g.fillStyle = '#070707';
      g.beginPath();
      g.arc(D.x, D.y, D.r, 0, TAU);
      g.fill();
      g.strokeStyle = '#3a3733';
      g.lineWidth = 3;
      g.stroke();
    }
  }
  // the speedometer
  const S = DIALS.speed;
  for (let v = 0; v <= 85; v += 5) {
    const major = v % 10 === 0;
    tick(S, v / 85, S.r * (major ? 0.8 : 0.87), S.r * 0.95, major ? 4 : 2, v === 55 ? '#ff7a3c' : ink);
    if (major) {
      const [x, y] = at(S, v / 85, S.r * 0.64);
      text(String(v), x, y, 30, v === 50 || v === 60 ? ink : ink);
    }
  }
  {
    const [x, y] = at(S, 55 / 85, S.r * 0.64);
    text('55', x, y, 26, '#ff7a3c');
  }
  for (let kmh = 20; kmh <= 120; kmh += 20) {
    const f = kmh / 1.609 / 85;
    tick(S, f, S.r * 0.38, S.r * 0.44, 2, '#e8954a');
    const [x, y] = at(S, f, S.r * 0.3);
    text(String(kmh), x, y, 13, '#e8954a');
  }
  text('MPH', S.x, S.y + S.r * 0.3, 18);
  text('km/h', S.x, S.y - S.r * 0.12, 12, '#e8954a', 'normal');
  // the odometer, in its window
  g.fillStyle = lit ? '#000' : '#020202';
  g.fillRect(S.x - 52, S.y + S.r * 0.44, 104, 26);
  const odo = '078412';
  for (let i = 0; i < 6; i++) {
    const last = i === 5;
    if (last) {
      g.fillStyle = lit ? '#bbbbbb' : '#e8e4da';
      g.fillRect(S.x - 52 + i * 17 + 2, S.y + S.r * 0.44 + 2, 15, 22);
    }
    text(odo[i], S.x - 52 + i * 17 + 9.5, S.y + S.r * 0.44 + 13.5, 18, last ? '#111' : ink, 'normal');
  }
  // the small ones
  const small = (D, labels, name, ticks = 5, red = null) => {
    for (let i = 0; i < ticks; i++) {
      const f = i / (ticks - 1);
      tick(D, f, D.r * (i % 2 ? 0.8 : 0.7), D.r * 0.92, i % 2 ? 2 : 3.5, red != null && f >= red ? '#ff5a3a' : ink);
    }
    labels.forEach(([s, f]) => {
      const [x, y] = at(D, f, D.r * 0.52);
      text(s, x, y + 2, 16);
    });
    text(name, D.x, D.y + D.r * 0.42, 13, ink, 'normal');
  };
  small(DIALS.fuel, [
    ['E', 0],
    ['F', 1],
  ], 'FUEL');
  small(DIALS.temp, [
    ['C', 0],
    ['H', 1],
  ], 'TEMP', 5, 0.9);
  small(DIALS.oil, [
    ['0', 0],
    ['80', 1],
  ], 'OIL');
  small(DIALS.volts, [
    ['9', 0],
    ['18', 1],
  ], 'VOLTS');
  // the lamps' windows (the lamps themselves sit over them)
  if (!lit) {
    g.fillStyle = '#050505';
    for (const [x, y] of Object.values(LAMP_AT)) g.fillRect(x - 24, y - 12, 48, 24);
  }
}
// where the warning lamps sit on the face (canvas px)
const LAMP_AT = { brake: [298, 336], gauges: [726, 336], beam: [512, 302], left: [300, 32], right: [724, 32] };
const faceLocal = (x, y) => [(x / FACE.px - 0.5) * FACE.w, (0.5 - y / FACE.py) * FACE.h];

// a warning lamp's window: its legend in white on black (the colour comes
// from the lamp)
function lampMap(kind) {
  return painted(
    96,
    48,
    (g, W, H) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff';
      g.strokeStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (kind === 'brake' || kind === 'gauges') {
        g.font = `bold ${kind === 'brake' ? 19 : 13}px ${FONT}`;
        if (kind === 'brake') g.fillText('BRAKE', W / 2, H / 2 + 1);
        else {
          g.fillText('CHECK', W / 2, H / 2 - 8);
          g.fillText('GAUGES', W / 2, H / 2 + 9);
        }
      } else if (kind === 'beam') {
        // the high beam's lamp: a headlight with its rays
        g.lineWidth = 3;
        g.beginPath();
        g.arc(W / 2 - 4, H / 2, 12, -Math.PI / 2, Math.PI / 2);
        g.closePath();
        g.stroke();
        for (let i = -2; i <= 2; i++) {
          g.beginPath();
          g.moveTo(W / 2 + 12, H / 2 + i * 6);
          g.lineTo(W / 2 + 28, H / 2 + i * 6);
          g.stroke();
        }
      } else {
        // a turn signal's arrow
        const s = kind === 'left' ? -1 : 1;
        g.beginPath();
        g.moveTo(W / 2 + s * 22, H / 2);
        g.lineTo(W / 2 + s * 4, H / 2 - 14);
        g.lineTo(W / 2 + s * 4, H / 2 - 6);
        g.lineTo(W / 2 - s * 20, H / 2 - 6);
        g.lineTo(W / 2 - s * 20, H / 2 + 6);
        g.lineTo(W / 2 + s * 4, H / 2 + 6);
        g.lineTo(W / 2 + s * 4, H / 2 + 14);
        g.closePath();
        g.fill();
      }
    },
    { mips: false },
  );
}

// The radio: an AM/FM cassette deck behind a chrome bezel; `lit`, its dial
// glowing amber.
function paintRadio(g, W, H, lit) {
  if (lit) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
  } else {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#d8d8d4');
    gr.addColorStop(0.45, '#8c8c88');
    gr.addColorStop(0.55, '#b4b4b0');
    gr.addColorStop(1, '#5c5c58');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#16120e';
    g.fillRect(8, 8, W - 16, H - 16);
  }
  // the dial
  g.fillStyle = lit ? 'rgba(255,170,70,0.55)' : '#0a0806';
  g.fillRect(36, 22, 250, 50);
  g.fillStyle = lit ? '#ffe0b0' : '#d8cfb8';
  g.font = `bold 13px ${FONT}`;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  ['88', '92', '96', '100', '104', '108'].forEach((s, i) => g.fillText(s, 60 + i * 42, 36));
  ['54', '60', '70', '90', '110', '140', '170'].forEach((s, i) => g.fillText(s, 56 + i * 35, 60));
  g.textAlign = 'left';
  g.font = `bold 10px ${FONT}`;
  g.fillText('FM', 40, 36);
  g.fillText('AM', 40, 60);
  g.fillStyle = '#ff3a20';
  g.fillRect(158, 24, 3, 46);
  if (lit) return;
  // the cassette's door, and the preset buttons' recess
  g.fillStyle = '#050403';
  g.fillRect(316, 28, 160, 34);
  g.strokeStyle = '#9a9a96';
  g.lineWidth = 2;
  g.strokeRect(316, 28, 160, 34);
  g.fillStyle = '#c8c4b8';
  g.font = `bold 10px ${FONT}`;
  g.textAlign = 'center';
  g.fillText('AM/FM STEREO  CASSETTE', 396, 76);
  g.fillStyle = '#0a0806';
  g.fillRect(36, 82, 250, 30);
}

// the heater's controls: three slots for their levers, and their legends
function paintHvac(g, W, H) {
  g.fillStyle = '#2c2018';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 3;
  g.strokeRect(2, 2, W - 4, H - 4);
  g.font = `bold 11px ${FONT}`;
  g.textBaseline = 'middle';
  const rows = [
    ['FAN', ['OFF', 'LO', '', 'HI']],
    ['TEMP', ['COLD', '', '', 'HOT']],
    ['AIR', ['VENT', 'HEAT', 'DEF', 'A/C']],
  ];
  rows.forEach(([name, ticks], i) => {
    const y = 18 + i * 28;
    g.fillStyle = '#e8dcc4';
    g.textAlign = 'left';
    g.fillText(name, 8, y + 4);
    g.fillStyle = '#060504';
    g.fillRect(58, y, 186, 7);
    g.textAlign = 'center';
    ticks.forEach((s, k) => {
      g.fillStyle = name === 'TEMP' ? (k ? '#ff7a5a' : '#7ab8ff') : '#d8ccb4';
      g.font = `bold 8px ${FONT}`;
      g.fillText(s, 66 + k * 56, y + 16);
    });
    g.font = `bold 11px ${FONT}`;
  });
}

// the gear indicator on top of the column
function prndlMap() {
  return painted(
    128,
    32,
    (g, W, H) => {
      g.fillStyle = '#0b0a09';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#efe8d8';
      g.font = `bold 20px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      'PRND21'.split('').forEach((c, i) => g.fillText(c, 14 + i * 20, H / 2 + 1));
    },
    { mips: false },
  );
}

// The side mirrors' glass: the road behind going back to the horizon under
// the evening sky, the RV's own white flank down the inner edge, and the
// small convex mirror below. Painted for the left; the right one is flipped.
function sideMirrorMap() {
  return painted(128, 256, (g, W, H) => {
    const hz = H * 0.42;
    const vp = [W * 0.58, hz];
    let gr = g.createLinearGradient(0, 0, 0, hz);
    gr.addColorStop(0, '#7f9cc0');
    gr.addColorStop(0.7, '#d9b48e');
    gr.addColorStop(1, '#f0c79a');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, hz);
    g.fillStyle = '#9a7a78';
    g.beginPath();
    g.moveTo(0, hz);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, hz - 3 - Math.abs(Math.sin(x * 0.07)) * 6);
    g.lineTo(W, hz);
    g.fill();
    gr = g.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, '#b48c66');
    gr.addColorStop(1, '#6f5038');
    g.fillStyle = gr;
    g.fillRect(0, hz, W, H - hz);
    // the road, and its centre line
    g.fillStyle = '#4c4844';
    g.beginPath();
    g.moveTo(vp[0] - 2, hz);
    g.lineTo(vp[0] + 2, hz);
    g.lineTo(W * 1.4, H);
    g.lineTo(-W * 0.2, H);
    g.fill();
    g.strokeStyle = '#d9a840';
    g.lineWidth = 2;
    g.setLineDash([10, 18]);
    g.beginPath();
    g.moveTo(vp[0], hz);
    g.lineTo(-W * 0.05, H);
    g.stroke();
    g.setLineDash([]);
    // the RV's flank: white, with its brown and orange stripes
    g.fillStyle = '#e9e2d4';
    g.beginPath();
    g.moveTo(W, 0);
    g.lineTo(W * 0.8, 0);
    g.lineTo(W * 0.74, H);
    g.lineTo(W, H);
    g.fill();
    for (const [y, c, w] of [
      [0.55, '#6a3c22', 9],
      [0.62, '#c86f2c', 6],
    ]) {
      g.strokeStyle = c;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(W * 0.76, H * y);
      g.lineTo(W, H * (y + 0.06));
      g.stroke();
    }
    // the convex spotter
    const y0 = H * 0.76;
    g.fillStyle = '#121212';
    g.fillRect(4, y0 - 4, W - 8, H - y0);
    gr = g.createRadialGradient(W / 2, y0 + 26, 4, W / 2, y0 + 26, W * 0.6);
    gr.addColorStop(0, '#c8a47e');
    gr.addColorStop(0.5, '#a08060');
    gr.addColorStop(1, '#5a4434');
    g.fillStyle = gr;
    g.fillRect(8, y0, W - 16, H - y0 - 8);
    g.fillStyle = '#d6cfc0';
    g.fillRect(W * 0.7, y0, W * 0.3 - 8, H - y0 - 8);
    g.fillStyle = 'rgba(255,255,255,0.2)';
    g.fillRect(8, y0, W - 16, 3);
  });
}

// the rear-view mirror: the coach behind you, dim, and Mr. White's yellow
function rearMirrorMap() {
  return painted(256, 64, (g, W, H) => {
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#8a7a62');
    gr.addColorStop(0.3, '#4a3626');
    gr.addColorStop(1, '#2a1e16');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#5c3b22';
    g.fillRect(0, 6, W * 0.32, 18);
    g.fillRect(W * 0.7, 6, W * 0.3, 18);
    gr = g.createRadialGradient(W * 0.2, H * 0.55, 2, W * 0.2, H * 0.55, 40);
    gr.addColorStop(0, 'rgba(240,196,140,0.8)');
    gr.addColorStop(1, 'rgba(240,196,140,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#0c0907';
    g.fillRect(W * 0.44, 18, W * 0.12, H);
    gr = g.createRadialGradient(W * 0.64, H * 0.85, 3, W * 0.64, H * 0.85, 26);
    gr.addColorStop(0, 'rgba(226,196,60,0.95)');
    gr.addColorStop(1, 'rgba(226,196,60,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  });
}

// a road map, folded open on the dash
function roadMapMap() {
  const r = rng(77);
  return painted(256, 192, (g, W, H) => {
    g.fillStyle = '#ece4cf';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(200,180,120,0.35)';
    for (let i = 0; i < 9; i++) g.fillRect(r() * W, r() * H, 20 + r() * 60, 14 + r() * 40);
    g.strokeStyle = 'rgba(80,140,200,0.7)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, H * 0.3);
    g.bezierCurveTo(W * 0.3, H * 0.5, W * 0.6, H * 0.1, W, H * 0.4);
    g.stroke();
    for (let i = 0; i < 12; i++) {
      g.strokeStyle = r() < 0.3 ? '#c8332a' : 'rgba(60,50,40,0.6)';
      g.lineWidth = r() < 0.3 ? 2.2 : 1;
      g.beginPath();
      g.moveTo(r() * W, r() * H);
      g.lineTo(r() * W, r() * H);
      g.stroke();
    }
    g.fillStyle = 'rgba(40,30,20,0.55)';
    for (let i = 0; i < 30; i++) g.fillRect(r() * W, r() * H, 8 + r() * 18, 2);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(W / 2, 0);
    g.lineTo(W / 2, H);
    g.moveTo(0, H / 2);
    g.lineTo(W, H / 2);
    g.stroke();
  });
}

// ── the sky ──

// The sky: the photographed evening sky (range-compressed in the file, as
// the games store it), sinking as the sun goes down; the dusk after it, the
// night, the sun itself, far ranges along the horizon, and the haze the
// land fades into. `uLift` is the RV rising: the far ranges go, and the
// land's haze (LAND_FRAG, below the horizon) is all that's left of the ground.
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SKY_FRAG = /* glsl */ `
uniform sampler2D uPhoto;
uniform float uHasPhoto;
uniform float uShift;
uniform float uSink;
uniform float uDusk;
uniform float uNight;
uniform float uSunK;
uniform float uLift;
uniform vec3 uTint;
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uHaze;
varying vec3 vDir;
vec3 photo(vec3 d) {
  float el = degrees(asin(clamp(d.y, -1.0, 1.0))) + uSink;
  float u = atan(d.z, d.x) / 6.2831853 + 0.5 + uShift;
  float v = 1.0 - (90.0 - clamp(el, -11.0, 90.0)) / 101.25;
  vec3 l = pow(texture2D(uPhoto, vec2(u, clamp(v, 0.002, 0.998))).rgb, vec3(2.2));
  return l / max(vec3(1.0) - l, vec3(0.004));
}
float ridge(float a) {
  return 0.004 + 0.011 * (0.5 + 0.3 * sin(a * 3.0 + 1.3) + 0.16 * sin(a * 7.0 + 2.1) + 0.08 * abs(sin(a * 19.0 + 0.4)) + 0.04 * abs(sin(a * 43.0 + 2.7)));
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec2 dir = normalize(d.xz + vec2(1e-5));
  float toward = max(dot(dir, normalize(uSun.xz)), 0.0);
  vec3 day = uHasPhoto > 0.5 ? photo(d) * uTint : mix(vec3(0.95, 0.66, 0.42), vec3(0.24, 0.38, 0.66), smoothstep(0.0, 0.5, h));
  // dusk: the afterglow low where the sun went, violet over it, blue up high
  vec3 glow = mix(vec3(0.42, 0.16, 0.12), vec3(1.15, 0.42, 0.13), pow(toward, 3.0));
  vec3 dusk = mix(glow, vec3(0.16, 0.11, 0.27), smoothstep(0.0, 0.2, h));
  dusk = mix(dusk, vec3(0.03, 0.045, 0.12), smoothstep(0.12, 0.65, h));
  vec3 night = mix(vec3(0.028, 0.04, 0.09) + vec3(0.05, 0.022, 0.018) * pow(toward, 4.0), vec3(0.003, 0.005, 0.016), smoothstep(0.0, 0.4, h));
  vec3 c = mix(day, mix(day * 0.22, dusk, 0.85), uDusk);
  c = mix(c, night, uNight);
  float sd = max(dot(d, normalize(uSun)), 0.0);
  c += uSunCol * uSunK * (smoothstep(0.99993, 0.99997, sd) * 26.0 + pow(sd, 900.0) * 3.0 + pow(sd, 60.0) * 0.35 + pow(sd, 8.0) * 0.1);
  // far ranges along the horizon, then the haze
  float a = atan(d.x, -d.z);
  float rh = ridge(a);
  float keep = 1.0 - uLift;
  c = mix(c, uHaze * 0.8, (1.0 - smoothstep(rh - 0.0015, rh + 0.0015, h)) * keep);
  c = mix(c, uHaze, (1.0 - smoothstep(-0.004, 0.07, h)) * 0.55 * keep);
  // from up high: the air along the horizon, faintly lit, over the dark land
  c += vec3(0.012, 0.02, 0.05) * uLift * exp(-max(h, 0.0) * 26.0);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Everything below the horizon, in the land's own haze: the colour the ground
// fades to with distance. Drawn over the sky and its stars and under the
// land, so wherever the ground ends (its edge, the far end of the view) there
// is no seam, and no star shows through from under the world. As the RV
// rises (`uLift`) the haze stands a little higher: the air along the horizon.
const LAND_FRAG = /* glsl */ `
uniform vec3 uHaze;
uniform float uLift;
varying vec3 vDir;
void main() {
  float h = normalize(vDir).y;
  float a = 1.0 - smoothstep(-0.004 - 0.012 * uLift, 0.002 + 0.06 * uLift, h);
  gl_FragColor = vec4(uHaze, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// The photographed sky's colour just above the horizon, ahead of you (the
// sun's own glow counts for less): the day's haze.
function horizonColour(img, shift, tint) {
  const fallback = new THREE.Color(0.62, 0.48, 0.38);
  if (!img) return fallback;
  try {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 72;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 256, 72);
    const row = x.getImageData(0, Math.round(((90 - 2) / 101.25) * 72), 256, 1).data;
    const dec = (v) => {
      const l = (v / 255) ** 2.2;
      return l / Math.max(1 - l, 0.004);
    };
    const sum = [0, 0, 0];
    let n = 0;
    // straight ahead (−z) is atan(−1, 0): a quarter round from the photograph's u = 0.5
    const u0 = 0.25 + shift;
    for (let k = -64; k <= 64; k++) {
      const px = (((Math.floor((u0 + k / 256) * 256) % 256) + 256) % 256) * 4;
      const w = 1 / (1 + dec(row[px]) + dec(row[px + 1]));
      for (let ch = 0; ch < 3; ch++) sum[ch] += dec(row[px + ch]) * w;
      n += w;
    }
    return new THREE.Color((sum[0] / n) * tint[0] * 0.86, (sum[1] / n) * tint[1] * 0.86, (sum[2] / n) * tint[2] * 0.86);
  } catch {
    return fallback;
  }
}

// ── the world outside ──

// Distance haze over the land's materials, in linear light before the tone
// mapping, the colour shared (it follows the time of day). `rush`: the
// surface is one that scrolls under you (the ground, the road).
function hazy(mat, haze, key, extra, { rush = false } = {}) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uHaze = haze.color;
    s.uniforms.uHazeK = haze.k;
    s.uniforms.uRush = haze.rush;
    extra?.(s);
    // what rushes by under the wheels is read from a coarser copy of its
    // picture the faster it goes (the blur of speed), so its grain doesn't
    // crawl or strobe from frame to frame in the time-lapse
    if (rush) s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n  diffuseColor *= texture2D( map, vMapUv, uRush );\n#endif');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uHaze;\nuniform float uHazeK;\nuniform float uRush;')
      .replace(
        '#include <tonemapping_fragment>',
        `float hz = 1.0 - exp(-length(vViewPosition) * uHazeK);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, hz * hz * (3.0 - 2.0 * hz));
        #include <tonemapping_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `rv-haze-${key}${rush ? '-rush' : ''}`;
  return mat;
}

// A mesa: a flat cap of pale rock, a cliff, and the slope of fallen rock
// round its foot, on a ragged footprint. Faceted, coloured by height.
function mesaGeometry(r, { radius, height }) {
  const prof = [
    [0, 1],
    [0.9, 1],
    [0.96, 0.985],
    [1.0, 0.9],
    [1.03, 0.62],
    [1.2, 0.46],
    [1.55, 0.2],
    [1.95, 0],
  ];
  const tones = [
    [0.96, 0.9, 0.82],
    [0.96, 0.9, 0.82],
    [0.94, 0.84, 0.76],
    [0.98, 0.66, 0.54],
    [0.92, 0.6, 0.5],
    [0.86, 0.66, 0.54],
    [0.82, 0.68, 0.56],
    [0.8, 0.7, 0.58],
  ];
  const seg = 44;
  const ph = Array.from({ length: 6 }, () => r() * TAU);
  const foot = (a) => 1 + 0.16 * Math.sin(2 * a + ph[0]) + 0.09 * Math.sin(3 * a + ph[1]) + 0.05 * Math.sin(7 * a + ph[2]);
  const rings = prof.map(([f, hf], j) =>
    Array.from({ length: seg }, (_, i) => {
      const a = (i / seg) * TAU;
      const cliff = j >= 2 && j <= 4 ? 0.05 * Math.sin(a * 17 + ph[3]) + 0.03 * Math.sin(a * 31 + ph[4]) : 0;
      const rr = radius * f * foot(a) * (1 + cliff + (j > 4 ? (r() - 0.5) * 0.06 : 0));
      return [Math.cos(a) * rr, height * hf + (j > 4 && j < 7 ? (r() - 0.5) * height * 0.05 : 0), Math.sin(a) * rr];
    }),
  );
  const pos = [];
  const col = [];
  const uv = [];
  const put = (p, j, a) => {
    pos.push(...p);
    col.push(...tones[j]);
    uv.push(j <= 1 ? p[0] / 40 : (a * radius) / 40, j <= 1 ? p[2] / 40 : p[1] / 40);
  };
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < seg; i++) {
      const i2 = (i + 1) % seg;
      const a0 = (i / seg) * TAU;
      const a1 = ((i + 1) / seg) * TAU;
      if (j === 0) {
        put([0, height, 0], 0, a0);
        put(rings[1][i2], 1, a1);
        put(rings[1][i], 1, a0);
        continue;
      }
      const A = rings[j][i];
      const B = rings[j][i2];
      const C = rings[j + 1][i2];
      const D = rings[j + 1][i];
      put(A, j, a0);
      put(B, j, a1);
      put(C, j + 1, a1);
      put(A, j, a0);
      put(C, j + 1, a1);
      put(D, j + 1, a0);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// A model scattered beside the road in a band that recycles as you drive:
// each copy that falls behind comes back at the far end, somewhere new
// (from its index and how many times round it has been).
function scatter(models, model, o) {
  const inst = models.instanced(model, o.count, { receive: true, shadow: !!o.shadow });
  const n = o.count;
  const span = o.near - o.far;
  const r = rng(o.seed);
  const z0 = Float32Array.from({ length: n }, (_, i) => o.far + ((i + r()) / n) * span);
  const lap = new Int32Array(n).fill(-99999);
  const x = new Float32Array(n);
  const sc = new Float32Array(n);
  const turn = new Float32Array(n);
  const lean = new Float32Array(n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new V3();
  const s = new V3();
  const unit = 1 / Math.max(model.size.y, 0.01);
  const update = (d) => {
    for (let i = 0; i < n; i++) {
      const zz = z0[i] + d - o.far;
      const l = Math.floor(zz / span);
      if (l !== lap[i]) {
        lap[i] = l;
        const rr = rng(o.seed * 7919 + i * 131 + l * 104729);
        const side = rr() < (o.left ?? 0.5) ? -1 : 1;
        x[i] = LANE + side * (o.clear + Math.pow(rr(), o.spread ?? 1.6) * o.width);
        sc[i] = (o.h[0] + rr() * (o.h[1] - o.h[0])) * unit;
        turn[i] = rr() * TAU;
        lean[i] = (rr() - 0.5) * (o.lean ?? 0.12);
      }
      p.set(x[i], ROAD_Y - (o.sink ?? 0.05) * sc[i] * model.size.y, o.far + zz - l * span);
      q.setFromEuler(e.set(lean[i], turn[i], 0));
      inst.setMatrixAt(i, m.compose(p, q, s.setScalar(sc[i])));
    }
    inst.commit();
  };
  update(0);
  return { meshes: inst.meshes, update };
}

// The power line along the right of the road: poles with their crossarms,
// braces and insulators, a transformer now and then, and the wires sagging
// between them. Its pattern repeats every PERIOD poles, so the line can
// slide along by the length of one pattern and nobody sees the join.
const PERIOD = 4;
function powerLine({ wood, hardware, wire }) {
  const woods = [];
  const hard = [];
  const wires = [];
  const N = 34;
  const tops = [];
  const up = new V3(0, 0, 1);
  for (let i = 0; i < N; i++) {
    const z = 120 - i * POLE_GAP;
    const lean = [0.022, -0.012, 0.006, -0.026][i % PERIOD];
    const m = new THREE.Matrix4().makeRotationZ(lean).setPosition(POLE_X, ROAD_Y, z);
    woods.push(new THREE.CylinderGeometry(0.12, 0.16, 11.2, 8).translate(0, 5.6, 0).applyMatrix4(m));
    woods.push(new THREE.BoxGeometry(2.6, 0.13, 0.13).translate(0, 10.1, 0).applyMatrix4(m));
    woods.push(beam(new V3(0, 9.25, 0.08), new V3(-0.85, 10.04, 0.08), 0.06, 0.05, up).applyMatrix4(m));
    woods.push(beam(new V3(0, 9.25, 0.08), new V3(0.85, 10.04, 0.08), 0.06, 0.05, up).applyMatrix4(m));
    const pins = [
      [-1.15, 10.17],
      [1.15, 10.17],
      [0, 11.2],
    ];
    for (const [x, y] of pins) hard.push(new THREE.CylinderGeometry(0.045, 0.065, 0.2, 7).translate(x, y + 0.1, 0).applyMatrix4(m));
    tops.push(pins.map(([x, y]) => new V3(x, y + 0.18, 0).applyMatrix4(m)));
    if (i % PERIOD === 1) {
      hard.push(new THREE.CylinderGeometry(0.27, 0.27, 0.95, 12).translate(-0.42, 8.3, 0).applyMatrix4(m));
      hard.push(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 12).translate(-0.42, 8.8, 0).applyMatrix4(m));
    }
  }
  for (let i = 0; i + 1 < N; i++)
    for (let w = 0; w < 3; w++) {
      const a = tops[i][w];
      const b = tops[i + 1][w];
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const p = a.clone().lerp(b, t);
        p.y -= 0.9 * 4 * t * (1 - t);
        pts.push(p.toArray());
      }
      wires.push(tubeAlong(pts, 0.016, { segs: 10, radial: 3 }));
    }
  const group = new THREE.Group();
  const merge = (list, mat) => {
    const mesh = new THREE.Mesh(mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))), mat);
    list.forEach((g) => g.dispose());
    group.add(mesh);
  };
  merge(woods, wood);
  merge(hard, hardware);
  merge(wires, wire);
  return group;
}

// A ranch fence each side: weathered posts every few metres (a pattern of
// ten, so it slides like the power line) and three strands of wire.
const FENCE_PERIOD = 10;
function fences(postMat, wireMat) {
  const posts = [];
  const strands = [];
  const r = rng(41);
  const looks = Array.from({ length: FENCE_PERIOD }, () => [1.12 + r() * 0.16, (r() - 0.5) * 0.08, (r() - 0.5) * 0.06]);
  for (const side of [-1, 1]) {
    const x = LANE + side * 9.6;
    for (let i = 0; i < 75; i++) {
      const [h, lx, lz] = looks[i % FENCE_PERIOD];
      const thick = i % FENCE_PERIOD === 0 ? 0.14 : 0.085;
      const g = new THREE.BoxGeometry(thick, h, thick).translate(0, h / 2, 0);
      g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(lz, 0, lx)).setPosition(x, ROAD_Y - 0.05, 30 - i * POST_GAP));
      posts.push(g);
    }
    for (const y of [0.42, 0.74, 1.04]) strands.push(new THREE.BoxGeometry(0.008, 0.008, 380).translate(x, ROAD_Y + y, 30 - 190));
  }
  const group = new THREE.Group();
  group.add(new THREE.Mesh(mergeGeometries(posts.map((g) => g.toNonIndexed())), postMat));
  group.add(new THREE.Mesh(mergeGeometries(strands.map((g) => g.toNonIndexed())), wireMat));
  posts.forEach((g) => g.dispose());
  strands.forEach((g) => g.dispose());
  return group;
}

// ── the cab ──

// a captain's chair: pedestal, cushion, high back and fold-down armrests
function captainChair(bin, M, x, z, { head = true } = {}) {
  bin.add(M.black, roundedBox(0.36, 0.24, 0.36, 0.03), [x, 0.12, z + 0.04]);
  bin.add(M.brown, roundedBox(0.58, 0.07, 0.54, 0.025), [x, 0.28, z]);
  bin.add(M.velour, roundedBox(0.54, 0.16, 0.52, 0.065), [x, 0.4, z - 0.01]);
  // the cushion's front roll and its side bolsters
  bin.add(M.velour, rod(0.05, 0.05, 0.52, 14), [x, 0.42, z - 0.25], [0, Math.PI / 2, 0]);
  for (const s of [-1, 1]) bin.add(M.velour, roundedBox(0.08, 0.1, 0.48, 0.035), [x + s * 0.24, 0.5, z]);
  // the back, leaning back, in its shell, and the head roll
  const lean = 0.15;
  bin.add(M.velour, roundedBox(0.52, 0.82, 0.15, 0.07), [x, 0.9, z + 0.28], [lean, 0, 0]);
  if (head) for (const s of [-1, 1]) bin.add(M.velour, roundedBox(0.08, 0.78, 0.17, 0.035), [x + s * 0.235, 0.9, z + 0.27], [lean, 0, s * 0.06]);
  bin.add(M.tanDeep, roundedBox(0.56, 0.9, 0.05, 0.02), [x, 0.92, z + 0.37], [lean, 0, 0]);
  if (head) bin.add(M.velour, roundedBox(0.4, 0.2, 0.14, 0.065), [x, 1.42, z + 0.36], [lean, 0, 0]);
  for (const s of [-1, 1]) {
    bin.add(M.brown, roundedBox(0.075, 0.075, 0.38, 0.03), [x + s * 0.33, 0.68, z - 0.02]);
    bin.add(M.black, new THREE.CylinderGeometry(0.015, 0.015, 0.03, 10), [x + s * 0.33, 0.68, z + 0.19], [0, 0, Math.PI / 2]);
  }
}

// ── the wings ──
// Walt's home-made wings, the site owner's Meshy models (scripts/meshy-rv.mjs):
// one wing as it came, a right one (its root at +z, its tip at −z, its
// leading edge at −x, the jet hanging under it), mirrored for the left; and
// the whole RV with a pair of them, for the last look at it from outside (its
// cab at −x, its wings along z). Raw: where things are on the models as they
// came, in their own units.
const WINGS = { x: 1.22, y: 0.45, z: 0.1, span: 5.2, stow: 1.52, rise: 0.05 };
const WING_RAW = { span: 1.9, top: 0.18, jet: [0.235, -0.14, 0.374], tip: [-0.1, 0.15, -0.955] };
const FLYER = { length: 8.5, jet: [-0.15, -0.27, 0.5], tip: [-0.2, -0.19, 0.955] };
// the RV from outside: where it is (from your eye) and how it's turned, `u`
// of the way from the cut to the peak; off ahead and to the right, banking
// away and climbing, so its side and both wings show
function flightAt(u) {
  const d = 32 * u ** 1.4;
  return { x: 1.6 + 0.43 * d, y: -3 + 0.3 * d, z: -11 - 0.88 * d, yaw: -0.45, pitch: 0.25, roll: -0.12 - 0.08 * u };
}
// Hank, after you: his SUV (Albuquerque's, its front at −x, 5 m long and
// standing on y = 0) behind the RV, off to its left and below, and gaining,
// `u` as above, from the RV; it comes up from behind you, closes, then the
// RV pulls away
function chaseAt(u) {
  const close = smooth((u - 0.05) / 0.5);
  return { x: -10 + 2.6 * close, y: -5 + 2.6 * smooth(u / 0.5), z: 19 - 9.5 * close + 16 * smooth((u - 0.78) / 0.22) };
}
// the blue crystals: how many spill out, and where from on the RV (its back
// door, from the RV's middle, in metres)
const CRYSTALS = 70;
const DOOR = [0.4, -0.6, 3.8];

const LATE = 4000; // how long the cab waits for these three (ms)
const WING_URL = '/models/cockpit/rv-wing.glb';
const FLYER_URL = '/models/universe/rv-wings.glb';
const SUV_URL = '/models/albuquerque/world/suv.glb';

function loadModel(url) {
  const l = gltfLoader();
  return l
    .loadAsync(url)
    .then((g) => g.scene)
    .catch(() => null);
}

// Its paint lit from within a little (none by day), so a wing still reads as
// one against the night; returns the materials, to turn that up and down.
function selfLit(model) {
  const mats = new Set();
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m?.isMeshStandardMaterial || mats.has(m)) continue;
      m.emissive.setRGB(1, 0.92, 0.82);
      m.emissiveMap = m.map;
      m.emissiveIntensity = 0;
      m.metalness = Math.min(m.metalness, 0.3);
      mats.add(m);
    }
  });
  return [...mats];
}

// The pair, each on a pivot at the trailing edge of its root, under the side
// windows: swung back along the body below the window line (where you can't
// see them) until `open` swings them out level and they lock with a little
// rise. Each jet's glow is a pair of sprites (a hot core in a wide haze); the
// tips carry a red light on the left and a green on the right.
function wingPair(model) {
  const s = WINGS.span / WING_RAW.span;
  const group = new THREE.Group();
  const mats = selfLit(model);
  const pivots = [];
  const jets = [];
  const tips = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * WINGS.x, WINGS.y, WINGS.z);
    pivot.scale.x = sx; // the left is the right one mirrored
    const wing = sx > 0 ? model : model.clone();
    wing.rotation.y = -Math.PI / 2;
    wing.scale.setScalar(s);
    wing.updateMatrixWorld(true);
    // its root on the pivot, its trailing edge too, its top surface level with it
    const box = new THREE.Box3().setFromObject(wing);
    wing.position.set(-box.min.x, -WING_RAW.top * s, -box.max.z);
    const haze = glowSprite(0xff8a3a, 1.5 / s, 0);
    const core = glowSprite(0xfff0d8, 0.55 / s, 0);
    haze.position.set(...WING_RAW.jet).x += 0.08;
    core.position.set(...WING_RAW.jet).x += 0.03;
    const tip = glowSprite(sx < 0 ? 0xff2a2a : 0x38ff6a, 0.5 / s, 0);
    tip.position.set(...WING_RAW.tip);
    wing.add(haze, core, tip);
    jets.push(haze, core);
    tips.push(tip);
    pivot.add(wing);
    group.add(pivot);
    pivots.push(pivot);
  }
  return {
    group,
    // open: 0 stowed … 1 out; jets and lights: 0 … 1; night: how dark it is
    set(open, jets01, lights, night, t) {
      pivots.forEach((p, i) => {
        const sx = i ? 1 : -1;
        const o = open[i];
        p.rotation.set(0, -sx * WINGS.stow * (1 - o), sx * WINGS.rise * smooth((o - 0.92) / 0.08));
        p.visible = o > 0.001;
      });
      const flicker = 1 + 0.08 * Math.sin(t * 61) + 0.05 * Math.sin(t * 37);
      jets.forEach((j, i) => (j.material.opacity = jets01 * (i % 2 ? 1 : 0.75) * flicker));
      const blink = lights * (Math.sin(t * 5.2) > 0.2 ? 1 : 0.18);
      tips.forEach((tip) => (tip.material.opacity = blink));
      for (const m of mats) m.emissiveIntensity = 0.16 * night + 0.12 * jets01;
    },
  };
}

// Hank's SUV, turned to −z, its lights on the roof (red and blue, taking
// turns) and its tail lights on.
function chaserOf(model) {
  const group = new THREE.Group();
  model.rotation.y = -Math.PI / 2;
  model.position.y = -0.95;
  group.add(model);
  const mats = selfLit(model);
  // (each lamp a hot core in a wide, faint halo: one big bright sprite reads
  // as a ball of light sat on the roof, not as a lamp)
  const bar = [0xff2a2a, 0x2a6bff].map((c, i) => {
    const core = glowSprite(c, 0.9, 0);
    const halo = glowSprite(c, 4.2, 0);
    for (const s of [core, halo]) s.position.set(i ? 0.45 : -0.45, 1.05, 0.3);
    group.add(core, halo);
    return { core, halo };
  });
  for (const sx of [-1, 1]) {
    const tail = glowSprite(0xff3020, 0.7, 0.8);
    tail.position.set(sx * 0.85, 0.1, 2.5);
    group.add(tail);
  }
  group.visible = false;
  return {
    group,
    set(t) {
      const a = Math.sin(t * 19) > 0;
      bar.forEach((lamp, i) => {
        const on = (i === 0) === a;
        lamp.core.material.opacity = on ? 1 : 0.12;
        lamp.halo.material.opacity = on ? 0.3 : 0.03;
      });
      for (const m of mats) m.emissiveIntensity = 0.2;
    },
  };
}

// Walt's blue crystals, tumbling out of the RV's back door as it climbs: each
// let go at its own moment where the RV was then, drifting back past you
// while the RV pulls away (all worked out from the moment, so a jump or a
// skip shows them where they'd be). One instanced mesh.
function crystals(n) {
  const geo = new THREE.OctahedronGeometry(0.11, 0).scale(0.7, 1.5, 0.7);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8fdcff, emissive: 0x2a9cff, emissiveIntensity: 1.4, roughness: 0.15, metalness: 0.1, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  const r = rng(83);
  const each = Array.from({ length: n }, (_, i) => ({ at: 0.04 + (0.8 * i) / n + r() * 0.01, v: [(r() - 0.5) * 3, (r() - 0.6) * 2, 5 + r() * 7], spin: [r() * 6, r() * 6, r() * TAU], size: 0.7 + r() * 0.9 }));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new V3();
  const sc = new V3();
  mesh.visible = false;
  return {
    mesh,
    // u: through the shot; secs: how long the shot is; from(at) → where the
    // door was at `at`
    set(u, secs, from) {
      each.forEach((c, i) => {
        const age = (u - c.at) * secs;
        if (age < 0) {
          sc.setScalar(0);
          m.compose(pos.set(0, 0, 0), q.identity(), sc);
        } else {
          from(c.at, pos);
          pos.x += c.v[0] * age;
          pos.y += c.v[1] * age;
          pos.z += c.v[2] * age;
          e.set(c.spin[2] + c.spin[0] * age, c.spin[1] * age, 0);
          sc.setScalar(c.size * Math.min(1, age * 6));
          m.compose(pos, q.setFromEuler(e), sc);
        }
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// The whole winged RV from outside: centred, its cab turned to −z,
// FLYER.length long, with its jets and its wingtips' lights.
function flyerOf(model) {
  const group = new THREE.Group();
  const box = new THREE.Box3().setFromObject(model);
  const s = FLYER.length / (box.max.x - box.min.x);
  model.position.copy(box.getCenter(new V3())).negate();
  const holder = new THREE.Group();
  holder.rotation.y = -Math.PI / 2;
  holder.scale.setScalar(s);
  holder.add(model);
  group.add(holder);
  const mats = selfLit(model);
  const jets = [];
  const tips = [];
  for (const sz of [-1, 1]) {
    const haze = glowSprite(0xff8a3a, 2.4 / s, 0);
    const core = glowSprite(0xfff0d8, 0.8 / s, 0);
    haze.position.set(FLYER.jet[0] + 0.03, FLYER.jet[1], sz * FLYER.jet[2]);
    core.position.set(FLYER.jet[0] + 0.01, FLYER.jet[1], sz * FLYER.jet[2]);
    // its left wing is the one along +z
    const tip = glowSprite(sz > 0 ? 0xff2a2a : 0x38ff6a, 0.9 / s, 0);
    tip.position.set(FLYER.tip[0], FLYER.tip[1], sz * FLYER.tip[2]);
    model.add(haze, core, tip);
    jets.push(haze, core);
    tips.push(tip);
  }
  group.visible = false;
  return {
    group,
    set(jets01, t) {
      const flicker = 1 + 0.1 * Math.sin(t * 57) + 0.06 * Math.sin(t * 31);
      jets.forEach((j, i) => (j.material.opacity = jets01 * (i % 2 ? 1 : 0.8) * flicker));
      const blink = Math.sin(t * 5.2) > 0.2 ? 1 : 0.15;
      tips.forEach((tip) => (tip.material.opacity = blink));
      for (const m of mats) m.emissiveIntensity = 0.1;
    },
  };
}

export async function build({ rich, coarse, renderer, pmrem, say, added }) {
  const inside = new THREE.Group();
  const outside = new THREE.Group();
  const small = coarse || Math.min(window.innerWidth, window.innerHeight) < 600;
  const models = createModels({ base: '/games/models' });

  // Jesse, sat in the passenger's seat; Mr. White stood in the aisle behind,
  // in his suit. Both as the wardrobe has them (looks.js, kept): Walt’s
  // bodies are all his one figure, the cockpit’s, so only his colours and
  // gear change; Jesse in the lab’s suit is Albuquerque’s figure of him, sat
  // on his own clip.
  const looks = readLooks(local.get(LOOK_KEY));
  const jesseFile = looks.jesse.body === 'jesse' ? null : bodyById(looks.jesse.body)?.asset;
  const jesseP = loadCrew('jesse', { file: jesseFile, clip: 'sit', height: 1.73, hips: [0.6, 0.6, 0.2] });
  // the wings, the winged RV and Hank's SUV: waited for a little (LATE, so
  // they're there to be drawn once with everything else before you see the
  // cab), and after that they come when they come (without them the RV just
  // drives off into the night)
  const wingP = loadModel(WING_URL);
  const flyerP = loadModel(FLYER_URL);
  const suvP = loadModel(SUV_URL);
  const extras = Promise.race([Promise.all([wingP, flyerP, suvP]), new Promise((done) => setTimeout(done, LATE))]);
  const waltP = loadCrew('walt', { clip: 'idle', height: 1.79, hips: [0.6, 0.98, 0.9], face: Math.PI + 0.6 });

  const [bench, panelling, lino, asphalt, dirt, rock, photo, env, jesse, walt, brush, shrub, boulder, stone, sitClip, idleClip] = await Promise.all([
    loadSet('/cc0/materials/rv-bench', { arm: !small }),
    loadSet('/cc0/materials/rv-wall', { normal: !small }),
    loadSet('/cc0/materials/rv-floor', { normal: !small }),
    loadSet('/games/tex/asphalt-desert'),
    loadSet('/games/tex/desert-ground'),
    loadSet('/games/tex/mesa-rock', { normal: false }),
    loadTex('/games/sky/jasper-sky.webp', { srgb: false, repeat: false }),
    loadEnv(pmrem),
    jesseP,
    waltP,
    models.load('brush'),
    models.load('shrub'),
    models.load('boulder'),
    models.load('rock'),
    loadClip('jesse-sit'),
    loadClip('walt-idle'),
    extras,
  ]);

  // ── materials ──
  const mould = mouldedMaps(3);
  const carpet = carpetMaps(5);
  const velour = velourMaps(8);
  const liner = linerMaps(9);
  const curtain = curtainMaps(12);
  const tri = (m, size, swap = false) => {
    m.userData.tri = { size, swap };
    return m;
  };
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    tan: tri(std({ map: mould.map, bumpMap: mould.bump, bumpScale: 0.5, roughness: 0.62 }), 0.5),
    tanDeep: tri(std({ map: mould.map, bumpMap: mould.bump, bumpScale: 0.5, color: 0xb8a080, roughness: 0.6 }), 0.5),
    brown: tri(std({ map: mould.map, bumpMap: mould.bump, bumpScale: 0.4, color: 0x52392a, roughness: 0.52 }), 0.5),
    pad: tri(std({ map: mould.map, bumpMap: mould.bump, bumpScale: 0.7, color: 0x93785c, roughness: 0.78 }), 0.5),
    beige: tri(std({ map: mould.map, bumpMap: mould.bump, bumpScale: 0.15, color: 0xf4ead6, roughness: 0.36 }), 0.3),
    chrome: std({ color: 0xe2e4e8, roughness: 0.14, metalness: 1 }),
    satin: std({ color: 0xc8c2b8, roughness: 0.32, metalness: 0.85 }),
    black: std({ color: 0x171615, roughness: 0.55, metalness: 0.05 }),
    rubber: std({ color: 0x0e0e0e, roughness: 0.9 }),
    carpet: tri(std({ map: carpet.map, bumpMap: carpet.bump, bumpScale: 1, roughness: 1 }), 0.25),
    velour: tri(std({ map: velour.map, bumpMap: velour.bump, bumpScale: 1.6, roughness: 0.96 }), 0.48),
    liner: tri(std({ map: liner.map, bumpMap: liner.bump, bumpScale: 0.5, roughness: 0.86 }), 0.25),
    wood: tri(std({ map: bench.color, normalMap: bench.normal, roughnessMap: bench.arm, roughness: bench.arm ? 1 : 0.42, color: 0xe0c8b0 }), 0.7, true),
    panel: tri(std({ map: panelling.color, normalMap: panelling.normal, roughness: 0.78, color: 0xc49a7a }), 1.4),
    oak: tri(std({ map: panelling.color, normalMap: panelling.normal, roughness: 0.6, color: 0xe2c09c }), 1.0, true),
    lino: tri(std({ map: lino.color, normalMap: lino.normal, roughness: 0.55, color: 0xe8dcc8 }), 1.2),
    paint: std({ color: 0xe8e2d4, roughness: 0.42 }),
    curtain: tri(std({ map: curtain.map, bumpMap: curtain.bump, bumpScale: 2, roughness: 0.95 }), 0.42),
    labGlass: std({ color: 0xd8eef4, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false }),
    blue: std({ color: 0x5ec8ff, emissive: 0x1a6aa0, emissiveIntensity: 0.4, roughness: 0.1, transparent: true, opacity: 0.8 }),
    styro: std({ color: 0xf2efe8, roughness: 0.9 }),
  };
  const glassM = glassMat({ opacity: 0.025, rim: 0.14, smudge: 0.28, tint: '#d8e6ea' });

  const bin = partsBin();

  // ── the windshield, its pillars and the header over it ──
  const pane = (sx) => {
    const xi = sx * 0.035;
    const xo = sx * WS.x;
    const [x0, x1] = sx < 0 ? [xo, xi] : [xi, xo];
    const zAt = (x, z) => z + (Math.abs(x) / WS.x) * WS.v;
    return [
      [x0, WS.y0, zAt(x0, WS.z0)],
      [x1, WS.y0, zAt(x1, WS.z0)],
      [x1, WS.y1, zAt(x1, WS.z1)],
      [x0, WS.y1, zAt(x0, WS.z1)],
    ];
  };
  const glassParts = [];
  for (const sx of [-1, 1]) {
    const c = pane(sx);
    glassParts.push(quad(...c));
    // the rubber gasket round it
    const v = c.map((p) => new V3(...p));
    for (let i = 0; i < 4; i++) {
      const a = v[i];
      const b = v[(i + 1) % 4];
      const side = i % 2 ? new V3(1, 0, 0) : new V3(0, 1, 0.25);
      bin.put(M.rubber, beam(a, b, 0.034, 0.03, side));
    }
  }
  // the pillar between the panes, and the thick ones at the corners
  bin.put(M.tanDeep, beam(new V3(0, WS.y0 - 0.02, WS.z0 + 0.02), new V3(0, WS.y1 + 0.02, WS.z1 + 0.02), 0.075, 0.07, new V3(1, 0, 0)));
  for (const sx of [-1, 1]) {
    const a = new V3(sx * 1.12, WS.y0 - 0.04, -1.2);
    const b = new V3(sx * 1.12, WS.y1 + 0.06, -1.2 + (WS.z1 - WS.z0));
    bin.put(M.tanDeep, beam(a, b, 0.22, 0.09, new V3(sx * 0.6, 0, -0.8)));
  }
  bin.add(M.liner, roundedBox(2.36, 0.22, 0.34, 0.07), [0, 1.93, -1.0]);
  // the wipers, parked along the foot of the glass outside
  for (const [px, len] of [
    [-0.42, 0.62],
    [0.66, 0.58],
  ]) {
    const a = new V3(px, WS.y0 + 0.012, WS.z0 - 0.04);
    const b = new V3(px - len, WS.y0 + 0.03, WS.z0 - 0.02 + (Math.abs(px - len) / WS.x) * WS.v);
    bin.put(M.black, beam(a, b, 0.016, 0.012, new V3(0, 1, 0.3)));
    bin.put(M.rubber, beam(a.clone().lerp(b, 0.12).add(new V3(0, 0.012, 0.01)), b.clone().add(new V3(0, 0.012, 0.01)), 0.012, 0.018, new V3(0, 1, 0.3)));
  }

  // ── the dash ──
  // its profile from the foot of the glass, over the top, down its face and
  // under, to the floor; run across the cab
  bin.put(
    M.tan,
    across(
      [
        [-1.38, 0],
        [-1.38, 0.95],
        [-1.32, 0.985],
        [-1.0, 1.0],
        ['q', -0.9, 1.005, -0.888, 0.948],
        [-0.875, 0.64],
        ['q', -0.866, 0.52, -0.93, 0.49],
        [-1.06, 0.43],
        [-1.2, 0.14],
        [-1.26, 0],
      ],
      -1.16,
      1.16,
    ),
  );
  // the padded vinyl over its top, a shade darker
  bin.put(
    M.pad,
    across(
      [
        [-1.335, 0.975],
        [-1.335, 0.992],
        [-1.0, 1.007],
        ['q', -0.89, 1.012, -0.879, 0.95],
        [-0.874, 0.895],
        [-0.888, 0.895],
        [-0.9, 0.96],
        [-1.0, 0.99],
      ],
      -1.162,
      1.162,
    ),
  );
  // the defroster's grille along the foot of the glass
  bin.add(M.brown, new THREE.BoxGeometry(2.2, 0.006, 0.07), [0, 0.998, -1.25]);
  for (let i = 0; i < 46; i++) bin.add(M.black, new THREE.BoxGeometry(0.03, 0.006, 0.05), [-1.04 + i * 0.0465, 1.001, -1.25]);
  // speaker grilles at the ends of the dash top
  for (const sx of [-1, 1]) bin.add(M.brown, roundedBox(0.2, 0.012, 0.13, 0.005), [sx * 0.95, 1.008, -1.1]);
  // the knee panel under the gauges, where the column goes in
  bin.add(M.tanDeep, roundedBox(0.66, 0.36, 0.2, 0.03), [-0.6, 0.47, -0.82], [0.1, 0, 0]);
  // woodgrain across the face, either side of the gauges
  bin.add(M.wood, roundedBox(1.4, 0.085, 0.02, 0.006), [0.42, 0.755, -0.862]);
  bin.add(M.wood, roundedBox(0.22, 0.085, 0.02, 0.006), [-1.04, 0.755, -0.862]);
  bin.add(M.brown, roundedBox(1.42, 0.012, 0.024, 0.004), [0.42, 0.803, -0.862]);
  bin.add(M.brown, roundedBox(1.42, 0.012, 0.024, 0.004), [0.42, 0.707, -0.862]);

  // vents: a dark mouth with louvres
  const vent = (x, y, w, h) => {
    bin.add(M.brown, roundedBox(w + 0.02, h + 0.02, 0.02, 0.008), [x, y, -0.868]);
    bin.add(M.black, new THREE.BoxGeometry(w, h, 0.01), [x, y, -0.856]);
    for (let i = 0; i < 4; i++) bin.add(M.brown, new THREE.BoxGeometry(w - 0.004, 0.005, 0.018), [x, y - h / 2 + ((i + 0.5) * h) / 4, -0.852], [0.3, 0, 0]);
  };
  vent(0.02, 0.87, 0.2, 0.05);
  vent(-1.03, 0.87, 0.12, 0.06);
  vent(0.98, 0.87, 0.12, 0.06);
  // the radio, set into the woodgrain; the heater's levers below it
  const radioM = std({ map: painted(512, 128, (g, W, H) => paintRadio(g, W, H, false)), emissiveMap: painted(512, 128, (g, W, H) => paintRadio(g, W, H, true)), emissive: 0xffa040, emissiveIntensity: 0.15, roughness: 0.35, metalness: 0.5 });
  const radio = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), radioM);
  radio.position.set(0.02, 0.757, -0.846);
  inside.add(radio);
  bin.add(M.chrome, roundedBox(0.214, 0.062, 0.012, 0.004), [0.02, 0.757, -0.856]);
  for (const sx of [-1, 1]) bin.add(M.chrome, rod(0.009, 0.011, 0.02, 14), [0.02 + sx * 0.122, 0.757, -0.84]);
  for (let i = 0; i < 5; i++) bin.add(M.chrome, roundedBox(0.016, 0.009, 0.012, 0.002), [-0.048 + i * 0.019, 0.737, -0.842]);
  const hvacM = std({ map: painted(256, 96, paintHvac), roughness: 0.6 });
  const hvac = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.075), hvacM);
  hvac.position.set(0.02, 0.63, -0.866);
  hvac.rotation.x = -0.04;
  inside.add(hvac);
  for (const [i, f] of [
    [0, 0.65],
    [1, 0.3],
    [2, 0.5],
  ])
    bin.add(M.black, roundedBox(0.016, 0.012, 0.022, 0.003), [0.02 - 0.1 + (58 + f * 186) * (0.2 / 256), 0.63 + 0.0375 - (21 + i * 28) * (0.075 / 96), -0.856]);
  // the glovebox, its latch, and the passenger's side knobs
  bin.add(M.tan, roundedBox(0.44, 0.15, 0.03, 0.012), [0.62, 0.6, -0.86]);
  bin.add(M.chrome, roundedBox(0.05, 0.018, 0.012, 0.004), [0.62, 0.66, -0.842]);
  // the headlight switch and the wipers', left of the gauges
  for (const [y, r0] of [
    [0.67, 0.012],
    [0.6, 0.01],
  ]) {
    bin.add(M.chrome, rod(r0, r0, 0.03, 14), [-1.02, y, -0.85]);
    bin.add(M.black, rod(r0 * 1.4, r0 * 1.4, 0.006, 14), [-1.02, y, -0.866]);
  }

  // a road map, folded open on the passenger's side of the dash
  const mapTex = roadMapMap();
  const roadMap = new THREE.Group();
  for (const s of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.24), std({ map: mapTex, roughness: 0.9, side: THREE.DoubleSide }));
    leaf.geometry.translate(s * 0.085, 0, 0);
    leaf.material.map = mapTex;
    leaf.rotation.set(-Math.PI / 2, s * 0.08, 0);
    leaf.position.y = 0.006;
    roadMap.add(leaf);
  }
  roadMap.children[1].material = roadMap.children[0].material;
  roadMap.position.set(0.62, 1.008, -1.1);
  roadMap.rotation.y = 0.35;
  inside.add(roadMap);

  // ── the gauges, in their hooded binnacle ──
  const cluster = new THREE.Group();
  cluster.position.set(...FACE_AT);
  cluster.rotation.x = -FACE_TILT;
  inside.add(cluster);
  cluster.updateMatrixWorld(true);
  const CL = cluster.matrixWorld.clone();
  const faceM = std({
    map: painted(FACE.px, FACE.py, (g, W, H) => paintCluster(g, W, H, false)),
    emissiveMap: painted(FACE.px, FACE.py, (g, W, H) => paintCluster(g, W, H, true)),
    emissive: 0x7fe2c8,
    emissiveIntensity: 0,
    roughness: 0.45,
  });
  cluster.add(new THREE.Mesh(new THREE.PlaneGeometry(FACE.w, FACE.h), faceM));
  // bezels round each dial, and the caps over the needles' pivots
  for (const [id, D] of Object.entries(DIALS)) {
    const [x, y] = faceLocal(D.x, D.y);
    const rr = (D.r / FACE.px) * FACE.w;
    bin.put(M.chrome, new THREE.TorusGeometry(rr + 0.002, id === 'speed' ? 0.0035 : 0.0025, 6, 48).translate(x, y, 0.002), CL);
    bin.put(M.black, new THREE.CylinderGeometry(id === 'speed' ? 0.008 : 0.005, id === 'speed' ? 0.009 : 0.006, 0.006, 16).rotateX(Math.PI / 2).translate(x, y, 0.009), CL);
  }
  // the needles: orange, glowing with the gauges at night
  const needleM = std({ color: 0xff5a1c, emissive: 0xff4a10, emissiveIntensity: 0.25, roughness: 0.4 });
  const needles = {};
  for (const [id, D] of Object.entries(DIALS)) {
    const [x, y] = faceLocal(D.x, D.y);
    const len = (D.r / FACE.px) * FACE.w * 0.9;
    const s = new THREE.Shape();
    s.moveTo(-len * 0.18, -0.0024);
    s.lineTo(len, -0.0007);
    s.lineTo(len, 0.0007);
    s.lineTo(-len * 0.18, 0.0024);
    const n = new THREE.Mesh(new THREE.ShapeGeometry(s), needleM);
    n.position.set(x, y, 0.006);
    cluster.add(n);
    needles[id] = n;
  }
  // the warning lamps
  const LAMPS = { brake: '#ff3a24', gauges: '#ffb020', beam: '#3a8cff', left: '#36e05a', right: '#36e05a' };
  const lamps = {};
  for (const [id, col] of Object.entries(LAMPS)) {
    const [x, y] = faceLocal(...LAMP_AT[id]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.013), new THREE.MeshBasicMaterial({ map: lampMap(id), color: col, toneMapped: false }));
    m.position.set(x, y, 0.003);
    m.userData.col = new THREE.Color(col);
    cluster.add(m);
    lamps[id] = m;
  }
  glassParts.push(new THREE.PlaneGeometry(FACE.w + 0.02, FACE.h + 0.02).translate(0, 0, 0.016).applyMatrix4(CL));
  // a dark bezel round the face
  for (const [w, h, x, y] of [
    [FACE.w + 0.03, 0.016, 0, FACE.h / 2 + 0.006],
    [FACE.w + 0.03, 0.016, 0, -FACE.h / 2 - 0.006],
    [0.016, FACE.h + 0.03, FACE.w / 2 + 0.006, 0],
    [0.016, FACE.h + 0.03, -FACE.w / 2 - 0.006, 0],
  ])
    bin.put(M.brown, roundedBox(w, h, 0.02, 0.005).translate(x, y, 0.004), CL);
  // the hood over the face, its cheeks, and the ledge under it
  bin.put(
    M.pad,
    across(
      [
        [-1.0, 0.99],
        [-1.0, 1.05],
        ['q', -0.9, 1.092, -0.752, 1.07],
        [-0.745, 1.052],
        ['q', -0.86, 1.066, -0.9, 1.016],
        [-0.96, 1.0],
      ],
      -0.92,
      -0.28,
      { bevel: 0.006 },
    ),
  );
  for (const x0 of [-0.925, -0.305])
    bin.put(
      M.pad,
      across(
        [
          [-0.96, 0.79],
          [-0.76, 0.79],
          [-0.748, 1.05],
          ['q', -0.9, 1.09, -1.0, 1.05],
          [-1.0, 0.79],
        ],
        x0,
        x0 + 0.03,
        { bevel: 0.008 },
      ),
    );
  bin.put(
    M.tanDeep,
    across(
      [
        [-0.87, 0.818],
        [-0.75, 0.802],
        [-0.745, 0.776],
        [-0.88, 0.76],
      ],
      -0.92,
      -0.28,
      { bevel: 0.004 },
    ),
  );
  bin.add(M.wood, roundedBox(0.62, 0.022, 0.008, 0.003), [-0.6, 0.789, -0.744]);

  // ── the wheel, on its column ──
  const wheel = new THREE.Group();
  wheel.position.set(...WHEEL_AT);
  wheel.rotation.x = -WHEEL_TILT;
  inside.add(wheel);
  const spin = new THREE.Group();
  wheel.add(spin);
  const wbin = partsBin();
  const sbin = partsBin();
  // the rim, thin and beige, with the ridges for your fingers behind it
  sbin.add(M.beige, new THREE.TorusGeometry(WHEEL_R, 0.0135, 12, 96));
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    sbin.add(M.beige, new THREE.SphereGeometry(0.009, 6, 4), [Math.cos(a) * WHEEL_R, Math.sin(a) * WHEEL_R, -0.009]);
  }
  // two spokes, drooping a little, dished down to the hub
  for (const a of [-0.3, Math.PI + 0.3]) {
    const dir = new V3(Math.cos(a), Math.sin(a), 0);
    const p0 = dir.clone().multiplyScalar(0.05).setZ(-0.03);
    const p1 = dir.clone().multiplyScalar(WHEEL_R - 0.006);
    sbin.put(M.beige, beam(p0, p1, 0.046, 0.012, new V3(-Math.sin(a), Math.cos(a), 0)));
    sbin.put(M.beige, beam(p0.clone().setZ(-0.036), p1.clone().setZ(-0.008), 0.03, 0.01, new V3(-Math.sin(a), Math.cos(a), 0)));
  }
  sbin.add(M.tanDeep, rod(0.055, 0.045, 0.05, 24), [0, 0, -0.045]);
  // the horn pad, and its little badge
  sbin.add(M.beige, roundedBox(0.155, 0.11, 0.04, 0.019), [0, 0, -0.01]);
  sbin.add(M.beige, new THREE.SphereGeometry(1, 28, 14), [0, 0, 0.008], [0, 0, 0], [0.068, 0.046, 0.016]);
  sbin.add(M.brown, roundedBox(0.04, 0.014, 0.008, 0.003), [0, 0, 0.022]);
  // the column: its top, the shroud running down into the knee panel
  wbin.add(M.tanDeep, roundedBox(0.12, 0.12, 0.13, 0.03), [0, 0.012, -0.135]);
  wbin.add(M.tanDeep, rod(0.06, 0.05, 0.38, 18), [0, 0, -0.38]);
  wbin.add(M.black, rod(0.032, 0.032, 0.1, 12), [0, 0, -0.08]);
  // the turn signal's stalk, out to the left
  wbin.put(M.black, tubeAlong([[-0.055, 0.0, -0.12], [-0.13, -0.008, -0.1], [-0.2, -0.015, -0.085]], 0.0055, { segs: 8, radial: 8 }));
  wbin.add(M.black, new THREE.SphereGeometry(0.011, 10, 8), [-0.2, -0.015, -0.085], [0, 0, 0], [1.6, 1, 1]);
  // the ignition key and its fob, hanging from the column's right
  wbin.add(M.chrome, new THREE.TorusGeometry(0.012, 0.0018, 6, 18), [0.064, -0.05, -0.2], [0, Math.PI / 2, 0]);
  wbin.add(M.satin, new THREE.BoxGeometry(0.004, 0.032, 0.011), [0.064, -0.072, -0.2]);
  wbin.add(M.rubber, roundedBox(0.008, 0.042, 0.022, 0.004), [0.068, -0.082, -0.188], [0, 0, 0.12]);
  // the gear indicator on top of the column, and its pointer
  const prndl = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.019), new THREE.MeshStandardMaterial({ map: prndlMap(), roughness: 0.3, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }));
  prndl.position.set(0, 0.075, -0.115);
  prndl.rotation.x = -0.75;
  wheel.add(prndl);
  wbin.add(M.black, roundedBox(0.09, 0.03, 0.02, 0.006), [0, 0.07, -0.12], [-0.75, 0, 0]);
  const gearPointer = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.002), std({ color: 0xff2a10, emissive: 0xff2a10, emissiveIntensity: 0.6 }));
  prndl.add(gearPointer);
  gearPointer.position.set(-0.0285, 0, 0.002);
  // the shifter: a chrome stalk out to the right, a black knob; it pivots
  // on the column, down from Park into Drive
  const shifter = new THREE.Group();
  shifter.position.set(0.055, 0.02, -0.125);
  wheel.add(shifter);
  const stalk = new THREE.Mesh(tubeAlong([[0, 0, 0], [0.09, 0.016, 0.02], [0.2, 0.026, 0.05]], 0.0065, { segs: 10, radial: 10 }), M.satin);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), M.black);
  knob.scale.set(1.9, 1, 1);
  knob.position.set(0.215, 0.028, 0.054);
  knob.rotation.y = -0.25;
  shifter.add(stalk, knob);
  const shifterHit = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.09), new THREE.MeshBasicMaterial({ visible: false }));
  shifterHit.position.set(0.12, 0.02, 0.03);
  shifter.add(shifterHit);
  const wheelHit = new THREE.Mesh(rod(WHEEL_R + 0.025, WHEEL_R + 0.025, 0.07, 24), new THREE.MeshBasicMaterial({ visible: false }));
  spin.add(wheelHit);

  // ── the side walls, windows and roof ──
  for (const sx of [-1, 1]) {
    const x = sx * 1.18;
    bin.add(M.tan, new THREE.BoxGeometry(0.04, 1.0, 1.7), [x, 0.5, -0.3]);
    bin.add(M.tan, new THREE.BoxGeometry(0.04, 0.33, 1.7), [x, 1.875, -0.3]);
    bin.add(M.tanDeep, new THREE.BoxGeometry(0.06, 0.74, 0.26), [x - sx * 0.01, 1.35, 0.43]);
    // the window: glass, a rubber frame, and the bar the slider runs on
    glassParts.push(quad([x - sx * 0.012, 0.995, sx < 0 ? 0.3 : -1.12], [x - sx * 0.012, 0.995, sx < 0 ? -1.12 : 0.3], [x - sx * 0.012, 1.715, sx < 0 ? -1.12 : 0.3], [x - sx * 0.012, 1.715, sx < 0 ? 0.3 : -1.12]));
    for (const [a, b] of [
      [
        [x, 0.995, -1.13],
        [x, 0.995, 0.31],
      ],
      [
        [x, 1.715, -1.13],
        [x, 1.715, 0.31],
      ],
      [
        [x, 0.99, 0.3],
        [x, 1.72, 0.3],
      ],
    ])
      bin.put(M.rubber, beam(new V3(...a), new V3(...b), 0.03, 0.05, new V3(0, 1, 1)));
    bin.put(M.satin, beam(new V3(x - sx * 0.02, 0.99, -0.42), new V3(x - sx * 0.02, 1.72, -0.42), 0.025, 0.02, new V3(0, 0, 1)));
    // the sill, the door's woodgrain strip and its armrest
    bin.add(M.tanDeep, roundedBox(0.07, 0.03, 1.45, 0.01), [x - sx * 0.025, 0.985, -0.4]);
    bin.add(M.wood, roundedBox(0.02, 0.05, 1.3, 0.006), [x - sx * 0.022, 0.86, -0.4]);
    bin.add(M.brown, roundedBox(0.012, 0.012, 1.32, 0.004), [x - sx * 0.024, 0.89, -0.4]);
    if (sx < 0) {
      bin.add(M.tanDeep, roundedBox(0.07, 0.065, 0.55, 0.025), [x + 0.05, 0.72, -0.3]);
      bin.add(M.chrome, roundedBox(0.02, 0.025, 0.1, 0.006), [x + 0.03, 0.8, -0.82]);
      // the window crank
      bin.add(M.satin, rod(0.016, 0.016, 0.01, 14), [x + 0.03, 0.6, -0.55], [0, Math.PI / 2, 0]);
      bin.put(M.satin, beam(new V3(x + 0.04, 0.6, -0.55), new V3(x + 0.045, 0.56, -0.48), 0.01, 0.006, new V3(1, 0, 0)));
      bin.add(M.black, rod(0.007, 0.007, 0.03, 8), [x + 0.06, 0.56, -0.48], [0, Math.PI / 2, 0]);
    }
  }
  // the roof, the cab's floor and the carpeted engine hump between the seats
  bin.add(M.liner, new THREE.BoxGeometry(2.4, 0.04, 4.7), [0, 2.04, 1.05]);
  bin.add(M.carpet, new THREE.BoxGeometry(2.36, 0.04, 1.95), [0, -0.02, -0.4]);
  bin.add(M.carpet, roundedBox(0.66, 0.46, 1.1, 0.1), [0, 0.2, -0.46]);
  bin.add(M.tan, roundedBox(0.52, 0.05, 0.5, 0.02), [0, 0.45, -0.32]);
  for (const x of [-0.11, 0.11]) bin.add(M.tanDeep, new THREE.TorusGeometry(0.045, 0.008, 8, 24), [x, 0.476, -0.18], [Math.PI / 2, 0, 0]);
  // a styrofoam cup of coffee in one of them
  bin.add(M.styro, new THREE.CylinderGeometry(0.044, 0.033, 0.11, 20), [-0.11, 0.53, -0.18]);
  bin.add(M.styro, new THREE.CylinderGeometry(0.046, 0.046, 0.008, 20), [-0.11, 0.586, -0.18]);
  // the pedals
  bin.add(M.rubber, roundedBox(0.1, 0.07, 0.02, 0.008), [-0.75, 0.2, -0.98], [-0.5, 0, 0]);
  bin.add(M.rubber, roundedBox(0.06, 0.15, 0.015, 0.006), [-0.44, 0.15, -1.05], [-0.7, 0, 0]);
  bin.add(M.satin, new THREE.BoxGeometry(0.02, 0.25, 0.02), [-0.75, 0.32, -1.04], [0.4, 0, 0]);
  bin.add(M.rubber, roundedBox(0.07, 0.05, 0.015, 0.006), [-1.0, 0.26, -1.0], [-0.4, 0, 0]);

  // the sun visors, folded up; yours is down a little, papers under its strap
  for (const sx of [-1, 1]) {
    const down = sx < 0 ? 0.55 : 0.08;
    const v = new THREE.Group();
    v.position.set(sx * 0.6, 1.95, -0.9);
    v.rotation.x = Math.PI / 2 + 0.1 + down;
    v.updateMatrixWorld(true);
    const vm = v.matrixWorld;
    bin.put(M.liner, roundedBox(0.52, 0.18, 0.026, 0.012).translate(0, 0.095, 0), vm);
    bin.put(M.satin, rod(0.005, 0.005, 0.42, 8).rotateY(Math.PI / 2), vm);
    if (sx < 0) {
      bin.put(M.styro, new THREE.BoxGeometry(0.2, 0.09, 0.003).translate(0.08, 0.1, -0.016), vm);
      bin.put(M.brown, new THREE.BoxGeometry(0.02, 0.18, 0.004).translate(0.12, 0.095, -0.018), vm);
    }
  }
  // the dome light
  bin.add(M.tanDeep, roundedBox(0.3, 0.035, 0.14, 0.015), [0, 2.01, -0.25]);
  bin.add(M.styro, new THREE.BoxGeometry(0.24, 0.006, 0.1), [0, 1.99, -0.25]);

  // the rear-view mirror on the header, and the little pine tree hanging from it
  bin.add(M.black, new THREE.CylinderGeometry(0.008, 0.01, 0.1, 8), [0, 1.8, -1.03]);
  const mirror = new THREE.Group();
  mirror.position.set(0, 1.735, -1.02);
  mirror.rotation.set(-0.12, -0.24, 0);
  inside.add(mirror);
  mirror.updateMatrixWorld(true);
  bin.put(M.black, roundedBox(0.25, 0.072, 0.03, 0.014), mirror.matrixWorld);
  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.232, 0.056), new THREE.MeshBasicMaterial({ map: rearMirrorMap(), color: 0xffffff }));
  rearGlass.position.z = 0.016;
  mirror.add(rearGlass);
  const tree = new THREE.Group();
  tree.position.set(0.035, 1.705, -1.0);
  inside.add(tree);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.12, 4).translate(0, -0.06, 0), M.styro);
  const treeShape = new THREE.Shape(
    [
      [0, 0],
      [0.014, -0.02],
      [0.007, -0.02],
      [0.026, -0.046],
      [0.011, -0.046],
      [0.036, -0.08],
      [0.008, -0.08],
      [0.008, -0.096],
      [-0.008, -0.096],
      [-0.008, -0.08],
      [-0.036, -0.08],
      [-0.011, -0.046],
      [-0.026, -0.046],
      [-0.007, -0.02],
      [-0.014, -0.02],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  );
  const treeMesh = new THREE.Mesh(new THREE.ShapeGeometry(treeShape).translate(0, -0.115, 0), std({ color: 0x2c8a46, roughness: 0.85, side: THREE.DoubleSide }));
  tree.add(string, treeMesh);

  // the big side mirrors, on arms out in front of the corners
  const mirrorTex = sideMirrorMap();
  const sideGlass = [];
  for (const sx of [-1, 1]) {
    const head = new THREE.Group();
    head.position.set(sx * 1.56, 1.42, -1.72);
    head.rotation.y = sx * 0.32;
    inside.add(head);
    head.updateMatrixWorld(true);
    const hm = head.matrixWorld;
    bin.put(M.black, roundedBox(0.22, 0.4, 0.07, 0.025), hm);
    const geo = new THREE.PlaneGeometry(0.19, 0.37);
    if (sx > 0) {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    }
    const g = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: mirrorTex, color: 0xffffff }));
    g.position.z = 0.037;
    head.add(g);
    sideGlass.push(g);
    // two chrome arms back to the body
    for (const y of [-0.14, 0.14]) {
      const a = new V3(sx * 1.2, 1.42 + y * 1.6, -1.3);
      const b = new V3(sx * 1.5, 1.42 + y, -1.7);
      bin.put(M.chrome, tubeAlong([a.toArray(), a.clone().lerp(b, 0.5).add(new V3(sx * 0.05, 0, -0.05)).toArray(), b.toArray()], 0.012, { segs: 10, radial: 8 }));
    }
    bin.add(M.paint, roundedBox(0.1, 0.36, 0.1, 0.03), [sx * 1.2, 1.42, -1.29]);
  }

  // ── the seats ──
  captainChair(bin, M, -0.6, 0.21, { head: false });
  captainChair(bin, M, 0.6, 0.1);

  // ── the coach behind: the door, the dinette, the galley, cabinets ──
  bin.add(M.lino, new THREE.BoxGeometry(2.36, 0.04, 2.9), [0, -0.02, 2.0]);
  // the right side: the door behind the passenger's seat, its window and grab handle
  bin.add(M.tan, roundedBox(0.05, 1.95, 0.72, 0.02), [1.15, 0.975, 0.92]);
  bin.add(M.tanDeep, roundedBox(0.03, 0.5, 0.5, 0.02), [1.12, 0.62, 0.92]);
  glassParts.push(quad([1.12, 1.28, 1.14], [1.12, 1.28, 0.7], [1.12, 1.68, 0.7], [1.12, 1.68, 1.14]));
  for (const [a, b] of [
    [
      [1.12, 1.27, 0.69],
      [1.12, 1.27, 1.15],
    ],
    [
      [1.12, 1.69, 0.69],
      [1.12, 1.69, 1.15],
    ],
    [
      [1.12, 1.27, 0.69],
      [1.12, 1.69, 0.69],
    ],
    [
      [1.12, 1.27, 1.15],
      [1.12, 1.69, 1.15],
    ],
  ])
    bin.put(M.black, beam(new V3(...a), new V3(...b), 0.025, 0.03, new V3(1, 1, 1)));
  bin.put(M.chrome, tubeAlong([[1.16, 0.8, 0.6], [1.09, 0.82, 0.6], [1.09, 1.38, 0.6], [1.16, 1.4, 0.6]], 0.012, { segs: 16, radial: 8 }));
  bin.add(M.chrome, roundedBox(0.03, 0.04, 0.12, 0.008), [1.11, 1.02, 1.2]);
  bin.add(M.rubber, new THREE.BoxGeometry(0.4, 0.02, 0.66), [0.94, 0.0, 0.92]);
  // the walls of the coach, panelled
  bin.add(M.panel, new THREE.BoxGeometry(0.04, 2.04, 2.1), [1.18, 1.02, 2.37]);
  bin.add(M.panel, new THREE.BoxGeometry(0.04, 2.04, 2.85), [-1.18, 1.02, 1.98]);
  bin.add(M.panel, new THREE.BoxGeometry(2.4, 2.04, 0.04), [0, 1.02, 3.42]);
  // a window over the dinette, with its curtains drawn back
  glassParts.push(quad([1.155, 1.0, 2.65], [1.155, 1.0, 1.75], [1.155, 1.6, 1.75], [1.155, 1.6, 2.65]));
  bin.add(M.black, new THREE.BoxGeometry(0.02, 0.62, 0.92), [1.165, 1.3, 2.2]);
  for (const z of [1.76, 2.62]) bin.add(M.curtain, new THREE.BoxGeometry(0.03, 0.68, 0.22), [1.12, 1.3, z]);
  bin.add(M.oak, roundedBox(0.08, 0.1, 1.2, 0.02), [1.12, 1.66, 2.2]);
  // the dinette: two benches facing over a table, flasks on it
  for (const [z, f] of [
    [1.62, 1],
    [2.68, -1],
  ]) {
    bin.add(M.oak, new THREE.BoxGeometry(0.66, 0.42, 0.4), [0.8, 0.21, z]);
    bin.add(M.velour, roundedBox(0.64, 0.1, 0.42, 0.04), [0.8, 0.47, z]);
    bin.add(M.velour, roundedBox(0.64, 0.5, 0.1, 0.04), [0.8, 0.78, z - f * 0.2], [f * 0.08, 0, 0]);
  }
  bin.add(M.wood, roundedBox(0.62, 0.035, 0.6, 0.012), [0.84, 0.74, 2.15]);
  bin.add(M.chrome, new THREE.CylinderGeometry(0.03, 0.03, 0.72, 12), [0.84, 0.36, 2.15]);
  const flask = (h, r0, neck) =>
    new THREE.LatheGeometry(
      [
        [0.001, 0],
        [r0, 0],
        [r0 * 1.02, 0.01],
        [neck * 1.1, h * 0.7],
        [neck, h * 0.75],
        [neck, h],
        [neck * 1.3, h * 1.02],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      18,
    );
  bin.add(M.labGlass, flask(0.18, 0.07, 0.018), [0.74, 0.758, 2.05]);
  bin.add(M.labGlass, flask(0.13, 0.05, 0.014), [0.92, 0.758, 2.26]);
  bin.add(M.labGlass, new THREE.CylinderGeometry(0.04, 0.04, 0.12, 18, 1, true), [0.98, 0.818, 1.98]);
  bin.add(M.blue, new THREE.CylinderGeometry(0.058, 0.066, 0.03, 18), [0.74, 0.775, 2.05]);
  // upper cabinets down both sides
  for (const [x, z0, z1] of [
    [0.98, 1.3, 3.4],
    [-0.98, 0.62, 3.4],
  ]) {
    bin.add(M.panel, new THREE.BoxGeometry(0.38, 0.36, z1 - z0), [x, 1.84, (z0 + z1) / 2]);
    const n = Math.round((z1 - z0) / 0.46);
    for (let i = 0; i < n; i++) {
      const z = z0 + ((i + 0.5) * (z1 - z0)) / n;
      const sx = Math.sign(x);
      bin.add(M.oak, roundedBox(0.02, 0.3, (z1 - z0) / n - 0.03, 0.01), [x - sx * 0.2, 1.84, z]);
      bin.add(M.chrome, new THREE.SphereGeometry(0.01, 8, 6), [x - sx * 0.215, 1.73, z + (i % 2 ? -1 : 1) * 0.15]);
    }
  }
  // the galley on the left: cupboards, a counter, the sink and its tap
  bin.add(M.oak, new THREE.BoxGeometry(0.55, 0.86, 1.7), [-0.88, 0.43, 1.55]);
  bin.add(M.tan, roundedBox(0.6, 0.04, 1.74, 0.01), [-0.88, 0.88, 1.55]);
  bin.add(M.satin, new THREE.BoxGeometry(0.36, 0.01, 0.42), [-0.88, 0.902, 1.3]);
  bin.put(M.chrome, tubeAlong([[-1.1, 0.9, 1.3], [-1.1, 1.08, 1.3], [-1.02, 1.12, 1.3], [-0.96, 1.06, 1.3]], 0.01, { segs: 12, radial: 8 }));
  // a curtain across the doorway to the back
  bin.add(M.curtain, new THREE.BoxGeometry(0.8, 1.9, 0.03), [0, 0.98, 3.38]);

  bin.build(inside);
  wbin.build(wheel);
  sbin.build(spin);

  // all the glass in one draw, last
  const glass = new THREE.Mesh(
    mergeGeometries(
      glassParts.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
        return n;
      }),
    ),
    glassM,
  );
  glass.renderOrder = 10;
  inside.add(glass);

  // ── the crew ──
  // in their looks (nothing in Jesse’s hand: it rests on his knee)
  const undress = [jesse && dress(jesse, { ...looks.jesse, gear: { ...looks.jesse.gear, hand: 'none' } }), walt && dress(walt, looks.walt)].filter(Boolean);
  // Jesse sat back, his head turned your way; Mr. White watching the road.
  // Both answer the driving (`ride`, set each frame): pressed back into the
  // seat as it pulls away, swaying with the wheel, Jesse's hands up at the
  // dash as it lifts and his head out at the wings; Walt, stood in the
  // aisle, braces against the pull and leans into the turns.
  const ride = { push: 0, sway: 0, lift: 0, wings: 0 };
  const jesseSit = jesseFile && jesse ? retarget(sitClip, jesse.bones.Hips?.position.y ?? 1, sitClip?.userData.hips ?? jesse.bones.Hips?.position.y ?? 1) : sitClip;
  const jesseMove = calmly(jesse, jesseSit, 9.5, 1.2, 0.5, (b, t) => {
    nudge(b.Spine01, -0.04 - ride.push * 0.16, 0, ride.sway * 0.5);
    nudge(b.Head, -0.06 - ride.push * 0.08 + ride.lift * 0.12, 0.45 + Math.sin(t * 0.23) * 0.12 - ride.wings * 0.9, ride.sway * 0.3);
    // (the arms up and out at the dash while it's lifting: a hold on, a yo)
    nudge(b.LeftArm, -ride.lift * 0.9, 0, ride.lift * 0.5);
    nudge(b.RightArm, -ride.lift * 0.9, 0, -ride.lift * 0.5);
    nudge(b.LeftForeArm, -ride.lift * 0.6, 0, 0);
    nudge(b.RightForeArm, -ride.lift * 0.6, 0, 0);
  });
  const waltMove = calmly(walt, idleClip, 3.2, 0.5, 0.35, (b, t) => {
    nudge(b.Hips, ride.push * 0.1, 0, -ride.sway * 0.4);
    nudge(b.Spine01, ride.push * 0.14, 0, -ride.sway * 0.35);
    nudge(b.Head, 0.04 - ride.push * 0.06 + ride.lift * 0.1, Math.sin(t * 0.17) * 0.15, 0);
  });
  jesseMove?.(0);
  waltMove?.(0);
  if (jesse) inside.add(jesse.group);
  if (walt) {
    // stood on the floor: lift or drop him so his feet are on it
    inside.add(walt.group);
    walt.group.updateMatrixWorld(true);
    const toe = Math.min(walt.bones.LeftToeBase?.getWorldPosition(new V3()).y ?? 0, walt.bones.RightToeBase?.getWorldPosition(new V3()).y ?? 0);
    walt.group.position.y -= toe - 0.035;
  }

  // ── light in the cab ──
  const sunIn = new V3(Math.sin(SUN_BEARING), 0.42, -Math.cos(SUN_BEARING)).normalize();
  const hemi = new THREE.HemisphereLight(0xdfe4ee, 0x6a4c34, 0.4);
  inside.add(hemi);
  const key = new THREE.DirectionalLight(0xffc68e, 2.2);
  key.target.position.set(0, 0.8, -0.3);
  key.position.copy(key.target.position).addScaledVector(sunIn, 5);
  inside.add(key, key.target);
  if (rich) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera;
    c.left = -2.2;
    c.right = 2.2;
    c.top = 2.2;
    c.bottom = -2.2;
    c.near = 1;
    c.far = 10;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    for (const crew of [jesse, walt])
      crew?.group.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = false;
      });
  }
  // the sun off the dash, lifting the wheel and faces from below
  const bounce = new THREE.PointLight(0xffcf9a, 0.5, 3, 1.5);
  bounce.position.set(0, 1.1, -0.75);
  inside.add(bounce);
  // the gauges' glow at night, and the moon
  const dashGlow = new THREE.PointLight(0x7fe2c8, 0, 1.6, 2);
  dashGlow.position.set(-0.6, 0.98, -0.62);
  inside.add(dashGlow);
  const radioGlow = new THREE.PointLight(0xffa04a, 0, 0.9, 2);
  radioGlow.position.set(0.02, 0.8, -0.7);
  inside.add(radioGlow);
  const moon = new THREE.DirectionalLight(0x7d96d0, 0);
  moon.position.set(-2, 3, -1.5);
  inside.add(moon);

  // Reflections dim with the light, night coming on: each surface takes the
  // evening sky as its own reflection (a scene's environment would set its
  // strength for every surface alike)
  const ENV = 0.4;
  const reflective = [];
  inside.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      if (m?.isMeshStandardMaterial && !reflective.includes(m)) {
        reflective.push(m);
        if (env) {
          m.envMap = env;
          m.envMapIntensity = ENV;
        }
      }
  });

  // ── outside: the high desert ──
  // `tilt` turns everything outside about your eye (the nose coming up as
  // the RV lifts), `world` is the land (it drops away)
  const tilt = new THREE.Group();
  tilt.position.set(...EYE);
  outside.add(tilt);
  const outer = new THREE.Group();
  outer.position.set(-EYE[0], -EYE[1], -EYE[2]);
  tilt.add(outer);
  const world = new THREE.Group();
  outer.add(world);

  const sunDir = new V3();
  const setSun = (el) => {
    const e = THREE.MathUtils.degToRad(el);
    sunDir.set(Math.sin(SUN_BEARING) * Math.cos(e), Math.sin(e), -Math.cos(SUN_BEARING) * Math.cos(e));
  };
  setSun(SUN_EL);
  const shift = SKY_U - (Math.atan2(sunDir.z, sunDir.x) / TAU + 0.5);
  if (photo) {
    photo.generateMipmaps = false;
    photo.minFilter = THREE.LinearFilter;
    photo.wrapS = THREE.RepeatWrapping;
    photo.wrapT = THREE.ClampToEdgeWrapping;
  }
  const TINT = [1.2, 0.82, 0.6];
  const dayHaze = horizonColour(photo?.image, shift, TINT).multiplyScalar(0.62).lerp(new THREE.Color(0.62, 0.38, 0.22), 0.45);
  const duskHaze = new THREE.Color(0.26, 0.13, 0.12);
  const nightHaze = new THREE.Color(0.018, 0.024, 0.05);
  const haze = { color: { value: dayHaze.clone() }, k: { value: 1 / 3200 }, rush: { value: 0 } };

  const skyU = {
    uPhoto: { value: photo },
    uHasPhoto: { value: photo ? 1 : 0 },
    uShift: { value: shift },
    uSink: { value: 0 },
    uDusk: { value: 0 },
    uNight: { value: 0 },
    uSunK: { value: 1 },
    uLift: { value: 0 },
    uTint: { value: new V3(...TINT) },
    uSun: { value: sunDir },
    uSunCol: { value: new THREE.Color(1.0, 0.72, 0.42) },
    uHaze: haze.color,
  };
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(5200, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyU, side: THREE.BackSide, depthWrite: false }));
  skyDome.position.set(...EYE);
  skyDome.renderOrder = -12;
  skyDome.frustumCulled = false;
  outer.add(skyDome);
  // the land's haze below the horizon, over the sky and the stars
  // (LAND_FRAG); nearer than the stars are, so the far ground is behind it
  // and no star is ever drawn on the land
  const landDome = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 48, 12, 0, TAU, Math.PI * 0.44, Math.PI * 0.56),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: LAND_FRAG, uniforms: { uHaze: haze.color, uLift: skyU.uLift }, side: THREE.BackSide, transparent: true, depthWrite: false }),
  );
  landDome.position.set(...EYE);
  landDome.renderOrder = -8;
  landDome.frustumCulled = false;
  outer.add(landDome);
  // the stars, and the faint band of the galaxy, for the night (drawn far
  // out, behind everything, added over the sky)
  const stars = starField({ seed: 19, count: small ? 3400 : 6000, radius: 1800, nebula: ['#2c4282', '#5a3274'], deep: '#000000', band: [0.55, 1, -0.35] });
  stars.group.scale.setScalar(2.75);
  stars.group.position.set(...EYE);
  const nebula = stars.group.children[0];
  nebula.material.transparent = true;
  nebula.material.blending = THREE.AdditiveBlending;
  nebula.renderOrder = -11;
  stars.set({ fade: 0 });
  outer.add(stars.group);
  // the low sun's glare
  const sunGlow = glowSprite('#ffd9a8', 230, 0.85);
  const sunHalo = glowSprite('#ff9a58', 1100, 0.14);
  outer.add(sunGlow, sunHalo);

  // light on the land
  const sunLight = new THREE.DirectionalLight(0xffb67a, 2.6);
  sunLight.target.position.set(-2, ROAD_Y, -45);
  outer.add(sunLight, sunLight.target);
  if (rich) {
    // long evening shadows near the road (the shadow map is the cab's too)
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const c = sunLight.shadow.camera;
    c.left = -70;
    c.right = 70;
    c.top = 70;
    c.bottom = -70;
    c.near = 10;
    c.far = 900;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.06;
  }
  const landHemi = new THREE.HemisphereLight(0xa8bce0, 0x6a4a30, 1.0);
  outer.add(landHemi);
  const beams = new THREE.SpotLight(0xffe8c4, 0, 150, 0.42, 0.6, 1.1);
  beams.position.set(-0.1, ROAD_Y + 0.9, -3.3);
  beams.target.position.set(-0.4, ROAD_Y, -42);
  outer.add(beams, beams.target);

  // the ground, the road over it, and the road's markings over that
  const scrolls = [];
  const scrolling = (tex, tile) => tex && scrolls.push([tex, tile]);
  const macro = macroMap(23);
  const groundGeo = planarUV(new THREE.PlaneGeometry(12000, 12000), { size: GROUND_TILE });
  groundGeo.rotateX(-Math.PI / 2).translate(0, ROAD_Y - 0.02, 0);
  const groundM = hazy(std({ map: dirt.color, normalMap: dirt.normal, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, color: 0xf6e0c8 }), haze, 'ground', (s) => {
    s.uniforms.uMacro = { value: macro };
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uMacro;').replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      #ifdef USE_MAP
        diffuseColor.rgb *= mix(0.74, 1.14, texture2D(uMacro, vMapUv * ${(GROUND_TILE / 280).toFixed(5)}).r) * mix(0.9, 1.06, texture2D(uMacro, vMapUv * ${(GROUND_TILE / 38).toFixed(5)}).g);
      #endif`,
    );
  }, { rush: true });
  const ground = new THREE.Mesh(groundGeo, groundM);
  ground.receiveShadow = true;
  world.add(ground);
  scrolling(dirt.color, GROUND_TILE);
  scrolling(dirt.normal, GROUND_TILE);

  const ROAD_LEN = 3200;
  const roadGeo = planarUV(new THREE.PlaneGeometry(ROAD_W, ROAD_LEN), { size: ROAD_TILE });
  roadGeo.rotateX(-Math.PI / 2).translate(LANE, ROAD_Y, -ROAD_LEN / 2 + 60);
  const roadM = hazy(std({ map: asphalt.color, normalMap: asphalt.normal, roughness: 0.92, color: 0xd8d2cc, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), haze, 'road', null, { rush: true });
  const road = new THREE.Mesh(roadGeo, roadM);
  road.receiveShadow = true;
  world.add(road);
  scrolling(asphalt.color, ROAD_TILE);
  scrolling(asphalt.normal, ROAD_TILE);
  const marks = markingsMap(31);
  marks.wrapS = THREE.ClampToEdgeWrapping;
  const markGeo = new THREE.PlaneGeometry(MARK_W, ROAD_LEN);
  {
    const uv = markGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * ROAD_LEN) / LINE_TILE);
  }
  markGeo.rotateX(-Math.PI / 2).translate(LANE, ROAD_Y, -ROAD_LEN / 2 + 60);
  const markM = hazy(std({ map: marks, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), haze, 'marks');
  const markMesh = new THREE.Mesh(markGeo, markM);
  markMesh.receiveShadow = true;
  markMesh.renderOrder = 1;
  world.add(markMesh);
  scrolling(marks, LINE_TILE);

  // mesas round the horizon
  const r = rng(53);
  const mesaParts = [
    [-430, -1550, 260, 105],
    [560, -2150, 380, 150],
    [-1150, -2700, 540, 190],
    [120, -3400, 680, 125],
    [-1950, -1150, 300, 80],
    [1500, -1350, 280, 115],
    [2400, -2800, 720, 215],
    [-3000, -2600, 820, 240],
    [1900, 900, 420, 140],
    [-1600, 1700, 520, 170],
    [500, 2700, 720, 190],
  ].map(([x, z, radius, height]) => mesaGeometry(r, { radius, height }).translate(x, ROAD_Y - 2, z));
  const mesaM = hazy(std({ map: rock.color, vertexColors: true, roughness: 1, flatShading: true }), haze, 'mesa');
  const mesas = new THREE.Mesh(mergeGeometries(mesaParts), mesaM);
  mesaParts.forEach((g) => g.dispose());
  world.add(mesas);

  // the power line, and the fences
  const weathered = weatheredMap(61);
  const woodM = hazy(std({ map: weathered, roughness: 0.95 }), haze, 'pole');
  const power = powerLine({ wood: woodM, hardware: hazy(std({ color: 0x8a8e88, roughness: 0.5, metalness: 0.4 }), haze, 'hardware'), wire: hazy(std({ color: 0x2a2826, roughness: 0.6, metalness: 0.5 }), haze, 'wire') });
  power.children.forEach((m) => (m.castShadow = rich));
  world.add(power);
  const fence = fences(woodM, hazy(std({ color: 0x5e5a54, roughness: 0.5, metalness: 0.6 }), haze, 'strand'));
  fence.children[0].castShadow = rich;
  world.add(fence);

  // the lights of a town far off ahead, and ranches here and there, for
  // the night (and to fall away below you as you rise)
  const townPts = [];
  const townCol = [];
  {
    const tr = rng(71);
    const cluster = (cx, cz, w, d, n) => {
      for (let i = 0; i < n; i++) {
        const u = (tr() + tr() + tr()) / 3 - 0.5;
        const v = (tr() + tr() + tr()) / 3 - 0.5;
        townPts.push(cx + u * w, ROAD_Y + 2 + tr() * 6, cz + v * d);
        const warm = tr();
        townCol.push(1, 0.62 + warm * 0.3, 0.3 + warm * 0.35);
      }
    };
    cluster(-2400, -5200, 2600, 700, 360);
    cluster(3600, -4600, 900, 300, 90);
    cluster(900, -5600, 600, 200, 50);
    for (let i = 0; i < 26; i++) cluster((tr() - 0.5) * 7000, -700 - tr() * 4500, 30, 30, 1 + Math.floor(tr() * 3));
  }
  const townGeo = new THREE.BufferGeometry();
  townGeo.setAttribute('position', new THREE.Float32BufferAttribute(townPts, 3));
  townGeo.setAttribute('color', new THREE.Float32BufferAttribute(townCol, 3));
  const town = new THREE.Points(townGeo, new THREE.PointsMaterial({ map: glowTexture(), size: small ? 5 : 7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  town.frustumCulled = false;
  world.add(town);

  // scrub and stones, scattered either side
  const scatters = [];
  const few = small ? 0.65 : 1;
  const spread = [
    [brush, { count: Math.round(30 * few), h: [0.45, 1.1], clear: 4.4, width: 70, spread: 2.2, seed: 3, sink: 0.08 }],
    [shrub, { count: Math.round(36 * few), h: [0.6, 1.6], clear: 5, width: 90, spread: 2, seed: 5, sink: 0.06 }],
    [stone, { count: Math.round(28 * few), h: [0.16, 0.5], clear: 4.2, width: 50, spread: 2, seed: 7, sink: 0.25, lean: 0.5 }],
    [boulder, { count: Math.round(9 * few), h: [1.0, 2.6], clear: 12, width: 160, seed: 9, sink: 0.2, lean: 0.3 }],
  ];
  for (const [model, o] of spread) {
    if (!model) continue;
    for (const p of model.parts) if (p.material?.isMeshStandardMaterial) hazy(p.material, haze, `prop-${model.name}`);
    const s = scatter(models, model, { near: 40, far: -360, shadow: rich, ...o });
    s.meshes.forEach((m) => world.add(m));
    scatters.push(s);
  }

  // ── the wings ──
  let gone = false;
  let wings = null;
  let flyer = null;
  // (none of these is seen until well into the drive. Here in time, each is
  // drawn once with the cab before you see it; one that comes after tells
  // the scene (`added`), which gets it onto the graphics chip then and not
  // at the moment it's first seen: the wings swinging out, the cut to outside)
  let handed = false;
  wingP.then((m) => {
    if (!m) return;
    if (gone) disposeTree(m);
    else {
      wings = wingPair(m);
      inside.add(wings.group);
      if (handed) added?.(wings.group, 'inside');
    }
  });
  flyerP.then((m) => {
    if (!m) return;
    if (gone) disposeTree(m);
    else {
      flyer = flyerOf(m);
      outside.add(flyer.group);
      if (handed) added?.(flyer.group, 'outside');
    }
  });
  let hank = null;
  suvP.then((m) => {
    if (!m) return;
    if (gone) disposeTree(m);
    else {
      hank = chaserOf(m);
      outside.add(hank.group);
      if (handed) added?.(hank.group, 'outside');
    }
  });
  queueMicrotask(() => (handed = true));
  const blue = crystals(small ? Math.round(CRYSTALS * 0.6) : CRYSTALS);
  outside.add(blue.mesh);
  // moonlight on the RV from outside, at the last (none until then)
  const flyerLight = new THREE.DirectionalLight(0xaabbe8, 0);
  flyerLight.position.set(EYE[0] - 4, EYE[1] + 10, EYE[2] + 6);
  flyerLight.target.position.set(EYE[0], EYE[1] - 6, EYE[2] - 30);
  outside.add(flyerLight, flyerLight.target);
  // where the RV's back door was, `u` through the shot from outside (from
  // your eye's frame, into the scene's)
  const doorOff = new V3();
  const doorTurn = new THREE.Euler();
  const doorAt = (u, into) => {
    const f = flightAt(u);
    doorOff.set(...DOOR).applyEuler(doorTurn.set(f.pitch, f.yaw, f.roll, 'YXZ'));
    return into.set(EYE[0] + f.x, EYE[1] + f.y, EYE[2] + f.z).add(doorOff);
  };
  // what's said on the way, from vehicles.js: as the wings come out, as the
  // RV leaves the road, and as Hank comes after it
  const LINES = vehicleById('rv').lines;
  let cues = null;
  let saidTo = 0;

  // ── the drive ──
  let shiftK = 0;
  let lastD = -1;
  const swing = { a: 0, v: 0, b: 0, w: 0 };
  let lastV = 0;
  const glassLight = new THREE.Color();
  const tmpC = new THREE.Color();
  const hemiSky = [new THREE.Color(0xe4e8f2), new THREE.Color(0x1a2448)];
  const hemiGround = [new THREE.Color(0x6a4c34), new THREE.Color(0x07060a)];
  const landSky = [new THREE.Color(0xa8bce0), new THREE.Color(0x2a3a66), new THREE.Color(0xa07e9c)];
  const landGround = [new THREE.Color(0x6a4a30), new THREE.Color(0x0a0806)];
  const sunCol = [new THREE.Color(0xffb67a), new THREE.Color(0xff5a2a)];
  const mirrorDay = new THREE.Color(1, 1, 1);
  const mirrorNight = new THREE.Color(0.06, 0.07, 0.12);
  const lampLevel = { brake: 1, gauges: 0, beam: 0, left: 0, right: 0 };

  // where a needle points: `f` of the way round its dial
  const point = (id, f) => {
    const D = DIALS[id];
    needles[id].rotation.z = -(D.from + clamp01(f) * D.sweep);
  };

  return {
    inside,
    outside,
    environment: env,
    eye: EYE,
    rest: REST,
    range: [1.95, 0.5],
    hfov: 92,
    vmin: 58,
    vmax: 100,
    envIntensity: ENV,
    glance: -1.0,
    flash: '#060914',
    rumble: 0.8,
    triggers: [wheelHit, shifterHit, knob, stalk],
    resize(w, h, px) {
      stars.set({ px });
    },
    launch() {},
    // the head turned for you: out of the left window at the wing as it
    // swings out, back ahead before it lifts; then, outside, after the RV
    aim(lt, p) {
      if (flyer && lt >= p.cut) {
        const f = flightAt(clamp01((lt - p.cut) / (p.peak - p.cut)));
        return [Math.atan2(-f.x, -f.z) - REST[0], Math.atan2(f.y + 1, Math.hypot(f.x, f.z)) - REST[1]];
      }
      const side = smooth((lt - p.wings + 300) / 700) - smooth((lt - p.jets - 500) / 900);
      return [1.42 * side, -0.12 * side];
    },
    update(dt, t, { launching, t: lt, plan }) {
      const dr = launching ? driveAt(plan, lt) : { d: 0, v: 0, k: 0 };
      const { d, v, k } = dr;
      const p = plan;

      // ── the time of day ──
      const sink = 14 * smooth(k / 0.62);
      const dusk = smooth((k - 0.1) / 0.45);
      const night = smooth((k - 0.4) / 0.38);
      const starsK = smooth((k - 0.38) / 0.42);
      const lights = smooth((k - 0.3) / 0.04);
      const glow = smooth((k - 0.26) / 0.18);
      const lift = launching ? smooth((lt - p.lift) / (p.peak - p.lift)) : 0;
      // from outside, at the last: how far through that shot (−1 before it)
      const out = flyer && launching && lt >= p.cut ? clamp01((lt - p.cut) / (p.peak - p.cut)) : -1;
      const el = SUN_EL - sink;
      setSun(el);
      const up = clamp01((el + 1.5) / 6);
      skyU.uSink.value = sink;
      skyU.uDusk.value = dusk;
      skyU.uNight.value = night;
      skyU.uSunK.value = (0.35 + 0.65 * up) * (1 - night);
      skyU.uLift.value = lift;
      skyU.uSunCol.value.setRGB(1, 0.72 - 0.3 * dusk, 0.42 - 0.25 * dusk);
      if (k < 0.55) haze.color.value.copy(dayHaze).lerp(duskHaze, dusk);
      else haze.color.value.copy(duskHaze).lerp(nightHaze, night);
      // the higher you climb, the more air between you and the land: it
      // sinks into its haze, darker, until only the towns' lights are left
      haze.color.value.multiplyScalar(1 - 0.45 * lift);
      haze.k.value = (1 + 5 * lift) / (3200 - 1600 * night);
      // the blur of speed on the ground and the road (hazy's `rush`)
      const rush = smooth((v - 15) / 110);
      haze.rush.value = 8 * rush;
      // (and a lamp as low as a headlight rakes the dirt, every grain of its
      // relief lit or black: it eases off as the lamps come on too)
      groundM.normalScale.setScalar((1.2 - 0.8 * lights) * (1 - rush));
      roadM.normalScale.setScalar(1 - rush);
      stars.set({ fade: starsK });
      sunGlow.position.copy(sunDir).multiplyScalar(2400).add(skyDome.position);
      sunHalo.position.copy(sunGlow.position);
      sunGlow.material.opacity = 0.85 * up;
      sunHalo.material.opacity = 0.13 * up + 0.1 * dusk * (1 - night);
      sunLight.position.copy(sunDir).multiplyScalar(450).add(sunLight.target.position);
      sunLight.intensity = 2.6 * up;
      // once the sun is down nothing casts a shadow (the sun outside and the
      // key light in the cab both go with it): the shadow maps stop being
      // redrawn, which is most of a frame's geometry for the rest of the drive
      sunLight.shadow.autoUpdate = up > 0;
      key.shadow.autoUpdate = up > 0;
      sunLight.color.copy(sunCol[0]).lerp(sunCol[1], dusk);
      landHemi.color.copy(landSky[0]).lerp(landSky[2], dusk).lerp(landSky[1], night);
      landHemi.groundColor.copy(landGround[0]).lerp(landGround[1], night);
      landHemi.intensity = 1.0 - 0.3 * dusk - 0.45 * night;
      town.material.opacity = smooth((k - 0.42) / 0.3);
      // (the headlights are the cab's: seen from outside, the RV is out in
      // front of where they shine from, and would stand in its own beam)
      beams.intensity = out < 0 ? 420 * lights * (1 - lift) : 0;

      // ── the road going by ──
      if (d !== lastD) {
        for (const [tex, tile] of scrolls) tex.offset.y = (d / tile) % 1;
        power.position.z = d % (POLE_GAP * PERIOD);
        fence.position.z = d % (POST_GAP * FENCE_PERIOD);
        mesas.position.z = d;
        for (const s of scatters) s.update(d);
        lastD = d;
      }
      // rising into the night: the land drops, the nose comes up
      world.position.y = -1100 * lift ** 2.2;
      tilt.rotation.x = -0.2 * lift;

      // ── the wings ──
      // out of the sides (the left a moment before the right), a hard lock,
      // then the jets catch and burn hotter as it climbs
      const open = [0, 300].map((lag) => (launching ? smooth((lt - p.wings - lag) / 1200) : 0));
      const lit = launching ? smooth((lt - p.jets) / 450) * (0.75 + 0.25 * smooth((lt - p.lift) / 1500)) : 0;
      const nav = launching ? smooth((lt - p.wings - 1500) / 200) : 0;
      wings?.set(open, lit, nav, night, t);
      if (wings && open[1] > 0.92 && open[1] < 1) swing.v += (Math.random() - 0.5) * 2 * dt * 30; // the lock shakes the little tree
      // and from outside, at the last: the cab gone, the RV ahead of you
      // climbing away into the stars
      inside.visible = out < 0;
      if (flyer) {
        flyer.group.visible = out >= 0;
        if (out >= 0) {
          const f = flightAt(out);
          flyer.group.position.set(EYE[0] + f.x, EYE[1] + f.y, EYE[2] + f.z);
          flyer.group.rotation.set(f.pitch, f.yaw, f.roll + 0.03 * Math.sin(t * 1.7), 'YXZ');
          flyer.set(1, t);
        }
      }
      // the crystals out of the back, and Hank after them
      blue.mesh.visible = out >= 0;
      if (out >= 0) blue.set(out, (p.peak - p.cut) / 1000, doorAt);
      if (hank) {
        hank.group.visible = out >= 0;
        if (out >= 0) {
          const f = flightAt(out);
          const c = chaseAt(out);
          hank.group.position.set(EYE[0] + f.x + c.x, EYE[1] + f.y + c.y, EYE[2] + f.z + c.z);
          hank.group.rotation.set(0.18, f.yaw * 0.6, 0.06 * Math.sin(t * 2.3), 'YXZ');
          hank.set(t);
        }
      }
      flyerLight.intensity = out >= 0 ? 1.3 : 0;

      // ── what's said ──
      if (launching) {
        cues ??= [
          [p.wings + 200, LINES.wings[0]],
          [p.wings + 2700, LINES.wings[1]],
          [p.lift + 100, LINES.lift[0]],
          [p.cut + 250, LINES.chase[0]],
          [p.cut + 1500, LINES.chase[1]],
          [p.cut + 2600, LINES.chase[2]],
        ];
        for (const l of due(cues, saidTo, lt)) say?.(l);
        saidTo = lt;
      } else saidTo = 0;

      // ── in the cab ──
      key.intensity = 2.2 * up;
      key.color.copy(sunCol[0]).lerp(sunCol[1], dusk * 0.6);
      bounce.intensity = 0.5 * up;
      hemi.color.copy(hemiSky[0]).lerp(hemiSky[1], dusk * 0.5 + night * 0.5);
      hemi.groundColor.copy(hemiGround[0]).lerp(hemiGround[1], night);
      const dim = Math.max(dusk * 0.7, night);
      hemi.intensity = 0.4 * (1 - 0.78 * dim);
      moon.intensity = 0.3 * night;
      faceM.emissiveIntensity = 1.3 * glow;
      needleM.emissiveIntensity = 0.25 + 1.6 * glow;
      radioM.emissiveIntensity = 0.15 + 1.2 * glow;
      dashGlow.intensity = 0.5 * glow;
      radioGlow.intensity = 0.15 * glow;
      const envK = 1 - 0.92 * dim;
      for (const m of reflective) m.envMapIntensity = (env ? ENV : 1) * envK;
      glassLight.setRGB(1, 0.9, 0.76).lerp(tmpC.setRGB(0.14, 0.2, 0.34), dim);
      glassM.userData.setLight?.(glassLight);
      for (const g of sideGlass) g.material.color.copy(mirrorDay).lerp(mirrorNight, Math.max(dusk * 0.8, night));
      rearGlass.material.color.copy(mirrorDay).lerp(mirrorNight, Math.max(dusk * 0.8, night) * 0.8);

      // the gauges: the speedometer follows the drive, the rest settle in
      const mph = 85 * (1 - Math.exp(-v / 42));
      point('speed', (mph + (v > 1 ? Math.sin(t * 23) * 0.4 : 0)) / 85);
      point('fuel', 0.62 - 0.05 * k);
      point('temp', 0.47 + 0.06 * smooth(k * 2));
      point('oil', (launching ? 0.45 + 0.2 * clamp01(v / 30) : 0.34) + Math.sin(t * 9) * 0.008);
      point('volts', 0.56 + Math.sin(t * 3.1) * 0.006);
      // lamps: the parking brake's goes out as you go; the high beams come on with the dark
      lampLevel.brake = launching && lt > 260 ? 0 : 1;
      lampLevel.beam = lights;
      for (const [id, m] of Object.entries(lamps)) m.material.color.copy(m.userData.col).multiplyScalar(0.05 + 2.2 * lampLevel[id]);

      // into drive: the shifter comes down through the gate
      const wantShift = launching ? smooth((lt - 120) / 280) : 0;
      shiftK += (wantShift - shiftK) * Math.min(1, dt * 20);
      shifter.rotation.z = 0.22 - 0.5 * shiftK;
      gearPointer.position.x = -0.0285 + 0.0475 * shiftK * 0.67;
      // small corrections at the wheel while the road goes by
      const steer = launching ? (0.05 * Math.sin(t * 0.8) + 0.025 * Math.sin(t * 2.1 + 1)) * clamp01(v / 15) * (1 - lift) : 0;
      spin.rotation.z += (steer - spin.rotation.z) * Math.min(1, dt * 3);

      // the little tree: thrown back as you speed up, set swinging by the road
      const accel = dt > 0 ? (v - lastV) / Math.max(dt, 0.016) : 0;
      lastV = v;
      const sdt = Math.min(dt, 0.05);
      const target = -Math.atan(Math.min(accel, 60) / 9.8) * 0.5;
      swing.v += ((target - swing.a) * 38 - swing.v * 1.6) * sdt + (launching ? (Math.random() - 0.5) * 0.4 * clamp01(v / 20) : 0) * sdt * 30;
      swing.a += swing.v * sdt;
      swing.w += (-swing.b * 30 - swing.w * 1.2) * sdt + (launching ? (Math.random() - 0.5) * 0.3 * clamp01(v / 20) : 0) * sdt * 30;
      swing.b += swing.w * sdt;
      tree.rotation.set(swing.a + Math.sin(t * 1.3) * 0.02, Math.sin(t * 0.5) * 0.4, swing.b + Math.sin(t * 1.7) * 0.015);

      // (how the ride feels to the two of them, eased: the pull of the
      // speed coming on, the sway of the steering, the lift, the wings out)
      {
        const push = launching ? clamp01((v - 2) / 18) * (1 - lift) : 0;
        const sway = launching ? steer * 6 : 0;
        const k = Math.min(1, dt * 4);
        ride.push += (push - ride.push) * k;
        ride.sway += (sway - ride.sway) * k;
        ride.lift += (lift * (1 - smooth((lt - p.peak) / 2500)) - ride.lift) * k;
        ride.wings += (open[0] * (1 - smooth((lt - p.wings - 4500) / 1500)) - ride.wings) * k;
      }
      jesseMove?.(t);
      waltMove?.(t);
    },
    dispose() {
      gone = true;
      for (const off of undress) off();
      jesse?.dispose();
      walt?.dispose();
      models.dispose();
      renderer.shadowMap.enabled = false;
      env?.dispose();
    },
  };
}
