// The Great Hall (the design’s §4.4): the hall at the films’ size, its four
// long tables and their benches, the plates and goblets that fill at the
// feast, the high table on its dais with the Headmaster’s gold chair, the
// golden owl lectern, the floating candles, the enchanted ceiling (the
// world’s own sky on the vault: it rains above the tables when it rains),
// the house banners, two great fireplaces, the leaded windows lit by the
// hour, the great doors, the four hourglasses counting the points and, in
// Christmas week, the twelve trees. The room’s plan is ./plan/greatHall.js.
//
// A room for rooms/index.js (./host.js says the shape): { id, name, build(rt, ctx) → room }
//   ctx: { house, tier, renderer, props: { points, christmas, feast, sky, hour, people }, load(url) }
//   room: { id, name, group, spawn, colliders, floors, doors, places, bounds, floorAt,
//     plan, poses, cheer(house), step(dt, ctx), set(props), info(), dispose() }
//   set({ points, settle, christmas, feast, cup, sky, hour }): what changes while you are in it
//   (cup: the house the House Cup went to; the banners all in its colours, the
//   leaving feast’s hall; null to give each table its own again)
//   (sky: ceiling.js’s skyAt() shape, from the grounds’ clock; hour alone works too)

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { createRoomKit, countOf, instanced } from './kit';
import { HALL, hallPlan } from './plan/greatHall';
import { createCandles } from './candles';
import { createCeiling, skyAt } from './ceiling';
import { createHourglasses } from './hourglasses';
import { createBanners } from './banners';
import { archPanel, createWindows } from './parts/glass';
import { createFire } from './parts/fire';
import { roomEnv, wearEnv } from './parts/env';
import { bench, chair, doors, fireplace, lectern, stool, table, throne } from './parts/furniture';
import { createCrowd } from '../cast/crowd';
import { CROWD, figure } from '../cast/figures';

const W = HALL.width / 2;
const L = HALL.length / 2;

function architecture(kit, plan) {
  const { wall, dais } = HALL;
  // the floor in great flags; the dais and its three steps
  kit.box('flags', 0, -0.3, 0, HALL.width + 2, 0.3, HALL.length + 2);
  kit.box('flags', 0, 0, -L + (L + dais.z) / 2 - 0.5, HALL.width, dais.height, L + dais.z + 1);
  for (let i = 0; i < dais.steps; i++) {
    const h = dais.height * (1 - (i + 1) / dais.steps) + 1e-3;
    if (h > 0.01) kit.box('ashlar', 0, 0, dais.z + 0.2 + i * 0.4 + 0.2, HALL.width - 1, h, 0.4);
  }
  // the long walls, broken by the windows: below them, between them, above them
  const bays = plan.windows.filter((w) => w.side > 0).map((w) => w.z);
  for (const side of [-1, 1]) {
    const x = side * (W + 0.5);
    const win = plan.windows.find((w) => w.side === side);
    kit.box('stone', x, 0, 0, 1, win.y, HALL.length);
    kit.box('stone', x, win.y + win.h, 0, 1, wall - win.y - win.h + 0.6, HALL.length);
    let z0 = -L;
    for (const z of bays) {
      const a = z - win.w / 2;
      kit.box('stone', x, win.y, (z0 + a) / 2, 1, win.h, a - z0);
      // the reveal: deep stone either side of the glass
      kit.box('ashlar', side * (W + 0.05), win.y, a - 0.15, 0.3, win.h, 0.3);
      kit.box('ashlar', side * (W + 0.05), win.y, z + win.w / 2 + 0.15, 0.3, win.h, 0.3);
      kit.box('ashlar', side * (W + 0.05), win.y - 0.25, z, 0.5, 0.25, win.w + 0.6);
      z0 = z + win.w / 2;
    }
    kit.box('stone', x, win.y, (z0 + L) / 2, 1, win.h, L - z0);
    // the stone round each light’s pointed head, filling the bay’s corners
    for (const z of bays) kit.add('stone', archPanel(win.w, win.h, 0.98), { at: [x, win.y, z], ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
    // the shafts between the bays, up to the vault’s springing, their capitals and the springers
    for (let i = 0; i <= bays.length; i++) {
      const z = i < bays.length ? bays[i] - 3.2 : bays.at(-1) + 3.2;
      kit.box('ashlar', side * (W - 0.2), 0, z, 0.55, wall, 0.55);
      kit.box('ashlar', side * (W - 0.25), wall - 0.4, z, 0.8, 0.4, 0.8);
    }
    // the panelling below the sills: oak, in bays of stiles, a moulded rail along its top
    kit.box('oak', side * (W - 0.04), 0, 0, 0.08, 3.1, HALL.length - 0.2);
    kit.box('darkoak', side * (W - 0.1), 3.05, 0, 0.18, 0.14, HALL.length - 0.2);
    kit.box('darkoak', side * (W - 0.08), 0, 0, 0.14, 0.22, HALL.length - 0.2);
    for (let z = -L + 0.8; z < L; z += 1.25) kit.box('darkoak', side * (W - 0.09), 0.22, z, 0.06, 2.83, 0.09);
    // the cornice where the enchantment begins
    kit.box('ashlar', side * (W - 0.1), wall - 0.05, 0, 0.5, 0.35, HALL.length);
  }
  // the end walls up into the vault: the dais end round the great window, the doors’ end round the doors
  const g = plan.great;
  for (const [z, open] of [
    [-L - 0.5, g],
    [L + 0.5, { x: 0, w: HALL.doors.width + 1.6, h: HALL.doors.height + 0.2, y: 0 }],
  ]) {
    const side = (HALL.width - open.w) / 2;
    kit.box('stone', -W + side / 2, 0, z, side, HALL.peak + 1, 1);
    kit.box('stone', W - side / 2, 0, z, side, HALL.peak + 1, 1);
    kit.box('stone', 0, 0, z, open.w, open.y, 1);
    kit.box('stone', 0, open.y + open.h, z, open.w, HALL.peak + 1 - open.y - open.h, 1);
  }
  kit.add('stone', archPanel(g.w, g.h, 0.98), { at: [0, g.y, -L - 0.5] });
  // the great window’s mullions and transom, and its tracery wheel
  for (const x of [-g.w / 4, 0, g.w / 4]) kit.box('ashlar', x, g.y, -L + 0.1, 0.22, g.h - 1.6, 0.3);
  kit.box('ashlar', 0, g.y + g.h * 0.45, -L + 0.1, g.w, 0.22, 0.3);
  kit.add('ashlar', new THREE.TorusGeometry(1.5, 0.12, 6, 28), { at: [0, g.y + g.h - 2.2, -L + 0.1] });
  // the doors at the hall’s foot
  doors(kit, { at: [0, 0, L - 0.05], ry: Math.PI, w: HALL.doors.width, h: HALL.doors.height + 1.2, open: 0 });
}

function furnish(kit, plan) {
  const { table: t, bench: b } = HALL;
  for (const tb of plan.tables) table(kit, { at: [tb.x, 0, (tb.z0 + tb.z1) / 2], len: tb.z1 - tb.z0, w: t.width, top: t.top });
  for (const bn of plan.benches) bench(kit, { at: [bn.x, 0, (bn.z0 + bn.z1) / 2], len: bn.z1 - bn.z0, seat: b.top });
  // the high table across the dais, its cloth to the floor on the hall’s side
  const y = HALL.dais.height;
  table(kit, { at: [0, y, plan.staffZ], ry: Math.PI / 2, len: 17.4, w: 1.2, top: 0.8 });
  kit.box(kit.paint('#4a1426', { rough: 0.9 }), 0, y + 0.06, plan.staffZ + 0.62, 17.4, 0.74, 0.04);
  kit.box(kit.paint('#c9a24a', { rough: 0.5, metal: 0.6 }), 0, y + 0.72, plan.staffZ + 0.64, 17.4, 0.06, 0.05);
  for (const s of plan.staff) {
    if (s.gold) throne(kit, { at: [s.at[0], y, s.at[2]], ry: 0 });
    else chair(kit, { at: [s.at[0], y, s.at[2]], ry: 0, back: 1.4 });
  }
  lectern(kit, { at: plan.lectern.at, ry: 0 });
  // the fireplaces (their fires are lit by the room)
  return plan.fire.map((f) => fireplace(kit, { at: f.at, ry: f.yaw, w: 2.6, h: 2.6 }));
}

// the plates and goblets laid at every place; filled at the feast
function tableware(plan, { tier }) {
  const group = new THREE.Group();
  const places = plan.seats.filter((_, i) => tier !== 'low' || i % 2 === 0);
  const toTable = (s) => {
    const t = plan.tables.find((x) => x.house === s.house);
    const dir = Math.sign(t.x - s.at[0]);
    return { x: s.at[0] + dir * 0.62, z: s.at[2], dir };
  };
  const top = HALL.table.top;
  const plateGeo = new THREE.CylinderGeometry(0.13, 0.1, 0.018, 18);
  const gobletGeo = new THREE.LatheGeometry(
    [
      [0.0, 0],
      [0.045, 0],
      [0.045, 0.008],
      [0.008, 0.02],
      [0.008, 0.09],
      [0.042, 0.12],
      [0.05, 0.19],
      [0.046, 0.19],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    12,
  );
  const gold = new MeshStandardNodeMaterial({ color: new THREE.Color('#d2a94c'), roughness: 0.3, metalness: 1 });
  const plates = instanced(plateGeo, gold, places.map((s) => ({ at: [toTable(s).x, top + 0.009, toTable(s).z] })));
  const goblets = instanced(gobletGeo, gold, places.map((s) => { const p = toTable(s); return { at: [p.x - p.dir * 0.05, top, p.z + 0.22] }; }));
  // the feast: the plates heaped, the goblets brimming with pumpkin juice, dishes down the tables
  const heapGeo = new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const food = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.75 });
  const heaps = instanced(heapGeo, food, places.map((s) => ({ at: [toTable(s).x, top + 0.018, toTable(s).z], s: [1, 0.55, 1] })), { colours: ['#b5793a', '#c99a4a', '#8e5a2c', '#d8b070', '#a0603a'] });
  const juiceGeo = new THREE.CircleGeometry(0.044, 12).rotateX(-Math.PI / 2);
  const juice = new MeshStandardNodeMaterial({ color: new THREE.Color('#e07a1c'), roughness: 0.2 });
  const juices = instanced(juiceGeo, juice, places.map((s) => { const p = toTable(s); return { at: [p.x - p.dir * 0.05, top + 0.17, p.z + 0.22] }; }));
  const dishes = [];
  for (const t of plan.tables) for (let z = t.z0 + 1.5; z < t.z1 - 1; z += 2.6) dishes.push({ at: [t.x, top + 0.02, z], s: [1, 0.9, 1.4], ry: z * 0.3 });
  const dishGeo = new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const roast = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.6 });
  const roasts = instanced(dishGeo, roast, dishes, { colours: ['#8a4a22', '#b06a2a', '#c8a050', '#6a3a1a'] });
  const feast = [heaps, juices, roasts];
  for (const m of feast) m.visible = false;
  group.add(plates, goblets, ...feast);
  return {
    group,
    feast(on) {
      for (const m of feast) m.visible = Boolean(on);
    },
    dispose() {
      for (const m of [plates, goblets, ...feast]) m.dispose?.();
      for (const g of [plateGeo, gobletGeo, heapGeo, juiceGeo, dishGeo]) g.dispose();
      for (const m of [gold, food, juice, roast]) m.dispose();
    },
  };
}

// the twelve trees at Christmas: the kit’s pines, dressed in baubles and little lights
function christmas(plan, { load }) {
  const group = new THREE.Group();
  group.visible = false;
  const lights = [];
  const baubleGeo = new THREE.SphereGeometry(0.11, 8, 6);
  const baubleMat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.6 });
  const spots = [];
  let s = 41;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (const t of plan.trees) {
    for (let i = 0; i < 26; i++) {
      const y = 0.8 + rnd() * 5.6;
      const r = (1 - y / 7.2) * 1.9;
      const a = rnd() * Math.PI * 2;
      spots.push({ at: [t.at[0] + Math.cos(a) * r, y, t.at[2] + Math.sin(a) * r] });
    }
  }
  const baubles = instanced(baubleGeo, baubleMat, spots, { colours: ['#c0182a', '#d4ac4f', '#1f6b3e', '#2353d6', '#e8e8f0'] });
  group.add(baubles);
  // (a pine of the kit stood at each spot once it loads; until then the baubles hang on nothing)
  const trees = [];
  // (the MegaKit keeps its five pines in one file, each a node by its name)
  Promise.resolve(load?.('/kit/naturemega/pine.glb'))
    .then((gltf) => {
      const pine = gltf?.scene?.getObjectByName('Pine_3');
      if (!pine) return;
      for (const t of plan.trees) {
        const tree = pine.clone(true);
        tree.position.set(0, 0, 0);
        tree.rotation.set(0, 0, 0);
        const box = new THREE.Box3().setFromObject(tree);
        const k = (7.4 * t.s) / Math.max(0.1, box.max.y - box.min.y);
        tree.scale.setScalar(k);
        tree.position.set(t.at[0], -box.min.y * k, t.at[2]);
        group.add(tree);
        trees.push(tree);
      }
    })
    .catch(() => {});
  return {
    group,
    lights,
    dispose() {
      baubleGeo.dispose();
      baubleMat.dispose();
      baubles.dispose?.();
    },
  };
}

// the school at its tables (a share of the places, by the tier: the crowd is
// the hall’s heaviest thing) and the staff at the high table, sat and talking
const FILL = { low: 0.22, mid: 0.4, high: 0.5, ultra: 0.72 };
function people(rt, plan, { tier }) {
  const fill = FILL[tier] ?? FILL.high;
  const hash = (i) => ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
  const spots = plan.seats.filter((s, i) => hash(i) < fill).map((s) => ({ at: s.at, yaw: s.yaw, tag: s.house }));
  const crowd = createCrowd({ rt, spots, bodies: CROWD, clips: { idle: 'sit.idle', cheer: 'sit.cheer' }, tier });
  const staff = plan.staff.map((s, i) => {
    // (no ink hull up here: it draws each figure twice, and from the hall’s floor the line doesn’t read)
    const f = figure(s.who, { rt, seed: i + 3, ink: false });
    f.group.position.set(s.at[0], HALL.dais.height, s.at[2] + 0.12);
    f.set({ base: i % 3 === 1 ? 'sit.talk' : 'sit.idle' });
    return f;
  });
  const group = new THREE.Group();
  group.add(crowd.group, ...staff.map((f) => f.group));
  return {
    group,
    crowd,
    staff,
    step(dt, ctx) {
      crowd.step(dt, ctx);
      for (const f of staff) f.tick(dt);
    },
    dispose() {
      crowd.dispose();
      for (const f of staff) f.dispose();
    },
  };
}

function build(rt, ctx = {}) {
  const house = ctx.house ?? null;
  const opts = { ...(ctx.props ?? {}), load: ctx.load };
  const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
  const renderer = ctx.renderer ?? rt?.gfx?.renderer ?? null;
  const plan = hallPlan({ tier });
  const group = new THREE.Group();
  group.name = 'room:greatHall';
  const kit = createRoomKit({ house, tier });
  architecture(kit, plan);
  const firesAt = furnish(kit, plan);
  const ware = tableware(plan, { tier });
  const hourglasses = createHourglasses({ spots: plan.hourglasses, kit, tier });
  stool(kit, { at: plan.stool.at });
  const statics = kit.build(group);
  const candles = createCandles({ count: plan.candles.count, box: plan.candles.box, tier });
  const ceiling = createCeiling({ width: HALL.width, length: HALL.length, spring: HALL.wall + 0.3, rise: HALL.peak - HALL.wall, tier });
  const hang = (cup) => createBanners(cup ? plan.banners.map((s) => ({ ...s, house: cup })) : plan.banners, { renderer, w: plan.banners[0].w, h: plan.banners[0].h });
  let banners = hang(opts.cup ?? null);
  let cupFor = opts.cup ?? null;
  const windows = createWindows(
    [...plan.windows.map((w) => ({ at: [w.side * (W + 0.02), w.y, w.z], w: w.w, h: w.h, ry: w.side > 0 ? -Math.PI / 2 : Math.PI / 2 })), { at: [0, plan.great.y, -L - 0.02], w: plan.great.w, h: plan.great.h, ry: 0 }],
    { renderer },
  );
  const fires = firesAt.map((at) => createFire({ at, w: 1.6, h: 1.25, tongues: 5, tier }));
  const trees = christmas(plan, { load: opts.load ?? ((url) => rt?.assets?.gltf?.(url)) });
  // the room’s own light: the candles’ warmth from above, the stone’s cool bounce from below
  const hemi = new THREE.HemisphereLight(0xe8d4b8, 0x262628, 0.38);
  const daylight = new THREE.DirectionalLight(0xdfe6f0, 0);
  daylight.position.set(-20, 30, 6);
  group.add(ware.group, hourglasses.group, candles.group, ceiling.group, banners.group, windows.group, trees.group, hemi, daylight, daylight.target);
  let gone = false;
  const folk = opts.people === false ? null : people(rt, plan, { tier });
  if (folk) {
    group.add(folk.group);
    // (the figures come in late: the house’s look put on them as they do)
    Promise.all([folk.crowd.ready, ...folk.staff.map((f) => f.ready)]).then(() => !gone && house?.adopt?.(folk.group));
  }
  for (const f of fires) group.add(f.group);
  house?.adopt?.(group);
  // the gold and the brass catch the candles: a little warm room to reflect, made once
  let env = null;
  roomEnv(renderer)
    .then((tex) => {
      if (gone) return tex?.dispose();
      env = tex;
      const mats = new Set();
      group.traverse((o) => o.material && [o.material].flat().forEach((m) => mats.add(m)));
      wearEnv([...mats].filter((m) => m.metalness > 0.3), env, 1);
      wearEnv([...mats].filter((m) => m.metalness <= 0.3 && !m.userData.noHouse), env, 0.25);
    })
    .catch(() => {});

  let points = opts.points ?? {};
  hourglasses.jump(points);
  const room = {
    id: 'greatHall',
    name: 'The Great Hall',
    group,
    plan,
    // (the registry’s shapes, rooms/index.js: circles the walk goes round, the dais and its steps as floors)
    colliders: plan.colliders.map((c) => ({ kind: 'circle', ...c })),
    floors: [
      { id: 'dais', line: [[-HALL.width / 2, HALL.dais.height, (HALL.dais.z - L) / 2], [HALL.width / 2, HALL.dais.height, (HALL.dais.z - L) / 2]], width: L + HALL.dais.z },
      { id: 'dais-steps', line: [[0, 0, HALL.dais.z + 1.2], [0, HALL.dais.height, HALL.dais.z]], width: HALL.width - 1 },
    ],
    bounds: plan.bounds,
    floorAt: plan.floorAt,
    doors: plan.doors,
    places: plan.places,
    spawn: { at: [plan.start.at[0], 0, plan.start.at[1]], yaw: plan.start.yaw },
    start: plan.start,
    statics,
    // (the checks’ and the arrival’s named views: where the eye stands, where it looks)
    poses: {
      doors: { at: [0, 1.55, L - 2.5], look: [0, 4.2, -L + 4] },
      aisle: { at: [-4.4, 1.5, 4], look: [0, 3.6, -L + 2] },
      // (between Snape’s chair and the Headmaster’s, over their heads: behind Hagrid there is only Hagrid)
      dais: { at: [-1.9, HALL.dais.height + 2.2, plan.staffZ - 1.4], look: [0, 2.2, L - 6] },
      ceiling: { at: [0, 1.5, 6], look: [0, 18, -8] },
      hourglasses: { at: [0, 1.6, L - 9], look: [-6.4, 2.6, L - 1.6] },
      stool: { at: [0, 1.3, plan.stool.at[2] + 5], look: [0, 1.6, plan.stool.at[2] - 6] },
    },
    folk,
    // the table that cheers as a house is called (the Sorting): every place of `house` at it
    cheer(houseId, seconds = 7) {
      folk?.crowd.cheer((p) => p.tag === houseId, seconds);
    },
    step(dt, ctx = {}) {
      folk?.step(dt, ctx);
      candles.step(dt);
      hourglasses.step(dt);
      for (const f of fires) f.step(dt);
      if (ctx.sky || ctx.hour != null) room.set({ sky: ctx.sky, hour: ctx.hour });
    },
    set(p = {}) {
      if (p.points && p.points !== points) {
        points = p.points;
        // (settle: as they stand when you come in; otherwise the stones run, as they do when a teacher says the words)
        if (p.settle) hourglasses.jump(points);
        else hourglasses.set(points);
      }
      if (p.feast != null) ware.feast(p.feast);
      if (p.cup !== undefined && (p.cup ?? null) !== cupFor) {
        cupFor = p.cup ?? null;
        banners.dispose();
        banners = hang(cupFor);
        group.add(banners.group);
        house?.adopt?.(banners.group);
      }
      if (p.christmas != null) {
        trees.group.visible = Boolean(p.christmas);
        if (trees.group.visible) house?.adopt?.(trees.group);
      }
      const sky = p.sky ?? (p.hour != null ? skyAt(p.hour, { cloud: p.cloud ?? 0.3, rain: p.rain ?? 0 }) : null);
      if (sky) {
        ceiling.set(sky);
        const up = Math.max(0, Math.min(1, (sky.sun.dir[1] + 0.05) / 0.4));
        const dusk = Math.max(0, 1 - Math.abs(sky.sun.dir[1]) / 0.2) * (sky.sun.dir[1] > -0.2 ? 1 : 0);
        windows.set({ day: up * (1 - (sky.rain ?? 0) * 0.4), dusk: dusk * 0.6 });
        daylight.intensity = up * 1.2;
        // (by day the candles burn low; at night they are the light)
        candles.set({ dim: 1 - up * 0.45 });
        hemi.intensity = 0.55 + up * 0.5;
      }
    },
    info: () => ({ ...countOf(group), candles: candles.count, hourglasses: hourglasses.shown(), crowd: folk?.crowd.info() ?? null }),
    dispose() {
      gone = true;
      env?.dispose();
      folk?.dispose();
      candles.dispose();
      ceiling.dispose();
      hourglasses.dispose();
      banners.dispose();
      windows.dispose();
      for (const f of fires) f.dispose();
      trees.dispose();
      ware.dispose();
      kit.dispose();
      group.removeFromParent();
    },
  };
  room.set({ hour: opts.hour ?? 21, feast: opts.feast ?? false, christmas: opts.christmas ?? false, sky: opts.sky });
  return room;
}

export default { id: 'greatHall', name: 'The Great Hall', build };
