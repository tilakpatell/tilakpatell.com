// The Room of Requirement (the design’s §4.4): the seventh-floor corridor,
// the tapestry of Barnabas the Barmy trying to teach trolls ballet on one
// wall, and opposite it a bare stretch of stone. Think of what you need
// (E, then one of three), walk past the wall three times (rules/requirement.js),
// and a door grows out of it; through it, the room you asked for
// (parts/needs.js): a room to practise in, the room of hidden things, or a
// quiet room with a window onto the lake. The four stand far apart in the
// room’s frame and only the one you’re in is drawn; Esc goes back to the
// Grand Staircase, and each room has its door back to the corridor.
//
// It tells 'card' { where: 'requirement' } when the card at the top of the
// hill of hidden things is found (Lane F’s cards), and 'choices' for the
// HUD’s card of three; room.pick(n) answers it, as do the digits 1 to 3.

import * as THREE from 'three';
import { canvasTexture } from '../../../lib/three/canvasTexture';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { NEEDS, PASSES, newWall, pass, think } from '../rules/requirement';
import { countOf, createRoomKit } from './kit';
import { ROOM_ORIGIN } from './origin';
import { buildNeed } from './parts/needs';
import { createWindows } from './parts/glass';

const C = { w: 12, d: 2.2, h: 5 }; // the corridor: half its length, half its width, its height
// (the rooms it becomes stand under the corridor, each on its own floor far below the last, so
// the Map and the walk keep you on the seventh floor whichever you’re in)
const BASE = { corridor: 0, practise: -60, hide: -120, quiet: -180 };
const zoneAt = (y) => Object.keys(BASE).reduce((a, k) => (Math.abs(y - BASE[k]) < Math.abs(y - BASE[a]) ? k : a), 'corridor');
const SAID = ['Once.', 'Twice.', 'A third time, and the wall is not a wall any more.'];

// Barnabas the Barmy trying to teach trolls ballet: three grey trolls in pink
// tutus, clubs and all, mid-plié, and the little wizard in purple with his
// baton up, on a woven ground with its threads showing
export function paintTapestry({ w = 768, h = 512 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#5a2a24');
  grd.addColorStop(0.7, '#7a3a2a');
  grd.addColorStop(1, '#4a3a22');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#6a5a3a';
  g.fillRect(0, h * 0.78, w, h * 0.22);
  const troll = (x, s, lean) => {
    g.save();
    g.translate(x, h * 0.8);
    g.rotate(lean);
    g.fillStyle = '#8a8a7e';
    g.beginPath();
    g.ellipse(0, -h * 0.28 * s, w * 0.07 * s, h * 0.2 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(0, -h * 0.52 * s, w * 0.03 * s, 0, Math.PI * 2);
    g.fill();
    // the legs, one pointed
    g.fillRect(-w * 0.04 * s, -h * 0.1 * s, w * 0.025 * s, h * 0.1 * s);
    g.save();
    g.rotate(-0.9);
    g.fillRect(w * 0.0, -h * 0.08 * s, w * 0.022 * s, h * 0.12 * s);
    g.restore();
    // the tutu
    g.fillStyle = '#f0a0c0';
    g.beginPath();
    g.ellipse(0, -h * 0.15 * s, w * 0.11 * s, h * 0.04 * s, 0, 0, Math.PI * 2);
    g.fill();
    // the club, over its shoulder
    g.fillStyle = '#5a3a1a';
    g.save();
    g.translate(w * 0.05 * s, -h * 0.42 * s);
    g.rotate(0.6);
    g.fillRect(0, -h * 0.02, w * 0.11 * s, h * 0.03 * s);
    g.restore();
    g.restore();
  };
  troll(w * 0.38, 1, -0.05);
  troll(w * 0.6, 0.92, 0.08);
  troll(w * 0.82, 1.05, -0.12);
  // Barnabas, small and determined, baton up
  g.fillStyle = '#5a2a7a';
  g.beginPath();
  g.moveTo(w * 0.14, h * 0.8);
  g.lineTo(w * 0.2, h * 0.42);
  g.lineTo(w * 0.26, h * 0.8);
  g.fill();
  g.fillStyle = '#e8c8a8';
  g.beginPath();
  g.arc(w * 0.2, h * 0.38, w * 0.022, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8e8e0';
  g.beginPath();
  g.moveTo(w * 0.19, h * 0.4);
  g.lineTo(w * 0.21, h * 0.4);
  g.lineTo(w * 0.2, h * 0.5);
  g.fill();
  g.strokeStyle = '#2a1a10';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(w * 0.23, h * 0.5);
  g.lineTo(w * 0.29, h * 0.33);
  g.stroke();
  // the weave, and a border of knots
  for (let y = 0; y < h; y += 3) {
    g.fillStyle = `rgba(0,0,0,${0.06 + (y % 9 ? 0 : 0.05)})`;
    g.fillRect(0, y, w, 1);
  }
  g.strokeStyle = '#c8a050';
  g.lineWidth = 14;
  g.strokeRect(7, 7, w - 14, h - 14);
  return c;
}

function build(rt, ctx = {}) {
  const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
  const renderer = ctx.renderer ?? rt?.gfx?.renderer ?? null;
  const tell = ctx.tell ?? (() => {});
  const toast = (text) => tell('toast', { text });
  const group = new THREE.Group();
  group.name = 'room:requirement';

  // ── the corridor
  const hall = new THREE.Group();
  const kit = createRoomKit({ house: ctx.house, tier });
  kit.box('stone', 0, 0, -C.d - 0.5, C.w * 2, C.h, 1);
  kit.box('stone', 0, 0, C.d + 0.5, C.w * 2, C.h, 1);
  kit.box('stone', -C.w - 0.5, 0, 0, 1, C.h, C.d * 2 + 2);
  kit.box('stone', C.w + 0.5, 0, 0, 1, C.h, C.d * 2 + 2);
  kit.box('flags', 0, -0.3, 0, C.w * 2, 0.3, C.d * 2);
  kit.box('stonedark', 0, C.h, 0, C.w * 2 + 2, 0.4, C.d * 2 + 2);
  for (let x = -C.w + 1.5; x < C.w; x += 3) kit.box('stonedark', x, C.h - 0.5, 0, 0.4, 0.5, C.d * 2);
  // torches in their brackets, and a long runner of carpet
  for (const [x, z] of [[-8, -C.d], [8, -C.d], [-6, C.d], [6, C.d]]) {
    const s = Math.sign(z);
    kit.box('iron', x, 2.2, z - s * 0.12, 0.08, 0.3, 0.24);
    kit.cyl('darkoak', x, 2.3, z - s * 0.28, 0.04, 0.03, 0.36, { seg: 6 });
    kit.cyl(kit.glow('#ffb050', 2.4), x, 2.62, z - s * 0.28, 0.05, 0.02, 0.18, { seg: 6 });
  }
  kit.box(kit.paint('#5a1a1a', { rough: 1 }), 0, 0.005, 0, C.w * 2 - 2, 0.01, 1.4);
  // the bare stretch: the same stone, nothing on it at all
  kit.build(hall);
  const tapestry = typeof document !== 'undefined' ? canvasTexture(paintTapestry(), renderer, { wrap: false }) : null;
  if (tapestry) tapestry.colorSpace = THREE.SRGBColorSpace;
  const tapMat = new MeshStandardNodeMaterial({ map: tapestry, color: tapestry ? 0xffffff : 0x7a3a2a, roughness: 1 });
  const tap = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8), tapMat);
  tap.position.set(0, 2.3, C.d - 0.02);
  tap.rotation.y = Math.PI;
  hall.add(tap);
  const ends = createWindows([{ at: [C.w - 0.02, 1.2, 0], w: 1.4, h: 3, ry: -Math.PI / 2 }], { renderer });
  ends.set({ day: 0, dusk: 0.1 });
  hall.add(ends.group);
  // the door that grows out of the wall: oak, iron-strapped, its handle brass
  const doorKit = createRoomKit({ house: ctx.house, tier });
  const door = new THREE.Group();
  doorKit.box('darkoak', 0, 0, 0, 1.6, 2.6, 0.12);
  doorKit.box('ashlar', -0.95, 0, 0, 0.3, 2.9, 0.3);
  doorKit.box('ashlar', 0.95, 0, 0, 0.3, 2.9, 0.3);
  doorKit.box('ashlar', 0, 2.6, 0, 2.2, 0.35, 0.3);
  for (const y of [0.5, 1.3, 2.1]) doorKit.box('iron', 0, y, 0.07, 1.5, 0.08, 0.02);
  doorKit.cyl('brass', 0.6, 1.2, 0.08, 0.05, 0.05, 0.06, { seg: 10, rx: Math.PI / 2 });
  doorKit.build(door);
  door.position.set(0, 0, -C.d + 0.02);
  door.scale.set(1, 0.001, 1);
  door.visible = false;
  hall.add(door);
  hall.add(new THREE.HemisphereLight(0xe0d0b8, 0x221a14, 0.75));
  for (const [x, z] of [[-8, -1.6], [6, 1.6]].slice(0, tier === 'low' ? 0 : 2)) {
    const l = new THREE.PointLight(0xffa860, 9, 14, 1.6);
    l.position.set(x, 2.6, z);
    hall.add(l);
  }
  group.add(hall);

  // ── the three rooms it can be, built as asked for
  const zones = { corridor: { group: hall, bounds: { x0: -C.w + 0.5, x1: C.w - 0.5, z0: -C.d + 0.4, z1: C.d - 0.4 }, colliders: [], spawn: { at: [-C.w + 1.6, 0], yaw: -Math.PI / 2 } } };
  const zoneOf = (id) => {
    if (!zones[id]) {
      zones[id] = buildNeed(id, { at: [0, 0], y: BASE[id], tier, renderer, house: ctx.house });
      group.add(zones[id].group);
      ctx.house?.adopt?.(zones[id].group);
    }
    return zones[id];
  };
  let zone = 'corridor';
  let wall = newWall();
  let choosing = false;
  let grow = 0;
  let card = false;
  const show = (id) => {
    zone = id;
    for (const [k, z] of Object.entries(zones)) z.group.visible = k === id;
  };
  const ask = () => {
    choosing = true;
    tell('choices', { title: 'Walk past three times, thinking of…', options: NEEDS.map((n, i) => ({ n: i + 1, text: n.ask })) });
  };
  const choose = (n) => {
    const need = NEEDS[n - 1];
    if (!need || !choosing) return;
    choosing = false;
    tell('choices', null);
    wall = think(wall, need.id);
    door.visible = false;
    grow = 0;
    toast(`${need.ask}. Now walk past the wall, three times.`);
  };
  const goIn = () => {
    const z = zoneOf(wall.need);
    show(wall.need);
    ctx.place?.(z.spawn.at, z.spawn.yaw);
    toast(NEEDS.find((n) => n.id === wall.need).said);
  };
  const goOut = () => {
    show('corridor');
    ctx.place?.([0, -0.4], Math.PI);
  };

  const room = {
    id: 'requirement',
    name: 'The Room of Requirement',
    group,
    spawn: { at: [-C.w + 1.6, 0, 0], yaw: -Math.PI / 2 },
    colliders: [],
    floorAt: () => BASE[zone],
    get bounds() {
      return zones[zone].bounds;
    },
    solidsNow: () => zones[zone].colliders,
    get doors() {
      if (zone !== 'corridor') {
        const z = zones[zone];
        const out = [{ id: 'out', at: z.spawn.at, r: 1.2, verb: 'Go out to', name: 'The seventh-floor corridor', act: goOut }];
        if (z.card && !card) out.push({ id: 'card', at: z.card.foot, r: 1.6, verb: 'Climb up to', name: 'The glint at the top', act: () => {
          card = true;
          toast('You climb the hill of lost things. At the top, under a broken crown, is a Chocolate Frog card.');
          tell('card', { where: 'requirement' });
        } });
        if (z.cabinet) out.push({ id: 'cabinet', at: z.cabinet.at, r: 1.0, verb: 'Knock on', name: 'The black cabinet', act: () => toast('You knock. A long way off, something knocks back.') });
        return out;
      }
      const out = [{ id: 'back', at: [-C.w + 1, 0], r: 1.2, verb: 'Go back to', name: 'The Grand Staircase', act: () => ctx.leave?.() }];
      if (wall.open) out.push({ id: 'door', at: [0, -C.d + 0.9], r: 1.1, verb: 'Go in', name: NEEDS.find((n) => n.id === wall.need).room, act: goIn });
      else out.push({ id: 'think', at: [0, -C.d + 0.9], r: 1.3, verb: wall.need ? 'Think again of' : 'Think of', name: 'What you need', act: ask });
      return out;
    },
    places: [{ id: 'requirement', name: 'The Room of Requirement', at: [0, 0], r: 12 }],
    poses: {
      corridor: { at: [7, 1.6, 1.2], look: [-1, 1.6, -C.d] },
      tapestry: { at: [0, 1.6, -1.2], look: [0, 2.2, C.d] },
      practise: { at: [0, BASE.practise + 1.7, 6.6], look: [0, BASE.practise + 1.2, -7] },
      hide: { at: [-2, BASE.hide + 1.7, 18], look: [2, BASE.hide + 6, -14] },
      quiet: { at: [2.2, BASE.quiet + 1.5, 2.6], look: [-1.2, BASE.quiet + 1.4, -3.2] },
    },
    lessons: {},
    pick: choose,
    step(dt, c = {}) {
      // (the room you’re in is the one drawn: by where the eye is, so a view the checks set shows it too)
      const y = c.camera ? c.camera.position.y - ROOM_ORIGIN[1] - 1.5 : BASE[zone];
      const here = zoneAt(y);
      if (here !== zone || !zones[here].group.visible) {
        if (here !== 'corridor') zoneOf(here);
        show(here);
      }
      if (choosing) for (let n = 1; n <= NEEDS.length; n++) if (c.input?.pressed?.has?.(`Digit${n}`)) choose(n);
      if (zone === 'corridor' && c.at) {
        const r = pass(wall, { x: c.at[0], d: c.at[1] + C.d });
        wall = r.state;
        if (r.passed) toast(SAID[Math.min(wall.passes, PASSES) - 1]);
        if (r.opened) door.visible = true;
      }
      if (door.visible && grow < 1) {
        grow = Math.min(1, grow + dt / 1.6);
        door.scale.y = Math.max(0.001, grow * grow * (3 - 2 * grow));
      }
      zones[zone].step?.(dt);
    },
    set() {},
    info: () => ({ ...countOf(group), zone, passes: wall.passes, need: wall.need, open: wall.open }),
    dispose() {
      tell('choices', null);
      for (const [k, z] of Object.entries(zones)) if (k !== 'corridor') z.dispose();
      kit.dispose();
      doorKit.dispose();
      tap.geometry.dispose();
      tapMat.dispose();
      tapestry?.dispose();
      ends.dispose();
      group.removeFromParent();
    },
  };
  ctx.house?.adopt?.(group);
  show('corridor');
  return room;
}

export default { id: 'requirement', name: 'The Room of Requirement', build };
