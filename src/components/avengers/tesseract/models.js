// Tesseract Run's models, built from code: the Quinjet (a faceted stealth
// fuselage lofted through its stations, swept wings with a VTOL fan in each
// that tilts, twin canted tails, the canopy, landing gear, nav lights and the
// glow of its fans and engines), the Tesseract's containment case, the steel
// cable, the landing pads, the windsocks, the gantry, the hangar, rain.

import * as THREE from 'three';
import { hot } from '../hq/engine';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PartBuilder, canvasTexture, placed, rbox } from '../hq/kit/shapes';
import { logoTexture } from '../hq/kit/world';
import { CABLE, CASE, GANTRY, HANGAR, WHEELS, WHEEL_DROP } from './rules';

export const BLUE = 0x4fb8ff; // the Tesseract's blue, and the game's accent
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

// ── the Quinjet ──────────────────────────────────────────────────────────────
// Facing +x, up +y, its right (starboard) side toward +z. Metres, its middle at
// the origin, matching the outline in ./rules.js.

// The fuselage's stations: x, half-width, top, bottom, and the chine (the
// sharp edge along its side, where it's widest).
const STATIONS = [
  [8.6, 0.05, -0.2, -0.3, -0.26],
  [8.15, 0.52, 0.16, -0.62, -0.34],
  [7.3, 1.0, 0.62, -0.9, -0.38],
  [6.2, 1.34, 1.02, -1.04, -0.4],
  [5.0, 1.58, 1.34, -1.13, -0.42],
  [3.5, 1.76, 1.52, -1.2, -0.42],
  [2.0, 1.92, 1.6, -1.23, -0.38],
  [0.0, 2.06, 1.6, -1.24, -0.32],
  [-2.0, 2.12, 1.52, -1.22, -0.26],
  [-4.0, 2.06, 1.36, -1.14, -0.18],
  [-5.8, 1.88, 1.16, -0.97, -0.1],
  [-7.0, 1.64, 0.98, -0.64, 0.0],
  [-7.7, 1.48, 0.88, -0.38, 0.05],
];
const CANOPY = [3.1, 7.75]; // the glass, along x

// Catmull-Rom through the stations, `per` rings between each pair
function rings(per = 4) {
  const out = [];
  const n = STATIONS.length;
  for (let i = 0; i < n - 1; i++) {
    const a = STATIONS[Math.max(0, i - 1)];
    const b = STATIONS[i];
    const c = STATIONS[i + 1];
    const d = STATIONS[Math.min(n - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(b.map((_, j) => 0.5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3)));
    }
  }
  out.push(STATIONS[n - 1].slice());
  return out;
}

// One ring of the fuselage at a station: eight points round it, from the
// spine, down the right side to the keel and up the left.
function ringPoints([x, w, top, bot, chine]) {
  // the canopy bulges up a little over the glass
  const glass = smooth(CANOPY[0], CANOPY[0] + 0.8, x) * (1 - smooth(CANOPY[1] - 0.9, CANOPY[1], x));
  const t = top + glass * 0.12;
  const pts = [
    [0, t],
    [w * 0.6, t - (t - chine) * 0.2],
    [w, chine],
    [w * 0.74, bot + (chine - bot) * 0.3],
    [0, bot],
  ];
  return [...pts, ...pts.slice(1, 4).reverse().map(([z, y]) => [-z, y])].map(([z, y]) => new THREE.Vector3(x, y, z));
}
// the canopy: the top strips over the cockpit, and side windows below them
const isGlass = (strip, x) => ((strip === 0 || strip === 7) && x > 3.1 && x < 7.75) || ((strip === 1 || strip === 6) && x > 4.3 && x < 7.25);

function fuselage(builder) {
  const R = rings(5).map(ringPoints);
  const strips = R[0].length;
  // u along the body, v round it, both in metres
  for (let s = 0; s < strips; s++) {
    let run = [];
    let key = null;
    const flush = () => {
      if (run.length < 2) return;
      const pos = [];
      const uv = [];
      const idx = [];
      for (const [r, ring] of run.entries()) {
        const a = ring[s];
        const b = ring[(s + 1) % strips];
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        const v0 = s * 1.2;
        uv.push(a.x / 1.7, v0 / 1.7, a.x / 1.7, (v0 + a.distanceTo(b)) / 1.7);
        if (r > 0) {
          const i = r * 2;
          idx.push(i - 2, i, i - 1, i - 1, i, i + 1);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      builder.add(key, g);
    };
    for (let r = 0; r < R.length; r++) {
      const x = R[r][0].x;
      const k = isGlass(s, x) ? 'glass' : 'paint';
      if (k !== key) {
        // the boundary ring belongs to both runs
        const last = run[run.length - 1];
        flush();
        run = last ? [last] : [];
        key = k;
      }
      run.push(R[r]);
    }
    flush();
  }
  // the tail's end plate, round the engine nozzles
  const end = R[R.length - 1];
  const c = new THREE.Vector3().copy(end[0]).add(end[4]).multiplyScalar(0.5);
  const pos = [];
  for (let i = 0; i < strips; i++) {
    const a = end[i];
    const b = end[(i + 1) % strips];
    pos.push(c.x, c.y, c.z, b.x, b.y, b.z, a.x, a.y, a.z);
  }
  const plate = new THREE.BufferGeometry();
  plate.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  plate.computeVertexNormals();
  builder.add('dark', plate);
}

// a flat shape in the (x, z) plane, `thick` deep in y, its top at y = 0
function slab(points, thick, holes = []) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) shape.holes.push(h);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1, curveSegments: 28 });
  // the shape's plane is (x, y) with depth along z: lay it flat
  g.rotateX(-Math.PI / 2);
  g.translate(0, -thick, 0);
  // uv in metres
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 3, p.getZ(i) / 3);
  return g;
}

// The wing's planform (right side), the fan's hole in it.
const WING = [
  [2.7, 1.7],
  [0.3, 4.1],
  [-2.3, 7.3],
  [-3.0, 7.75],
  [-3.95, 7.7],
  [-4.75, 1.7],
];
export const FAN = { x: -1.15, z: 3.95, r: 1.12 };
const WING_Y = -0.3; // the wing's top surface at the root
const WING_T = 0.34;
const ANHEDRAL = 0.075; // the tips droop

// The wing's frame: a point in it (x, y from its top surface, z out along it)
// to the jet's, and the frame itself for parts that move in it.
const wingFrame = (side) => new THREE.Matrix4().makeTranslation(0, WING_Y, 0).multiply(new THREE.Matrix4().makeRotationX(ANHEDRAL * side));

function wing(builder, side) {
  const pts = WING.map(([x, z]) => [x, z * side]);
  if (side < 0) pts.reverse();
  const hole = new THREE.Path();
  hole.absarc(FAN.x, -FAN.z * side, FAN.r + 0.04, 0, Math.PI * 2, side < 0);
  const local = new PartBuilder();
  local.add('paint', slab(pts, WING_T, [hole]));
  // the wingtip's fence, turned down
  local.add('paint', rbox(1.6, 0.62, 0.1, 0.04), { p: [-3.25, -0.42, 7.72 * side], r: [0.22 * side, 0, 0] });
  // a fairing round the fan's duct, under the wing
  local.add('dark', new THREE.TorusGeometry(FAN.r + 0.1, 0.09, 8, 36).rotateX(Math.PI / 2), { p: [FAN.x, -WING_T - 0.02, FAN.z * side] });
  const M = wingFrame(side);
  for (const [k, g] of Object.entries(local.geometries())) builder.add(k, g.applyMatrix4(M));
  // a leading-edge strake into the fuselage
  builder.add('paint', placed(rbox(3.2, 0.22, 0.5, 0.08), { p: [1.7, WING_Y - 0.12, 1.85 * side], r: [0, 0.55 * side, 0] }));
}
// where a point of the wing is, in the jet's frame
const onWing = (side, x, y, z) => new THREE.Vector3(x, y, z * side).applyMatrix4(wingFrame(side));

// a fin in its own plane (x, y), `thick` across
function finGeometry() {
  const shape = new THREE.Shape([new THREE.Vector2(-4.5, 0), new THREE.Vector2(-7.85, 0), new THREE.Vector2(-8.05, 2.45), new THREE.Vector2(-6.55, 2.45)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 1 });
  g.translate(0, 0, -0.06);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 3, p.getY(i) / 3);
  return g;
}
const FIN_CANT = 0.3;
const FIN_Z = 1.05;
const FIN_Y = 0.92;

// A ducted fan: the duct and its stators (still), the rotor (spins), the glow
// under it. Centred on its pivot; its axis is +y.
function fanParts() {
  const duct = new PartBuilder();
  duct.add('dark', new THREE.CylinderGeometry(FAN.r, FAN.r, 0.62, 40, 1, true));
  duct.add('metal', new THREE.TorusGeometry(FAN.r + 0.02, 0.07, 8, 40).rotateX(Math.PI / 2), { p: [0, 0.3, 0] });
  duct.add('metal', new THREE.TorusGeometry(FAN.r + 0.02, 0.05, 8, 40).rotateX(Math.PI / 2), { p: [0, -0.3, 0] });
  for (let i = 0; i < 4; i++) duct.add('dark', new THREE.BoxGeometry(FAN.r * 2 - 0.1, 0.06, 0.1).rotateY((i * Math.PI) / 4), { p: [0, -0.18, 0] });
  duct.add('dark', new THREE.CylinderGeometry(0.3, 0.26, 0.5, 16), { p: [0, -0.02, 0] });
  duct.add('metal', new THREE.ConeGeometry(0.3, 0.32, 16), { p: [0, 0.38, 0] });
  const rotor = new PartBuilder();
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    rotor.add('blade', new THREE.BoxGeometry(FAN.r - 0.34, 0.025, 0.24).translate((FAN.r - 0.34) / 2 + 0.3, 0, 0).rotateX(0.5).rotateY(a), { p: [0, 0.1, 0] });
  }
  return { duct, rotor };
}

// The blur of a spinning fan, and the hot glow under it: soft textures.
function fanBlurTexture() {
  return canvasTexture(256, 256, (x, w) => {
    const c = w / 2;
    x.clearRect(0, 0, w, w);
    for (let i = 0; i < 22; i++) {
      const a0 = (i / 22) * Math.PI * 2;
      const g = x.createRadialGradient(c, c, w * 0.12, c, c, w * 0.5);
      g.addColorStop(0, 'rgba(40,44,50,0.0)');
      g.addColorStop(0.3, 'rgba(70,76,84,0.55)');
      g.addColorStop(1, 'rgba(60,66,74,0.35)');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(c, c);
      x.arc(c, c, w * 0.49, a0, a0 + 0.12);
      x.closePath();
      x.fill();
    }
  });
}
export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(160,220,255,0.5)') {
  return canvasTexture(128, 128, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, mid);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
  });
}

// The plume under a fan: a cone of hot air, brightest at the duct, streaked
// and wavering (the shimmer), fading as it spreads.
function plumeMaterial(color = 0x9fdcff) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFace;
      void main() {
        vUv = uv;
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFace = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPower;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying float vFace;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        float along = 1.0 - vUv.y; // 0 at the duct, 1 at the far end
        float n = noise(vec2(vUv.x * 18.0, along * 6.0 - uTime * 9.0)) * 0.6 + noise(vec2(vUv.x * 40.0, along * 14.0 - uTime * 17.0)) * 0.4;
        float core = pow(vFace, 1.6);
        float fade = pow(1.0 - along, 1.8 + (1.0 - uPower) * 2.0);
        float a = uPower * fade * core * (0.45 + n * 0.75);
        gl_FragColor = vec4(uColor * a * 1.6, a);
      }`,
  });
}

// A canvas of the Quinjet's markings for its tails: the "A", small and pale.
function finLogo() {
  return logoTexture(256, { color: '#dfe6ee' });
}

// The nav lights: one draw for all of them, points that glow (bloom does the rest).
function navLights(list) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(list.flatMap((l) => l.at.toArray()), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(list.flatMap((l) => new THREE.Color(l.color).multiplyScalar(l.k).toArray()), 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(list.map((l) => l.size)), 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(list.length).fill(1), 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uScale: { value: 600 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uScale;
      void main() {
        vColor = color;
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(2.5, aSize * uScale / max(0.1, -mv.z)) * (0.4 + 0.6 * aAlpha);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(0.35, 0.0, r);
        float halo = pow(max(0.0, 1.0 - r), 3.0) * 0.6;
        float a = (core + halo) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * a, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  return { points, mat, alpha: geo.attributes.aAlpha };
}

// The Quinjet. Returns its group and the moving parts:
// { group, body, fans, gear, update(state) }.
export function buildQuinjet(mats, { lite = false } = {}) {
  const group = new THREE.Group();
  group.name = 'quinjet';
  // the body pitches inside the group; the group goes where the rules say
  const body = new THREE.Group();
  group.add(body);

  const b = new PartBuilder();
  fuselage(b);
  wing(b, 1);
  wing(b, -1);
  // the tails, canted out
  const fin = finGeometry();
  for (const side of [1, -1]) b.add('paint', placed(fin, { p: [0, FIN_Y, FIN_Z * side], r: [FIN_CANT * side, 0, 0] }));
  // intakes behind the cockpit, nozzles at the tail
  for (const side of [1, -1]) {
    b.add('dark', placed(rbox(2.0, 0.42, 0.3, 0.06), { p: [1.3, -0.12, 1.87 * side], r: [0, -0.12 * side, 0] }));
    b.add('metal', placed(rbox(0.9, 0.62, 0.95, 0.12), { p: [-7.55, 0.14, 0.72 * side] }));
    b.add('dark', placed(new THREE.BoxGeometry(0.2, 0.42, 0.72), { p: [-7.95, 0.14, 0.72 * side] }));
  }
  // a dorsal spine and the cockpit's frame
  b.add('paint', placed(rbox(5.6, 0.22, 0.5, 0.08), { p: [-2.6, 1.52, 0] }));
  b.add('metal', placed(new THREE.BoxGeometry(0.12, 0.08, 2.4), { p: [4.55, 1.41, 0], r: [0, 0, -0.38] }));
  // antennas and probes
  b.add('metal', placed(new THREE.CylinderGeometry(0.025, 0.04, 0.9, 6), { p: [8.75, -0.24, 0], r: [0, 0, Math.PI / 2] }));
  b.add('dark', placed(rbox(0.5, 0.18, 0.08, 0.03), { p: [-1.2, 1.7, 0], r: [0, 0, -0.3] }));
  const hull = b.build(mats);
  hull.children.forEach((m) => (m.castShadow = m.name !== 'glass'));
  body.add(hull);

  // the A on each tail (one mesh)
  const logoMat = new THREE.MeshStandardMaterial({ map: finLogo(), transparent: true, roughness: 0.6, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const logoGeo = mergeGeometries(
    [1, -1].map((side) => {
      const g = new THREE.PlaneGeometry(1.0, 1.0);
      const at = new THREE.Vector3(-6.95, FIN_Y + 1.25 * Math.cos(FIN_CANT), FIN_Z * side + side * (0.09 + 1.25 * Math.sin(FIN_CANT)));
      g.applyMatrix4(new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromEuler(new THREE.Euler(FIN_CANT * side, side > 0 ? 0 : Math.PI, 0)), new THREE.Vector3(1, 1, 1)));
      return g;
    }),
  );
  body.add(new THREE.Mesh(logoGeo, logoMat));

  // the fans: both tilt together about one axis (across the jet, through
  // their middles), each spinning in its own wing
  const fanAt = [1, -1].map((side) => onWing(side, FAN.x, -WING_T / 2, FAN.z));
  const fans = new THREE.Group();
  fans.position.set(FAN.x, fanAt[0].y, 0);
  body.add(fans);
  const local = (side) => new THREE.Matrix4().makeTranslation(0, 0, fanAt[side > 0 ? 0 : 1].z).multiply(new THREE.Matrix4().makeRotationX(ANHEDRAL * side));
  const both = (g) => mergeGeometries([g.clone().applyMatrix4(local(1)), g.clone().applyMatrix4(local(-1))]);
  const { duct, rotor } = fanParts();
  for (const [k, g] of Object.entries(duct.geometries())) {
    const m = new THREE.Mesh(both(g), mats[k]);
    m.castShadow = true;
    fans.add(m);
  }
  const blades = new THREE.InstancedMesh(rotor.geometries().blade, mats.blade, 2);
  const blurMat = new THREE.MeshBasicMaterial({ map: fanBlurTexture(), transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide });
  const blur = new THREE.InstancedMesh(new THREE.CircleGeometry(FAN.r - 0.04, 40).rotateX(-Math.PI / 2).translate(0, 0.11, 0), blurMat, 2);
  blades.frustumCulled = false;
  blur.frustumCulled = false;
  fans.add(blades, blur);
  // the glow under each fan, and its plume
  const fanGlow = new THREE.MeshBasicMaterial({ color: hot(BLUE, 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, map: glowTexture() });
  const discs = new THREE.Mesh(both(new THREE.CircleGeometry(FAN.r * 1.25, 32).rotateX(Math.PI / 2).translate(0, -0.33, 0)), fanGlow);
  discs.renderOrder = 3;
  fans.add(discs);
  const plumeMat = plumeMaterial();
  const plumes = new THREE.Mesh(both(new THREE.CylinderGeometry(FAN.r * 0.95, FAN.r * 2.1, 7, 24, 1, true).translate(0, -3.8, 0)), plumeMat);
  plumes.renderOrder = 4;
  plumes.frustumCulled = false;
  fans.add(plumes);

  // the engines' glow at the tail, and their plumes
  const jetGlow = new THREE.MeshBasicMaterial({ color: hot(0x9fd8ff, 1), toneMapped: false });
  const nozzle = new THREE.PlaneGeometry(0.62, 0.36).rotateY(-Math.PI / 2);
  body.add(new THREE.Mesh(mergeGeometries([1, -1].map((side) => nozzle.clone().translate(-8.06, 0.14, 0.72 * side))), jetGlow));
  const rearGeo = new THREE.CylinderGeometry(0.34, 0.12, 3.2, 16, 1, true).translate(0, -1.6, 0).rotateZ(-Math.PI / 2);
  const rear = new THREE.Mesh(mergeGeometries([1, -1].map((side) => rearGeo.clone().translate(0, 0, 0.72 * side))), plumeMat);
  rear.position.set(-8.06, 0.14, 0);
  rear.renderOrder = 4;
  body.add(rear);

  // landing gear: the nose leg folds forward, the main legs back; each a
  // strut, an oleo, a scissor link, wheels and hubs
  const r = 0.3;
  const legParts = (b2, z, twin) => {
    b2.add('metal', new THREE.CylinderGeometry(0.075, 0.075, WHEEL_DROP - r + 0.15, 10).translate(0, -(WHEEL_DROP - r + 0.15) / 2 + 0.1, 0), { p: [0, 0, z] });
    b2.add('metal', new THREE.CylinderGeometry(0.11, 0.11, 0.42, 10).translate(0, -0.25, 0), { p: [0, 0, z] });
    b2.add('metal', new THREE.BoxGeometry(0.06, 0.5, 0.04).translate(0.12, -0.55, 0).rotateZ(0.3), { p: [0, 0, z] });
    for (const dz of twin ? [-0.15, 0.15] : [0]) {
      b2.add('rubber', new THREE.CylinderGeometry(r, r, 0.22, 18).rotateX(Math.PI / 2), { p: [0, -(WHEEL_DROP - r), z + dz] });
      b2.add('metal', new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.24, 12).rotateX(Math.PI / 2), { p: [0, -(WHEEL_DROP - r), z + dz] });
    }
  };
  const noseB = new PartBuilder();
  legParts(noseB, 0, true);
  const mainB = new PartBuilder();
  legParts(mainB, 1.3, false);
  legParts(mainB, -1.3, false);
  const gear = [
    { g: noseB.build(mats), at: WHEELS[0], dir: 1 },
    { g: mainB.build(mats), at: WHEELS[1], dir: -1 },
  ];
  for (const leg of gear) {
    leg.g.position.set(leg.at[0], leg.at[1] + 0.05, 0);
    body.add(leg.g);
  }

  // nav lights: red to port (left, -z), green to starboard (+z), white strobes
  // on the tails, red beacons over and under
  const tipAt = (side) => onWing(side, -2.55, -0.2, 7.85);
  const finTip = (side) => new THREE.Vector3(-8.0, FIN_Y + 2.45 * Math.cos(FIN_CANT), FIN_Z * side + side * 2.45 * Math.sin(FIN_CANT));
  const nav = navLights([
    { at: tipAt(1), color: 0x30ff70, k: 3, size: 0.9 },
    { at: tipAt(-1), color: 0xff2a2a, k: 3, size: 0.9 },
    { at: finTip(1), color: 0xffffff, k: 5, size: 1.1 },
    { at: finTip(-1), color: 0xffffff, k: 5, size: 1.1 },
    { at: new THREE.Vector3(-1.2, 1.82, 0), color: 0xff3020, k: 4, size: 0.9 },
    { at: new THREE.Vector3(-0.6, -1.25, 0), color: 0xff3020, k: 4, size: 0.9 },
  ]);
  body.add(nav.points);

  // ── moving it ──
  const fanColor = new THREE.Color();
  const white = new THREE.Color(0xdff4ff);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const zero = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let spin = 0;
  let strobe = 0;
  const update = ({ pitch = 0, fanTilt = 0, spool = 0, gear: down = 1, t = 0, dt = 0, rear: thrust = 0, calm = false, scale = 600 }) => {
    body.rotation.z = -pitch;
    fans.rotation.z = -fanTilt;
    spin += dt * (4 + spool * 26);
    for (const [i, side] of [1, -1].entries()) {
      // each rotor turns in its own wing's plane
      m4.compose(zero, q.setFromAxisAngle(up, spin * side), one).premultiply(local(side));
      blades.setMatrixAt(i, m4);
      blur.setMatrixAt(i, m4);
    }
    blades.instanceMatrix.needsUpdate = true;
    blur.instanceMatrix.needsUpdate = true;
    blurMat.opacity = clamp(spool * 1.4, 0, 0.85);
    // the fans' glow and plumes answer the throttle
    fanColor.set(BLUE).lerp(white, spool * 0.5).multiplyScalar(0.25 + spool * 2.2);
    fanGlow.color.copy(fanColor);
    fanGlow.opacity = clamp(0.25 + spool, 0, 1);
    plumeMat.uniforms.uPower.value = clamp(spool * 1.1, 0, 1);
    plumeMat.uniforms.uTime.value = t;
    plumes.scale.set(1, 0.55 + spool * 0.75, 1);
    plumes.visible = spool > 0.02;
    jetGlow.color.set(0x9fd8ff).multiplyScalar(0.6 + thrust * 3);
    rear.scale.set(1, 0.6 + thrust * 0.8, 0.6 + thrust * 0.8);
    rear.visible = thrust > 0.05;
    // the wheels fold into the belly as they come up
    for (const leg of gear) {
      leg.g.rotation.z = (1 - down) * (Math.PI / 2) * leg.dir * 0.98;
      leg.g.visible = down > 0.02;
    }
    // strobes: a double flash every second and a half; beacons pulse
    strobe += dt;
    const ph = strobe % 1.5;
    const flash = calm ? 0.6 : ph < 0.06 || (ph > 0.16 && ph < 0.22) ? 1 : 0;
    const beat = calm ? 0.7 : 0.35 + 0.65 * Math.max(0, Math.sin(strobe * 5.5));
    const a = nav.alpha.array;
    a[2] = a[3] = flash;
    a[4] = a[5] = beat;
    nav.alpha.needsUpdate = true;
    nav.mat.uniforms.uScale.value = scale;
  };
  update({});
  return { group, body, fans, gear, update, lite };
}

// Materials for the Quinjet: dark stealth paint on plates, smoked glass, dark
// trim, steel, rubber. `paint` is a PBR set's material, passed in.
export function quinjetMaterials(paint) {
  return {
    paint,
    glass: new THREE.MeshPhysicalMaterial({ color: 0x07090b, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8, emissive: new THREE.Color(0x0a1a24), emissiveIntensity: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 0.6, roughness: 0.55, side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8d949c, metalness: 1, roughness: 0.35 }),
    blade: new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.8, roughness: 0.4 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0, roughness: 0.9 }),
  };
}

// ── the Tesseract's case ─────────────────────────────────────────────────────
// Its origin is the middle of its base; the sling's ring is at the top.

// The Tesseract: a cube of blue light with a lattice in it that shifts.
function tesseractMaterial() {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vPos = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPower;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec3 vView;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float lattice(vec3 p, float s) {
        vec3 g = abs(fract(p * s) - 0.5);
        return smoothstep(0.42, 0.5, max(max(g.x, g.y), g.z));
      }
      void main() {
        vec3 p = vPos / 0.23; // -1..1 across the cube
        // the edges burn
        vec3 a = abs(p);
        float edge = smoothstep(0.82, 1.0, max(max(a.x * step(a.x, 2.0), 0.0), 0.0) + 0.0);
        float e2 = smoothstep(0.78, 0.98, (a.x + a.y + a.z - max(max(a.x, a.y), a.z)) * 0.5);
        // nested cubes, turning
        float t = uTime * 0.6;
        float c = cos(t), s = sin(t);
        vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
        float inner = lattice(q * 0.5 + 0.5, 2.0) * 0.6 + lattice(p * 0.5 + 0.5 + uTime * 0.05, 4.0) * 0.35;
        float core = 1.0 - smoothstep(0.0, 1.2, length(p.xy * 0.8));
        float fres = pow(1.0 - abs(dot(vNormal, vView)), 2.0);
        float flick = 0.9 + 0.1 * sin(uTime * 7.0 + hash(floor(p * 3.0)) * 6.0);
        vec3 deep = vec3(0.05, 0.25, 0.9);
        vec3 bright = vec3(0.55, 0.88, 1.6);
        vec3 col = deep * (0.8 + core) + bright * (e2 * 2.4 + inner * 1.6 + fres * 1.2);
        gl_FragColor = vec4(col * flick * (0.6 + uPower * 1.4) * 1.6, 1.0);
      }`,
  });
}

export function buildCase(mats) {
  const group = new THREE.Group();
  group.name = 'tesseract-case';
  const W = CASE.w;
  const H = CASE.h;
  const b = new PartBuilder();
  b.add('frame', rbox(W, 0.3, W, 0.06), { p: [0, 0.15, 0] });
  b.add('frame', rbox(W, 0.24, W, 0.06), { p: [0, H - 0.12, 0] });
  b.add('trim', rbox(W - 0.3, 0.06, W - 0.3, 0.02), { p: [0, H + 0.02, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add('frame', rbox(0.16, H - 0.5, 0.16, 0.04), { p: [sx * (W / 2 - 0.1), H / 2, sz * (W / 2 - 0.1)] });
  // the cradle the cube floats over
  b.add('trim', new THREE.CylinderGeometry(0.36, 0.44, 0.2, 20), { p: [0, 0.4, 0] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.add('frame', new THREE.BoxGeometry(0.05, 0.36, 0.05), { p: [Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.3], r: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3] });
  }
  // latches and handles
  for (const sx of [-1, 1]) {
    b.add('trim', rbox(0.5, 0.1, 0.08, 0.03), { p: [sx * 0.5, 0.22, W / 2 + 0.02] });
    b.add('trim', rbox(0.08, 0.1, 0.5, 0.03), { p: [sx * (W / 2 + 0.02), 0.22, 0] });
  }
  // the sling: four straps from the lid's corners up to the ring
  const ring = new THREE.Vector3(0, H + CASE.sling, 0);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const a = new THREE.Vector3(sx * (W / 2 - 0.12), H, sz * (W / 2 - 0.12));
      const len = a.distanceTo(ring);
      const strap = new THREE.CylinderGeometry(0.025, 0.025, len, 6).translate(0, len / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ring.clone().sub(a).normalize());
      strap.applyQuaternion(q).translate(a.x, a.y, a.z);
      b.add('strap', strap);
    }
  b.add('trim', new THREE.TorusGeometry(0.13, 0.035, 8, 20), { p: [0, H + CASE.sling, 0] });
  const solid = b.build(mats);
  group.add(solid);

  // the glass: a box inside the frame
  const glass = new THREE.Mesh(new THREE.BoxGeometry(W - 0.22, H - 0.52, W - 0.22), mats.glass);
  glass.position.y = H / 2 + 0.02;
  glass.renderOrder = 2;
  group.add(glass);

  // the cube, and its glow
  const cubeMat = tesseractMaterial();
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), cubeMat);
  cube.position.y = 1.0;
  group.add(cube);
  const haloMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(220,245,255,1)', 'rgba(80,170,255,0.45)'), color: hot(BLUE, 1.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(2.4);
  halo.position.y = 1.0;
  halo.renderOrder = 3;
  group.add(halo);
  // a strip of status lights round the base
  const ledMat = new THREE.MeshBasicMaterial({ color: hot(BLUE, 2.2), toneMapped: false });
  const led = new THREE.Mesh(new THREE.BoxGeometry(W - 0.6, 0.035, 0.02), ledMat);
  led.position.set(0, 0.24, W / 2 + 0.04);
  group.add(led);

  group.traverse((o) => {
    if (o.isMesh && o !== glass && o !== cube && o !== led) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const update = (t, power = 1) => {
    cubeMat.uniforms.uTime.value = t;
    cubeMat.uniforms.uPower.value = power;
    cube.rotation.set(Math.sin(t * 0.4) * 0.2 + 0.35, t * 0.5, Math.cos(t * 0.3) * 0.15);
    cube.position.y = 1.0 + Math.sin(t * 1.3) * 0.03;
    haloMat.opacity = 0.55 + 0.25 * power + 0.1 * Math.sin(t * 3.1);
    halo.scale.setScalar(2.2 + power * 0.8);
  };
  return { group, cube, update, ledMat };
}

export function caseMaterials(steel) {
  return {
    frame: steel,
    trim: new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.9, roughness: 0.4 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x1f2124, metalness: 0.2, roughness: 0.8 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, depthWrite: false, side: THREE.DoubleSide }),
  };
}

// ── the cable ────────────────────────────────────────────────────────────────
// A steel wire rope through a chain of points, rebuilt in place each frame
// (a tube along a smooth curve through them). Its points are simulated here
// too (verlet, both ends pinned), so it sags when it's slack and whips a
// little when it snaps taut.
export function buildCable(mat, { nodes = 14, radius = 0.06, sides = 6, segs = 40 } = {}) {
  const pts = Array.from({ length: nodes }, () => ({ p: new THREE.Vector3(), q: new THREE.Vector3() }));
  const rest = CABLE / (nodes - 1);
  const ringN = sides + 1;
  const count = (segs + 1) * ringN;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const idx = [];
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * ringN + j;
      const b2 = (i + 1) * ringN + j;
      idx.push(a, b2, a + 1, a + 1, b2, b2 + 1);
    }
  for (let i = 0; i <= segs; i++) for (let j = 0; j <= sides; j++) uv.set([j / sides, (i / segs) * CABLE * 6], (i * ringN + j) * 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const curve = new THREE.CatmullRomCurve3(pts.map((n) => n.p));
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const P = new THREE.Vector3();
  const up = new THREE.Vector3(0, 0, 1);
  let ready = false;

  const reset = (a, b2) => {
    for (const [i, n] of pts.entries()) {
      n.p.copy(a).lerp(b2, i / (nodes - 1));
      n.q.copy(n.p);
    }
    ready = true;
  };
  // move the ends, let the middle follow; wind pushes it
  const step = (a, b2, dt, wind = 0) => {
    // an end that jumped (a new leg, a restart) starts the rope afresh
    if (!ready || a.distanceToSquared(pts[0].p) > 9 || b2.distanceToSquared(pts[nodes - 1].p) > 9) reset(a, b2);
    const h = Math.min(dt, 1 / 30);
    for (let i = 1; i < nodes - 1; i++) {
      const n = pts[i];
      const vx = (n.p.x - n.q.x) * 0.985;
      const vy = (n.p.y - n.q.y) * 0.985;
      const vz = (n.p.z - n.q.z) * 0.985;
      n.q.copy(n.p);
      n.p.x += vx + wind * 0.4 * h * h;
      n.p.y += vy - 9.8 * h * h;
      n.p.z += vz;
    }
    pts[0].p.copy(a);
    pts[nodes - 1].p.copy(b2);
    // a taut cable is a straight one: if the ends are a cable's length apart the
    // constraints pull every point onto the line between them
    for (let it = 0; it < 18; it++) {
      for (let i = 0; i < nodes - 1; i++) {
        const p1 = pts[i].p;
        const p2 = pts[i + 1].p;
        P.subVectors(p2, p1);
        const d = P.length() || 1e-6;
        const diff = (d - rest) / d;
        if (diff <= 0) continue;
        const w1 = i === 0 ? 0 : 0.5;
        const w2 = i + 1 === nodes - 1 ? 0 : 0.5;
        const s = w1 + w2 || 1;
        p1.addScaledVector(P, (diff * w1) / s);
        p2.addScaledVector(P, (-diff * w2) / s);
      }
    }
    // draw it
    curve.points = pts.map((n) => n.p);
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      curve.getPointAt(u, P);
      curve.getTangentAt(u, T);
      N.crossVectors(T, up).normalize();
      if (N.lengthSq() < 1e-6) N.set(1, 0, 0);
      B.crossVectors(T, N).normalize();
      for (let j = 0; j <= sides; j++) {
        const a2 = (j / sides) * Math.PI * 2;
        const cx = Math.cos(a2);
        const sx = Math.sin(a2);
        const k = (i * ringN + j) * 3;
        nor[k] = N.x * cx + B.x * sx;
        nor[k + 1] = N.y * cx + B.y * sx;
        nor[k + 2] = N.z * cx + B.z * sx;
        pos[k] = P.x + nor[k] * radius;
        pos[k + 1] = P.y + nor[k + 1] * radius;
        pos[k + 2] = P.z + nor[k + 2] * radius;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.computeBoundingSphere();
  };
  return { mesh, step, reset, points: pts, end: () => pts[nodes - 2].p };
}

// ── pads ─────────────────────────────────────────────────────────────────────
// The markings: a circle, the A in it, hazard stripes round the edge.
export function padTexture() {
  return canvasTexture(1024, 1024, (x, w) => {
    x.clearRect(0, 0, w, w);
    const c = w / 2;
    // hazard border
    const bw = w * 0.045;
    x.save();
    x.beginPath();
    x.rect(0, 0, w, w);
    x.rect(bw, bw, w - bw * 2, w - bw * 2);
    x.clip('evenodd');
    x.fillStyle = 'rgba(230,180,40,0.92)';
    x.fillRect(0, 0, w, w);
    x.fillStyle = 'rgba(20,20,20,0.92)';
    for (let i = -w; i < w * 2; i += w / 14) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + w / 28, 0);
      x.lineTo(i + w / 28 - w, w);
      x.lineTo(i - w, w);
      x.closePath();
      x.fill();
    }
    x.restore();
    // the touchdown circle
    x.strokeStyle = 'rgba(240,240,236,0.9)';
    x.lineWidth = w * 0.022;
    x.beginPath();
    x.arc(c, c, w * 0.34, 0, Math.PI * 2);
    x.stroke();
    x.lineWidth = w * 0.008;
    x.beginPath();
    x.arc(c, c, w * 0.29, 0, Math.PI * 2);
    x.stroke();
    // the A
    x.globalAlpha = 0.85;
    x.drawImage(logoTexture(512, { color: '#f2f2ee' }).image, c - w * 0.22, c - w * 0.22, w * 0.44, w * 0.44);
    x.globalAlpha = 1;
    // aiming marks
    x.fillStyle = 'rgba(240,240,236,0.9)';
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      x.save();
      x.translate(c + dx * w * 0.4, c + dy * w * 0.4);
      x.fillRect(-w * 0.012 - (dx ? w * 0.03 : 0), -w * 0.012 - (dy ? w * 0.03 : 0), w * 0.024 + (dx ? w * 0.06 : 0), w * 0.024 + (dy ? w * 0.06 : 0));
      x.restore();
    }
  });
}

// A windsock: its pole, and the sock, which points downwind and droops in a
// calm. The sock's geometry has its mouth at the origin and runs along +x.
export function windsockGeometries() {
  const pole = new PartBuilder();
  pole.add('pole', new THREE.CylinderGeometry(0.06, 0.08, 5.2, 8).translate(0, 2.6, 0));
  pole.add('pole', new THREE.TorusGeometry(0.34, 0.03, 6, 16).rotateY(Math.PI / 2), { p: [0, 5.15, 0] });
  const sock = new THREE.CylinderGeometry(0.34, 0.14, 2.6, 16, 6, true).rotateZ(Math.PI / 2).translate(1.3, 0, 0);
  // stripes: u round, v along
  const p = sock.attributes.position;
  const uv = sock.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setY(i, p.getX(i) / 2.6);
  return { pole: pole.geometries().pole, sock };
}
export function windsockTexture() {
  return canvasTexture(64, 256, (x, w, h) => {
    for (let i = 0; i < 5; i++) {
      x.fillStyle = i % 2 ? '#f4f1ea' : '#ef5a1c';
      x.fillRect(0, (i * h) / 5, w, h / 5);
    }
  });
}

// ── the gantry ───────────────────────────────────────────────────────────────
// A steel truss tower beside the way, its boom reaching across it at the
// rules' height (its bottom chord is the girder you mustn't hit).
export function buildGantry(mats, { lite = false } = {}) {
  const g = new THREE.Group();
  g.name = 'gantry';
  const b = new PartBuilder();
  const beam = (a, c2, t = 0.28, key = 'steel') => {
    const d = new THREE.Vector3().subVectors(c2, a);
    const len = d.length();
    const geo = new THREE.BoxGeometry(t, len, t).translate(0, len / 2, 0);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    geo.translate(a.x, a.y, a.z);
    b.add(key, geo);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const TZ = -17; // the tower, behind the way
  const TH = 31;
  const s = 1.7;
  // the tower: four legs, ties and cross-bracing
  for (const [ax, az] of [
    [-s, -s],
    [s, -s],
    [s, s],
    [-s, s],
  ])
    beam(V(ax, 0, TZ + az), V(ax * 0.85, TH, TZ + az * 0.85), 0.42);
  for (let y = 0; y < TH - 1; y += 3.4) {
    const k = 1 - (y / TH) * 0.15;
    const k2 = 1 - ((y + 3.4) / TH) * 0.15;
    const c = [
      [-s, -s],
      [s, -s],
      [s, s],
      [-s, s],
    ];
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = c[i];
      const [x2, z2] = c[(i + 1) % 4];
      beam(V(x1 * k, y, TZ + z1 * k), V(x2 * k, y, TZ + z2 * k), 0.16);
      if (!lite || i % 2 === 0) beam(V(x1 * k, y, TZ + z1 * k), V(x2 * k2, y + 3.4, TZ + z2 * k2), 0.12);
    }
  }
  // the boom: a box truss from the tower out over the way
  const y0 = GANTRY.y + 0.15;
  const y1 = GANTRY.y + GANTRY.h - 0.15;
  const hw = GANTRY.w / 2 - 0.15;
  const z0 = TZ - 2;
  const z1 = 8;
  for (const x of [-hw, hw]) {
    beam(V(x, y0, z0), V(x, y0, z1), 0.3, 'hazard');
    beam(V(x, y1, z0), V(x, y1, z1), 0.3);
  }
  for (let z = z0; z <= z1 + 0.01; z += 2.5) {
    beam(V(-hw, y0, z), V(hw, y0, z), 0.14, 'hazard');
    beam(V(-hw, y1, z), V(hw, y1, z), 0.14);
    for (const x of [-hw, hw]) beam(V(x, y0, z), V(x, y1, z), 0.14);
    if (z + 2.5 <= z1 + 0.01) for (const x of [-hw, hw]) beam(V(x, y0, z), V(x, y1, z + 2.5), 0.1);
  }
  // a walkway and the cab
  b.add('steel', new THREE.BoxGeometry(GANTRY.w - 0.6, 0.08, z1 - z0), { p: [0, y1 + 0.2, (z0 + z1) / 2] });
  b.add('cab', rbox(3.2, 2.6, 3.2, 0.12), { p: [0, 19.5, TZ + 2.6] });
  // footings
  b.add('concrete', new THREE.BoxGeometry(5, 0.8, 5), { p: [0, 0.2, TZ] });
  const mesh = b.build(mats);
  g.add(mesh);
  // the cab's windows, the warning beacons at the boom's end, floodlights under it
  const lamps = [];
  const glow = (color, k) => new THREE.MeshBasicMaterial({ color: hot(color, k), toneMapped: false });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), glow(0xffd7a0, 0.6));
  win.position.set(0, 20.0, TZ + 4.22);
  g.add(win);
  const beaconMat = glow(0xff2a1a, 3);
  for (const x of [-hw, hw]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), beaconMat);
    m.position.set(x, y1 + 0.35, z1);
    g.add(m);
    lamps.push(m);
  }
  const flood = glow(0xfff1d8, 2.2);
  for (const z of [-6, 2]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.6), flood);
    m.position.set(0, y0 - 0.2, z);
    g.add(m);
  }
  g.traverse((o) => {
    if (o.isMesh && o.material.type !== 'MeshBasicMaterial') {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group: g, beaconMat };
}

// hazard stripes, for girders
export function hazardTexture() {
  return canvasTexture(
    256,
    64,
    (x, w, h) => {
      x.fillStyle = '#e6b422';
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#18181a';
      for (let i = -h; i < w + h; i += 64) {
        x.beginPath();
        x.moveTo(i, 0);
        x.lineTo(i + 32, 0);
        x.lineTo(i + 32 - h, h);
        x.lineTo(i - h, h);
        x.closePath();
        x.fill();
      }
    },
    { repeat: [1, 1] },
  );
}

// ── the hangar ───────────────────────────────────────────────────────────────
// Steel portal frames under a pitched roof, clad in corrugated iron; its end
// toward the way stands open (the doors slid back), and so does the long
// side facing you, so you see in. Lit warm inside. The roof's underside is at
// the rules' height across the way.
export function buildHangar(mats, { lite = false } = {}) {
  const g = new THREE.Group();
  g.name = 'hangar';
  const { x0, x1, roof } = HANGAR;
  const zb = -34; // the back (far) wall
  const zf = 18; // the open front
  const eave = roof + 1.6;
  const ridge = roof + 9;
  const zr = (zb + zf) / 2;
  const b = new PartBuilder();
  const beam = (a, c2, t = 0.5, key = 'frame') => {
    const d = new THREE.Vector3().subVectors(c2, a);
    const len = d.length();
    const geo = new THREE.BoxGeometry(t, len, t * 1.4).translate(0, len / 2, 0);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    geo.translate(a.x, a.y, a.z);
    b.add(key, geo);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // portal frames every 11 m: columns at front and back, rafters to the ridge, a tie at the roof's height
  const frames = [];
  for (let x = x0 + 0.5; x <= x1 - 1; x += 11) frames.push(x);
  frames.push(x1 - 2.2);
  for (const x of frames) {
    // columns along the back only: the front is one long span over the doors
    beam(V(x, 0, zb + 0.6), V(x, eave, zb + 0.6), 0.6);
    beam(V(x, eave, zb + 0.6), V(x, ridge, zr), 0.5);
    beam(V(x, eave, zf - 0.4), V(x, ridge, zr), 0.5);
    // the bottom chord: the line you fly under
    beam(V(x, roof + 0.25, zb + 0.6), V(x, roof + 0.25, zf - 0.4), 0.36);
    for (let k = 1; k < 6; k++) {
      const z = lerp(zb + 0.6, zf - 0.4, k / 6);
      const yTop = z < zr ? lerp(eave, ridge, (z - zb) / (zr - zb)) : lerp(ridge, eave, (z - zr) / (zf - zr));
      beam(V(x, roof + 0.25, z), V(x, yTop, z), 0.2);
    }
  }
  // purlins along the roof
  for (let k = 0; k <= 6; k++) {
    for (const [za, ya] of [
      [lerp(zb + 0.6, zr, k / 6), lerp(eave, ridge, k / 6)],
      [lerp(zf - 0.4, zr, k / 6), lerp(eave, ridge, k / 6)],
    ])
      beam(V(x0, ya + 0.3, za), V(x1, ya + 0.3, za), 0.22);
  }
  // the header over the open end, and its fascia
  b.add('clad', new THREE.BoxGeometry(0.4, ridge - roof, zf - zb), { p: [x0 - 1.4, (roof + ridge) / 2 + 0.4, zr] });
  b.add('frame', new THREE.BoxGeometry(0.9, 1.0, zf - zb + 1), { p: [x0 - 1.4, roof + 0.5, zr] });
  // the end doors, slid back behind the far wall; the front's, to the far end
  for (const z of [zb + 2.8, zb + 3.5]) b.add('door', new THREE.BoxGeometry(0.5, roof, 5.6), { p: [x0 - 1.2 + (z - zb - 2.8) * 1.2, roof / 2, z - 5] });
  for (const k of [0, 1]) b.add('door', new THREE.BoxGeometry(5.6, roof, 0.45), { p: [x1 - 3.2 - k * 0.2, roof / 2, zf + 0.5 + k * 0.6] });
  // the long span over the front: a deep truss on two end posts
  b.add('frame', new THREE.BoxGeometry(x1 - x0 + 3, 1.6, 0.8), { p: [(x0 + x1) / 2, roof + 0.8, zf - 0.4] });
  b.add('frame', new THREE.BoxGeometry(x1 - x0 + 3, 0.5, 0.8), { p: [(x0 + x1) / 2, eave + 0.2, zf - 0.4] });
  for (let x = x0; x < x1; x += 3) beam(V(x, roof + 1.6, zf - 0.4), V(x + 3, eave, zf - 0.4), 0.18);
  beam(V(x1 + 0.6, 0, zf - 0.4), V(x1 + 0.6, eave, zf - 0.4), 0.9);
  // the floor, a kerb round it
  b.add('kerb', new THREE.BoxGeometry(x1 - x0 + 4, 0.3, 0.5), { p: [(x0 + x1) / 2, 0.05, zf + 1.2] });
  const mesh = b.build(mats);
  g.add(mesh);

  // cladding: the back wall, the far end, the roof (inside faces lit)
  const clad = (w, h, pos, rotY, rep) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.clad);
    m.position.copy(pos);
    m.rotation.y = rotY;
    m.receiveShadow = true;
    m.castShadow = true;
    if (rep) {
      // nothing: one material, tiled by its texture's own repeat
    }
    return m;
  };
  g.add(clad(x1 - x0 + 2, eave, V((x0 + x1) / 2, eave / 2, zb), 0));
  g.add(clad(zf - zb, ridge, V(x1 + 0.2, ridge / 2, zr), -Math.PI / 2));
  // the roof: two slopes
  const slopeLen = Math.hypot(zr - zb, ridge - eave);
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 4, slopeLen + 1), mats.roof);
    const zc = side < 0 ? (zb + zr) / 2 : (zf + zr) / 2;
    m.position.set((x0 + x1) / 2, (eave + ridge) / 2 + 0.6, zc);
    m.rotation.set(-Math.PI / 2 + side * Math.atan2(ridge - eave, zr - zb) * -1, 0, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  // the floor slab and its markings
  const floor = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 2, 0.3, zf - zb + 2), mats.floor);
  floor.position.set((x0 + x1) / 2, -0.13, zr);
  floor.receiveShadow = true;
  g.add(floor);
  const lines = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, zf - zb).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: hangarFloorTexture(), transparent: true, roughness: 0.6, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  lines.position.set((x0 + x1) / 2, 0.035, zr);
  lines.receiveShadow = true;
  g.add(lines);

  // the A on the back wall, lit
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshStandardMaterial({ map: logoTexture(512, { color: '#e8eef6' }), transparent: true, emissive: 0xffffff, emissiveIntensity: 0.5, emissiveMap: logoTexture(512, { color: '#e8eef6' }), roughness: 0.5, metalness: 0, depthWrite: false }));
  logo.position.set(x0 + 30, 14.5, zb + 0.15);
  g.add(logo);

  // lights: rows of high-bay lamps under the tie beams
  const lampMat = new THREE.MeshBasicMaterial({ color: hot(0xfff0d8, 2.6), toneMapped: false });
  const lampGeo = new THREE.CylinderGeometry(0.55, 0.85, 0.5, 16, 1, true);
  const lampN = frames.length * 3;
  const lamps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 16), lampMat, lampN);
  const shades = new THREE.InstancedMesh(lampGeo, mats.frame, lampN);
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (const x of frames)
    for (const z of [-22, -8, 6]) {
      m4.makeTranslation(x + 5.5, roof - 1.0, z);
      shades.setMatrixAt(n, m4);
      m4.makeTranslation(x + 5.5, roof - 1.26, z);
      lamps.setMatrixAt(n, m4);
      n++;
    }
  g.add(lamps, shades);
  // a band of windows high on the back wall
  const band = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 4, 2.2), new THREE.MeshBasicMaterial({ color: hot(0xbfd8ff, lite ? 0.5 : 0.7), toneMapped: false }));
  band.position.set((x0 + x1) / 2, eave - 2.4, zb + 0.12);
  g.add(band);

  g.traverse((o) => {
    if (o.isMesh && o.material.type !== 'MeshBasicMaterial' && !o.material.transparent) {
      o.castShadow = o.castShadow || o.parent === mesh;
      o.receiveShadow = true;
    }
  });
  return { group: g, frames, zb, zf };
}

function hangarFloorTexture() {
  return canvasTexture(1024, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.strokeStyle = 'rgba(232,186,48,0.85)';
    x.lineWidth = 6;
    // a taxi line in from the door, bays along the back
    x.beginPath();
    x.moveTo(0, h * 0.62);
    x.lineTo(w, h * 0.62);
    x.stroke();
    x.setLineDash([24, 18]);
    x.beginPath();
    x.moveTo(0, h * 0.66);
    x.lineTo(w, h * 0.66);
    x.stroke();
    x.setLineDash([]);
    x.strokeStyle = 'rgba(235,235,230,0.55)';
    x.lineWidth = 4;
    for (let i = 1; i < 6; i++) {
      x.beginPath();
      x.moveTo((i * w) / 6, 0);
      x.lineTo((i * w) / 6, h * 0.3);
      x.stroke();
    }
  });
}

// ── rain ─────────────────────────────────────────────────────────────────────
// Streaks falling in a box that follows the camera, slanted by the wind, and
// kept out of the hangar.
export function buildRain({ count = 3500, size = [90, 60, 70], calm = false } = {}) {
  const pos = new Float32Array(count * 2 * 3);
  const seed = new Float32Array(count * 2);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * size[0];
    const y = Math.random() * size[1];
    const z = (Math.random() - 0.5) * size[2];
    const s = Math.random();
    for (let k = 0; k < 2; k++) {
      pos.set([x, y, z], (i * 2 + k) * 3);
      seed[i * 2 + k] = s;
      end[i * 2 + k] = k;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('end', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uSize: { value: new THREE.Vector3(...size) },
      uSpeed: { value: calm ? 9 : 21 },
      uWind: { value: 0 },
      uFlash: { value: 0 },
      uOpacity: { value: 1 },
      uBoxMin: { value: new THREE.Vector3(HANGAR.x0 - 1.5, -5, -34) },
      uBoxMax: { value: new THREE.Vector3(HANGAR.x1 + 2, HANGAR.roof + 10, 18) },
    },
    vertexShader: /* glsl */ `
      attribute float seed;
      attribute float end;
      uniform float uTime, uSpeed, uFlash, uWind, uOpacity;
      uniform vec3 uCenter, uSize, uBoxMin, uBoxMax;
      varying float vA;
      void main() {
        vec3 p = position;
        float fall = uTime * uSpeed * (0.85 + seed * 0.3);
        p.y = mod(p.y - fall, uSize.y);
        p.x += uWind * (uSize.y - p.y) / uSpeed;
        p.xz = mod(p.xz - uCenter.xz + uSize.xz * 0.5, uSize.xz) - uSize.xz * 0.5 + uCenter.xz;
        p.y += uCenter.y - uSize.y * 0.45;
        vec3 dir = normalize(vec3(-uWind, uSpeed, 0.0));
        p += dir * end * 0.9;
        float near = smoothstep(2.0, 9.0, distance(p, cameraPosition));
        vec3 inside = step(uBoxMin, p) * step(p, uBoxMax);
        float sheltered = inside.x * inside.y * inside.z;
        vA = (0.2 + uFlash * 0.35) * (0.5 + seed * 0.5) * (1.0 - end * 0.85) * near * (1.0 - sheltered) * uOpacity;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() { gl_FragColor = vec4(0.74, 0.8, 0.92, vA); }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 9;
  return { lines, mat };
}

// ── wind made visible ────────────────────────────────────────────────────────
// Long faint streaks that ride the wind past the camera, more in a gust.
export function buildStreaks({ count = 160 } = {}) {
  const pos = new Float32Array(count * 2 * 3);
  const seed = new Float32Array(count * 2);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random();
    const y = Math.random();
    const z = Math.random();
    const s = Math.random();
    for (let k = 0; k < 2; k++) {
      pos.set([x, y, z], (i * 2 + k) * 3);
      seed[i * 2 + k] = s;
      end[i * 2 + k] = k;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('end', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(140, 60, 60) }, uWind: { value: 0 }, uAmount: { value: 0 }, uTint: { value: new THREE.Color(0xfff2dc) } },
    vertexShader: /* glsl */ `
      attribute float seed;
      attribute float end;
      uniform float uTime, uWind, uAmount;
      uniform vec3 uCenter, uSize;
      varying float vA;
      void main() {
        vec3 p = position * uSize - uSize * 0.5;
        float speed = uWind * (1.3 + seed);
        p.x = mod(p.x + uTime * speed + seed * 400.0, uSize.x) - uSize.x * 0.5;
        p.y += sin(uTime * 0.7 + seed * 30.0) * 1.5;
        p += uCenter;
        // a streak is as long as the wind is strong
        p.x -= end * clamp(abs(uWind), 0.0, 14.0) * 0.55 * sign(uWind);
        float show = step(seed, uAmount);
        float edge = smoothstep(0.0, 0.25, fract((p.x - uCenter.x) / uSize.x + 0.5)) * smoothstep(1.0, 0.75, fract((p.x - uCenter.x) / uSize.x + 0.5));
        vA = show * edge * (1.0 - end) * 0.16;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      varying float vA;
      void main() { gl_FragColor = vec4(uTint * vA, vA); }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 8;
  return { lines, mat };
}

// A leaf, painted once, for the gusts to carry.
export function leafTexture() {
  return canvasTexture(64, 64, (x) => {
    x.clearRect(0, 0, 64, 64);
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.moveTo(32, 4);
    x.quadraticCurveTo(58, 26, 32, 60);
    x.quadraticCurveTo(6, 26, 32, 4);
    x.fill();
  });
}

export { smooth, clamp, lerp };
