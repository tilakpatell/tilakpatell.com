// The Grand Staircase (the design’s §4.4): the tower of stairs between the
// floors, eight floors of landings drawn, the stairs swinging on their
// schedule (rules/staircases.js: never the one you’re on, never leaving a
// landing that nothing reaches), the portraits on every wall talking as you
// pass and one of them wandering off when you look away (rules/portraits.js),
// the Fat Lady at the top wanting the password, the Ravenclaw knocker’s
// riddle on the fifth floor, the trick step on the way to the third. The
// room’s plan is ./plan/staircase.js.
//
// You walk a landing (its platform, and the gallery across where its floor
// has one); a stair is a door at its foot or its head (“E Climb · The fifth
// floor, west”), and taking it is a short ride along it, the stair held
// still under you. The ground floor is the Entrance Hall: the Great Hall’s
// door, the great doors out, and on the east wall the way down to the
// dungeons, the bare wall that is Slytherin’s, the fruit bowl whose pear the
// kitchens answer to, and the barrels by Hufflepuff’s.
//
//   default: { id, name, build(rt, ctx) → room } (./host.js says the shape)
//   room.word(text): the password or the riddle’s answer typed into the HUD’s card

import * as THREE from 'three';
import { GALLERIES, LANDINGS, STAIRS, createStairs, endOf, stepStairs } from '../rules/staircases';
import { FAT_LADY, FRAMES, REACH, fatLady, hangs, passing, trick, wander } from '../rules/portraits';
import { KNOCKER, answer as answerRiddle, knock, riddleFor } from '../rules/riddles';
import { LINES } from '../rules/lines';
import { SHAFT, areaOf, frameAt, landingAt, spawnAt, stairEnds } from './plan/staircase';
import { countOf, createRoomKit } from './kit';
import { createPortraits } from './portraits';
import { createFire } from './parts/fire';
import { createWindows } from './parts/glass';
import { roomEnv, wearEnv } from './parts/env';
import { ROOM_ORIGIN } from './host';

const H = SHAFT.half;
const TOP = SHAFT.floor * SHAFT.floors + 2; // m: the shaft’s ceiling
const N_TREADS = 18;
const CLIMB = 1.4; // m a second along a stair
const EYE = 1.45;

// what each landing’s doors open on, by name (a room not built yet says it’s locked)
export const ROOM_NAMES = {
  greatHall: 'The Great Hall',
  potions: 'The dungeons',
  charms: 'The Charms classroom',
  defence: 'The Defence classroom',
  library: 'The library',
  owlery: 'The Owlery',
  requirement: 'The seventh-floor corridor',
  astronomy: 'The Astronomy Tower',
  gryffindor: 'The Fat Lady',
  ravenclaw: 'The eagle knocker',
  slytherin: 'A bare dungeon wall',
  hufflepuff: 'The barrels',
  kitchens: 'The fruit bowl',
};

// ── the stair, built once a unit long (z 0 to 1) and a floor high: stretched to its run
function shear(g, k) {
  // (y gains k for every unit of z: the flight’s slope, whatever its run)
  g.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, k, 0, 0, 0, 1, 0, 0, 0, 0, 1));
  return g;
}
function stairGeometry() {
  const rise = SHAFT.floor;
  const treads = [];
  for (let i = 0; i < N_TREADS; i++) {
    const g = new THREE.BoxGeometry(1.8, 0.2, 1 / N_TREADS);
    g.translate(0, (rise * (i + 1)) / N_TREADS - 0.1, (i + 0.5) / N_TREADS);
    treads.push(g);
  }
  // the soffit under the treads and the two stringers, sloped with the flight
  const soffit = shear(new THREE.BoxGeometry(1.8, 0.3, 1).translate(0, -0.2, 0.5), rise);
  const strings = [-0.95, 0.95].map((x) => shear(new THREE.BoxGeometry(0.16, 0.7, 1).translate(x, 0, 0.5), rise));
  const stone = mergeAll([...treads, soffit, ...strings]);
  // the rails: a post every sixth of the way and a handrail a metre over the treads, either side
  const iron = [];
  for (const x of [-0.92, 0.92]) {
    for (let i = 0; i <= 6; i++) iron.push(new THREE.CylinderGeometry(0.025, 0.025, 1, 6).translate(x, 0.5 + (rise * i) / 6, i / 6));
    iron.push(shear(new THREE.BoxGeometry(0.06, 0.06, 1).translate(x, 1.0, 0.5), rise));
  }
  return { stone, iron: mergeAll(iron) };
}
function mergeAll(geos) {
  const out = new THREE.BufferGeometry();
  let n = 0;
  let idx = 0;
  for (const g of geos) {
    n += g.attributes.position.count;
    idx += g.index.count;
  }
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uvs = new Float32Array(n * 2);
  const index = new Uint32Array(idx);
  let v = 0;
  let k = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, v * 3);
    nor.set(g.attributes.normal.array, v * 3);
    uvs.set(g.attributes.uv.array, v * 2);
    for (let i = 0; i < g.index.count; i++) index[k++] = g.index.array[i] + v;
    v += g.attributes.position.count;
    g.dispose();
  }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeVertexNormals();
  return out;
}

// ── the shaft: walls, the ground floor, the landings, the galleries, the doorways
function doorway(kit, { y, z, side, w = 1.6, h = 2.8, open = false }) {
  const inX = side === 'w' ? 1 : -1;
  const wx = side === 'w' ? -H : H;
  // an arch of dressed stone proud of the wall, the door dark oak in it (or the dark beyond, open)
  kit.box('ashlar', wx + inX * 0.12, y, z - w / 2 - 0.25, 0.3, h + 0.3, 0.25);
  kit.box('ashlar', wx + inX * 0.12, y, z + w / 2 + 0.25, 0.3, h + 0.3, 0.25);
  kit.box('ashlar', wx + inX * 0.12, y + h, z, 0.3, 0.45, w + 0.75);
  kit.box(open ? kit.paint('#0c0a08') : 'darkoak', wx + inX * 0.05, y, z, 0.1, h, w);
  if (!open) kit.box('iron', wx + inX * 0.12, y + h * 0.48, z + w * 0.3, 0.06, 0.08, 0.08);
}

function shaft(kit) {
  // the four walls the full height, the ground floor’s flags, the ceiling high up
  kit.box('stonedark', -H - 0.5, 0, 0, 1, TOP, H * 2 + 2);
  kit.box('stonedark', H + 0.5, 0, 0, 1, TOP, H * 2 + 2);
  kit.box('stonedark', 0, 0, -H - 0.5, H * 2, TOP, 1);
  kit.box('stonedark', 0, 0, H + 0.5, H * 2, TOP, 1);
  kit.box('flags', 0, -0.3, 0, H * 2, 0.3, H * 2);
  kit.box('stonedark', 0, TOP, 0, H * 2 + 2, 0.6, H * 2 + 2);
  // the floors’ string courses round the walls, a band of ashlar at each landing’s height
  for (let f = 1; f < SHAFT.floors; f++) {
    const y = f * SHAFT.floor - 0.6;
    kit.box('ashlar', -H + 0.1, y, 0, 0.2, 0.3, H * 2);
    kit.box('ashlar', H - 0.1, y, 0, 0.2, 0.3, H * 2);
    kit.box('ashlar', 0, y, -H + 0.1, H * 2, 0.3, 0.2);
    kit.box('ashlar', 0, y, H - 0.1, H * 2, 0.3, 0.2);
  }
  // every landing: its slab on a corbel, a low wall at its open corners, its doorway
  for (const l of LANDINGS) {
    const p = landingAt(l.id);
    const [x0, x1, z0, z1] = p.rect;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    if (l.floor > 0) {
      kit.box('ashlar', cx, p.at[1] - 0.45, cz, x1 - x0, 0.45, z1 - z0);
      // (the corbel under it, stepped back into the wall)
      const wx = l.side === 'w' ? x0 + 0.6 : x1 - 0.6;
      kit.box('stone', wx, p.at[1] - 2.2, cz, 1.2, 1.75, 2.4);
      const inner = l.side === 'w' ? x1 : x0;
      for (const zz of [z0 + 0.4, z1 - 0.4]) kit.box('ashlar', inner - (l.side === 'w' ? 0.12 : -0.12), p.at[1], zz, 0.24, 0.95, 0.8);
    }
  }
  // the galleries across: the fourth floor’s bridge and the seventh’s corridor (the ground floor is floor)
  for (const [a] of GALLERIES) {
    const p = landingAt(a);
    if (p.floor === 0) continue;
    const z = p.at[2];
    kit.box('ashlar', 0, p.at[1] - 0.45, z, H * 2 - 2 * SHAFT.platform.deep + 0.2, 0.45, SHAFT.gallery);
    for (const s of [-1, 1]) kit.box('ashlar', 0, p.at[1], z + s * (SHAFT.gallery / 2 - 0.12), H * 2 - 2 * SHAFT.platform.deep, 0.95, 0.24);
    // (a pier under the bridge’s middle, down to the floor below’s string course)
    kit.box('stone', 0, p.at[1] - 3.2, z, 1.2, 2.75, SHAFT.gallery - 0.4);
  }
}

// the doors each landing opens on, placed along its wall
function doorsOf(l) {
  const p = landingAt(l.id);
  if (l.id === '0w') return [{ key: 'greatHall', at: [-H + 0.6, -6], side: 'w', z: -6 }];
  if (l.id === '0e') return ['potions', 'slytherin', 'kitchens', 'hufflepuff'].map((key, i) => ({ key, side: 'e', z: [-9, -3, 3, 9][i], at: [H - 0.6, [-9, -3, 3, 9][i]] }));
  return l.doors.map((key, i) => {
    const z = p.at[2] + (l.doors.length > 1 ? (i - (l.doors.length - 1) / 2) * 2.4 : 0);
    return { key, side: l.side, z, at: [p.at[0] + (l.side === 'w' ? -1.4 : 1.4), z] };
  });
}

function build(rt, ctx = {}) {
  const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
  const house = ctx.house ?? null;
  const renderer = ctx.renderer ?? rt?.gfx?.renderer ?? null;
  const props = ctx.props ?? {};
  const tell = ctx.tell ?? (() => {});
  const say = (who, name, text) => tell('line', { who, name, text });
  const toast = (text) => tell('toast', { text });
  const group = new THREE.Group();
  group.name = 'room:staircase';
  const kit = createRoomKit({ house, tier });
  shaft(kit);

  // the doorways (the ground floor’s east wall has four; the great doors in the south wall)
  const doorSpots = LANDINGS.flatMap((l) => doorsOf(l).map((d) => ({ ...d, landing: l.id, y: l.floor * SHAFT.floor })));
  for (const d of doorSpots) if (d.key !== 'gryffindor' && d.key !== 'kitchens' && d.key !== 'hufflepuff') doorway(kit, { y: d.y, z: d.z, side: d.side, open: d.key === 'requirement' });
  // the great doors out to the grounds, in the south wall
  kit.box('ashlar', 0, 0, H - 0.15, 5.6, 6.4, 0.3);
  kit.box('darkoak', 0, 0, H - 0.3, 4.4, 5.8, 0.12);
  // the barrels by Hufflepuff’s (a stack in the ground floor’s north-east corner)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) kit.cyl('board', H - 0.55, r * 0.62, 8 + c * 0.66 - (3 - r) * 0.1 + r * 0.33, 0.31, 0.31, 0.62, { rz: Math.PI / 2, seg: 10 });

  // the portraits: the dozen on the walls, the Fat Lady in her doorway, the fruit bowl by the kitchens
  let pstate = hangs();
  const frameSpots = FRAMES.map((id) => ({ id, ...frameAt(id), subject: pstate.at[id] }));
  const lady = landingAt('7w');
  frameSpots.push({ id: 'fatlady', at: [-H + 0.08, lady.at[1] + 1.45, lady.at[2]], ry: Math.PI / 2, w: 1.5, h: 2.3, subject: 'fatlady' });
  frameSpots.push({ id: 'fruit', at: [H - 0.08, 1.7, 3], ry: -Math.PI / 2, w: 1.0, h: 0.8, subject: 'empty' });
  const portraits = createPortraits({ frames: frameSpots, kit, renderer });

  const statics = kit.build(group);

  // the stairs: two meshes each (the stone flight and its iron rails), moved every frame they swing
  const geo = stairGeometry();
  const stoneMat = kit.mat('ashlar');
  const ironMat = kit.mat('iron');
  const flights = new Map();
  for (const s of STAIRS) {
    const g = new THREE.Group();
    g.name = `stair:${s.id}`;
    const a = new THREE.Mesh(geo.stone, stoneMat);
    const b = new THREE.Mesh(geo.iron, ironMat);
    a.castShadow = b.castShadow = tier !== 'low';
    a.receiveShadow = true;
    g.add(a, b);
    group.add(g);
    flights.set(s.id, g);
  }

  // the light: torches by every doorway (their flames; real light in a few), tall windows high in the end walls
  const torchAt = LANDINGS.map((l) => {
    const p = landingAt(l.id);
    return [p.at[0] + (l.side === 'w' ? 0.5 : -0.5) - (l.side === 'w' ? 1.0 : -1.0), p.at[1] + 2.4, p.at[2] + 1.6];
  });
  const lit = { low: 0, mid: 4, high: 8, ultra: 10 }[tier] ?? 4;
  const fires = torchAt.map((at, i) => createFire({ at, w: 0.22, h: 0.4, tongues: 2, tier, light: i % Math.max(1, Math.ceil(torchAt.length / Math.max(1, lit))) === 0 && lit > 0 }));
  for (const f of fires) group.add(f.group);
  const windows = createWindows(
    [0, 1, 2, 3].flatMap((i) => [
      { at: [-6 + i * 4, 12 + (i % 2) * 9, -H + 0.02], w: 1.8, h: 6.5, ry: 0 },
      { at: [-6 + i * 4, 16 + (i % 2) * 9, H - 0.02], w: 1.8, h: 6.5, ry: Math.PI },
    ]),
    { renderer },
  );
  windows.set({ day: 0, dusk: 0.15 });
  // (the torches’ warmth everywhere a little, so the far walls read as stone and not as night)
  const hemi = new THREE.HemisphereLight(0xffdcb4, 0x3a3026, 1.15);
  group.add(windows.group, portraits.group, hemi);
  // the gilt and the iron catch the torches: the room’s little reflection, as the hall’s
  let env = null;
  let gone = false;
  roomEnv(renderer)
    .then((tex) => {
      if (gone) return tex?.dispose();
      env = tex;
      const mats = new Set();
      group.traverse((o) => o.material && [o.material].flat().forEach((mm) => mats.add(mm)));
      wearEnv([...mats].filter((mm) => mm.metalness > 0.3), env, 1);
    })
    .catch(() => {});

  // ── the walk: the landing you’re on, its floor, its doors
  let here = '0w';
  let stairs = createStairs({ seed: (Date.now() >>> 0) % 997 });
  const visit = Date.now();
  let ride = null; // { stair, from: [x,y,z], to: [x,y,z], t, dur, down, target, tripped }
  let pending = null; // what the HUD’s card was asked for: { kind, riddle }
  let peevesSaid = false;
  let t = 0;
  const area = () => (landingAt(here).floor === 0 ? { y: 0, rects: [[-H + 0.4, H - 0.4, -H + 0.4, H - 0.4]], landings: ['0w', '0e'] } : areaOf(here));
  const onArea = (x, z) => area().rects.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);

  // a landing’s doors: its rooms, and the stairs at it as they stand now
  const doorFor = (d) => {
    const name = ROOM_NAMES[d.key] ?? d.key;
    if (d.key.startsWith('locked:')) {
      const words = d.key.slice(7);
      return { id: `door:${d.landing}:${d.z}`, at: d.at, r: 1.4, name: words.split('.')[0], verb: 'Try', act: () => toast(words) };
    }
    if (d.key === 'gryffindor') return { id: 'fatlady', at: d.at, r: 1.6, name, verb: 'Speak to', act: askFatLady };
    if (d.key === 'ravenclaw') return { id: 'knocker', at: d.at, r: 1.6, name, verb: 'Knock', act: askKnocker };
    if (d.key === 'slytherin') return { id: 'slytherin', at: d.at, r: 1.4, name, verb: 'Speak to', act: askWall };
    if (d.key === 'hufflepuff') return { id: 'barrels', at: [H - 1.2, 9], r: 1.6, name, verb: 'Tap', act: tapBarrels };
    if (d.key === 'kitchens') return { id: 'fruit', at: d.at, r: 1.4, name, verb: 'Tickle the pear in', act: () => enter('kitchens', 'You tickle the pear. It giggles, and turns into a green door handle.') };
    return { id: `door:${d.key}`, at: d.at, r: 1.4, name, to: d.key, locked: `${name}. Not today.` };
  };
  const doors = () => {
    const a = area();
    const out = doorSpots.filter((d) => a.landings.includes(d.landing)).map(doorFor);
    if (a.landings.includes('0w')) out.push({ id: 'great-doors', at: [0, H - 1.4], r: 2.2, name: 'The grounds', verb: 'Go out to', act: () => ctx.out?.() ?? ctx.leave?.() });
    for (const s of STAIRS) {
      const end = endOf(stairs, s.id);
      if (a.landings.includes(s.from)) {
        const e = stairEnds(s, stairs.ends[s.id]);
        const moving = !end;
        out.push({ id: `up:${s.id}`, at: [e.from[0], e.from[2]], r: 1.1, verb: moving ? 'Wait' : 'Climb', name: moving ? 'The stair is moving' : landingAt(end).name, act: () => climb(s, false) });
      }
      if (end && a.landings.includes(end)) {
        const e = stairEnds(s, stairs.ends[s.id]);
        out.push({ id: `down:${s.id}`, at: [e.to[0], e.to[2]], r: 1.1, verb: 'Go down', name: landingAt(s.from).name, act: () => climb(s, true) });
      }
    }
    return out;
  };

  const enter = (id, words) => {
    if (words) toast(words);
    ctx.enter?.(id);
  };
  // the Fat Lady: Gryffindor’s only, the Sorting’s password, sulking after three wrong tries
  function askFatLady() {
    if (props.house !== 'gryffindor') return say('fatlady', FAT_LADY.name, 'Not your tower, dear. Off you go, and mind the stairs.');
    if (t < pstate.fat.sulkUntil) return say('fatlady', FAT_LADY.name, FAT_LADY.sulking);
    pending = { kind: 'fatlady' };
    say('fatlady', FAT_LADY.name, pstate.fat.tries >= 3 ? FAT_LADY.back : FAT_LADY.ask);
    tell('word', { title: 'The Fat Lady', prompt: 'The password', placeholder: 'Say the password' });
  }
  // the knocker asks anyone a riddle: reason at it and you’re in
  function askKnocker() {
    const r = riddleFor((visit >>> 4) + Math.floor(t));
    pending = { kind: 'riddle', state: knock(r) };
    say('knocker', KNOCKER.name, r.ask);
    tell('word', { title: KNOCKER.name, prompt: r.ask, placeholder: 'Your answer' });
  }
  function askWall() {
    if (props.house !== 'slytherin') return toast('The wall stays a wall. It doesn’t talk to you.');
    pending = { kind: 'wall' };
    tell('word', { title: 'A bare dungeon wall', prompt: 'The password', placeholder: 'Say the password' });
  }
  function tapBarrels() {
    if (props.house !== 'hufflepuff') return toast('A lid pops off the wrong barrel and you’re soaked in vinegar.');
    enter('hufflepuff', 'You tap the second barrel from the bottom in the rhythm of the house’s name. A lid swings open.');
  }

  // a stair taken: a ride up (or down) it, the stair held under you; the trick step once a visit
  function climb(s, down) {
    if (ride) return;
    const end = endOf(stairs, s.id);
    if (!end) return toast('Wait for the stair to come to rest.');
    const e = stairEnds(s, stairs.ends[s.id]);
    const [a, b] = down ? [e.to, e.from] : [e.from, e.to];
    ride = { stair: s.id, from: a, to: b, t: 0, dur: Math.hypot(e.run, e.rise) / CLIMB, target: down ? s.from : end, trick: s.id === 'w2' && !down, tripped: 0 };
    ctx.hold?.(true);
    tell('near', { door: null });
  }

  // ── what’s typed into the HUD’s card
  const word = (text) => {
    if (!pending) return;
    if (pending.kind === 'fatlady') {
      const r = fatLady(pstate, text, props.password, t);
      pstate = r.state;
      say('fatlady', FAT_LADY.name, r.line);
      if (r.open) {
        pending = null;
        tell('word', null);
        enter('gryffindor');
      } else if (t < pstate.fat.sulkUntil) {
        pending = null;
        tell('word', null);
      }
      return;
    }
    if (pending.kind === 'riddle') {
      const r = answerRiddle(pending.state, text);
      pending.state = r.state;
      say('knocker', KNOCKER.name, r.line);
      if (r.open) {
        pending = null;
        tell('word', null);
        enter('ravenclaw');
      }
      return;
    }
    if (pending.kind === 'wall') {
      const right = String(text ?? '').trim().toLowerCase() === String(props.password ?? '').toLowerCase();
      if (right) {
        pending = null;
        tell('word', null);
        enter('slytherin', 'The stones of the wall slide back.');
      } else toast('The wall stays a wall.');
    }
  };

  // ── the stairs where the schedule has them: settled at their end, or swinging between
  const ease = (k) => k * k * (3 - 2 * k);
  const placeFlights = () => {
    for (const s of STAIRS) {
      const g = flights.get(s.id);
      const now = stairs.ends[s.id];
      let e = stairEnds(s, now);
      if (stairs.swinging?.id === s.id) {
        const k = ease(Math.min(1, stairs.swinging.t / stairs.swing));
        const a = e;
        const b = stairEnds(s, stairs.swinging.toward);
        let dy = b.yaw - a.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        e = { from: a.from.map((v, i) => v + (b.from[i] - v) * k), yaw: a.yaw + dy * k, run: a.run + (b.run - a.run) * k };
      }
      g.position.set(...e.from);
      g.rotation.set(0, e.yaw, 0);
      g.scale.set(1, 1, e.run);
    }
  };
  placeFlights();

  // ── who you see: the frames in view (for the wanderer), the nearest in reach (for their lines)
  const frustum = new THREE.Frustum();
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const seen = (camera) => {
    const out = new Set();
    if (!camera) return out;
    m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(m);
    for (const f of frameSpots) {
      v.set(f.at[0] + ROOM_ORIGIN[0], f.at[1] + ROOM_ORIGIN[1], f.at[2] + ROOM_ORIGIN[2]);
      if (frustum.containsPoint(v) && v.distanceTo(camera.position) < 45) out.add(f.id);
    }
    return out;
  };

  const spawn = spawnAt('0w');
  const room = {
    id: 'staircase',
    name: 'The Grand Staircase',
    group,
    statics,
    spawn: { at: [spawn.at[0] + 3, 0, spawn.at[1]], yaw: -Math.PI / 2 },
    colliders: [],
    get level() {
      return area().y;
    },
    bounds: { x0: -H + 0.3, x1: H - 0.3, z0: -H + 0.3, z1: H - 0.3 },
    // (the landing’s floor where you are on it; a drop off its edge that the walk won’t take)
    floorAt: (x, z) => (onArea(x, z) ? area().y : area().y - 40),
    get doors() {
      return ride ? [] : doors();
    },
    places: LANDINGS.map((l) => ({ id: `landing-${l.id}`, name: l.name, at: [landingAt(l.id).at[0], landingAt(l.id).at[2]], r: 3 })),
    get here() {
      return here;
    },
    poses: {
      shaft: { at: [-8, 1.5, -6], look: [6, 18, 4] },
      up: { at: [0, 1.6, 0], look: [0.5, 30, 1] },
      fourth: { at: [-9, 21.5, 6], look: [9, 24, -6] },
      top: { at: [-9.5, 36.5, 6], look: [6, 25, -6] },
      ladies: { at: [-6.5, 36.5, 6], look: [-12, 36.5, 6] },
    },
    word,
    step(dt, c = {}) {
      t += dt;
      const was = stairs.swinging?.id ?? null;
      stairs = stepStairs(stairs, dt, { on: ride?.stair ?? null });
      // (Peeves, the first time a stair goes while you watch)
      if (!was && stairs.swinging && !peevesSaid && t > 4) {
        peevesSaid = true;
        say('peeves', 'Peeves', LINES.peeves.stairs);
      }
      placeFlights();
      for (const f of fires) f.step(dt);
      if (ride) {
        ride.t += dt;
        let k = Math.min(1, ride.t / ride.dur);
        // (the trick step: halfway up, a leg through it to the knee, once a visit)
        let dip = 0;
        if (ride.trick && k > 0.45 && !ride.tripped) {
          const r = trick(pstate, visit);
          pstate = r.state;
          ride.tripped = r.sink ? t : -1;
          if (r.sink) toast('The trick step takes your leg to the knee. You pull it out, red to the ears.');
        }
        if (ride.tripped > 0 && t - ride.tripped < 1.6) {
          ride.t -= dt;
          k = Math.min(1, ride.t / ride.dur);
          dip = 0.45 * Math.sin(Math.min(1, (t - ride.tripped) / 1.6) * Math.PI);
        }
        const p = ride.from.map((a, i) => a + (ride.to[i] - a) * k);
        const ahead = ride.from.map((a, i) => a + (ride.to[i] - a) * Math.min(1, k + 0.25));
        if (c.camera) {
          c.camera.position.set(p[0] + ROOM_ORIGIN[0], p[1] + EYE - dip + Math.sin(ride.t * 7) * 0.025 + ROOM_ORIGIN[1], p[2] + ROOM_ORIGIN[2]);
          c.camera.lookAt(ahead[0] + ROOM_ORIGIN[0], ahead[1] + EYE * 0.9 + ROOM_ORIGIN[1], ahead[2] + ROOM_ORIGIN[2]);
        }
        if (k >= 1) {
          here = ride.target;
          const to = ride.to;
          // (a step onto the landing, facing the way you were going)
          const dx = to[0] - ride.from[0];
          const dz = to[2] - ride.from[2];
          const l = Math.hypot(dx, dz) || 1;
          ride = null;
          ctx.hold?.(false);
          ctx.place?.([to[0] + (dx / l) * 0.9, to[2] + (dz / l) * 0.9], Math.atan2(-dx, -dz));
          tell('landing', { id: here, name: landingAt(here).name });
        }
      }
      // the portraits: who speaks to you as you pass, and the wanderer, when nobody’s looking
      if (c.at && !ride) {
        const y = area().y;
        const near = frameSpots
          .filter((f) => FRAMES.includes(f.id) && Math.abs(f.at[1] - 1.4 - y) < 1)
          .map((f) => ({ frame: f.id, d: Math.hypot(f.at[0] - c.at[0], f.at[2] - c.at[1]) }))
          .filter((n) => n.d <= REACH)
          .sort((a, b) => a.d - b.d);
        const r = passing(pstate, near, t);
        pstate = r.state;
        if (r.said) say(`portrait:${r.said.id}`, r.said.name, r.said.line);
      }
      const w = wander(pstate, { seen: seen(c.camera), dt });
      pstate = w.state;
      if (w.moved) {
        portraits.show(w.moved.from, null);
        portraits.show(w.moved.to, w.moved.to ? 'cadogan' : null);
      }
      // (the Fat Lady turns her back while she sulks)
      portraits.show('fatlady', t < pstate.fat.sulkUntil ? 'fatladyBack' : 'fatlady');
    },
    set() {},
    info: () => ({ ...countOf(group), here, swinging: stairs.swinging?.id ?? null, swings: stairs.swings, ends: { ...stairs.ends } }),
    // (the checks’: stand on a landing)
    at(id) {
      if (!landingAt(id)) return;
      here = id;
      const sp = spawnAt(id);
      ctx.place?.(sp.at, sp.yaw);
    },
    dispose() {
      gone = true;
      env?.dispose();
      geo.stone.dispose();
      geo.iron.dispose();
      portraits.dispose();
      windows.dispose();
      for (const f of fires) f.dispose();
      kit.dispose();
      group.removeFromParent();
    },
  };
  return room;
}

export default { id: 'staircase', name: 'The Grand Staircase', build };
