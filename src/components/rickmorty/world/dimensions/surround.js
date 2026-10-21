// The world round a place, drawn from its layout (./outskirts.js's): the
// edge, the ring of buildings and the skyline in the room kit (./lots.js,
// all in the list that casts no shadow), the forecourt's path; then, as
// they load, the place's own set pieces, the props (the Quaternius models
// the town stands) and the traffic, each model one instanced mesh a part,
// and the crowd (./crowd.js). A room with a world outside gets the ground
// round its walls, or stars round it in space. Every load is tracked (the
// place isn't ready till it's stood) and one that fails is left out: the
// place goes on without it. stage.js calls it before the room kit builds.
//
// surround({ R, d, kit, loader, blocks }, world, laid) → { ready, actions: { hop,
//   turn, crowd } }
//   blocks: the place's (./blocks.js), drawn as each says: a rail or a
//   barrier round its edge, a box of its size, or nothing
// wallOpenings(world, side, d) → a wall's openings for shell.js's wallLine
// groundSize(d, reach) → [across, deep]   the outdoor ground's size
// roomFog(d, world, fogFar) → [colour, near, far] | null   a room's, looking out
// QUATERNIUS: { node: [file, metres tall] }   the town's kit models, by node

import * as THREE from 'three';
import { edgeRun, lot, opening, windowPaints } from './lots';
import { createCrowd } from './crowd';
import { instanced, partsOf } from '../models';
import { STREET_SKY } from '../sky';
import { gltfLoader } from '../../../../lib/three/gltf';

export const QUATERNIUS = {
  Bush_Common_Flowers: ['/models/quaternius/nature/trees.glb', 1.3],
  Bush_Long_1: ['/models/quaternius/nature/trees.glb', 1.6],
  CommonTree_3: ['/models/quaternius/nature/trees.glb', 9.4],
  CommonTree_4: ['/models/quaternius/nature/trees.glb', 9.4],
  CommonTree_5: ['/models/quaternius/nature/trees.glb', 7],
  Pine_4: ['/models/quaternius/nature/trees.glb', 10.2],
  Pine_5: ['/models/quaternius/nature/trees.glb', 8.7],
  Fern_2: ['/models/quaternius/nature/flowers.glb', 0.52],
  Flower_1_Single: ['/models/quaternius/nature/flowers.glb', 0.5],
  Flower_3_Single: ['/models/quaternius/nature/flowers.glb', 0.6],
  Flower_6: ['/models/quaternius/nature/flowers.glb', 0.12],
  Grass_Common_Short: ['/models/quaternius/nature/grass.glb', 0.5],
  Grass_Wispy_Short: ['/models/quaternius/nature/grass.glb', 0.45],
  Mushroom_Common: ['/models/quaternius/nature/mushrooms.glb', 0.3],
  Mushroom_RedCap: ['/models/quaternius/nature/mushrooms.glb', 0.35],
  Pebble_Desert: ['/models/quaternius/nature/rocks.glb', 0.1],
  Pebble_Round_2: ['/models/quaternius/nature/rocks.glb', 0.1],
  Pebble_Square_3: ['/models/quaternius/nature/rocks.glb', 0.21],
  Rock_Desert_1: ['/models/quaternius/nature/rocks.glb', 0.7],
  Rock_Desert_2: ['/models/quaternius/nature/rocks.glb', 0.62],
  Rock_Medium_1: ['/models/quaternius/nature/rocks.glb', 0.7],
  Rock_Medium_2: ['/models/quaternius/nature/rocks.glb', 0.62],
  Rock_Medium_4: ['/models/quaternius/nature/rocks.glb', 0.66],
  Pickup_Crate: ['/models/quaternius/props/space.glb', 0.8],
  Pickup_Jar: ['/models/quaternius/props/space.glb', 0.9],
  Prop_ACUnit: ['/models/quaternius/props/city.glb', 0.6],
  Prop_Bollard: ['/models/quaternius/props/city.glb', 0.89],
  Prop_Planter_Single: ['/models/quaternius/props/city.glb', 0.6],
  Sign_NoParking: ['/models/quaternius/props/street.glb', 2.4],
  Sign_Stop: ['/models/quaternius/props/street.glb', 2.4],
  Streetlight_Single: ['/models/quaternius/props/street.glb', 5.6],
  TrafficLight: ['/models/quaternius/props/street.glb', 4.4],
};

const LOOK = { walls: [0xd8d0c0], roofs: [0x8a6a4a], lit: [0xffe08a], trim: 0x4a3a2a };
const SHIP = 6; // metres a ship stands, if its lane doesn't say

// ── what the stage asks ──
export function wallOpenings(world, side, d) {
  return (world?.windows ?? [])
    .filter((o) => o.wall === side)
    .map((o) => ({
      c: (side === 'n' || side === 's' ? d.centre.x : d.centre.z) + (o.from + o.to) / 2,
      w: o.to - o.from,
      y0: o.y0,
      y1: o.y0 + o.h,
      draw: (f, u, wl) => opening(f, u, wl, { w: o.to - o.from, y0: o.y0, h: o.h, mullion: o.mullion ?? 0, frame: o.frame }),
    }));
}
// where a place's crowd looks: at Morty while the place hunts him, or
// always if its world says so (`watch: 'morty'`); else where it was set to
export function watchOf(world, { hunting, morty }) {
  if (!morty || !(hunting || world?.watch === 'morty')) return null;
  return [morty.x, morty.z];
}
export function groundSize(d, reach) {
  const w = d.area.x1 - d.area.x0 + 260;
  const dd = d.area.z1 - d.area.z0 + 260;
  return reach ? [Math.max(w, reach * 2), Math.max(dd, reach * 2)] : [w, dd];
}
export function roomFog(d, world, fogFar) {
  if (world?.outside !== 'ground') return null;
  const diagonal = Math.hypot(d.area.x1 - d.area.x0, d.area.z1 - d.area.z0);
  return [world.sky?.low ?? STREET_SKY.low, diagonal + 10, fogFar - 20];
}

// stars all round, for a room in space: a dome that follows the camera,
// its stars dotted on a texture made here (no canvas, no shader of its own);
// and the record's planets and moons hung in it, each where it says
// (`bearing` degrees round from north to the east, `up` degrees over the
// eye) and as wide as it says (`size` degrees across), lit on one side
// with one shade of shadow, as the show draws them
const FAR = 400; // metres out a body hangs, inside the dome
const STARS = 3500;
function starDome(R, bodies = []) {
  const W = 1024;
  const H = 512;
  const data = new Uint8Array(W * H * 4);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < W * H; i++) data[i * 4 + 3] = 255;
  // (many, most of them faint: a sky full of them through a window, not a few blocks)
  for (let k = 0; k < STARS; k++) {
    const i = Math.floor(r() * W * H) * 4;
    const b = 60 + Math.floor(r() ** 3 * 195);
    data[i] = b;
    data[i + 1] = b;
    data[i + 2] = Math.min(255, b + 20);
  }
  const map = R.own(new THREE.DataTexture(data, W, H));
  map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  const dome = new THREE.Mesh(R.own(new THREE.SphereGeometry(450, 24, 12)), R.own(new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, fog: false, depthWrite: false })));
  dome.renderOrder = -1;
  R.add(dome, { ink: false });
  const hung = bodies.map((b, i) => {
    const deg = Math.PI / 180;
    const dir = new THREE.Vector3(Math.sin(b.bearing * deg) * Math.cos(b.up * deg), Math.sin(b.up * deg), -Math.cos(b.bearing * deg) * Math.cos(b.up * deg));
    // (lit from over its shoulder: one shade of shadow, a hard edge)
    const light = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).add(new THREE.Vector3(0, 0.6, 0)).normalize();
    const geo = R.own(new THREE.SphereGeometry(1, 24, 16));
    const lit = new THREE.Color(b.color);
    const dark = lit.clone().multiplyScalar(0.55);
    const n = geo.attributes.normal;
    const colors = new Float32Array(n.count * 3);
    const nv = new THREE.Vector3();
    for (let k = 0; k < n.count; k++) (nv.fromBufferAttribute(n, k).dot(light) > -0.15 ? lit : dark).toArray(colors, k * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const body = new THREE.Mesh(geo, R.own(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false })));
    body.scale.setScalar(FAR * Math.tan((b.size * deg) / 2));
    body.renderOrder = -1;
    body.userData.body = i;
    R.add(body, { ink: false });
    return { body, dir };
  });
  R.tick((t, dt, state, camera) => {
    if (!camera) return;
    dome.position.copy(camera.position);
    for (const { body, dir } of hung) body.position.copy(camera.position).addScaledVector(dir, FAR);
  });
}

// the ground round a room's walls (its floor is its own): four strips, just under the floor
function groundRound(R, d, reach, color) {
  const A = d.area;
  const t = 0.25; // (the walls' thickness, not under them)
  const strips = [
    [A.x0 - reach, A.x1 + reach, A.z0 - reach, A.z0 - t],
    [A.x0 - reach, A.x1 + reach, A.z1 + t, A.z1 + reach],
    [A.x1 + t, A.x1 + reach, A.z0 - t, A.z1 + t],
    [A.x0 - reach, A.x0 - t, A.z0 - t, A.z1 + t],
  ];
  for (const [x0, x1, z0, z1] of strips) R.fixed((x0 + x1) / 2, (z0 + z1) / 2, 0).box(color, 0, -0.13, 0, x1 - x0, 0.1, z1 - z0);
}

export function surround({ R, d, kit, loader = null, blocks = [] }, world, laid) {
  const look = world.look ?? LOOK;
  const room = d.kind === 'room';

  // ── the blocks the crowd stands in ──
  for (const b of blocks) {
    const [x, z] = [d.centre.x + b.dx, d.centre.z + b.dz];
    if (b.draw === 'box') R.frame(x, z, 0, { list: 'fixed' }).box(look.trim ?? 0x5a5a5a, 0, 0, 0, b.w, b.h, b.d);
    else if (b.draw === 'rail' || b.draw === 'barrier') {
      const [x0, x1, z0, z1] = [x - b.w / 2, x + b.w / 2, z - b.d / 2, z + b.d / 2];
      for (const [a0, c0, a1, c1] of [
        [x0, z0, x1, z0],
        [x0, z1, x1, z1],
        [x0, z0, x0, z1],
        [x1, z0, x1, z1],
      ])
        edgeRun(R, { kind: b.draw, x0: a0, z0: c0, x1: a1, z1: c1, h: b.h }, look);
    }
  }

  // ── drawn now, in the room kit ──
  for (const run of laid.edge) edgeRun(R, run, look);
  const windows = laid.lots.length || laid.skyline.length ? windowPaints(R, look) : {};
  // (a lot may have a look of its own: a stand's concrete, under a city's night)
  const own = new Map();
  const looked = (l) => {
    if (!l.look) return [look, windows];
    if (!own.has(l.look)) own.set(l.look, windowPaints(R, l.look));
    return [l.look, own.get(l.look)];
  };
  for (const l of laid.lots)
    if (!l.model) {
      const [lk, wins] = looked(l);
      lot(R, l, lk, { windows: wins, list: 'fixed' });
    }
  for (const s of laid.skyline) lot(R, { ...s, y: 0, turn: Math.atan2(d.centre.x - s.x, d.centre.z - s.z) }, look, { windows, list: 'fixed' });
  if (laid.path) {
    const [[x0, z0], [x1, z1]] = laid.path.pts;
    R.fixed((x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0)).box(laid.path.color ?? look.path ?? 0xc8b898, 0, 0, 0, laid.path.w, 0.02, Math.hypot(x1 - x0, z1 - z0));
  }
  if (room && world.outside === 'ground') groundRound(R, d, laid.reach, world.ground ?? 0x7a9a52);
  if (room && world.outside === 'space') starDome(R, world.bodies);

  // ── stood as they load ──
  let gltf = loader;
  const files = new Map();
  const file = (url) => {
    gltf ??= gltfLoader();
    if (!files.has(url)) files.set(url, gltf.loadAsync(url));
    return files.get(url);
  };
  const stand = (key, parts, list, { shadows = false } = {}) =>
    instanced(parts, list, { shadows }).map((mesh) => {
      mesh.userData.surround = key;
      R.own(mesh);
      R.add(mesh, { ink: false });
      kit.adopt?.(mesh);
      return mesh;
    });
  const grouped = (list, by) => list.reduce((m, o) => m.set(by(o), [...(m.get(by(o)) ?? []), o]), new Map());
  const warn = (what) => (e) => import.meta.env?.DEV && console.warn('surround: no', what, e?.message ?? e);
  // a model the cast loads (a set piece, a ship, by its path), its parts as they stand `h` tall
  const castParts = async (model, h) => {
    await kit.need([model], { clips: [] });
    const g = kit.cast.prop(model, h);
    return g ? partsOf(g, { tall: h, paint: false }) : null;
  };
  const jobs = [];
  // the place's set pieces in the ring, and its own pieces (in the box too:
  // they cast their shadows, as the code buildings they stand for did; but
  // never one outside a room, into it)
  const spinning = [];
  const A = d.area;
  const indoors = (l) => l.x >= A.x0 && l.x <= A.x1 && l.z >= A.z0 && l.z <= A.z1;
  const casts = (l) => Boolean(l.piece) && (!room || indoors(l));
  for (const [, lots] of grouped(laid.lots.filter((l) => l.model), (l) => `${l.model}${l.piece ? ' piece' : ''}${casts(l) ? ' casts' : ''}`)) {
    const { model, h } = lots[0];
    jobs.push(
      castParts(model, h)
        .then((parts) => {
          if (!parts) return;
          const meshes = stand(model, parts, lots.map((l) => ({ x: l.x, z: l.z, turn: l.turn, y: l.y, s: l.h / h })), { shadows: casts(lots[0]) });
          if (lots.some((l) => l.spin)) spinning.push({ lots, h, meshes: meshes.map((mesh, i) => ({ mesh, local: parts[i].local })) });
        })
        .catch(warn(model)),
    );
  }
  // the props: the town's kit models, by node
  for (const [model, props] of grouped(laid.props, (p) => p.model)) {
    const node = model?.startsWith('q:') ? model.slice(2) : null;
    if (!node || !QUATERNIUS[node]) continue;
    const [url, tall] = QUATERNIUS[node];
    jobs.push(
      file(url)
        .then((g) => {
          const parts = partsOf(g.scene.clone(), { node, tall });
          // (each at the height it's laid at: the model's own scaled to it)
          if (parts) stand(model, parts, props.map((p) => ({ x: p.x, z: p.z, turn: p.turn, s: p.s * (p.h ? p.h / tall : 1) })));
        })
        .catch(warn(model)),
    );
  }
  // the traffic: each lane's ships flying from one end to the other, round again
  const lanes = [];
  for (const lane of laid.lanes)
    jobs.push(
      castParts(lane.model, lane.h ?? SHIP)
        .then((parts) => {
          if (!parts) return;
          const meshes = parts.map((p) => {
            const mesh = new THREE.InstancedMesh(p.geometry, p.material, lane.n);
            mesh.castShadow = false;
            mesh.userData.surround = lane.model;
            const x = laid.extents[lane.key];
            if (x) mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(x.x, x.y, x.z), x.r);
            R.own(mesh);
            R.add(mesh, { ink: false });
            kit.adopt?.(mesh);
            return { mesh, local: p.local };
          });
          const rise = (lane.y1 ?? lane.y) - lane.y;
          lanes.push({ lane, meshes, rise, len: Math.hypot(lane.to[0] - lane.from[0], lane.to[1] - lane.from[1], rise), yaw: Math.atan2(lane.to[0] - lane.from[0], lane.to[1] - lane.from[1]) });
        })
        .catch(warn(lane.model)),
    );
  const m4 = new THREE.Matrix4();
  const each = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const size = new THREE.Vector3();
  R.tick((t) => {
    for (const { lots, h, meshes } of spinning) {
      lots.forEach((l, j) => {
        q.setFromAxisAngle(up, l.turn + l.spin * t);
        m4.compose(v.set(l.x, l.y, l.z), q, size.setScalar(l.h / h));
        for (const { mesh, local } of meshes) mesh.setMatrixAt(j, each.copy(m4).multiply(local));
      });
      for (const { mesh } of meshes) mesh.instanceMatrix.needsUpdate = true;
    }
    for (const { lane, meshes, len, rise, yaw } of lanes) {
      q.setFromAxisAngle(up, yaw);
      for (let j = 0; j < lane.n; j++) {
        const k = ((t * lane.speed) / len + j / lane.n) % 1;
        v.set(lane.from[0] + (lane.to[0] - lane.from[0]) * k, lane.y + rise * k, lane.from[1] + (lane.to[1] - lane.from[1]) * k);
        m4.compose(v, q, one);
        for (const { mesh, local } of meshes) mesh.setMatrixAt(j, each.copy(m4).multiply(local));
      }
      for (const { mesh } of meshes) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  // the crowd
  const crowd = createCrowd(kit, R, laid, { loader: gltf });
  const ready = Promise.all([...jobs, crowd.ready]).then(() => true);
  kit.track?.(ready);
  return { ready, actions: { hop: () => crowd.hop(), turn: (to) => crowd.turn(to), show: (key, on) => crowd.show(key, on), crowd: () => crowd.counts() } };
}
