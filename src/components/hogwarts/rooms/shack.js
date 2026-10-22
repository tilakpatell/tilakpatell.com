// The Shrieking Shack (the design’s §4.9): the house on the hill above
// Hogsmeade that the village says is the most haunted in Britain. One room
// of bare boards, some of them gone; its windows boarded, the night coming
// through the gaps in slits; the furniture smashed (a table on its knees, a
// chair in pieces, a bed with its hangings in rags); long gouges down the
// walls in fours, as if something with claws had wanted out; dust on
// everything, a lantern on a chain turning in the draught. The passage
// under the Willow comes up through a trapdoor in the floor. The front door
// won’t open from in here without Alohomora; once it does, it lets you out
// onto the hill above the village. Coming in is quest 12’s third thing (the
// host’s 'room' event says so).
//
// A room for rooms/host.js: build(rt, ctx) → room (its header says the shape);
// the frame: the floor’s middle at the origin, the front door at +z (the
// village down the hill outside it), the trapdoor at the back.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { createRoomKit, countOf } from './kit';
import { bed, frame } from './parts/furniture';
import { canvasTexture } from '../../../lib/three/canvasTexture';
import { lamp, panes, shell } from './village/shell';
import { LINES, SHACK_ROOM, shackFront, tunnelFoot } from './village/plan';

const W = 7;
const D = 6;
const H = 2.75;
const DOOR = { x: 0.9, w: 1.05, h: 2.05 };
const TRAP = SHACK_ROOM.trap;
const SLIT = 18; // the light through a boarded window’s gaps

// claw marks: gouges in fours, pale where the wood is torn, on a clear canvas
function paintGouges(seed = 3) {
  const c = typeof document === 'undefined' ? null : Object.assign(document.createElement('canvas'), { width: 256, height: 512 });
  if (!c) return null;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let set = 0; set < 2; set++) {
    const x0 = 40 + rnd() * 120;
    const y0 = 40 + set * 220 + rnd() * 40;
    const lean = (rnd() - 0.5) * 0.5;
    for (let k = 0; k < 4; k++) {
      const x = x0 + k * 22;
      const len = 150 + rnd() * 60;
      g.strokeStyle = 'rgba(20,12,6,0.85)';
      g.lineWidth = 11 + rnd() * 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, y0);
      g.quadraticCurveTo(x + lean * len * 0.5 + 6, y0 + len * 0.5, x + lean * len, y0 + len);
      g.stroke();
      g.strokeStyle = 'rgba(224,200,160,0.95)';
      g.lineWidth = 6 + rnd() * 2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, y0);
      g.quadraticCurveTo(x + lean * len * 0.5 + 6, y0 + len * 0.5, x + lean * len, y0 + len);
      g.stroke();

    }
  }
  return c;
}

function build(rt, ctx = {}) {
  const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
  const props = ctx.props ?? {};
  const renderer = ctx.renderer ?? rt?.gfx?.renderer ?? null;
  const group = new THREE.Group();
  group.name = 'room:shack';
  const kit = createRoomKit({ tier });
  const planks = kit.paint('#806a52', { scan: 'wood', metres: 1.0, strength: 0.75, rough: 0.95 });
  const grey = kit.paint('#6e6458', { scan: 'wood', metres: 0.9, strength: 0.8, rough: 1 });
  const dark = kit.paint('#0c0907', { rough: 1 });
  const windows = [-1.9, 2.5].map((x) => ({ x, w: 1.0, y: 0.95, h: 1.05 }));
  const room = shell(kit, { w: W, d: D, h: H, floor: dark, wall: planks, lower: grey, ceiling: '#3e3428', beams: 3, sag: 0.14, door: DOOR, windows, scan: 'wood', leaf: false });
  panes(kit, room.panes, props.hour ?? 22, { grime: 0.5 });
  // the windows boarded over: planks nailed across, the night in the gaps
  for (const p of room.panes)
    for (let i = 0; i < 4; i++) kit.box(grey, p.at[0] + (i % 2 ? 0.04 : -0.03), p.at[1] + 0.08 + i * 0.25, p.at[2] - 0.08, p.w + 0.2, 0.17, 0.03, { rz: (i % 2 ? 1 : -1) * 0.07 });

  // the floor: boards on the dark, a few gone and one snapped and sprung
  let s = 29;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let x = -W / 2 + 0.1; x < W / 2; x += 0.21) {
    const gone = rnd() < 0.07 && Math.abs(x - TRAP[0]) > 0.8;
    if (gone) continue;
    const snap = rnd() < 0.06;
    if (snap) {
      kit.box(planks, x, 0, -D / 4 - 0.3, 0.19, 0.03, D / 2 - 0.6);
      kit.box(planks, x, 0.06, D / 4, 0.19, 0.03, D / 2 - 0.2, { rx: 0.06 });
    } else kit.box(planks, x, 0, 0, 0.19, 0.03, D);
  }

  // the trapdoor: a square hole, its hatch thrown back, a ladder going down into the dark
  kit.box(dark, TRAP[0], 0.031, TRAP[1], 0.95, 0.002, 0.95);
  const hatch = frame(kit, { at: [TRAP[0] - 0.5, 0.03, TRAP[1]], ry: 0 });
  hatch.box(grey, -0.48, 0, 0, 0.95, 0.04, 0.95, { rz: 0.12 });
  for (const sx of [-0.3, 0.3]) kit.box(grey, TRAP[0] + sx, -1.5, TRAP[1] - 0.36, 0.05, 1.9, 0.05, { rx: -0.12 });
  for (let i = 0; i < 4; i++) kit.box(grey, TRAP[0], -1.2 + i * 0.35, TRAP[1] - 0.36 + (3 - i) * 0.04, 0.6, 0.04, 0.05);
  kit.solid(TRAP[0], TRAP[1], 0.42);

  // the wreck: a table down on two broken legs, a chair in pieces, a cupboard fallen against the wall, the bed
  const tb = frame(kit, { at: [1.1, 0, -0.6], ry: 0.5 });
  tb.box(planks, 0, 0.42, 0, 1.4, 0.06, 0.8, { rz: 0.32 });
  tb.box(grey, 0.6, 0, 0.3, 0.08, 0.8, 0.08);
  tb.box(grey, 0.6, 0, -0.3, 0.08, 0.8, 0.08);
  tb.box(grey, -0.2, 0.02, 0.55, 0.08, 0.08, 0.7, { ry: 0.9, rz: Math.PI / 2 });
  kit.solid(1.1, -0.6, 0.85);
  const ch = frame(kit, { at: [-0.6, 0, 1.2], ry: -0.8 });
  ch.box(planks, 0, 0.02, 0, 0.45, 0.04, 0.42, { rz: 0.1 });
  ch.box(grey, 0.3, 0.02, 0.3, 0.05, 0.05, 0.46, { ry: 0.4, rz: Math.PI / 2 });
  ch.box(grey, -0.35, 0.02, -0.2, 0.05, 0.05, 0.46, { ry: -0.7, rz: Math.PI / 2 });
  ch.box(grey, 0.1, 0.03, -0.45, 0.5, 0.05, 0.9, { rx: -1.2 });
  const cup = frame(kit, { at: [W / 2 - 0.55, 0, 0.9], ry: -Math.PI / 2 });
  cup.box(planks, 0, 0, 0, 1.1, 1.7, 0.5, { rx: 0.18 });
  cup.box(dark, 0.05, 0.5, 0.27, 0.9, 0.9, 0.02, { rx: 0.18 });
  kit.solid(W / 2 - 0.55, 0.9, 0.7);
  bed(kit, { at: [1.6, 0, -D / 2 + 1.2], ry: 0, hangings: '#4a2c2c', len: 2.0, w: 1.3 });
  kit.wall(0.9, -D / 2 + 0.3, 2.3, -D / 2 + 0.3, 0.55);
  kit.wall(0.9, -D / 2 + 1.2, 2.3, -D / 2 + 1.2, 0.55);
  // (rags of the hangings, hanging off the canopy)
  const rag = kit.paint('#3e2424', { rough: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) kit.box(rag, 1.0 + i * 0.3, 1.25 + rnd() * 0.3, -D / 2 + 0.25 + (i % 2) * 1.9, 0.18, 0.6 + rnd() * 0.4, 0.01, { rz: (rnd() - 0.5) * 0.4 });

  // the gouges on the walls: a canvas of them, laid where something tried the walls
  const gougeTex = (() => {
    const c = paintGouges(7);
    return c ? canvasTexture(c, renderer, { wrap: false }) : null;
  })();
  const gougeMat = new MeshStandardNodeMaterial({ map: gougeTex, transparent: true, alphaTest: 0.05, roughness: 1, depthWrite: false });
  const gouges = [];
  for (const [x, y, z, ry] of [
    [-W / 2 + 0.02, 1.2, 0.4, Math.PI / 2],
    [-W / 2 + 0.02, 1.0, -1.4, Math.PI / 2],
    [W / 2 - 0.02, 1.3, -1.2, -Math.PI / 2],
    [-0.6, 1.25, -D / 2 + 0.02, 0],
    [2.0, 1.15, D / 2 - 0.02, Math.PI],
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), gougeMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    group.add(m);
    gouges.push(m);
  }

  // the front door: shut in its frame, hinged on its left; Alohomora swings it in
  const hinge = new THREE.Group();
  hinge.position.set(DOOR.x - DOOR.w / 2 + 0.03, 0, D / 2 - 0.04);
  const leafKit = createRoomKit({ tier });
  leafKit.box(planks, DOOR.w / 2 - 0.03, 0.02, 0, DOOR.w - 0.06, DOOR.h - 0.04, 0.06);
  for (const y of [0.35, 1.0, 1.65]) leafKit.box('iron', DOOR.w / 2 - 0.03, y, -0.04, DOOR.w - 0.16, 0.06, 0.02);
  leafKit.cyl('iron', DOOR.w - 0.18, 1.0, -0.06, 0.03, 0.03, 0.05, { seg: 8, rx: Math.PI / 2 });
  leafKit.build(hinge);
  group.add(hinge);
  // (outside the door: the night on the hill, a dark blue that shows when it opens)
  const nightMat = new MeshBasicNodeMaterial({ color: new THREE.Color('#1b2340') });
  const night = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w + 0.4, DOOR.h + 0.3), nightMat);
  night.position.set(DOOR.x, DOOR.h / 2, D / 2 + 0.5);
  night.rotation.y = Math.PI;
  group.add(night);

  // the lantern on its chain, out, turning in the draught; the light is the night’s, through the boards
  const swing = new THREE.Group();
  swing.position.set(-0.4, H - 0.05, -0.2);
  const lampKit = createRoomKit({ tier });
  lamp(lampKit, swing, { at: [0, 0, 0], drop: 0.85, tier: 'low', colour: '#4a3a2a' });
  lampKit.build(swing);
  group.add(swing);
  // (the night’s grey-blue through the cracks: dim, but enough to see the wreck by)
  const hemi = new THREE.HemisphereLight(0xa8b4d4, 0x4a4036, tier === 'low' ? 3.2 : 2.4);
  group.add(hemi);
  const fill = tier === 'low' ? null : new THREE.PointLight('#b0bcd8', 16, 10, 1.3);
  if (fill) {
    fill.position.set(0.4, H - 0.4, 0.6);
    group.add(fill);
  }
  const slits = room.panes.map((p) => {
    if (tier === 'low') return null;
    const l = new THREE.PointLight('#8ea2d8', SLIT, 8, 1.5);
    l.position.set(p.at[0], p.at[1] + p.h / 2, p.at[2] - 0.6);
    group.add(l);
    return l;
  });
  // (a faint warm glow up through the trapdoor from the passage’s fungus)
  const below = tier === 'low' ? null : new THREE.PointLight('#9ad0c0', 1.6, 3, 1.5);
  if (below) {
    below.position.set(TRAP[0], -0.4, TRAP[1]);
    group.add(below);
  }
  kit.build(group);

  // dust, hanging in the slits of light
  const motes = [];
  for (let i = 0; i < (tier === 'low' ? 0 : 90); i++) motes.push([-3 + rnd() * 6, 0.4 + rnd() * 2, -2.5 + rnd() * 5]);
  const moteGeo = new THREE.SphereGeometry(0.006, 4, 3);
  const moteMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#d8d0c0'), emissive: new THREE.Color('#40444c'), roughness: 1 });
  const moteMesh = new THREE.InstancedMesh(moteGeo, moteMat, Math.max(1, motes.length));
  moteMesh.count = motes.length;
  group.add(moteMesh);
  const m4 = new THREE.Matrix4();

  const foot = tunnelFoot();
  const front = shackFront();
  const down = { id: 'trapdoor', at: TRAP, r: 0.7, name: 'The passage', verb: 'Climb down', to: 'tunnel', toAt: foot.at, toYaw: foot.yaw };
  const way = { id: 'front', at: [DOOR.x, D / 2 - 0.3], r: 0.8, name: 'Hogsmeade', verb: 'Go out', to: 'hogsmeade', toAt: front.at, toYaw: front.yaw };
  let opening = -1; // (s since Alohomora, or −1 while shut)
  let t = 0;
  const out = {
    id: 'shack',
    name: 'The Shrieking Shack',
    group,
    // (beside the trapdoor, as you come up out of it, looking into the room)
    spawn: { at: [SHACK_ROOM.up.at[0], 0, SHACK_ROOM.up.at[1]], yaw: SHACK_ROOM.up.yaw },
    colliders: kit.colliders,
    floors: [],
    bounds: room.bounds,
    floorAt: () => 0.03,
    doors: [down],
    out: { to: 'tunnel', at: foot.at, yaw: foot.yaw },
    spots: [{ id: 'door', at: [DOOR.x, D / 2 - 0.4], r: 0.7, verb: 'Cast Alohomora', label: 'The front door' }],
    places: [{ id: 'shack', name: 'The Shrieking Shack', at: [0, 0], r: 3 }],
    poses: {
      trapdoor: { at: [TRAP[0] + 1.0, 1.55, TRAP[1] + 1.2], look: [1.6, 1.0, 1.4] },
      room: { at: [2.6, 1.6, 2.2], look: [-2.0, 0.9, -1.8] },
      bed: { at: [-1.2, 1.5, 1.6], look: [1.6, 0.9, -D / 2 + 1] },
      door: { at: [-1.4, 1.55, -0.6], look: [DOOR.x, 1.1, D / 2] },
    },
    use(id) {
      if (id !== 'door' || opening >= 0) return;
      opening = 0;
      ctx.say?.(LINES.open);
      out.spots = [];
      out.doors = [down, way];
    },
    step(dt) {
      t += dt;
      swing.rotation.z = Math.sin(t * 0.9) * 0.06;
      swing.rotation.x = Math.sin(t * 0.63 + 1) * 0.04;
      if (opening >= 0) {
        opening += dt;
        // (dragged open on its hinge, slow at first and then going)
        const k = Math.min(1, opening / 1.4);
        hinge.rotation.y = -1.35 * k * k * (3 - 2 * k);
      }
      slits.forEach((l, i) => l && (l.intensity = SLIT * (0.9 + 0.1 * Math.sin(t * 0.4 + i * 2))));
      motes.forEach((p, i) => {
        m4.makeTranslation(p[0] + Math.sin(t * 0.1 + i) * 0.2, p[1] + Math.sin(t * 0.07 + i * 1.3) * 0.25, p[2] + Math.cos(t * 0.09 + i) * 0.2);
        moteMesh.setMatrixAt(i, m4);
      });
      moteMesh.instanceMatrix.needsUpdate = motes.length > 0;
    },
    set() {},
    info: () => ({ ...countOf(group), open: opening >= 0 }),
    dispose() {
      for (const g of gouges) g.geometry.dispose();
      gougeMat.dispose();
      gougeTex?.dispose();
      night.geometry.dispose();
      nightMat.dispose();
      moteMesh.dispose();
      moteGeo.dispose();
      moteMat.dispose();
      leafKit.dispose();
      lampKit.dispose();
      kit.dispose();
      group.removeFromParent();
    },
  };
  return out;
}

export default { id: 'shack', name: 'The Shrieking Shack', build };
