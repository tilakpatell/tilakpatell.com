// The Smiths' street in 3D, drawn from ./rules.js: the sky, bright lawns, the
// asphalt with its dashed yellow line between pale concrete sidewalks, the
// driveways and the Smiths' brick-edged front walk, white picket fences,
// the street's small things (DECOR: the flagpole, the marquee, telephone
// poles, mailboxes, the hydrant), round puffy trees in two greens, the
// neighbours' houses in their colours, the Smith house, Harry Herpson High
// with its name, flag, marquee and crosswalk, and the suburb going on past
// the end of the street, and the cruiser's chase rings over it while it
// flies (./chaseRings.js). Static parts are merged by material and repeats are
// instanced; the suburb thins out on a phone, its far side is a plain house
// design, and its trees are simple ones that cast no shadow. (Nothing that
// stands in front of anything else is left out of the ink: what the ink
// can't see, it outlines what's behind straight through.)
//
// buildStreet(kit) → { group, update(t, dt, state, camera), noInk, light },
// kit = { renderer, models: Map<name, Object3D|null> (toon-painted), cast, mats, tier }.

import * as THREE from 'three';
import { farTree } from '../../middleearth/towns/bake';
import { AREAS, DECOR, DINER, DRIVEWAY, FENCES, FRONT_WALK, NEIGHBOURS, OUTSKIRTS, ROAD, SCHOOL, STOOP, TREES, VEHICLES } from './rules';
import { at, batch, gentleRamp, mergeParts, rng, speckle } from './kit';
import { toonify } from '../portal/toon';
import { gltfLoader } from '../../../lib/three/gltf';
import { buildingMaterials, flagpole, marquee, neighbourHouses, school, smithHouse } from './buildings';
import { STREET_SKY, makeSky } from './sky';
import { shoneys } from './shoneys';
import { buildVisitors } from './visitors';
import { createChaseRings } from './chaseRings';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const FAR = 1200; // how far the ground and the road go on
export const ROAD_Y = -0.12; // the asphalt, a kerb's height under the sidewalks and lawns
const WALK = ROAD.w / 2 + ROAD.sidewalk; // 7
const NEAR = 140; // past this along the road the suburb is the plain design
// how long the street stands before its vehicles are fetched (s): the world's
// first download doesn't carry them
const RIDES_AFTER = 3;
// how much suburb each tier draws: trees past the street, every nth house
// along the road out to `side` metres, and the rows behind the back yards
const SUBURB = { high: { trees: 190, every: 1, side: 330, back: true }, mid: { trees: 80, every: 2, side: 330, back: false }, low: { trees: 40, every: 3, side: 180, back: false } };
// a clean, bright suburban afternoon (./scene.js's light and fog for the street)
export const STREET_LIGHT = { sun: [0xfff3df, 2.4], hemi: [0xd6f0ff, 0x6a9a4a, 1.35], fog: [0xd2eef8, 90, 560] };
const TINTS = [0xe9c9a1, 0xb7d3c6, 0xe7b8b0, 0xc2cfe6, 0xf0dd9a, 0xd9bfd8, 0xf2e6cf, 0xc9dfb0, 0xf0a0a8];
const ROOFS = [0x5d5f6c, 0x6e4a36, 0x7a4038, 0x56606e, 0x4f5a52, 0x6b4c3b];

export async function buildStreet(kit) {
  const { models, mats, tier = 'high' } = kit;
  const plan = SUBURB[tier] ?? SUBURB.high;
  const group = new THREE.Group();
  group.name = 'street';
  const b = batch();
  const flat = batch(); // the ground's layers: they take shadows, cast none
  const m = buildingMaterials(mats);
  const sky = makeSky(560, STREET_SKY);
  group.add(sky.dome);
  const decor = (kind) => DECOR.filter((d) => d.kind === kind);
  const tmp = new THREE.Matrix4();

  // ── the ground ──
  const grass = mats.painted(
    'grass',
    256,
    256,
    (g, w, h) => {
      speckle(g, w, h, { base: '#62b347', specks: ['#5dad43', '#67b84b', '#5aa940', '#6bbc4e'], n: 1800, size: 2, seed: 21 });
      const r = rng(8);
      g.globalAlpha = 0.08;
      for (let i = 0; i < 14; i++) {
        g.fillStyle = r() < 0.5 ? '#3f8a2e' : '#8fd66a';
        g.beginPath();
        g.ellipse(r() * w, r() * h, 20 + r() * 40, 12 + r() * 30, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    },
    { tile: 7 },
  );
  for (const s of [-1, 1]) flat.add(new THREE.PlaneGeometry(FAR * 2, FAR - WALK).rotateX(-Math.PI / 2), grass, 0, 0, s * (WALK + (FAR - WALK) / 2));
  // (this tile is 12 m long and the road's 10 m across: a 3 m dash every 12 m)
  const asphalt = mats.painted(
    'asphalt',
    512,
    256,
    (g, w, h) => {
      speckle(g, w, h, { base: '#74777c', specks: ['#707378', '#787b80', '#6d7075', '#7c7f84'], n: 2500, size: 1.5, seed: 33 });
      // a crack, mended with tar
      g.strokeStyle = 'rgba(52,54,58,0.3)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(w * 0.62, h * 0.2);
      g.bezierCurveTo(w * 0.7, h * 0.35, w * 0.6, h * 0.5, w * 0.72, h * 0.66);
      g.stroke();
      g.fillStyle = '#e8c33a';
      g.fillRect(w * 0.1, h / 2 - 4, w * 0.25, 8);
    },
    { repeat: [(FAR * 2) / 12, 1] },
  );
  const road = new THREE.Mesh(new THREE.PlaneGeometry(FAR * 2, ROAD.w).rotateX(-Math.PI / 2), asphalt);
  road.position.set(0, ROAD_Y, ROAD.z);
  road.receiveShadow = true;
  group.add(road);
  // sidewalks: concrete slabs a kerb's height over the road, joints every 2 m
  const slab = mats.painted(
    'slab',
    128,
    128,
    (g, w, h) => {
      speckle(g, w, h, { base: '#dcd8cf', specks: ['#d4d0c7', '#e2dfd8', '#d0cbc1'], n: 500, size: 1.5, seed: 5 });
      g.fillStyle = '#a9a398';
      g.fillRect(0, 0, w, 3);
      g.fillRect(0, 0, 3, h);
    },
    { tile: 2 },
  );
  for (const s of [-1, 1]) flat.add(BOX, slab, at(0, (ROAD_Y + 0.03) / 2, s * (ROAD.w / 2 + ROAD.sidewalk / 2), 0, FAR * 2, 0.03 - ROAD_Y, ROAD.sidewalk));
  const pad = (x0, x1, z0, z1, top = 0.025, mat = slab) => flat.add(BOX, mat, at((x0 + x1) / 2, top / 2 - 0.01, (z0 + z1) / 2, 0, x1 - x0, top + 0.02, z1 - z0));
  pad(DRIVEWAY.x0, DRIVEWAY.x1, DRIVEWAY.z0, DRIVEWAY.z1);
  // the front walk, edged in red brick, from the porch step to the sidewalk
  pad(FRONT_WALK.x0, FRONT_WALK.x1, FRONT_WALK.z0, FRONT_WALK.z1, 0.035);
  for (const x of [FRONT_WALK.x0 - 0.08, FRONT_WALK.x1 + 0.08]) b.add(BOX, m.brick, at(x, 0.04, (FRONT_WALK.z0 + FRONT_WALK.z1) / 2, 0, 0.16, 0.08, FRONT_WALK.z1 - FRONT_WALK.z0));
  // the stoop at the front door and its two steps: red brick under a concrete top
  for (const p of STOOP) {
    b.add(BOX, m.brick, at(p.x, (p.top - 0.06) / 2, p.z, 0, p.w - 0.04, p.top - 0.06, p.d - 0.04));
    flat.add(BOX, slab, at(p.x, p.top - 0.03, p.z, 0, p.w, 0.06, p.d));
  }

  // ── the Smith house and the school ──
  const bushes = [];
  const smith = smithHouse(b, m, mats, models.get('smith-house'), bushes);
  if (smith.group) group.add(smith.group);
  const hhhs = school(b, m, mats, models.get('school'), bushes);
  if (hhhs.group) group.add(hhhs.group);
  // Shoney's, in the north-east lot, and its parking lot
  group.add(shoneys(b, mats, models.get('shoneys')).group);
  group.add(hhhs.plate);
  const front = SCHOOL.z - SCHOOL.d / 2;
  pad(SCHOOL.x - 1.6, SCHOOL.x + 1.6, WALK, front - 2.5);
  pad(SCHOOL.x - 5, SCHOOL.x + 5, front - 2.5, front + 0.2);
  const pole = decor('pole').find((d) => d.id === 'flagpole');
  const flag = flagpole(b, m, mats, pole.x, pole.z);
  group.add(flag.flag);
  for (const d of decor('box')) marquee(b, m, mats, d);
  // the crosswalk in front of the school
  const zebra = mats.toon(0xe4e1d8);
  for (let z = -4; z <= 4; z += 1) flat.add(BOX, zebra, at(SCHOOL.x, ROAD_Y + 0.01, z, 0, 3.2, 0.02, 0.55));

  // ── the neighbours, and the suburb on past the street's ends and behind its yards ──
  const r = rng(77);
  const pick = (list) => list[Math.floor(r() * list.length)];
  // each driveway is where its mailbox (rules.js's DECOR) stands beside it
  // (Shoney's has its sign there, and a parking lot for a driveway: ./buildings.js)
  const drives = NEIGHBOURS.filter((n) => n !== DINER).map((n) => ({ x: DECOR.find((d) => d.id === `mailbox-${n.id}`).x - 2.1, z: n.z, s: Math.sign(n.z) }));
  const houses = NEIGHBOURS.filter((n) => n !== DINER).map((n) => ({ x: n.x, z: n.z, turn: n.z < 0 ? 0 : Math.PI, look: n.look, tint: n.tint, roofTint: n.roofTint, id: n.id }));
  // the houses on along the road, solid in the rules, each with its drive
  for (const o of OUTSKIRTS) {
    houses.push({ x: o.x, z: o.z, turn: o.z < 0 ? 0 : Math.PI, look: o.look, tint: pick(TINTS), roofTint: pick(ROOFS), id: o.id });
    drives.push({ x: o.x - 7.8, z: o.z, s: Math.sign(o.z) });
  }
  // the street's edge: a hedge all round (gaps for the road and sidewalks,
  // closed off there with striped barriers), so nothing stops Morty unseen
  const A = AREAS.street;
  const hedge = mats.toon(0x3d8a3a);
  const barrier = mats.toon(0xd8302a);
  const hx = (A.x1 - A.x0) / 2;
  for (const s of [-1, 1]) b.add(BOX, hedge, at(0, 0.65, s * (A.z1 + 0.6), 0, A.x1 - A.x0 + 2.4, 1.3, 1.2));
  for (const s of [-1, 1])
    for (const t of [-1, 1]) {
      const z0 = t < 0 ? A.z0 - 1.2 : WALK + 0.2;
      const z1 = t < 0 ? -WALK - 0.2 : A.z1 + 1.2;
      b.add(BOX, hedge, at(s * (hx + 0.6), 0.65, (z0 + z1) / 2, 0, 1.2, 1.3, z1 - z0));
      // the barrier across the road and its sidewalk, red and white
      for (let z = -WALK; z < WALK; z += 1) b.add(BOX, (Math.round(z) & 1) ? m.white : barrier, at(s * (hx + 0.5), 0.9, z + 0.5, 0, 0.12, 0.3, 1));
      for (const z of [-WALK + 0.3, 0, WALK - 0.3]) b.add(BOX, m.white, at(s * (hx + 0.5), 0.45, z, 0, 0.1, 0.9, 0.1));
    }
  const suburb = [];
  let k = 0;
  for (let x = AREAS.street.x1 + 8; x < plan.side; x += 21 + r() * 4, k++)
    for (const sx of [-1, 1])
      for (const s of [-1, 1]) {
        const side = r() < 0.5 ? -1 : 1;
        const near = x < NEAR;
        if (k % plan.every) continue;
        suburb.push({ x: sx * x, z: s * 20, turn: s < 0 ? 0 : Math.PI, look: near ? pick(['colonial', 'ranch']) : 'distant', tint: pick(TINTS), roofTint: pick(ROOFS) });
        if (near) drives.push({ x: sx * x + side * 7.8, z: s * 20, s });
      }
  if (plan.back) for (let x = -plan.side; x < plan.side; x += 22 + r() * 5) for (const s of [-1, 1]) suburb.push({ x, z: s * 62, turn: s < 0 ? Math.PI : 0, look: 'distant', tint: pick(TINTS), roofTint: pick(ROOFS) });
  // the street's own cast shadows; the suburb's are too far off to need them
  const hood = neighbourHouses(mats, houses);
  const nearSuburb = neighbourHouses(mats, suburb.filter((h) => h.look !== 'distant'), { shadows: false });
  const farSuburb = neighbourHouses(mats, suburb.filter((h) => h.look === 'distant'), { shadows: false });
  group.add(hood.group, nearSuburb.group, farSuburb.group);
  // striped awnings on the pink house next door to the west, as in the show
  const next = houses.find((h) => h.id === 'n0');
  const stripes = mats.painted('awning', 64, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#fbf4ef' : '#d9607a';
      g.fillRect((i * w) / 8, 0, w / 8 + 1, h);
    }
    g.fillStyle = '#d9607a';
    g.fillRect(0, h - 6, w, 6);
  });
  for (const [x, y] of hood.designs[next.look]?.awnings ?? []) b.add(BOX, stripes, at(next.x + x, y, next.z + 5.35, 0, 1.5, 0.06, 0.8, 0.55));
  // their driveways
  for (const d of drives) pad(d.x - 1.5, d.x + 1.5, d.s < 0 ? d.z - 4 : WALK, d.s < 0 ? -WALK : d.z + 4);

  // ── the street's small things, where rules.js has them ──
  const mailRed = mats.toon(0xc8352e);
  for (const d of decor('mailbox')) {
    const s = Math.sign(d.z);
    b.add(BOX, mats.wood, at(d.x, 0.55, d.z, 0, 0.1, 1.1, 0.1));
    b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 12, 1, false, -Math.PI / 2, Math.PI), m.metal, at(d.x, 1.12, d.z, 0, 1, 1, 1, -Math.PI / 2));
    b.add(BOX, m.metal, at(d.x, 1.04, d.z, 0, 0.34, 0.17, 0.5));
    b.add(BOX, mailRed, at(d.x + 0.19, 1.25, d.z - s * 0.05, 0, 0.03, 0.26, 0.06));
  }
  const red = mats.toon(0xd6342c);
  for (const d of decor('hydrant')) {
    b.add(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 10), red, at(d.x, 0.35, d.z));
    b.add(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), red, at(d.x, 0.7, d.z));
    b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), red, at(d.x, 0.48, d.z, 0, 1, 1, 1, Math.PI / 2));
  }
  // telephone poles: the street's, and the same spacing on out past its ends
  const poles = decor('pole').filter((d) => d.id !== 'flagpole');
  const step = poles.length > 1 ? poles[1].x - poles[0].x : 32;
  const poleZ = poles[0]?.z ?? WALK + 0.6;
  const poleXs = poles.map((d) => d.x);
  while (poleXs[0] > -plan.side) poleXs.unshift(poleXs[0] - step);
  while (poleXs[poleXs.length - 1] < plan.side) poleXs.push(poleXs[poleXs.length - 1] + step);
  const poleWood = mats.toon(0x7b5a3d);
  for (const x of poleXs) {
    b.add(new THREE.CylinderGeometry(0.13, 0.17, 9, 8), poleWood, at(x, 4.5, poleZ));
    b.add(BOX, poleWood, at(x, 8.2, poleZ, 0, 0.12, 0.14, 2.4));
    for (const dz of [-1, 0, 1]) b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 6), m.white, at(x, 8.36, poleZ + dz));
  }
  const wirePts = [];
  const sag = (u) => 8.42 - Math.sin(u * Math.PI) * 0.55;
  for (let i = 0; i < poleXs.length - 1; i++)
    for (const dz of [-1, 0, 1])
      for (let j = 0; j < 8; j++) {
        const [a, c] = [j / 8, (j + 1) / 8];
        wirePts.push(poleXs[i] + (poleXs[i + 1] - poleXs[i]) * a, sag(a), poleZ + dz, poleXs[i] + (poleXs[i + 1] - poleXs[i]) * c, sag(c), poleZ + dz);
      }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  const wires = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x2a2630 }));
  group.add(wires);

  // ── fences: white pickets round the back yards, each a flat card ──
  const picket = (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.045, 0);
    s.lineTo(0.045, 0);
    s.lineTo(0.045, 0.92);
    s.lineTo(0, 1.02);
    s.lineTo(-0.045, 0.92);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  })();
  const spots = [];
  for (const [x0, z0, x1, z1] of FENCES) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const turn = Math.atan2(-(z1 - z0), x1 - x0);
    const n = Math.max(1, Math.round(len / 0.17));
    for (let i = 0; i <= n; i++) spots.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, turn]);
    for (const y of [0.3, 0.75]) b.add(BOX, m.white, at((x0 + x1) / 2, y, (z0 + z1) / 2, turn, len, 0.07, 0.04));
    const posts = Math.max(1, Math.round(len / 2.4));
    for (let i = 0; i <= posts; i++) b.add(BOX, m.white, at(x0 + ((x1 - x0) * i) / posts, 0.58, z0 + ((z1 - z0) * i) / posts, turn, 0.1, 1.16, 0.1));
  }
  const pickets = new THREE.InstancedMesh(picket, mats.toon(0xf4f0e6, { side: THREE.DoubleSide }), spots.length);
  spots.forEach(([x, z, turn], i) => pickets.setMatrixAt(i, tmp.makeRotationY(turn).setPosition(x, 0, z)));
  pickets.castShadow = true;
  pickets.receiveShadow = true;
  group.add(pickets);

  // ── trees: round puffs in two greens on brown trunks ──
  // the rules' trees and the school's, then simple ones out in the suburb
  const near = [...TREES, ...decor('tree').map((d) => ({ x: d.x, z: d.z, s: 1.05, kind: 0, turn: 1 }))];
  const far = [];
  for (let i = 0, tries = 0; i < plan.trees && tries < 6000; tries++) {
    const x = (r() * 2 - 1) * 330;
    const z = (r() < 0.5 ? -1 : 1) * (12 + r() * 200);
    if (Math.abs(x) < AREAS.street.x1 + 2 && Math.abs(z) < AREAS.street.z1 + 1.5) continue;
    if (Math.abs(z) < WALK + 1.5) continue;
    if ([...houses, ...suburb].some((h) => Math.abs(h.x - x) < 8 && Math.abs(h.z - z) < 7.5) || drives.some((d) => Math.abs(d.x - x) < 2.5 && Math.abs(d.z - z) < 9)) continue;
    far.push({ x, z, s: 0.8 + r() * 0.7, turn: r() * 6.3 });
    i++;
  }
  const tint = (t, c) => {
    const h = Math.abs(Math.sin(t.x * 12.9898 + t.z * 78.233) * 43758.5453) % 1;
    return c.setRGB(0.9 + h * 0.12, 1, 0.88 + (1 - h) * 0.1);
  };
  const planted = (geo, list, shadows) => {
    const mesh = new THREE.InstancedMesh(geo, mats.toon(0xffffff, { vertexColors: true }), list.length);
    const c = new THREE.Color();
    list.forEach((t, i) => {
      mesh.setMatrixAt(i, tmp.makeRotationY(t.turn).scale(new THREE.Vector3(t.s, t.s, t.s)).setPosition(t.x, 0, t.z));
      mesh.setColorAt(i, tint(t, c));
    });
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    return mesh;
  };
  for (let kind = 0; kind < 3; kind++) {
    const list = near.filter((t) => t.kind === kind);
    if (list.length) planted(treeGeometry(kind, tier === 'high' ? 2 : 1), list, true);
  }
  planted(farTree({ leaf: [0x3d8a35, 0x4f9c3c, 0x63b545], trunk: 0x7a5232 }), far, false);

  // ── bushes ──
  if (bushes.length) {
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mats.toon(0xffffff), bushes.length);
    const c = new THREE.Color();
    bushes.forEach((u, i) => {
      mesh.setMatrixAt(i, tmp.makeScale(u.s * 1.15, u.s * 0.9, u.s).setPosition(u.x, u.y, u.z));
      mesh.setColorAt(i, c.set(i % 3 ? 0x4e9a3a : 0x3f8a33));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // the President's motorcade, the Federation's agents and its patrol ship
  const visitors = await buildVisitors(kit, { roadY: ROAD_Y });
  group.add(visitors.group);
  const rings = createChaseRings();
  group.add(rings.group);

  // ── the multiverse's vehicles (rules.js's VEHICLES) ──
  // Space Beth's ship and Jerry's car-ship on the Smiths' lawn, the Gotron
  // over the houses across the street and a ferret at its feet: fetched a
  // moment after the street's first drawn (RIDES_AFTER), toon-painted as the
  // street's other models are, each stood its height on its footprint. One
  // that won't load is left out.
  const rides = new THREE.Group();
  rides.name = 'vehicles';
  group.add(rides);
  let ridesAt = null;
  const loadRides = () => {
    const loader = gltfLoader();
    for (const v of VEHICLES) {
      const load = loader
        .loadAsync(`/models/c137/rm/${v.id}.glb`)
        .then((g) => {
          const model = toonify(g.scene, { gradientMap: gentleRamp(), aniso: kit.fit?.aniso, dispose: true });
          rides.add(standing(model, v));
        })
        .catch(() => {});
      kit.track?.(load);
    }
  };

  b.build(group);
  const ground = flat.build(group, { cast: false });
  return {
    group,
    // what the street's light is baked on (lib/three/groundwork)
    floor: [road, ...ground],
    sky,
    noInk: [sky.dome, wires, ...visitors.noInk, ...rings.noInk],
    light: STREET_LIGHT,
    update(t, dt, state, camera) {
      ridesAt ??= t + RIDES_AFTER;
      if (t >= ridesAt && ridesAt !== Infinity) {
        ridesAt = Infinity;
        loadRides();
      }
      sky.update(t, camera);
      flag.update(t);
      visitors.update(t, dt, state);
      rings.update(t, state.chase, state.flying);
    },
    dispose() {
      visitors.dispose();
      rings.dispose();
    },
  };
}

// A vehicle's model stood on its footprint: turned, scaled to its height
// (the same on every axis, so it keeps its shape), centred on (x, z) and on
// the ground
function standing(model, { x, z, h, turn }) {
  const holder = new THREE.Group();
  model.rotation.y = turn;
  holder.add(model);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const k = h / (box.max.y - box.min.y);
  holder.scale.setScalar(k);
  holder.position.set(x - ((box.min.x + box.max.x) / 2) * k, -box.min.y * k, z - ((box.min.z + box.max.z) / 2) * k);
  holder.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return holder;
}

// One tree of a kind (0 round, 1 tall, 2 wide) at scale 1: its trunk and
// its puffs, darker green underneath and lighter on top, as one
// vertex-coloured geometry.
function treeGeometry(kind, detail = 1) {
  const DARK = 0x3d8a35;
  const LIGHT = 0x63b545;
  const TRUNK = 0x7a5232;
  const parts = [];
  const puff = (x, y, z, r, color) => parts.push({ geo: new THREE.IcosahedronGeometry(r, detail), color, matrix: at(x, y, z) });
  const trunkH = kind === 1 ? 3.0 : kind === 2 ? 2.7 : 3.2;
  parts.push({ geo: new THREE.CylinderGeometry(0.2, 0.3, trunkH + 0.6, 7), color: TRUNK, matrix: at(0, (trunkH + 0.6) / 2, 0) });
  if (kind === 0) {
    puff(0, trunkH + 1.5, 0, 1.75, DARK);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      puff(Math.cos(a) * 1.25, trunkH + 1.2 + (i % 2) * 0.4, Math.sin(a) * 1.25, 1.05, DARK);
    }
    puff(0.3, trunkH + 2.6, 0.2, 1.15, LIGHT);
    puff(-0.6, trunkH + 2.2, -0.5, 0.95, LIGHT);
  } else if (kind === 1) {
    puff(0, trunkH + 1.2, 0, 1.45, DARK);
    puff(0.2, trunkH + 2.5, 0.1, 1.3, DARK);
    puff(-0.1, trunkH + 3.6, -0.1, 1.0, LIGHT);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      puff(Math.cos(a) * 0.95, trunkH + 1.8 + (i % 2) * 0.6, Math.sin(a) * 0.95, 0.8, i % 2 ? LIGHT : DARK);
    }
  } else {
    for (const [x, z] of [[1.3, 0], [-1.3, 0.2], [0, 1.1], [0.1, -1.1]]) puff(x, trunkH + 1.3, z, 1.35, DARK);
    puff(0, trunkH + 2.2, 0, 1.4, LIGHT);
    puff(0.9, trunkH + 2.0, -0.6, 0.9, LIGHT);
    parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.14, 1.6, 6), color: TRUNK, matrix: at(0.5, trunkH + 0.3, 0, 0, 1, 1, 1, 0, -0.7) });
  }
  return mergeParts(parts);
}
