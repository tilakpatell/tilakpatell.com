// The city, drawn from ./map.js: every tower one instance of a box painted
// in the shader (./facade.js, one draw for the whole skyline), with
// what stands on the roofs; the suburbs' houses, each one instance of a
// box whose walls the shader paints with siding, windows, a front door and
// a garage door, under a hipped roof; the strip's shops; the trees (round
// ones in town, pines on the hills); the bridges over the river and its
// embankments. Lit windows and spire beacons at night.

import * as THREE from 'three';
import { hot } from '../../avengers/hq/stage';
import { SKIN, WINDOWS, towerField, towerMaterial } from './facade';
import { BRIDGES, COAST, BEACH, RIVER, groundAt, rng } from './map';
import { LAND } from './ground';
import { STAGES, heightOf } from './demolish';

const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const P = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// instanced copies of one geometry, placed by `place(row, matrix, i)`
function instances(group, geo, mat, rows, place, { shadow = true, color } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, rows.length));
  rows.forEach((row, i) => {
    mesh.setMatrixAt(i, place(row, M4, i));
    if (color) mesh.setColorAt(i, color(row, i));
  });
  mesh.count = rows.length;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
  return mesh;
}

// A hipped roof over a unit footprint (−0.5…0.5), 1 high, a ridge along x.
function hipRoof(ridge = 0.32) {
  const g = new THREE.BufferGeometry();
  const a = [-0.5, 0, -0.5];
  const b = [0.5, 0, -0.5];
  const c = [0.5, 0, 0.5];
  const d = [-0.5, 0, 0.5];
  const e = [-ridge, 1, 0];
  const f = [ridge, 1, 0];
  const tris = [a, e, f, a, f, b, b, f, c, c, f, e, c, e, d, d, e, a];
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

// The suburbs' houses: siding, two storeys of windows, a front door, a
// garage door on the wider ones, painted from where each point is on the
// house (its own metres, from the instance's size), the front toward +z.
function houseMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = uniforms.uNight;
    sh.uniforms.uTint = uniforms.uTint;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aHouse;\nattribute float aHurt;\nvarying vec3 vH;\nvarying vec3 vHN;\nflat varying vec4 vHouse;\nflat varying float vHurt;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vH = position * vec3(aHouse.x, aHouse.y, aHouse.z);
        vHN = normal;
        vHouse = aHouse;
        vHurt = aHurt;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        uniform vec3 uTint;
        varying vec3 vH;
        varying vec3 vHN;
        flat varying vec4 vHouse;
        flat varying float vHurt;
        float hh(float n) { return fract(sin(n * 91.7) * 43758.5); }
        float box2(vec2 f, vec4 r) { return step(r.x, f.x) * step(f.x, r.y) * step(r.z, f.y) * step(f.y, r.w); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float seed = vHouse.w;
        vec3 n = normalize(vHN);
        float front = step(0.5, n.z);
        float side = step(0.5, abs(n.x));
        float u = side > 0.5 ? vH.z * sign(n.x) : vH.x * sign(n.z + 0.001);
        float y = vH.y + vHouse.y * 0.5;
        float w = side > 0.5 ? vHouse.z : vHouse.x;
        // siding colours: white, cream, pale blue, sage, grey, butter, tan
        vec3 sid = vec3(0.86, 0.85, 0.8);
        float k = hh(seed * 7.0);
        if (k < 0.18) sid = vec3(0.86, 0.84, 0.78);
        else if (k < 0.32) sid = vec3(0.8, 0.74, 0.6);
        else if (k < 0.46) sid = vec3(0.58, 0.67, 0.74);
        else if (k < 0.6) sid = vec3(0.6, 0.66, 0.55);
        else if (k < 0.74) sid = vec3(0.56, 0.56, 0.56);
        else if (k < 0.86) sid = vec3(0.86, 0.78, 0.52);
        else sid = vec3(0.72, 0.6, 0.47);
        // the windows: two storeys, a column every 3 m; the door in the middle of the front
        float cols = max(1.0, floor(w / 3.0));
        float cu = (u + w * 0.5) / w * cols;
        vec2 f = vec2(fract(cu), y);
        float win = box2(f, vec4(0.28, 0.72, 0.95, 2.15)) + box2(f, vec4(0.28, 0.72, 3.6, 4.8));
        float garage = front * step(12.0, vHouse.x) * box2(vec2(u, y), vec4(vHouse.x * 0.5 - 4.2, vHouse.x * 0.5 - 1.2, 0.0, 2.4));
        float door = front * box2(vec2(u, y), vec4(-0.55, 0.55, 0.0, 2.2));
        win *= (1.0 - garage) * (1.0 - door) * (1.0 - step(0.6, n.y));
        float trim = (1.0 - win) * (box2(f, vec4(0.24, 0.76, 0.9, 2.2)) + box2(f, vec4(0.24, 0.76, 3.55, 4.85))) * (1.0 - step(0.6, n.y));
        vec3 glass = mix(vec3(0.08, 0.1, 0.13), vec3(0.18, 0.22, 0.26), hh(floor(cu) + seed));
        vec3 c = mix(sid, vec3(0.95), clamp(trim + garage * 0.85, 0.0, 1.0));
        c = mix(c, glass, win);
        c = mix(c, mix(vec3(0.42, 0.16, 0.12), vec3(0.15, 0.22, 0.35), hh(seed * 3.0)), door);
        // the bottom: a band of brick or stone
        c = mix(c, vec3(0.45, 0.32, 0.26), step(y, 0.45) * (1.0 - door) * (1.0 - garage));
        diffuseColor.rgb = pow(c, vec3(2.2));
        // the damage (./demolish.js): cracked siding, dark panes
        if (vHurt > 0.0) {
          float crack = step(1.0 - vHurt * 0.5, hh(floor(u * 1.3) * 7.0 + floor(y * 1.3) * 3.0 + seed)) * (1.0 - step(0.6, n.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.3, max(crack, vHurt * win * 0.7));
        }
        float houseWin = win;
        float houseCol = floor(cu);`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, houseWin);')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float lit = step(0.45, hh(houseCol * 3.1 + seed * 17.0 + step(3.0, y) * 5.0)) * houseWin * uNight;
        totalEmissiveRadiance += lit * vec3(1.0, 0.72, 0.42) * ${(0.6 * WINDOWS.light).toFixed(3)};
        diffuseColor.rgb *= 1.0 - 0.4 * uNight * (1.0 - houseWin);
        diffuseColor.rgb *= uTint;`,
      );
  };
  m.customProgramCacheKey = () => 'inv-house';
  return m;
}

export function buildCity(world, { small = false } = {}) {
  const group = new THREE.Group();
  group.name = 'city';
  const uniforms = { uNight: { value: 0 }, uBurn: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) } };
  const r = rng(29);

  // ── the towers ──
  const facade = towerMaterial(uniforms);
  const list = [];
  const index = new Map(); // `b:<id>` → its instances in `list` (the base first, a top piece after)
  for (const b of world.buildings) {
    const style = { kind: SKIN[b.kind], tone: b.tone, seed: (b.id * 0.6180339) % 1 };
    index.set(`b:${b.id}`, b.top ? [list.length, list.length + 1] : [list.length]);
    list.push({ x: b.x, z: b.z, w: b.w, d: b.d, h: b.h, ...style });
    if (b.top) list.push({ x: b.x, y: b.h, z: b.z, w: b.top.w, d: b.top.d, h: b.top.h, ...style });
  }
  // the strip's shops: low brick and stone with their shopfronts
  for (const s of world.shops) list.push({ x: s.x, z: s.z, w: s.w, d: s.d, h: s.h, kind: s.tone < 0.5 ? SKIN.brick : SKIN.stone, tone: s.tone, seed: s.tone });
  const towers = towerField(list, facade);
  towers.castShadow = true;
  towers.receiveShadow = true;
  towers.name = 'towers';
  group.add(towers);

  // ── on the roofs: water towers, plant, spires and their beacons ──
  const tanks = [];
  const units = [];
  const spires = [];
  const parapets = [];
  for (const t of world.buildings) {
    const top = t.h + (t.top?.h ?? 0);
    const w = t.top?.w ?? t.w;
    const d = t.top?.d ?? t.d;
    if (t.roof === 'tank') tanks.push([t.x + (r() - 0.5) * w * 0.4, top, t.z + (r() - 0.5) * d * 0.4]);
    else if (t.roof === 'spire') spires.push([t.x, top, t.z, 0.5 + r() * 0.5, 16 + t.h * 0.12 + r() * 14]);
    if (t.roof !== 'spire' && (t.zone === 'core' || r() < 0.35)) for (let i = 0, m = 1 + Math.floor(r() * 2); i < m; i++) units.push([t.x + (r() - 0.5) * w * 0.6, top, t.z + (r() - 0.5) * d * 0.6, 2 + r() * 3, 1.4 + r(), 2 + r() * 2]);
    if (t.h > 24) parapets.push([t.x, top, t.z, w, d]);
  }
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.6, metalness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.45, metalness: 0.7 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a8780, roughness: 0.9 });
  const at = ([x, y, z], m) => m.makeTranslation(x, y, z);
  instances(group, new THREE.CylinderGeometry(2.2, 2.2, 4, 8, 1, true).translate(0, 4.4, 0), wood, tanks, at);
  instances(group, new THREE.ConeGeometry(2.5, 1.8, 8, 1, true).translate(0, 7.3, 0), iron, tanks, at);
  instances(group, new THREE.BoxGeometry(3.2, 2.4, 0.25).translate(0, 1.2, 0), iron, tanks, at);
  instances(group, new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), metal, units, ([x, y, z, w, h, d], m) => m.makeScale(w, h, d).setPosition(x, y, z));
  // the masts: a plinth and an aerial
  instances(group, new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), metal, spires, ([x, y, z, rr], m) => m.makeScale(rr * 6, 3, rr * 6).setPosition(x, y, z));
  instances(group, new THREE.CylinderGeometry(0.35, 1, 1, 6, 1, true).translate(0, 0.5, 0), metal, spires, ([x, y, z, rr, h], m) => m.makeScale(rr, h, rr).setPosition(x, y + 3, z));
  // a low wall round the roof's edge: four quads facing out and four in
  const frame = new THREE.BufferGeometry();
  {
    const pos = [];
    const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    const e = 0.5;
    const i = 0.47;
    for (const [s, k] of [
      [e, 1],
      [i, -1],
    ]) {
      // (out: wound to face out; in: the other way, to face the roof)
      const P0 = [-s, 0, s];
      const P1 = [s, 0, s];
      const P2 = [s, 0, -s];
      const P3 = [-s, 0, -s];
      const up = (p) => [p[0], 1, p[2]];
      for (const [a, b] of [
        [P0, P1],
        [P1, P2],
        [P2, P3],
        [P3, P0],
      ])
        if (k > 0) quad(a, b, up(b), up(a));
        else quad(b, a, up(a), up(b));
    }
    frame.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    frame.computeVertexNormals();
  }
  instances(group, frame, stone, parapets, ([x, y, z, w, d], m) => m.makeScale(w, 1.1, d).setPosition(x, y, z), { shadow: false });
  const beaconMat = new THREE.MeshBasicMaterial({ color: hot(0xff2a2a, 3), toneMapped: false });
  instances(group, new THREE.SphereGeometry(0.7, 8, 6), beaconMat, spires, ([x, y, z, , h], m) => m.makeTranslation(x, y + h + 3.4, z), { shadow: false });

  // ── the suburbs: houses and their roofs ──
  const houses = world.houses;
  const hgeo = new THREE.BoxGeometry(1, 1, 1);
  const hattr = new Float32Array(houses.length * 4);
  houses.forEach((h, i) => hattr.set([h.w, h.h, h.d, h.home ? 0.137 : h.tone], i * 4));
  hgeo.setAttribute('aHouse', new THREE.InstancedBufferAttribute(hattr, 4));
  hgeo.setAttribute('aHurt', new THREE.InstancedBufferAttribute(new Float32Array(houses.length), 1));
  const houseMesh = instances(group, hgeo, houseMaterial(uniforms), houses, (h, m) => m.compose(P.set(h.x, h.h / 2, h.z), Q.setFromAxisAngle(UP, h.yaw), S.set(h.w, h.h, h.d)));
  houseMesh.name = 'houses';
  const roofColors = [0x3b3b3e, 0x4a3a30, 0x2f3a44, 0x5a4636, 0x45474a, 0x6a3b2e];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
  instances(group, hipRoof(), roofMat, houses, (h, m) => m.compose(P.set(h.x, h.h, h.z), Q.setFromAxisAngle(UP, h.yaw), S.set(h.w + 0.9, 2.2, h.d + 0.9)), {
    color: (h) => new THREE.Color(roofColors[Math.floor(h.roof * roofColors.length)]),
  });
  // a chimney on half of them; driveways from the street to the garage
  const chimneys = houses.filter((h) => h.roof > 0.5);
  instances(group, new THREE.BoxGeometry(0.9, 2.6, 0.9).translate(0, 1.3, 0), new THREE.MeshStandardMaterial({ color: 0x7a4a3a, roughness: 0.9 }), chimneys, (h, m) => m.makeTranslation(h.x - h.w * 0.3, h.h + 0.4, h.z));
  const drives = houses.map((h) => {
    const s = h.yaw === 0 ? 1 : -1; // the front faces +z when yaw is 0
    const x = h.x + s * (h.w >= 12 ? h.w * 0.5 - 2.7 : h.w * 0.5 + 1.8);
    return [x, h.z + s * (h.d / 2 + 4.6), 3.2, 9.2];
  });
  instances(group, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8c8a85, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), drives, ([x, z, w, d], m) => m.makeScale(w, 1, d).setPosition(x, 0.02, z), { shadow: false });
  // back-yard fences
  // (one fence down the middle of each block, behind the south row)
  const fences = houses.filter((h) => h.yaw === 0).map((h) => [h.x, h.z - (h.d / 2 + 9), 25.4]);
  instances(group, new THREE.BoxGeometry(1, 1.6, 0.12).translate(0, 0.8, 0), new THREE.MeshStandardMaterial({ color: 0x8d7a62, roughness: 0.95 }), fences, ([x, z, w], m) => m.makeScale(w, 1, 1).setPosition(x, 0, z), { shadow: false });

  // ── the trees: the parks' fuller, the suburbs' simpler (there are thousands) ──
  const parks = world.trees.filter((t) => t[3] === 0);
  const yards = world.trees.filter((t) => t[3] === 1 && (!small || r() < 0.6));
  const pines = world.trees.filter((t) => t[3] === 2);
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.9 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true });
  const greens = [new THREE.Color(0x3d6a2a), new THREE.Color(0x4f7a2f), new THREE.Color(0x35602c), new THREE.Color(0x5b7d34), new THREE.Color(0x46702b)];
  const trunk = new THREE.CylinderGeometry(0.22, 0.32, 1, 4, 1, true).translate(0, 0.5, 0);
  for (const [rows, detail] of [
    [parks, small ? 0 : 1],
    [yards, 0],
  ]) {
    instances(group, trunk, bark, rows, ([x, z, s], m) => m.makeScale(1, s * 0.9, 1).setPosition(x, 0, z), { shadow: !small });
    instances(group, new THREE.IcosahedronGeometry(1, detail), leaf, rows, ([x, z, s], m, i) => m.compose(P.set(x, s * 1.75, z), Q.setFromAxisAngle(UP, i), S.set(s, s * (0.95 + (i % 5) * 0.06), s)), {
      shadow: !small,
      color: (_, i) => greens[i % greens.length],
    });
  }
  const pineGreens = [new THREE.Color(0x24432a), new THREE.Color(0x2c4f2f), new THREE.Color(0x1f3b26)];
  instances(group, new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), leaf, pines, ([x, z, s], m) => m.makeScale(s * 0.55, s * 2.6, s * 0.55).setPosition(x, groundAt(x, z) + s * 0.4, z), {
    shadow: false,
    color: (_, i) => pineGreens[i % pineGreens.length],
  });

  // ── the river: embankment walls, and the bridges over it ──
  const conc = new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.9 });
  const riverLen = COAST - BEACH + LAND;
  for (const x of [RIVER.x0, RIVER.x1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 9, riverLen), conc);
    wall.position.set(x + (x === RIVER.x0 ? -1 : 1), -3.9, -LAND + riverLen / 2);
    wall.receiveShadow = true;
    group.add(wall);
  }
  const steel = new THREE.MeshStandardMaterial({ color: 0x2f5d6b, roughness: 0.55, metalness: 0.55 });
  const span = RIVER.x1 - RIVER.x0 + 32;
  for (const z of BRIDGES) {
    const b = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 1.6, 18), conc);
    deck.position.set(0, -0.4, 0);
    const road = new THREE.Mesh(new THREE.BoxGeometry(span, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 0.85 }));
    road.position.y = 0.42;
    b.add(deck, road);
    // the trusses down both sides, and the bridge-tender's houses at the ends
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(span, 1.1, 0.25), steel);
      rail.position.set(0, 0.95, s * 8.8);
      b.add(rail);
      for (let k = 0; k < 9; k++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), steel);
        post.position.set(-span / 2 + 16 + k * ((span - 32) / 8), 2.9, s * 8.8);
        b.add(post);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(span - 30, 0.6, 0.6), steel);
      top.position.set(0, 5.4, s * 8.8);
      b.add(top);
      for (const e of [-1, 1]) {
        const house = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 5), stone);
        house.position.set(e * (span / 2 - 4), 3.9, s * 12.5);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(4, 2.4, 4), steel);
        cap.rotation.y = Math.PI / 4;
        cap.position.set(e * (span / 2 - 4), 8.6, s * 12.5);
        b.add(house, cap);
      }
    }
    b.position.set((RIVER.x0 + RIVER.x1) / 2, 0, z);
    b.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    group.add(b);
  }

  let blink = 0;
  // a thing's damage, drawn (./demolish.js): the facade's cracks and soot from
  // `aHurt`, the top lowered by heightOf through the bite (a top piece goes
  // with it), the style's roof height following; a house cracks only
  const QI = new THREE.Quaternion();
  function setDamage(key, d) {
    if (key.startsWith('b:')) {
      const idx = index.get(key);
      if (!idx) return false;
      const hurt = towers.geometry.attributes.aHurt;
      const style = towers.geometry.attributes.aStyle;
      const k = heightOf(d);
      idx.forEach((i, n) => {
        const b = list[i];
        const kk = n === 0 ? k : d >= STAGES[0] ? 0.001 : 1;
        hurt.setX(i, d);
        hurt.addUpdateRange(i, 1);
        towers.setMatrixAt(i, M4.compose(P.set(b.x, b.y ?? 0, b.z), QI, S.set(b.w, b.h * kk, b.d)));
        towers.instanceMatrix.addUpdateRange(i * 16, 16);
        style.setW(i, (b.y ?? 0) + b.h * kk);
        style.addUpdateRange(i * 4, 4);
      });
      hurt.needsUpdate = true;
      style.needsUpdate = true;
      towers.instanceMatrix.needsUpdate = true;
      return true;
    }
    if (key.startsWith('h:')) {
      const i = Number(key.slice(2));
      if (!houses[i]) return false;
      const hurt = hgeo.attributes.aHurt;
      hurt.setX(i, d);
      hurt.addUpdateRange(i, 1);
      hurt.needsUpdate = true;
      return true;
    }
    return false;
  }
  // where a thing stands and how big it is, for ./ruins.js
  function boxOf(key) {
    if (key.startsWith('b:')) {
      const idx = index.get(key);
      return idx ? list[idx[0]] : null;
    }
    const hh = houses[Number(key.slice(2))];
    return hh ? { x: hh.x, z: hh.z, w: hh.w, d: hh.d, h: hh.h } : null;
  }

  return {
    group,
    uniforms,
    setDamage,
    boxOf,
    // 0 by day, 1 at night: the windows, the houses' lights
    // a dimension's look (./dimensions.js): every tower hurt `ruins`, the city in a tint
    setDimension({ ruins = 0, tint = null } = {}) {
      uniforms.uBurn.value = ruins;
      uniforms.uTint.value.set(...(tint ?? [1, 1, 1]));
    },
    setNight(k) {
      uniforms.uNight.value = k;
    },
    update(t, night) {
      // the beacons blink at night
      const on = night > 0.3 ? (Math.sin(t * 3) > 0 ? 1 : 0.15) : 0.7;
      if (on !== blink) {
        blink = on;
        beaconMat.color.copy(hot(0xff2a2a, 3 * on));
      }
    },
  };
}
