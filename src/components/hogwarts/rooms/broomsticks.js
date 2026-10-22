// The Three Broomsticks (the design’s §4.9): the inn on Hogsmeade’s High
// Street, warm and loud. The bar along the back with its brass pumps and the
// bottles behind it on their shelves, the barrels racked in the corner,
// Madam Rosmerta behind the bar, a fire in the side wall with three brooms
// crossed over its chimney breast (the inn’s name, hung where you’d look for
// it), round tables with students at them and tankards of butterbeer, and on
// an evening Hagrid at the big table by the fire. Ask at the bar and a
// butterbeer comes sliding down it (quest 12’s first thing).
//
// A room for rooms/host.js: build(rt, ctx) → room (its header says the shape);
// the frame: the floor’s middle at the origin, the street door at +z.

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { createRoomKit, countOf, instanced } from './kit';
import { bookcase, fireplace } from './parts/furniture';
import { createFire } from './parts/fire';
import { roomEnv, wearEnv } from './parts/env';
import { lamp, panes, shell, signBoard } from './village/shell';
import { BOTTLES, createStock, fill } from './village/stock';
import { LINES, streetSide } from './village/plan';
import { CROWD, figure } from '../cast/figures';

const W = 16;
const D = 12;
const H = 3.9;
const BAR = { x0: -6.2, x1: 2.2, z: -3.7, top: 1.08, d: 0.8 };
const ASK = [-1.6, -2.75];
// the round tables: [x, z, seats]; the first, by the fire, is the big one Hagrid takes of an evening
const TABLES = [
  [-4.3, -1.5, 5],
  [-1.6, 3.4, 4],
  [1.4, 0.6, 4],
  [4.6, 2.9, 4],
  [5.2, -1.4, 3],
  [-4.9, 4.4, 3],
  [1.8, 4.6, 3],
];
const SEAT = 0.47;
const LAMP = 18; // a lamp’s light: warm and low, the fire doing the rest

// (the seats round a table, each facing its middle; the walk’s and the figures’ yaw: facing (sin, cos))
function seatsOf([x, z, n], r = 0.82) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + x * 0.7;
    const at = [x + Math.cos(a) * r, z + Math.sin(a) * r];
    out.push({ at, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) });
  }
  return out;
}

function build(rt, ctx = {}) {
  const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
  const props = ctx.props ?? {};
  const renderer = ctx.renderer ?? rt?.gfx?.renderer ?? null;
  const evening = (props.hour ?? 20) >= 18 || (props.hour ?? 20) < 2;
  const group = new THREE.Group();
  group.name = 'room:broomsticks';
  const kit = createRoomKit({ tier });
  const room = shell(kit, { w: W, d: D, h: H, floor: 'board', wall: '#d8c39c', lower: 'darkoak', ceiling: '#a8946e', beams: 5, sag: 0.08, door: { x: 0.6, w: 1.4, h: 2.3 }, windows: [-4.6, 5].map((x) => ({ x, w: 2.6, y: 0.85, h: 1.75 })) });
  panes(kit, room.panes, props.hour ?? 20);

  // the bar: a long panelled counter, its top polished, a brass rail along its foot
  const bx = (BAR.x0 + BAR.x1) / 2;
  const bw = BAR.x1 - BAR.x0;
  kit.box('darkoak', bx, 0, BAR.z, bw, BAR.top - 0.07, BAR.d);
  kit.box('oak', bx, BAR.top - 0.07, BAR.z, bw + 0.14, 0.07, BAR.d + 0.14);
  for (let x = BAR.x0 + 0.45; x < BAR.x1 - 0.2; x += 0.7) kit.box('oak', x, 0.15, BAR.z + BAR.d / 2 + 0.01, 0.5, BAR.top - 0.4, 0.03);
  kit.cyl('brass', bx, 0.16, BAR.z + BAR.d / 2 + 0.16, 0.025, 0.025, bw, { seg: 8, rz: Math.PI / 2 });
  kit.wall(BAR.x0, BAR.z, BAR.x1, BAR.z, 0.55);
  kit.solid(BAR.x1 + 0.2, BAR.z - 0.6, 0.5);
  // the pumps: tall brass-capped handles in a row
  for (let i = 0; i < 4; i++) {
    const x = -2.6 + i * 0.32;
    kit.cyl('brass', x, BAR.top, BAR.z + 0.1, 0.035, 0.045, 0.12, { seg: 10 });
    kit.cyl('darkoak', x, BAR.top + 0.12, BAR.z + 0.1, 0.022, 0.03, 0.34, { seg: 8, rx: 0.12 });
    kit.cyl('brass', x, BAR.top + 0.45, BAR.z + 0.06, 0.03, 0.022, 0.05, { seg: 8 });
  }
  // the back bar: shelves of bottles behind Rosmerta, a mirror between them
  const slots = [];
  for (const x of [-4.2, -0.2]) slots.push(...bookcase(kit, { at: [x, 0, -D / 2 + 0.25], ry: 0, w: 3.7, h: 3.0, shelves: 5, mat: 'darkoak' }).slice(1));
  const bottles = createStock(fill(slots, { seed: 23, kinds: BOTTLES, tier }), { tier });
  group.add(bottles.group);
  kit.box(kit.paint('#8a9aa6', { rough: 0.08, metal: 0.9 }), -2.2, 1.3, -D / 2 + 0.08, 0.3, 1.5, 0.02);
  // the barrels, racked on their sides in the corner
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 4 - row; i++) {
      const x = 3.6 + i * 0.85 + row * 0.42;
      kit.cyl('oak', x, 0.42 + row * 0.74, -D / 2 + 0.75, 0.38, 0.38, 0.95, { seg: 14, rx: Math.PI / 2 });
      for (const k of [-0.32, 0.32]) kit.cyl('iron', x, 0.42 + row * 0.74, -D / 2 + 0.75 + k, 0.395, 0.395, 0.05, { seg: 14, rx: Math.PI / 2 });
    }
  kit.box('darkoak', 4.8, 0, -D / 2 + 0.75, 3.6, 0.06, 1.0);
  kit.wall(3.2, -D / 2 + 0.8, 7.4, -D / 2 + 0.8, 0.6);

  // the fire in the left-hand wall, and the three brooms crossed over it
  const fireAt = fireplace(kit, { at: [-W / 2 + 0.4, 0, 0.9], ry: Math.PI / 2, w: 2.2, h: 1.9, mat: 'stonewarm' });
  const fire = createFire({ at: fireAt, w: 1.5, h: 0.95, tongues: 5, tier });
  group.add(fire.group);
  kit.solid(-W / 2 + 0.6, 0.9, 1.0);
  // (in the wall’s plane, crossed at their middles: each turned about the wall’s normal)
  const straw = kit.paint('#b58a4a', { rough: 1 });
  for (let i = 0; i < 3; i++) {
    const a = -0.6 + i * 0.6;
    const at = [-W / 2 + 0.66 + i * 0.03, 3.05, 0.9];
    kit.add('oak', new THREE.CylinderGeometry(0.018, 0.02, 1.5, 7), { at, rx: a });
    kit.add(straw, new THREE.ConeGeometry(0.1, 0.42, 9).translate(0, -0.93, 0), { at, rx: a });
    kit.add('iron', new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8).translate(0, -0.73, 0), { at, rx: a });
  }

  // the tables: round tops on a turned leg, their stools round them
  const cups = [];
  const candles = [];
  for (const t of TABLES) {
    const [x, z] = t;
    const big = t === TABLES[0];
    const r = big ? 0.7 : 0.55;
    kit.cyl('oak', x, 0.72, z, r, r, 0.05, { seg: 20 });
    kit.cyl('darkoak', x, 0.06, z, 0.07, 0.09, 0.66, { seg: 10 });
    kit.cyl('darkoak', x, 0, z, 0.3, 0.34, 0.06, { seg: 14 });
    kit.solid(x, z, r + 0.2);
    for (const s of seatsOf(t, r + 0.3)) {
      kit.cyl('oak', s.at[0], SEAT - 0.04, s.at[1], 0.19, 0.19, 0.04, { seg: 12 });
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        kit.cyl('darkoak', s.at[0] + Math.cos(a) * 0.12, 0, s.at[1] + Math.sin(a) * 0.12, 0.02, 0.025, SEAT - 0.04, { seg: 5 });
      }
    }
    candles.push([x, 0.77, z]);
    for (let k = 0; k < (big ? 4 : 2); k++) cups.push({ at: [x + Math.cos(k * 1.9 + x) * r * 0.6, 0.77, z + Math.sin(k * 1.9 + x) * r * 0.6], ry: k });
  }
  // tankards of butterbeer, their foam over the brim
  const mugGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.15, 12).translate(0, 0.075, 0);
  const foamGeo = new THREE.SphereGeometry(0.056, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.15, 0);
  const mugMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#8f8a80'), roughness: 0.4, metalness: 0.7 });
  const foamMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#f3e2b8'), roughness: 0.85 });
  cups.push({ at: [ASK[0] + 0.2, BAR.top, BAR.z + 0.25], ry: 0 }, { at: [ASK[0] + 1.4, BAR.top, BAR.z + 0.2], ry: 1 });
  const mugs = instanced(mugGeo, mugMat, cups);
  const foam = instanced(foamGeo, foamMat, cups);
  group.add(mugs, foam);
  // a candle on each table, in a little brass holder
  for (const c of candles) {
    kit.cyl('brass', c[0], c[1] - 0.05, c[2], 0.05, 0.06, 0.03, { seg: 10 });
    kit.cyl('wax', c[0], c[1] - 0.02, c[2], 0.022, 0.022, 0.12, { seg: 8 });
    kit.add(kit.glow('#ffb35a', 3), new THREE.SphereGeometry(0.018, 6, 5), { at: [c[0], c[1] + 0.12, c[2]], scale: [1, 1.7, 1] });
  }

  // the name over the bar
  const sign = signBoard({ text: 'The Three Broomsticks', w: 3.8, h: 0.55, bg: '#2a3a2a', fg: '#e3c06a', renderer });
  sign.mesh.position.set(-2.2, H - 0.62, -D / 2 + 0.44);
  group.add(sign.mesh);

  // the light: lamps along the beams, the fire’s own, the warm bounce
  const lamps = [
    [-4.2, H - 0.3, -2.4],
    [-1.4, H - 0.3, -2.6],
    [1.4, H - 0.3, -2.4],
    [4.6, H - 0.3, -0.8],
    [-3.0, H - 0.3, 2.6],
    [3.2, H - 0.3, 3.4],
  ].map((at) => lamp(kit, group, { at, tier, k: LAMP, colour: '#ffc488', distance: 11 }));
  const hemi = new THREE.HemisphereLight(0xffe4c0, 0x5a3e28, 1.25);
  group.add(hemi);
  kit.build(group);

  // the people: Rosmerta behind the bar, students at the tables, Hagrid by the fire of an evening
  const house = ctx.house ?? null;
  const rosmerta = figure('rosmerta', { rt, seed: 5 });
  rosmerta.group.position.set(ASK[0] - 0.3, 0, BAR.z - 0.9);
  rosmerta.set({ base: null, speed: 0 });
  group.add(rosmerta.group);
  // (whole figures, not the hall’s crowd: in a room this small every face is near the eye)
  const folkSpots = [];
  TABLES.forEach((t, ti) => {
    seatsOf(t, (t === TABLES[0] ? 0.7 : 0.55) + 0.3).forEach((s, si) => {
      // (Hagrid’s place at the big table kept for him; most seats empty: it’s a quiet hour)
      if (ti === 0 && si === 0) return;
      if ((ti * 3 + si) % 4 !== 1) return;
      folkSpots.push(s);
    });
  });
  const many = { low: 3, mid: 5, high: 8, ultra: 10 }[tier] ?? 8;
  const folk = folkSpots.slice(0, many).map((s, i) => {
    const f = figure(CROWD[i % CROWD.length], { rt, seed: 20 + i });
    f.group.position.set(s.at[0], 0, s.at[1]);
    f.group.rotation.y = s.yaw;
    f.set({ base: i % 3 === 1 ? 'sit.talk' : 'sit.idle' });
    group.add(f.group);
    return f;
  });
  const hagridSeat = seatsOf(TABLES[0], 1.0)[0];
  const hagrid = evening ? figure('hagrid', { rt, seed: 9 }) : null;
  if (hagrid) {
    hagrid.group.position.set(hagridSeat.at[0], 0, hagridSeat.at[1]);
    hagrid.group.rotation.y = hagridSeat.yaw;
    hagrid.set({ base: 'sit.talk' });
    group.add(hagrid.group);
  }
  let gone = false;
  Promise.all([...folk.map((f) => f.ready), rosmerta.ready, hagrid?.ready].filter(Boolean)).then(() => !gone && house?.adopt?.(group));

  let env = null;
  roomEnv(renderer, { warm: '#ffb878', windows: '#5a6a90', walls: '#3a2a1c' })
    .then((tex) => {
      if (gone) return tex?.dispose();
      env = tex;
      wearEnv([...kit.materials(), mugMat].filter((m) => m.metalness > 0.3), env, 1);
    })
    .catch(() => {});

  const street = streetSide('broomsticks');
  let poured = Boolean(props.found?.butterbeer);
  let t = 0;
  const out = {
    id: 'broomsticks',
    name: 'The Three Broomsticks',
    group,
    spawn: { at: [room.door[0], 0, room.door[1] - 0.6], yaw: 0 },
    colliders: kit.colliders,
    floors: [],
    bounds: room.bounds,
    floorAt: () => 0,
    doors: [{ id: 'street', at: [0.6, D / 2 - 0.25], r: 0.9, name: 'Hogsmeade', verb: 'Go out', faces: 0, to: 'hogsmeade', toAt: street.at, toYaw: street.yaw }],
    out: { to: 'hogsmeade', at: street.at, yaw: street.yaw },
    spots: [{ id: 'bar', at: ASK, r: 0.8, verb: 'Ask for', label: 'A butterbeer' }],
    places: [
      { id: 'bar', name: 'The bar', at: [bx, BAR.z], r: 3 },
      { id: 'fire', name: 'The fire', at: [-W / 2 + 1.5, 0.9], r: 2.5 },
    ],
    poses: {
      door: { at: [0.6, 1.6, D / 2 - 1.3], look: [-1.6, 1.3, -D / 2] },
      bar: { at: [-0.4, 1.55, -0.6], look: [-2.2, 1.4, -D / 2 + 0.3] },
      fire: { at: [-2.4, 1.6, 3.4], look: [-W / 2 + 0.3, 1.5, 0.9] },
      tables: { at: [6.2, 1.7, 4.8], look: [-2, 0.9, -0.8] },
    },
    use(id) {
      if (id !== 'bar') return;
      ctx.say?.(poured ? LINES.again : LINES.butterbeer);
      if (!poured) ctx.tell?.('butterbeer', {});
      poured = true;
      rosmerta.look?.(group.localToWorld(new THREE.Vector3(ASK[0], 1.5, ASK[1])));
    },
    step(dt) {
      t += dt;
      fire.step(dt);
      for (const f of folk) f.tick(dt);
      rosmerta.tick(dt);
      hagrid?.tick(dt);
      lamps.forEach((l, i) => l && (l.intensity = LAMP * (0.93 + 0.07 * Math.sin(t * 2.1 + i * 1.3))));
    },
    set() {},
    info: () => ({ ...countOf(group), bottles: bottles.count, folk: folk.length, hagrid: Boolean(hagrid) }),
    dispose() {
      gone = true;
      env?.dispose();
      fire.dispose();
      for (const f of folk) f.dispose();
      rosmerta.dispose();
      hagrid?.dispose();
      bottles.dispose();
      sign.dispose();
      for (const m of [mugs, foam]) m.dispose?.();
      for (const g of [mugGeo, foamGeo]) g.dispose();
      for (const m of [mugMat, foamMat]) m.dispose();
      kit.dispose();
      group.removeFromParent();
    },
  };
  return out;
}

export default { id: 'broomsticks', name: 'The Three Broomsticks', build };
