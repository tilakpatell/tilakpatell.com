// Inside the Prancing Pony, the night the hobbits came: the long common
// room, beamed and panelled, a fire roaring in the hearth at one end, the
// bar along the back wall with its barrels and Butterbur behind it, tables
// of Bree-landers, the hobbits' table, and in the dark corner at the far
// end a hooded man with his pipe. Built a little way under the world (as
// Bag End is), and lit by the fire and two lamps, which the scene lends it
// (./scene.js keeps one pool of lights for in and out).
//
// update(beat, …) poses everyone for the beat and says where the camera
// goes: bar (Butterbur, at the counter), room (the whole room), pints (the
// tap and a glass under it), slip (Frodo jumps up and the Ring flies),
// strider (the corner), and on the side song (Frodo up on the hobbits'
// table, singing, and the room clapping along).

import * as THREE from 'three';
import { hot } from '../../../../lib/three/stage3dNodes';
import { pose } from '../../mapFigures';
import { calm, dance, makePerson, sit } from '../../shire/people';
import { castDo } from '../../cast3d';
import { B, barrelParts, beam, benchParts, cyl, cylX, lathe, parts, roundBox, squareWindow } from '../../shire/props';
import { POUR } from './pints';
import { makeFolk } from './props';
import { makeStrider } from './ranger';

export const INN = new THREE.Vector3(0, -60, 0);
const W = 14; // the room, x
const D = 9; // and z
const H = 3.6;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// where things are, in the room's own frame
const BAR = { z: -2.5, top: 1.15 };
const TAP = V3(1.8, 1.5, -2.72);
const GLASS = V3(1.8, BAR.top + 0.08, -2.5);
const HOBBITS = V3(1.8, 0, 2.9); // their table
const CORNER = V3(5.6, 0, -3.3); // Strider's
const FIRE = V3(-W / 2 + 0.55, 0, 0.6);

export function buildInn(renderer, { kit }) {
  const { mats } = kit;
  const g = new THREE.Group();
  g.name = 'inn';
  g.position.copy(INN);
  const bk = parts();
  const dark = mats.timber;

  // the room: boards, panelling to the dado, plaster over it, a beamed ceiling
  const floor = kit.mats.wood.clone();
  floor.color.set(0x6a4a30);
  bk.add(floor, B(W, 0.1, D), { p: [0, -0.05, 0], uv: 0.6 });
  bk.add(mats.plaster, B(W, 0.1, D), { p: [0, H + 0.05, 0], uv: 0.4 });
  for (const [x, z, len, ry] of [[0, -D / 2, W, 0], [0, D / 2, W, Math.PI], [-W / 2, 0, D, Math.PI / 2], [W / 2, 0, D, -Math.PI / 2]]) {
    bk.at([x, 0, z], ry, () => {
      bk.add(mats.plaster, B(len, H, 0.12), { p: [0, H / 2, -0.06], uv: 0.4 });
      bk.add(dark, B(len, 1.2, 0.06), { p: [0, 0.6, 0.03], uv: 1.2 });
      bk.add(dark, B(len, 0.1, 0.1), { p: [0, 1.22, 0.06] });
      for (let k = -len / 2 + 0.1; k <= len / 2; k += 2.0) beam(bk, dark, k, 1.2, k, H, 0.2, 0.1);
    });
  }
  for (let x = -W / 2 + 0.8; x < W / 2; x += 1.6) bk.add(dark, B(0.26, 0.3, D), { p: [x, H - 0.15, 0], uv: 1 });
  bk.add(dark, B(W, 0.32, 0.3), { p: [0, H - 0.16, 0], uv: 1 });
  for (const z of [-1.5, 1.5]) for (const x of [-3.4, 0, 3.4]) bk.add(dark, cyl(0.16, 0.16, H, 8), { p: [x, H / 2, z], uv: 1 });
  // windows on the street side, black with rain; the door
  bk.at([W / 2, 0, D / 2], Math.PI, () => {
    for (const x of [2.0, 4.6, 9.4, 12.0]) squareWindow(bk, kit.K, { x, y: 1.75, w: 1.4, h: 1.5, nx: 4, ny: 4 });
    bk.add(kit.paint(0x2f4a36), B(1.6, 2.7, 0.08), { p: [7, 1.35, 0.04], uv: 1.25 });
  });

  // the hearth, at the west end: a stone breast, a wide black mouth, logs
  bk.add(mats.ashlar, B(1.0, H, 3.4), { p: [-W / 2 + 0.5, H / 2, FIRE.z], uv: 0.45 });
  bk.add(mats.void, new THREE.PlaneGeometry(2.0, 1.3), { p: [-W / 2 + 1.01, 0.75, FIRE.z], r: [0, Math.PI / 2, 0] });
  bk.add(mats.dressed, B(0.5, 0.22, 3.6), { p: [-W / 2 + 1.1, 1.62, FIRE.z], uv: 0.6 });
  bk.add(mats.dressed, B(1.2, 0.16, 2.8), { p: [-W / 2 + 1.4, 0.08, FIRE.z], uv: 0.6 });
  for (const dz of [-0.35, 0, 0.35]) bk.add(mats.trunk, cylX(0.1, 0.9, 7), { p: [-W / 2 + 1.2, 0.26, FIRE.z + dz], r: [0, dz, 0] });

  // the bar: a long counter, barrels racked behind, shelves of tankards
  bk.add(dark, B(7.2, BAR.top, 0.72), { p: [0, BAR.top / 2, BAR.z], uv: 1 });
  bk.add(mats.wood, roundBox(7.4, 0.08, 0.86, 0.02), { p: [0, BAR.top + 0.04, BAR.z], uv: 1.2 });
  for (let i = 0; i < 5; i++) bk.at([-3 + i * 1.5 + 0.52, 0.62, -D / 2 + 0.45], [0, 0, Math.PI / 2], () => barrelParts(bk, kit.K, { h: 1.05, r: 0.42 }));
  bk.add(dark, B(7.6, 0.2, 0.9), { p: [0, 0.1, -D / 2 + 0.45], uv: 1 });
  for (const y of [2.2, 2.8]) {
    bk.add(mats.wood, B(7, 0.06, 0.32), { p: [0, y, -D / 2 + 0.2], uv: 1.2 });
    for (let x = -3.2; x <= 3.2; x += 0.42) bk.add(mats.pewter, lathe([[0.001, 0], [0.08, 0], [0.085, 0.2], [0.075, 0.2], [0.07, 0.02]], 8), { p: [x, y + 0.03, -D / 2 + 0.22] });
  }
  // the tap: a barrel on its side on the counter, its spigot over the glass
  bk.at([TAP.x, TAP.y, TAP.z], [-Math.PI / 2, 0, 0], () => barrelParts(bk, kit.K, { h: 0.6, r: 0.24 }));
  bk.add(dark, B(0.5, 0.06, 0.5), { p: [TAP.x, BAR.top + 0.1, TAP.z - 0.3] });
  bk.add(mats.brass, cyl(0.026, 0.026, 0.2, 8), { p: [TAP.x, TAP.y - 0.04, TAP.z + 0.08], r: [Math.PI / 2, 0, 0] });
  bk.add(mats.brass, cyl(0.022, 0.018, 0.1, 8), { p: [TAP.x, TAP.y - 0.09, GLASS.z] });

  // tables and benches, tankards and candles on them
  const FOLK_TABLES = [[-4.3, 1.3], [-1.3, 1.5], [-2.9, 3.5], [4.6, 1.9]];
  const tables = [...FOLK_TABLES, [HOBBITS.x, HOBBITS.z], [CORNER.x, CORNER.z + 0.9]];
  const candles = [];
  tables.forEach(([x, z], i) => {
    const small = i === 5;
    bk.add(mats.wood, roundBox(small ? 1.0 : 1.8, 0.08, small ? 0.8 : 0.95, 0.02), { p: [x, 0.92, z], uv: 1.2 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bk.add(dark, B(0.08, 0.9, 0.08), { p: [x + sx * (small ? 0.4 : 0.8), 0.45, z + sz * 0.35] });
    if (!small) for (const s of [-1, 1]) bk.at([x, 0, z + s * 0.85], s > 0 ? Math.PI : 0, () => benchParts(bk, kit.K, 1.7));
    for (let k = 0; k < (small ? 1 : 3); k++) bk.add(mats.pewter, lathe([[0.001, 0], [0.07, 0], [0.075, 0.17], [0.065, 0.17], [0.06, 0.02]], 8), { p: [x - 0.5 + k * 0.5, 0.96, z + (k % 2 ? 0.2 : -0.15)] });
    candles.push(V3(x + 0.1, 1.12, z));
    bk.add(mats.lantern, cyl(0.03, 0.03, 0.16, 6), { p: [x + 0.1, 1.04, z] });
  });
  // the stairs up to the rooms, in the east corner by the street
  for (let i = 0; i < 9; i++) bk.add(dark, B(1.2, 0.18, 0.34), { p: [W / 2 - 0.7, 0.2 + i * 0.36, D / 2 - 1.0 - i * 0.34], uv: 1 });
  bk.build(g);

  // a candle's flame: bright enough to bloom
  const flameMat = new THREE.MeshBasicMaterial({ color: hot(0xffb060, 3) });
  for (const c of candles) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), flameMat);
    f.scale.y = 1.8;
    f.position.copy(c);
    g.add(f);
  }

  // ── the glass under the tap: the ale, its head, the two lines ──
  const glassG = new THREE.Group();
  glassG.position.copy(GLASS);
  g.add(glassG);
  const GH = 0.22;
  const GR = 0.075;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(GR, GR * 0.9, GH, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.08, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = GH / 2;
  const ale = new THREE.Mesh(new THREE.CylinderGeometry(GR * 0.94, GR * 0.86, 1, 20), new THREE.MeshStandardMaterial({ color: 0xa8641a, emissive: hot(0x5a2a06, 0.4), roughness: 0.3, transparent: true, opacity: 0.9 }));
  const head = new THREE.Mesh(new THREE.CylinderGeometry(GR * 0.95, GR * 0.94, 1, 20), new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.9 }));
  const lineMat = new THREE.MeshBasicMaterial({ color: hot(0xd9b14a, 1.2) });
  for (const k of [POUR.lo, POUR.hi]) {
    const l = new THREE.Mesh(new THREE.TorusGeometry(GR * 1.01, 0.0035, 4, 24), lineMat);
    l.rotation.x = Math.PI / 2;
    l.position.y = k * GH;
    glassG.add(l);
  }
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), ale.material);
  glassG.add(glass, ale, head, stream);
  const setPour = (p) => {
    const lv = Math.max(0.001, p?.level ?? 0);
    const hd = Math.max(0.001, p?.head ?? 0);
    ale.scale.y = lv * GH;
    ale.position.y = (lv * GH) / 2;
    head.scale.y = hd * GH;
    head.position.y = lv * GH + (hd * GH) / 2;
    head.visible = hd > 0.002;
    const pouring = Boolean(p?.pouring);
    stream.visible = pouring;
    const from = TAP.y - 0.12 - GLASS.y;
    const to = (lv + hd) * GH;
    stream.scale.y = Math.max(0.01, from - to);
    stream.position.y = (from + to) / 2;
  };
  setPour(null);

  // ── who's in ──
  const people = {};
  const add = (id, f, at, face, seated = false) => {
    f.group.position.copy(at);
    f.group.rotation.y = face;
    if (seated) {
      sit(f, true);
      f.group.position.y -= 0.12;
    }
    f.home = { at: at.clone(), face, seated };
    g.add(f.group);
    people[id] = f;
    return f;
  };
  add('butterbur', makeFolk('butterbur'), V3(0, 0, -3.22), -Math.PI / 2);
  add('sam', makePerson('sam'), V3(HOBBITS.x - 0.5, 0.18, HOBBITS.z + 0.85), Math.PI / 2, true);
  add('merry', makePerson('merry'), V3(HOBBITS.x + 0.4, 0.18, HOBBITS.z + 0.85), Math.PI / 2, true);
  add('pippin', makePerson('pippin'), V3(HOBBITS.x + 0.2, 0.18, HOBBITS.z - 0.85), -Math.PI / 2, true);
  add('frodo', makePerson('frodo'), V3(0.3, 0, -1.65), Math.PI / 2);
  // Bree-landers at their tables, and two at the bar
  const folk = [];
  FOLK_TABLES.forEach(([x, z], i) => {
    for (const s of [-1, 1]) {
      if ((i + (s > 0 ? 1 : 0)) % 3 === 2) continue;
      const f = add(`folk${folk.length}`, makeFolk('folk', { n: folk.length }), V3(x + (s > 0 ? 0.3 : -0.4), 0.18, z + s * 0.85), s > 0 ? Math.PI / 2 : -Math.PI / 2, true);
      folk.push(f);
    }
  });
  for (const [x, f] of [[-2.4, -Math.PI / 2 + 0.3], [-1.5, -Math.PI / 2 - 0.2]]) folk.push(add(`folk${folk.length}`, makeFolk('folk', { n: folk.length + 3 }), V3(x, 0, -1.7), f + Math.PI));
  // the man in the corner: Strider on the settle, hood up, his pipe going
  // (./ranger.js); he faces his table and the room, his back in the corner
  const strider = makeStrider(renderer);
  strider.group.position.set(CORNER.x + 0.1, 0, CORNER.z - 0.2);
  strider.group.rotation.y = -2.04;
  g.add(strider.group);

  // the Ring, for when it slips
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 20), new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: hot(0xffb030, 1.6), metalness: 1, roughness: 0.2 }));
  ring.visible = false;
  g.add(ring);
  const ringFrom = V3(HOBBITS.x - 0.2, 1.0, HOBBITS.z + 0.5);
  const ringTop = V3(HOBBITS.x - 0.8, 2.7, HOBBITS.z + 1.3);
  const ringTo = V3(HOBBITS.x - 1.25, 0.25, HOBBITS.z + 1.6);

  // ── each beat: who stands where, and the camera ──
  const cam = { at: V3(), look: V3() };
  const world = (v, out) => out.copy(v).add(INN);
  const CAMS = {
    bar: [V3(-1.0, 1.35, 0.3), V3(0.1, 1.3, -3.2)],
    ask: [V3(-0.9, 1.6, 0.5), V3(2.4, 1.3, -2.6)],
    room: [V3(-5.9, 2.5, 3.9), V3(4.6, 0.9, -2.6)],
    pints: [V3(2.25, 1.62, -1.62), V3(1.8, 1.36, -2.56)],
    slip: [V3(3.6, 0.7, 4.0), V3(HOBBITS.x - 0.8, 1.2, HOBBITS.z + 0.9)],
    strider: [V3(4.3, 1.48, -1.4), V3(CORNER.x + 0.12, 1.42, CORNER.z - 0.22)],
    song: [V3(-1.7, 2.0, 4.25), V3(HOBBITS.x + 0.1, 1.8, HOBBITS.z - 0.3)],
  };
  const homeAll = () => {
    for (const f of Object.values(people)) {
      f.group.position.copy(f.home.at);
      f.group.rotation.set(0, f.home.face, 0);
      if (f.sitting !== f.home.seated) sit(f, f.home.seated);
      calm(f);
    }
  };

  // s: { stepT (s into the beat), pour, ringOn (it's on his finger), ringOff,
  // song (seconds into the song, and the beat's length), dawn (Strider's gone
  // out to the East Gate) }
  const update = (beat, t, dt, s = {}) => {
    homeAll();
    const f = people.frodo;
    f.group.visible = true;
    ring.visible = false;
    const k = s.stepT ?? 0;
    if (beat === 'bar' || beat === 'ask') {
      f.group.position.set(0.3, 0, -1.65);
      f.group.rotation.y = Math.PI / 2;
    } else if (beat === 'pints') {
      f.group.position.set(2.7, 0, -1.7);
      f.group.rotation.y = Math.PI / 2 + 0.5;
      people.pippin.group.position.set(1.0, 0, -1.6);
      people.pippin.group.rotation.y = Math.PI / 2 - 0.4;
      sit(people.pippin, false);
      people.butterbur.group.position.set(1.25, 0, -3.22);
    } else if (beat === 'room') {
      f.group.position.set(HOBBITS.x - 0.9, 0.18, HOBBITS.z - 0.85);
      f.group.rotation.y = -Math.PI / 2;
      sit(f, true);
    } else if (beat === 'slip') {
      // up on the table, Pippin; Frodo jumps up, slips and goes over
      people.pippin.group.position.set(HOBBITS.x + 0.4, 0.96, HOBBITS.z);
      people.pippin.group.rotation.y = Math.PI;
      sit(people.pippin, false);
      const fall = Math.min(1, Math.max(0, (k - 0.35) / 0.4));
      f.group.position.set(HOBBITS.x - 0.9 - fall * 0.5, 0, HOBBITS.z - 0.5 + fall * 0.9);
      // (on the cast he goes over by his own fall, not tipped like a plank)
      f.group.rotation.set(0, Math.PI / 2 + 0.6, f.cast?.ready ? 0 : fall * 1.35);
      // the Ring, slowly, up and over and down
      const rk = Math.min(1, Math.max(0, (k - 0.55) / 1.6));
      if (rk > 0 && !s.ringOn) {
        ring.visible = true;
        const a = 1 - rk;
        ring.position.set(a * a * ringFrom.x + 2 * a * rk * ringTop.x + rk * rk * ringTo.x, a * a * ringFrom.y + 2 * a * rk * ringTop.y + rk * rk * ringTo.y, a * a * ringFrom.z + 2 * a * rk * ringTop.z + rk * rk * ringTo.z);
        ring.rotation.set(t * 3, t * 2, 0);
      }
      if (s.ringOn) f.group.visible = false;
    } else if (beat === 'strider') {
      // Frodo at the end of his table, looking up at him
      f.group.position.set(CORNER.x + 0.55, 0, CORNER.z + 1.65);
      f.group.rotation.y = 1.81;
    } else if (beat === 'song') {
      // up on the hobbits' table, facing the room
      f.group.position.set(HOBBITS.x - 0.2, 0.96, HOBBITS.z);
      f.group.rotation.y = -2.6;
    }
    // everyone breathing, Butterbur busy, the Bree-landers chatting
    for (const [id, p] of Object.entries(people)) {
      if (p.sitting) {
        pose(p, t + id.length, { moving: false, talk: id.startsWith('folk') && (beat === 'song' || Math.sin(t * 0.7 + id.length) > 0.4) ? 1 : 0 });
        sit(p, true);
      } else pose(p, t + id.length, { moving: false, talk: (id === 'butterbur' && (beat === 'bar' || beat === 'ask')) || (id === 'pippin' && beat === 'slip') ? 1 : 0, wave: id === 'pippin' && beat === 'slip' ? 0.8 : 0 });
    }
    // on the cast: Frodo goes over by his fall when he slips; Pippin holds
    // forth on the table; Butterbur works the tap; the hobbits clap seated
    castDo(f, { down: beat === 'slip' && k > 0.35, flinch: null, fall: 'fall', rise: null });
    castDo(people.pippin, { upper: beat === 'slip' ? 'talk.passion' : null });
    castDo(people.butterbur, { upper: beat === 'pints' && s.pour?.pouring ? 'interact' : null });
    for (const id of ['sam', 'merry', 'pippin']) if (id !== 'pippin' || beat === 'song') castDo(people[id], { upper: beat === 'song' ? 'sit.clap' : null });
    // the room looks at Frodo up on the table
    for (const p of folk) castDo(p, { look: beat === 'song' || beat === 'slip' ? f : null });
    if (beat === 'song') {
      // Frodo hops on every beat; the hobbits clap on the off-beats
      const st = s.song?.t ?? 0;
      const per = s.song?.beat ?? 0.54;
      dance(f, (st / per) * (Math.PI * 2) / 7 - 0.22, 0);
      for (const id of ['sam', 'merry', 'pippin']) {
        const p = people[id];
        // hands out in front, and together on the beat
        const k = Math.abs(Math.cos((st / per) * Math.PI)) ** 3;
        p.arms[0].rotation.x = -(0.3 + 0.6 * k);
        p.arms[1].rotation.x = 0.3 + 0.6 * k;
        p.arms[0].rotation.z = p.arms[1].rotation.z = 0.9;
      }
    }
    strider.group.visible = !s.dawn;
    // Strider watches the hobbits' table, or Frodo when he comes over
    const watching = beat === 'strider' || beat === 'slip' ? f.group.position.clone().add(INN).add(V3(0, 1.1, 0)) : world(V3(HOBBITS.x, 1.1, HOBBITS.z), V3());
    strider.update(t, { watch: watching, close: beat === 'strider' });
    lights.pipe.copy(strider.bowl).add(V3(0.08, 0.12, 0.06));
    setPour(beat === 'pints' ? s.pour : null);
    const [at, look] = CAMS[beat] ?? CAMS.room;
    world(at, cam.at);
    world(look, cam.look);
    if (beat === 'slip' && !s.ringOn) cam.look.lerp(world(ringTop, V3()), Math.min(1, Math.max(0, (k - 0.6) / 0.8)) * 0.6);
    return cam;
  };

  // where the lights the scene lends it go: the fire, the bar, the
  // hobbits' table, and a faint one for the pipe
  const lights = { fire: world(V3(FIRE.x + 0.9, 0.7, FIRE.z), V3()), bar: world(V3(0, 2.6, -2.2), V3()), table: world(V3(HOBBITS.x, 2.2, HOBBITS.z), V3()), corner: world(V3(CORNER.x - 0.3, 1.3, CORNER.z + 1.2), V3()), pipe: world(V3(CORNER.x + 0.5, 1.6, CORNER.z + 0.3), V3()) };
  const fireAt = world(V3(FIRE.x + 0.75, 0.3, FIRE.z), V3());
  const headOf = (id) => {
    if (id === 'strider') return strider.head.getWorldPosition(V3()).add(V3(0, 0.62, 0));
    const p = people[id];
    if (!p) return null;
    return p.group.position.clone().add(INN).add(V3(0, (p.top ?? 1.8) + 0.25 - (p.sitting ? 0.4 : 0), 0));
  };
  return {
    group: g,
    update,
    people,
    lights,
    fireAt,
    headOf,
    ring,
    strider,
    // how hard he's drawing on the pipe, 0…1, for the pipe's light
    get draw() {
      return strider.draw;
    },
  };
}
