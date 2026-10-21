// The places, modelled in code (all original designs): the Guardians of
// the Globe's hall on the plaza downtown (a colonnade under a frieze with
// their name, a dome, a golden globe on top), the GDA's block on the east
// bank (an office in smoked glass that says it's a records annex, a hangar
// with a curved roof, a black helicopter on the pad, a radar dish, a fence),
// the high school (brick, a portico, the flag, the field's goalposts and
// bleachers), Burger Mart on the strip (its sign up on a pylon, a
// drive-thru), and the Graysons' front porch, mailbox and Mom's car.
// Each is merged by material, so the lot is a handful of draws. Over the
// five places, a beacon each, to find them by from across the city.

import * as THREE from 'three';
import { PartBuilder, canvasTexture } from '../../avengers/hq/kit/shapes';
import { hot } from '../../avengers/hq/stage';
import { SKIN, towerField, towerMaterial } from './facade';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, s = 16) => new THREE.CylinderGeometry(r0, r1, h, s);

// The five places' beacons: a thin upright light over each, `h` metres
// tall, or `clear` metres over the tallest tower within `round` metres of it
// if that's taller (downtown stands 360 m high round the hall), to find them
// by from 3 km off. Each is one quad turned about its own upright to face
// the camera, `w` metres across but never under `px` pixels (a light a few
// metres across is under a pixel at 3 km), white down the middle and the
// compass's yellow at its edges, even up to `fade` of its height and then
// fading to nothing at the top, and gone within `near` metres (so at the
// door it isn't a wall of light in his face). Faint by day (`day`), bright
// at night (`night`). No light, no shadow: five quads in one draw, added
// to what's behind.
export const BEACON = { h: 400, clear: 150, round: 300, w: 3, px: 4, fade: 0.55, near: [80, 260], core: 0xfff4d6, edge: 0xffd23a, day: 0.6, night: 2.2 };

const BEACON_VS = /* glsl */ `
attribute vec3 aCorner; // (across, up, and the beacon's height)
uniform float uW, uPx;
varying vec2 vC;
varying float vD;
void main() {
  vec3 base = (modelMatrix * vec4(position, 1.0)).xyz;
  // how far off the upright is at its nearest, and how wide that makes it
  vec3 axis = vec3(base.x, clamp(cameraPosition.y, base.y, base.y + aCorner.z), base.z);
  float d = length(cameraPosition - axis);
  float w = max(uW, d * uPx);
  vec2 to = cameraPosition.xz - base.xz;
  vec2 side = length(to) > 1e-3 ? normalize(vec2(-to.y, to.x)) : vec2(1.0, 0.0);
  vec3 p = base + vec3(side.x * aCorner.x * w * 0.5, aCorner.y * aCorner.z, side.y * aCorner.x * w * 0.5);
  vC = aCorner.xy;
  vD = d;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const BEACON_FS = /* glsl */ `
uniform vec3 uCore, uEdge;
uniform float uK, uFade;
uniform vec2 uNear;
varying vec2 vC;
varying float vD;
void main() {
  float across = 1.0 - abs(vC.x);
  vec3 c = mix(uEdge, uCore, across * across);
  float k = across * (1.0 - smoothstep(uFade, 1.0, vC.y)) * smoothstep(uNear.x, uNear.y, vD);
  gl_FragColor = vec4(c * k * uK, 1.0);
}`;

// The beacons over `places` ([{ x, z }]), standing on the town's ground,
// clear of `buildings` ([{ x, z, h, top }]) round them.
function beacons(places, buildings) {
  const pos = [];
  const corner = [];
  const index = [];
  places.forEach((p, i) => {
    let tall = 0;
    for (const b of buildings) if (Math.hypot(b.x - p.x, b.z - p.z) < BEACON.round) tall = Math.max(tall, b.h + (b.top?.h ?? 0));
    const h = Math.max(BEACON.h, tall + BEACON.clear);
    for (const [cx, cy] of [
      [-1, 0],
      [1, 0],
      [1, 1],
      [-1, 1],
    ]) {
      pos.push(p.x, 0, p.z);
      corner.push(cx, cy, h);
    }
    const o = i * 4;
    index.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 3));
  geo.setIndex(index);
  const uniforms = {
    uW: { value: BEACON.w },
    uFade: { value: BEACON.fade },
    uPx: { value: 0 },
    uK: { value: BEACON.day },
    uNear: { value: new THREE.Vector2(...BEACON.near) },
    uCore: { value: new THREE.Color(BEACON.core) },
    uEdge: { value: new THREE.Color(BEACON.edge) },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: BEACON_VS, fragmentShader: BEACON_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'beacons';
  // (the shader puts the quads where they are: the bases alone would cull them)
  mesh.frustumCulled = false;
  mesh.userData.noBake = true;
  // metres a pixel spans, a metre off, times the fewest pixels across: from
  // the camera and the canvas it's drawn into, as it's drawn
  const size = new THREE.Vector2();
  mesh.onBeforeRender = (renderer, scene, camera) => {
    renderer.getDrawingBufferSize(size);
    const half = camera.isPerspectiveCamera ? Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / (camera.zoom || 1) : 0.6;
    uniforms.uPx.value = ((2 * half) / Math.max(1, size.y)) * BEACON.px;
  };
  return { mesh, uniforms };
}

// lettering on a sign: dark on light or the other way, in the show's face
export function sign(text, { w = 1024, h = 160, bg = '#0e1a33', fg = '#ffd23a', font = 'Bebas Neue', size = 0.78, stroke = null } = {}) {
  return canvasTexture(w, h, (x) => {
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.font = `400 ${Math.round(h * size)}px "${font}", Impact, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    if (stroke) {
      x.lineWidth = h * 0.08;
      x.strokeStyle = stroke;
      x.strokeText(text, w / 2, h * 0.54);
    }
    x.fillStyle = fg;
    x.fillText(text, w / 2, h * 0.54);
  });
}

// a car from boxes: body, cabin, wheels (the front toward +z)
function addCar(b, key, { x, z, yaw = 0, len = 4.6, wid = 1.85 }) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const at = (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
  b.add(key, box(wid, 0.75, len), { p: at(0, 0.62, 0), r: [0, yaw, 0] });
  b.add('glass', box(wid * 0.92, 0.62, len * 0.5), { p: at(0, 1.3, -0.15), r: [0, yaw, 0] });
  for (const [lx, lz] of [
    [wid / 2 - 0.1, len * 0.32],
    [-wid / 2 + 0.1, len * 0.32],
    [wid / 2 - 0.1, -len * 0.32],
    [-wid / 2 + 0.1, -len * 0.32],
  ])
    b.add('tyre', cyl(0.36, 0.36, 0.26, 12), { p: at(lx, 0.36, lz), r: [0, yaw, Math.PI / 2] });
}

export async function buildLandmarks(world, uniforms) {
  // the lettering wants the show's face loaded first
  try {
    await Promise.race([document.fonts?.load('400 64px "Bebas Neue"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* the fallback face will do */
  }
  const group = new THREE.Group();
  group.name = 'landmarks';
  const L = Object.fromEntries(world.landmarks.map((l) => [l.id, l]));
  const b = new PartBuilder();
  const mats = {
    stone: new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.75 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x8f877a, roughness: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1b2a36, roughness: 0.08, metalness: 0.9 }),
    dome: new THREE.MeshStandardMaterial({ color: 0x6fa3b4, roughness: 0.25, metalness: 0.75 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe6b84a, roughness: 0.28, metalness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x9a9893, roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x5d6168, roughness: 0.45, metalness: 0.7 }),
    black: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.35, metalness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.7 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc8322a, roughness: 0.6 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf2b632, roughness: 0.55 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8a6b4c, roughness: 0.85 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.9 }),
    car: new THREE.MeshStandardMaterial({ color: 0x9a3b34, roughness: 0.35, metalness: 0.5 }),
    heli: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.4, metalness: 0.5 }),
    lamp: new THREE.MeshBasicMaterial({ color: hot(0xfff1c8, 2.4), toneMapped: false }),
  };

  // ── the Guardians of the Globe's hall ──
  {
    const { x, z } = L.guardians;
    const H = 16;
    // the podium and the steps up to the doors, on the south
    b.add('stoneDark', box(36, 1.2, 36), { p: [x, 0.6, z] });
    for (let i = 0; i < 4; i++) b.add('stone', box(14 - i * 0.6, 0.3, 1.2), { p: [x, 0.15 + i * 0.3, z + 18.6 + (3 - i) * 0.6] });
    // the hall: glass behind a colonnade
    b.add('glass', box(30, H - 4, 30), { p: [x, 1.2 + (H - 4) / 2, z] });
    b.add('stone', box(34, 2.8, 34), { p: [x, H - 1.4, z] }); // the frieze
    b.add('stone', box(35, 0.6, 35), { p: [x, H + 0.3, z] }); // the cornice
    for (let i = 0; i < 9; i++) {
      const k = -15 + i * (30 / 8);
      for (const [px, pz] of [
        [x + k, z + 16.2],
        [x + k, z - 16.2],
        [x + 16.2, z + k],
        [x - 16.2, z + k],
      ])
        b.add('stone', cyl(0.75, 0.85, H - 4.2, 14), { p: [px, 1.2 + (H - 4.2) / 2, pz] });
    }
    // the drum, the dome, and the globe on top with its ring
    b.add('stone', cyl(9, 9, 4, 40), { p: [x, H + 2.6, z] });
    const dome = new THREE.SphereGeometry(8.6, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    b.add('dome', dome, { p: [x, H + 4.6, z] });
    b.add('gold', cyl(0.5, 0.8, 2, 10), { p: [x, H + 13.8, z] });
    b.add('gold', new THREE.SphereGeometry(2.6, 28, 18), { p: [x, H + 17.4, z] });
    b.add('gold', new THREE.TorusGeometry(3.8, 0.22, 8, 48), { p: [x, H + 17.4, z], r: [Math.PI / 2 - 0.4, 0, 0.3] });
    // their name over the doors
    const name = new THREE.Mesh(new THREE.PlaneGeometry(26, 2.2), new THREE.MeshStandardMaterial({ map: sign('GUARDIANS OF THE GLOBE', { bg: '#d9d2c3', fg: '#1d2b4a', size: 0.86 }), roughness: 0.7 }));
    name.position.set(x, H - 1.4, z + 17.02);
    group.add(name);
    // lamps along the plaza
    for (const [px, pz] of [
      [-24, 24],
      [24, 24],
      [-24, -24],
      [24, -24],
    ]) {
      b.add('steel', cyl(0.12, 0.16, 5, 8), { p: [x + px, 2.5, z + pz] });
      b.add('lamp', new THREE.SphereGeometry(0.35, 10, 8), { p: [x + px, 5.2, z + pz] });
    }
  }

  // ── the GDA ──
  {
    const o = L['gda-office'];
    const g = L['gda-hangar'];
    const pad = L['gda-pad'];
    // the office: smoked glass between concrete fins, a roof of plant and a radar dish
    b.add('glass', box(o.w - 0.6, o.h, o.d - 0.6), { p: [o.x, o.h / 2, o.z] });
    for (let i = 0; i <= 10; i++) b.add('concrete', box(0.6, o.h + 0.6, 0.9), { p: [o.x - o.w / 2 + (i * o.w) / 10, (o.h + 0.6) / 2, o.z + o.d / 2] });
    for (let i = 0; i <= 10; i++) b.add('concrete', box(0.6, o.h + 0.6, 0.9), { p: [o.x - o.w / 2 + (i * o.w) / 10, (o.h + 0.6) / 2, o.z - o.d / 2] });
    b.add('concrete', box(o.w + 0.6, 0.8, o.d + 0.6), { p: [o.x, o.h + 0.4, o.z] });
    b.add('steel', box(5, 2.2, 4), { p: [o.x - 8, o.h + 1.9, o.z] });
    b.add('steel', cyl(0.25, 0.3, 3, 8), { p: [o.x + 9, o.h + 2.3, o.z] });
    const dish = new THREE.SphereGeometry(2.4, 24, 8, 0, Math.PI * 2, 0, Math.PI / 3);
    b.add('white', dish, { p: [o.x + 9, o.h + 5.2, o.z], r: [-0.9, 0, 0] });
    b.add('concrete', box(6, 3, 1.2), { p: [o.x, 1.5, o.z + o.d / 2 + 1.8] }); // the entrance's canopy wall
    const annex = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), new THREE.MeshStandardMaterial({ map: sign('FEDERAL RECORDS ANNEX', { bg: '#9a9893', fg: '#22252a', size: 0.7 }), roughness: 0.8 }));
    annex.position.set(o.x, 2.4, o.z + o.d / 2 + 2.42);
    group.add(annex);
    // the hangar: walls, a curved roof, its door toward the pad
    b.add('steel', box(g.w, g.h * 0.55, g.d), { p: [g.x, (g.h * 0.55) / 2, g.z] });
    const roof = new THREE.CylinderGeometry(g.d / 2, g.d / 2, g.w, 28, 1, false, 0, Math.PI);
    b.add('steel', roof, { p: [g.x, g.h * 0.55, g.z], r: [0, 0, Math.PI / 2], s: [1, 1, (g.h * 0.45) / (g.d / 2)] });
    b.add('black', box(g.w * 0.7, g.h * 0.5, 0.3), { p: [g.x, g.h * 0.25, g.z + g.d / 2 + 0.1] });
    // the helicopter on the pad
    const hx = pad.x;
    const hz = pad.z;
    b.add('heli', new THREE.SphereGeometry(1.5, 18, 12), { p: [hx, 1.6, hz], s: [1, 0.9, 1.9] });
    b.add('heli', box(0.5, 0.5, 6), { p: [hx, 1.9, hz - 4.2] });
    b.add('heli', box(0.12, 1.4, 0.9), { p: [hx, 2.5, hz - 7] });
    b.add('glass', new THREE.SphereGeometry(1.2, 16, 10), { p: [hx, 1.9, hz + 1.3], s: [1, 0.8, 1.1] });
    b.add('black', box(0.25, 0.12, 10), { p: [hx, 3.15, hz], r: [0, 0.6, 0] });
    b.add('black', box(0.25, 0.12, 10), { p: [hx, 3.15, hz], r: [0, 0.6 + Math.PI / 2, 0] });
    b.add('black', cyl(0.18, 0.18, 0.9, 8), { p: [hx, 2.7, hz] });
    for (const sx of [-1, 1]) b.add('black', box(0.12, 0.12, 3.4), { p: [hx + sx * 1.1, 0.1, hz] });
    // the fence round the block: posts and three wires
    const cx = Math.round(o.x / 80) * 80;
    const cz = Math.round(o.z / 80) * 80;
    for (const [x0, z0, x1, z1] of [
      [cx - 29, cz - 29, cx + 29, cz - 29],
      [cx - 29, cz + 29, cx + 29, cz + 29],
      [cx - 29, cz - 29, cx - 29, cz + 29],
      [cx + 29, cz - 29, cx + 29, cz + 29],
    ]) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const along = x1 !== x0;
      for (let i = 0; i <= len / 4; i++) b.add('steel', cyl(0.05, 0.05, 2.6, 6), { p: [x0 + (along ? i * 4 : 0), 1.3, z0 + (along ? 0 : i * 4)] });
      for (const y of [0.9, 1.7, 2.5]) b.add('steel', box(along ? len : 0.03, 0.03, along ? 0.03 : len), { p: [(x0 + x1) / 2, y, (z0 + z1) / 2] });
    }
  }

  // ── the high school, its flag and its field ──
  {
    const s = L.school;
    const schoolMesh = towerField([{ x: s.x, z: s.z, w: s.w, d: s.d, h: s.h, kind: SKIN.brick, tone: 0.35, seed: 0.42 }], towerMaterial(uniforms));
    schoolMesh.castShadow = true;
    schoolMesh.receiveShadow = true;
    group.add(schoolMesh);
    // the portico: four columns and a pediment over the doors
    for (let i = 0; i < 4; i++) b.add('white', cyl(0.5, 0.55, 8, 12), { p: [s.x - 4.5 + i * 3, 4, s.z + s.d / 2 + 2.6] });
    b.add('white', box(12, 1.2, 4), { p: [s.x, 8.6, s.z + s.d / 2 + 1.6] });
    const tri = new THREE.Shape([new THREE.Vector2(-6.6, 0), new THREE.Vector2(6.6, 0), new THREE.Vector2(0, 2.4)]);
    b.add('white', new THREE.ExtrudeGeometry(tri, { depth: 3.6, bevelEnabled: false }), { p: [s.x, 9.2, s.z + s.d / 2 - 0.2] });
    const nameS = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.9), new THREE.MeshStandardMaterial({ map: sign('HIGH SCHOOL', { bg: '#f2f2ee', fg: '#1d2b4a' }), roughness: 0.7 }));
    nameS.position.set(s.x, 8.6, s.z + s.d / 2 + 3.62);
    group.add(nameS);
    b.add('steel', cyl(0.08, 0.1, 12, 8), { p: [s.x + 14, 6, s.z + s.d / 2 + 6] });
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.4),
      new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        roughness: 0.8,
        map: canvasTexture(240, 140, (x) => {
          for (let i = 0; i < 7; i++) {
            x.fillStyle = i % 2 ? '#f4f4f0' : '#b22234';
            x.fillRect(0, i * 20, 240, 20);
          }
          x.fillStyle = '#3c3b6e';
          x.fillRect(0, 0, 100, 80);
        }),
      }),
    );
    flag.position.set(s.x + 15.25, 11.2, s.z + s.d / 2 + 6);
    group.add(flag);
    const f = L.field;
    for (const sz of [-1, 1]) {
      // the goalposts at each end
      const gx = f.x + sz * (f.w / 2 - 4);
      b.add('yellow', cyl(0.12, 0.12, 3, 8), { p: [gx, 1.5, f.z] });
      b.add('yellow', cyl(0.1, 0.1, 5.6, 8), { p: [gx, 3, f.z], r: [Math.PI / 2, 0, 0] });
      for (const pz of [-2.8, 2.8]) b.add('yellow', cyl(0.08, 0.08, 6, 8), { p: [gx, 6, f.z + pz] });
    }
    // the bleachers along the far side, looking back at the school
    for (let i = 0; i < 5; i++) b.add('steel', box(f.w * 0.6, 0.4, 1.2), { p: [f.x, 0.5 + i * 0.6, f.z + f.d / 2 + 1 + i * 1.1] });
  }

  // ── Burger Mart ──
  {
    const m = L.burgermart;
    b.add('red', box(m.w, m.h * 0.6, m.d), { p: [m.x, (m.h * 0.6) / 2, m.z] });
    b.add('glass', box(m.w + 0.05, m.h * 0.32, m.d - 4), { p: [m.x, m.h * 0.32, m.z] });
    b.add('yellow', box(m.w + 0.4, m.h * 0.3, m.d + 0.4), { p: [m.x, m.h * 0.75, m.z] });
    b.add('red', box(m.w + 0.8, 0.3, m.d + 0.8), { p: [m.x, m.h * 0.9 + 0.15, m.z] });
    // the drive-thru: a window and a menu board round the back
    b.add('yellow', box(1.6, 1.4, 0.2), { p: [m.x - m.w / 2 + 3, 1.4, m.z - m.d / 2 - 0.1] });
    b.add('black', box(0.2, 1.8, 2.4), { p: [m.x - m.w / 2 - 4, 1.6, m.z - m.d / 2 - 5] });
    // the sign up on its pylon, by the road
    const px = m.x + m.w / 2 + 8;
    const pz = m.z - m.d / 2 - 2;
    b.add('steel', cyl(0.35, 0.45, 12, 10), { p: [px, 6, pz] });
    const tex = sign('BURGER MART', { w: 512, h: 256, bg: '#c8322a', fg: '#ffd23a', size: 0.5, stroke: '#7a1712' });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.4, 6.8), [
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 }),
      mats.red,
      mats.red,
      mats.red,
      mats.red,
    ]);
    board.position.set(px, 13.4, pz);
    board.castShadow = true;
    board.userData.glows = true;
    group.add(board);
    const tex2 = sign('BURGER MART', { w: 1024, h: 160, bg: '#f2b632', fg: '#c8322a', size: 0.8 });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), new THREE.MeshStandardMaterial({ map: tex2, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex2, emissiveIntensity: 0 }));
    front.position.set(m.x + m.w / 2 + 0.22, m.h * 0.75, m.z);
    front.rotation.y = Math.PI / 2;
    front.userData.glows = true;
    group.add(front);
    // a car or two in its lot
    addCar(b, 'car', { x: m.x + m.w / 2 + 14, z: m.z + 8, yaw: Math.PI / 2 });
  }

  // ── the Graysons': the porch, the mailbox, Mom's car in the drive ──
  {
    const home = world.places.find((p) => p.id === 'home');
    const h = world.houses.find((q) => q.home);
    const s = h.yaw === 0 ? 1 : -1; // which way the front faces
    const fz = h.z + s * (h.d / 2);
    b.add('white', box(4.4, 0.25, 2.4), { p: [h.x, 2.9, fz + s * 1.2] });
    for (const dx of [-2, 2]) b.add('white', cyl(0.1, 0.1, 2.8, 8), { p: [h.x + dx, 1.4, fz + s * 2.3] });
    b.add('concrete', box(4.4, 0.3, 2.4), { p: [h.x, 0.15, fz + s * 1.2] });
    // the walk to the street
    b.add('concrete', box(1.2, 0.04, 6), { p: [h.x, 0.02, fz + s * 5.4] });
    // the mailbox, with the name on it
    b.add('steel', cyl(0.05, 0.05, 1.1, 6), { p: [h.x + 2.2, 0.55, home.door[1] + s * 2.4] });
    b.add('black', box(0.3, 0.3, 0.5), { p: [h.x + 2.2, 1.2, home.door[1] + s * 2.4] });
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.14), new THREE.MeshStandardMaterial({ map: sign('GRAYSON', { w: 256, h: 64, bg: '#15171b', fg: '#f2f2ee' }), roughness: 0.6 }));
    nm.position.set(h.x + 2.36, 1.2, home.door[1] + s * 2.4);
    nm.rotation.y = Math.PI / 2;
    group.add(nm);
    const dx = h.w >= 12 ? h.w * 0.5 - 2.7 : h.w * 0.5 + 1.8;
    addCar(b, 'car', { x: h.x + s * dx, z: fz + s * 4.2, yaw: s > 0 ? Math.PI : 0 });
  }

  group.add(b.build(mats));
  const glows = [];
  group.traverse((o) => o.userData.glows && glows.push(o));
  // the beacons (BEACON; see-through, so the floor's bake leaves them out)
  const lights = beacons(world.places, world.buildings);
  group.add(lights.mesh);
  return {
    group,
    setNight(k) {
      mats.lamp.color.copy(hot(0xfff1c8, 0.6 + 2 * k));
      for (const o of glows) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.emissiveMap) m.emissiveIntensity = k * 0.9;
      lights.uniforms.uK.value = BEACON.day + (BEACON.night - BEACON.day) * k;
    },
  };
}
