// Honeydukes (the design’s §4.9): the sweetshop on Hogsmeade’s High Street.
// Shelves to the ceiling on three walls, every one crammed with jars and
// boxes and tins, the counter across the back with its brass till and its
// scales, tables of loose sweets heaped in the middle, a stand of lollipops
// turning in the window, and behind the counter the cellar’s trapdoor (the
// passage under it goes back to the castle: another day). The three sweets
// for quest 12 are here to take: a Chocolate Frog from the stand by the
// window (its card is Merlin’s), a box of Every Flavour Beans from the
// counter, and a Sugar Quill from the jar by the side shelves.
//
// A room for rooms/host.js: build(rt, ctx) → room (its header says the shape);
// the frame: the floor’s middle at the origin, the street door at +z.

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { createRoomKit, countOf, instanced } from './kit';
import { bookcase, frame, table } from './parts/furniture';
import { roomEnv, wearEnv } from './parts/env';
import { lamp, panes, shell, signBoard } from './village/shell';
import { createStock, fill } from './village/stock';
import { LINES, beanFor, streetSide } from './village/plan';

const W = 12;
const D = 9;
const H = 3.6;
const PINK = '#f0cfc8';
const PAINT = '#a8344e'; // the shop’s woodwork, a raspberry gloss
const SHELF = '#b07a48'; // the shelves, honey-coloured oak

const LAMP = 22; // a lamp’s light: the shop is the brightest room in the village

const SWEET = {
  frog: { at: [-3.5, 2.2], label: 'A Chocolate Frog' },
  beans: { at: [-2.4, -1.5], label: 'Every Flavour Beans' },
  quill: { at: [4.5, 0.9], label: 'A Sugar Quill' },
};
const TRAPDOOR = [3.9, -3.5];

function build(rt, ctx = {}) {
  const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
  const props = ctx.props ?? {};
  const renderer = ctx.renderer ?? rt?.gfx?.renderer ?? null;
  const found = new Set(props.found?.sweets ?? []);
  const group = new THREE.Group();
  group.name = 'room:honeydukes';
  const kit = createRoomKit({ tier });
  const wood = kit.paint(PAINT, { scan: 'wood', metres: 1.2, strength: 0.35, rough: 0.45 });
  const oak = kit.paint(SHELF, { scan: 'wood', metres: 1.0, strength: 0.5, rough: 0.6 });
  const room = shell(kit, { w: W, d: D, h: H, floor: 'board', wall: PINK, lower: wood, ceiling: '#efe2d6', beams: 4, door: { x: 0, w: 1.3, h: 2.3 }, windows: [-3.6, 3.6].map((x) => ({ x, w: 3, y: 0.55, h: 2.1 })) });
  panes(kit, room.panes, props.hour ?? 14);

  // the shelves: three units along the back, two down each side
  const slots = [];
  for (const x of [-3.9, 0, 3.9]) slots.push(...bookcase(kit, { at: [x, 0, -D / 2 + 0.25], ry: 0, w: 3.8, h: H - 0.25, shelves: 7, mat: oak }));
  for (const s of [-1, 1]) for (const z of [-2.2, 0.9]) slots.push(...bookcase(kit, { at: [s * (W / 2 - 0.25), 0, z], ry: s < 0 ? Math.PI / 2 : -Math.PI / 2, w: 3, h: H - 0.25, shelves: 7, mat: oak }));
  // (the bottom shelf is the floor’s: boxes, not jars, and none behind the counter’s own shelf)
  const stock = createStock(fill(slots, { seed: 17, tier, gap: 0.012 }), { tier });
  group.add(stock.group);

  // the counter across the back, panelled, its top dark and worn; the till and the scales on it
  const counter = { x0: -4.6, x1: 1.6, z: -2.3, top: 1.02, d: 0.75 };
  const cx = (counter.x0 + counter.x1) / 2;
  const cw = counter.x1 - counter.x0;
  kit.box(wood, cx, 0, counter.z, cw, counter.top - 0.06, counter.d);
  kit.box('darkoak', cx, counter.top - 0.06, counter.z, cw + 0.1, 0.06, counter.d + 0.1);
  for (let x = counter.x0 + 0.4; x < counter.x1 - 0.2; x += 0.62) kit.box(kit.paint('#f2e2c0', { rough: 0.5 }), x, 0.12, counter.z + counter.d / 2 + 0.01, 0.46, counter.top - 0.32, 0.03);
  kit.box('gold', cx, counter.top - 0.1, counter.z + counter.d / 2 + 0.02, cw, 0.03, 0.02);
  kit.wall(counter.x0, counter.z, counter.x1, counter.z, 0.5);
  const till = frame(kit, { at: [-3.9, counter.top, counter.z] });
  till.box('brass', 0, 0, 0, 0.42, 0.24, 0.36);
  till.box('brass', 0, 0.24, -0.06, 0.4, 0.18, 0.08, { rx: -0.5 });
  for (let i = 0; i < 6; i++) till.cyl('pewter', -0.15 + i * 0.06, 0.22, 0.12, 0.018, 0.018, 0.05, { seg: 6 });
  const scales = frame(kit, { at: [0.6, counter.top, counter.z] });
  scales.box('brass', 0, 0, 0, 0.3, 0.04, 0.2);
  scales.cyl('brass', 0, 0.04, 0, 0.018, 0.018, 0.42, { seg: 8 });
  scales.box('brass', 0, 0.44, 0, 0.62, 0.025, 0.025);
  for (const sx of [-1, 1]) {
    scales.box('brass', sx * 0.3, 0.2, 0, 0.006, 0.24, 0.006);
    scales.cyl('brass', sx * 0.3, 0.17, 0, 0.11, 0.08, 0.03, { seg: 16 });
  }
  // the beans on the counter: a stack of their striped boxes
  const beanBoxes = [];
  for (let i = 0; i < 9; i++) beanBoxes.push({ at: [SWEET.beans.at[0] - 0.3 + (i % 3) * 0.2, counter.top + Math.floor(i / 3) * 0.13, counter.z + 0.15], ry: (i % 2) * 0.2 - 0.1 });
  // the big jars along the counter’s front edge
  const counterJars = [];
  for (let x = -1.4; x <= 0.1; x += 0.3) counterJars.push({ kind: 'jar', at: [x, counter.top, counter.z + 0.2], ry: x, s: 1.5, colour: ['#e8455a', '#f2b63c', '#7ac74f', '#53a7e8', '#c36be0', '#f07fb6'][Math.round((x + 1.4) / 0.3) % 6] });
  const jars = createStock(counterJars, { tier });
  group.add(jars.group);

  // the tables of loose sweets in the middle, heaped
  const heaps = [];
  for (const [tx, tz] of [
    [-1.6, 0.6],
    [1.9, 0.9],
  ]) {
    table(kit, { at: [tx, 0, tz], len: 1.5, w: 1.0, top: 0.86, mat: wood });
    kit.solid(tx, tz, 0.95);
    let s = Math.round((tx + 5) * 97);
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < (tier === 'low' ? 90 : 220); i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd());
      const x = tx + Math.cos(a) * r * 0.42;
      const z = tz + Math.sin(a) * r * 0.66;
      // (a mound: highest in the middle of each tray)
      const y = 0.86 + (1 - r * r) * 0.16 * rnd();
      heaps.push({ at: [x, y, z], ry: rnd() * 6, s: 0.7 + rnd() * 0.6 });
    }
    // the trays’ rims
    kit.box('brass', tx, 0.86, tz, 0.96, 0.04, 1.44);
  }
  const heapColours = ['#e8455a', '#f2b63c', '#7ac74f', '#53a7e8', '#c36be0', '#f07fb6', '#fff1d6', '#ff8a3c', '#5ad1c8'];
  const sweetGeo = new THREE.SphereGeometry(0.03, 8, 6);
  const sweetMat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.35 });
  const loose = instanced(sweetGeo, sweetMat, heaps, { colours: heapColours });
  group.add(loose);

  // the frogs by the window: a stepped stand of their five-sided boxes, one at the front for the taking
  const frogGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.075, 5).translate(0, 0.0375, 0);
  const frogMat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.2 });
  // (the steps rise toward the window, the lowest facing into the shop)
  const z0 = SWEET.frog.at[1] + 0.75;
  const frogs = [];
  for (let step = 0; step < 4; step++) {
    const top = 0.7 + step * 0.22;
    const z = z0 + step * 0.22;
    kit.box(wood, SWEET.frog.at[0], 0, z, 1.5, top, 0.22);
    for (let i = 0; i < 7 - step; i++) frogs.push({ at: [SWEET.frog.at[0] - 0.6 + i * 0.2 + step * 0.1, top, z], ry: i * 0.6 });
  }
  kit.solid(SWEET.frog.at[0] - 0.4, z0 + 0.3, 0.55);
  kit.solid(SWEET.frog.at[0] + 0.4, z0 + 0.3, 0.55);
  const frogBoxes = instanced(frogGeo, frogMat, frogs.map((f) => ({ ...f, s: [1, 1, 1] })), { colours: ['#4a1f6a', '#5a2a7a', '#d4ac4f'] });
  group.add(frogBoxes);
  // the one to take: a box on the stand’s front with the lid ajar
  const frogOne = new THREE.Group();
  const oneBox = new THREE.Mesh(frogGeo, frogMat);
  oneBox.scale.setScalar(1.4);
  const oneLid = new THREE.Mesh(frogGeo, frogMat);
  oneLid.scale.set(1.4, 0.3, 1.4);
  oneLid.position.set(0.02, 0.1, -0.04);
  oneLid.rotation.x = -0.5;
  frogOne.add(oneBox, oneLid);
  frogOne.position.set(SWEET.frog.at[0] + 0.62, 0.7, z0 - 0.02);
  frogOne.visible = !found.has('frog');
  group.add(frogOne);
  const beanMat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.6 });
  const beanGeo = new THREE.BoxGeometry(0.16, 0.12, 0.1).translate(0, 0.06, 0);
  const beans = instanced(beanGeo, beanMat, beanBoxes.slice(0, found.has('beans') ? 8 : 9), { colours: ['#c2272d', '#f4efe2', '#c2272d'] });
  group.add(beans);

  // the Sugar Quills: a tall jar of them on a little round table by the side shelves
  const quillAt = SWEET.quill.at;
  const qt = frame(kit, { at: [quillAt[0], 0, quillAt[1]] });
  qt.cyl(wood, 0, 0, 0, 0.18, 0.24, 0.05, { seg: 16 });
  qt.cyl(wood, 0, 0.05, 0, 0.05, 0.05, 0.85, { seg: 10 });
  qt.cyl(wood, 0, 0.9, 0, 0.32, 0.32, 0.04, { seg: 20 });
  kit.solid(quillAt[0], quillAt[1], 0.45);
  const quillGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.36, 5).translate(0, 0.18, 0);
  const tipGeo = new THREE.ConeGeometry(0.02, 0.12, 6).translate(0, 0.42, 0);
  const quills = [];
  for (let i = 0; i < 14; i++) quills.push({ at: [quillAt[0] + Math.cos(i * 2.4) * 0.04, 0.94, quillAt[1] + Math.sin(i * 2.4) * 0.04], rx: Math.cos(i) * 0.18, rz: Math.sin(i * 1.7) * 0.18 });
  const quillMat = new MeshStandardNodeMaterial({ color: '#f4e9d8', roughness: 0.4 });
  const tipMat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.6 });
  const quillN = found.has('quill') ? quills.length - 1 : quills.length;
  const quillMesh = instanced(quillGeo, quillMat, quills.slice(0, quillN));
  const tipMesh = instanced(tipGeo, tipMat, quills.slice(0, quillN), { colours: ['#f0a8c8', '#a8d8f0', '#f0e0a0'] });
  group.add(quillMesh, tipMesh);
  const quillJar = createStock([{ kind: 'jar', at: [quillAt[0], 0.94, quillAt[1]], ry: 0, s: 1.3, colour: '#fff4e0' }], { tier });
  group.add(quillJar.group);

  // the lollipops turning in the right-hand window
  const pops = new THREE.Group();
  pops.position.set(3.6, 0.6, D / 2 - 0.45);
  const stickGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5).translate(0, 0.25, 0);
  const popGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 18).rotateX(Math.PI / 2).translate(0, 0.55, 0);
  const popSpots = [];
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 8 - ring * 2; i++) {
    const a = (i / (8 - ring * 2)) * Math.PI * 2 + ring;
    popSpots.push({ at: [Math.cos(a) * (0.42 - ring * 0.14), ring * 0.28, Math.sin(a) * (0.42 - ring * 0.14)], ry: -a + Math.PI / 2 });
  }
  pops.add(instanced(stickGeo, quillMat, popSpots), instanced(popGeo, tipMat, popSpots, { colours: ['#e8455a', '#f2b63c', '#7ac74f', '#53a7e8', '#c36be0'] }));
  const popPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.1, 8).translate(0, 0.25, 0), kit.mat('brass'));
  pops.add(popPost);
  group.add(pops);
  // the window shelves the passers-by see: stepped, with jars on them
  const shows = [];
  for (const x of [-3.6, 3.6]) {
    kit.box(wood, x, 0, D / 2 - 0.35, 3, 0.55, 0.5);
    if (x < 0) shows.push({ at: [x, 0.55, D / 2 - 0.35], ry: Math.PI, w: 2.8, h: 0.5 });
  }
  const windowStock = createStock(fill(shows, { seed: 4, tier }), { tier });
  group.add(windowStock.group);

  // the cellar’s trapdoor behind the counter: an oak hatch flush with the boards, an iron ring to lift it
  const hatch = frame(kit, { at: [TRAPDOOR[0], 0, TRAPDOOR[1]], ry: 0.04 });
  hatch.box('darkoak', 0, 0, 0, 1.1, 0.025, 0.9);
  for (const z of [-0.3, 0.3]) hatch.box('iron', -0.2, 0.025, z, 0.6, 0.01, 0.06);
  hatch.add('iron', new THREE.TorusGeometry(0.07, 0.012, 6, 16).rotateX(Math.PI / 2), { x: 0.35, y: 0.03 });
  // a sack and a crate by it: the cellar’s door is used
  kit.box('board', TRAPDOOR[0] + 1.0, 0, TRAPDOOR[1] + 0.2, 0.55, 0.45, 0.45, { ry: 0.3 });
  kit.add(kit.paint('#b49a6a', { rough: 1 }), new THREE.SphereGeometry(0.3, 10, 8), { at: [TRAPDOOR[0] + 1.05, 0.25, TRAPDOOR[1] - 0.5], scale: [1, 0.8, 0.9] });

  // the name over the counter, and over the door inside a little bell on its spring
  const sign = signBoard({ text: 'Honeydukes', w: 3.2, h: 0.62, bg: PAINT, fg: '#f1cf72', renderer });
  sign.mesh.position.set(-1.5, H - 0.75, -D / 2 + 0.47);
  group.add(sign.mesh);
  kit.add('brass', new THREE.SphereGeometry(0.06, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), { at: [0.5, 2.55, D / 2 - 0.2] });
  kit.box('brass', 0.5, 2.55, D / 2 - 0.2, 0.012, 0.25, 0.012);

  // the light: lamps hung from the beams, the room’s warm bounce, what the windows let in
  const lamps = [
    [-3.2, H - 0.3, -0.9],
    [0, H - 0.3, 1.6],
    [3.2, H - 0.3, -0.9],
    [-4.2, H - 0.3, -3.0],
    [1.5, H - 0.3, -3.0],
    [-4.2, H - 0.3, 2.6],
  ].map((at) => lamp(kit, group, { at, tier, k: LAMP, colour: '#ffd6a0', distance: 11 }));
  const hemi = new THREE.HemisphereLight(0xfff0e4, 0x6a4a40, 1.6);
  group.add(hemi);
  kit.build(group);

  let env = null;
  let gone = false;
  roomEnv(renderer, { warm: '#ffc89a', windows: '#c9d2e0', walls: '#5a3a38' })
    .then((tex) => {
      if (gone) return tex?.dispose();
      env = tex;
      wearEnv(kit.materials().filter((m) => m.metalness > 0.3), env, 1);
    })
    .catch(() => {});

  const street = streetSide('honeydukes');
  const spots = () =>
    [
      !found.has('frog') && { id: 'frog', at: SWEET.frog.at, r: 0.7, verb: 'Take', label: SWEET.frog.label },
      !found.has('beans') && { id: 'beans', at: SWEET.beans.at, r: 0.7, verb: 'Take', label: SWEET.beans.label },
      !found.has('quill') && { id: 'quill', at: SWEET.quill.at, r: 0.7, verb: 'Take', label: SWEET.quill.label },
      { id: 'trapdoor', at: TRAPDOOR, r: 0.8, verb: 'Look at', label: 'The trapdoor' },
    ].filter(Boolean);
  let t = 0;
  let tasted = Math.floor((props.week ?? 1) * 5 + (props.hour ?? 0));
  const say = (text) => ctx.say?.(text);
  const tell = (type, data) => ctx.tell?.(type, data);

  const out = {
    id: 'honeydukes',
    name: 'Honeydukes',
    group,
    spawn: { at: [room.door[0], 0, room.door[1] - 0.6], yaw: 0 },
    colliders: kit.colliders,
    floors: [],
    bounds: room.bounds,
    floorAt: () => 0,
    doors: [{ id: 'street', at: [0, D / 2 - 0.25], r: 0.9, name: 'Hogsmeade', verb: 'Go out', faces: 0, to: 'hogsmeade', toAt: street.at, toYaw: street.yaw }],
    out: { to: 'hogsmeade', at: street.at, yaw: street.yaw },
    spots: spots(),
    places: [
      { id: 'counter', name: 'The counter', at: [cx, counter.z], r: 3 },
      { id: 'window', name: 'The window', at: [-3.6, 3.4], r: 2 },
    ],
    poses: {
      door: { at: [0, 1.6, D / 2 - 1.2], look: [0, 1.4, -D / 2] },
      counter: { at: [-0.6, 1.55, 1.6], look: [-1.8, 1.2, -3.2] },
      window: { at: [-1.2, 1.5, -0.6], look: [-3.6, 1.0, 3.4] },
      shelves: { at: [-2.5, 1.6, 2.6], look: [-5.6, 1.6, -1.2] },
    },
    use(id) {
      if (id === 'trapdoor') return say(LINES.trapdoor);
      if (!SWEET[id] || found.has(id)) return;
      found.add(id);
      if (id === 'frog') {
        frogOne.visible = false;
        tell('sweet', { id: 'frog' });
        tell('pickup', { id: 'card', card: 'merlin' });
        say(LINES.frog);
      } else if (id === 'beans') {
        beans.count = 8;
        tell('sweet', { id: 'beans' });
        say(LINES.beans(beanFor(tasted++)));
      } else if (id === 'quill') {
        quillMesh.count = tipMesh.count = quills.length - 1;
        tell('sweet', { id: 'quill' });
        say(LINES.quill);
      }
      out.spots = spots();
    },
    step(dt) {
      t += dt;
      pops.rotation.y = t * 0.35;
      // (the lamps breathe a little, as flames in glass do)
      lamps.forEach((l, i) => l && (l.intensity = LAMP * (0.94 + 0.06 * Math.sin(t * 2.3 + i * 1.7))));
    },
    set() {},
    info: () => ({ ...countOf(group), stock: stock.count }),
    dispose() {
      gone = true;
      env?.dispose();
      for (const s of [stock, jars, windowStock, quillJar, sign]) s.dispose();
      for (const m of [loose, frogBoxes, beans, quillMesh, tipMesh]) m.dispose?.();
      for (const g of [sweetGeo, frogGeo, beanGeo, quillGeo, tipGeo, stickGeo, popGeo, popPost.geometry]) g.dispose();
      for (const m of [sweetMat, frogMat, beanMat, quillMat, tipMat]) m.dispose();
      kit.dispose();
      group.removeFromParent();
    },
  };
  return out;
}

export default { id: 'honeydukes', name: 'Honeydukes', build };
