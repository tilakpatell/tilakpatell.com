// The passage under the Whomping Willow (the design’s §4.9): a low tunnel
// dug through the earth from the Willow’s roots to the Shrieking Shack,
// sixty metres of it, bending round old stones, going down under the lawn
// and up the Shack’s hill. Roots come through its roof, thick by the Willow
// and thinner further on; pale fungus glows in clumps along its foot, and
// that and the light at either end is all the light there is: the night
// between the Willow’s roots behind you, the Shack’s trapdoor at the top of
// a ladder ahead.
//
// A room for rooms/host.js: build(rt, ctx) → room (its header says the shape);
// the frame: the Willow end at the origin, the passage running off along
// −z and bending (village/plan.js’s TUNNEL); its floor rises and falls.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { createRoomKit, countOf } from './kit';
import { lamp } from './village/shell';
import { SHACK_ROOM, TUNNEL, onTunnel, tunnelFoot, tunnelSamples, walkYaw } from './village/plan';

const RING = 14; // vertices round the arch
const STEP = 0.5; // m between rings
const GLOW = 20; // a lit clump of fungus: enough to see the walls by, no more

// (a small hash for the earth’s lumps: the same every visit)
const lump = (i, j) => {
  const v = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return v - Math.floor(v) - 0.5;
};

// the arch swept along the passage: walls and roof as one surface, the floor as another
// (wound so their faces, and so their normals, look into the passage, where the eye is)
function sweep(list) {
  const pos = [];
  const uv = [];
  const idx = [];
  const fpos = [];
  const fuv = [];
  const fidx = [];
  const FLOOR = 4;
  list.forEach((p, i) => {
    const right = [-p.dir[1], p.dir[0]];
    for (let j = 0; j <= RING; j++) {
      const a = (Math.PI * j) / RING;
      // (lumpier in the wall than at its foot; bulging a little over the walker’s head)
      const k = 1 + lump(i, j) * 0.16 * Math.sin(a);
      const side = Math.cos(a) * TUNNEL.wide * k;
      const up = Math.sin(a) * TUNNEL.crown * (1 + lump(j, i) * 0.06);
      pos.push(p.at[0] + right[0] * side, p.y + up, p.at[1] + right[1] * side);
      uv.push((j / RING) * 3.5, p.s / 2);
    }
    for (let j = 0; j <= FLOOR; j++) {
      const off = TUNNEL.wide * (1 - (2 * j) / FLOOR) * 1.02;
      // (worn into a path down its middle)
      const dip = -0.05 * (1 - Math.abs(off) / TUNNEL.wide) + lump(i * 3, j) * 0.03;
      fpos.push(p.at[0] + right[0] * off, p.y + dip, p.at[1] + right[1] * off);
      fuv.push(j / FLOOR, p.s / 2);
    }
  });
  for (let i = 0; i < list.length - 1; i++) {
    for (let j = 0; j < RING; j++) {
      const a = i * (RING + 1) + j;
      const b = a + RING + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    for (let j = 0; j < FLOOR; j++) {
      const a = i * (FLOOR + 1) + j;
      const b = a + FLOOR + 1;
      fidx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const make = (p, u, x) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.setIndex(x);
    g.computeVertexNormals();
    return g;
  };
  return { walls: make(pos, uv, idx), floor: make(fpos, fuv, fidx) };
}

// an end of the passage, closed: the arch’s outline filled
function cap(p, flip) {
  const shape = new THREE.Shape();
  for (let j = 0; j <= RING; j++) {
    const a = (Math.PI * j) / RING;
    const x = Math.cos(a) * TUNNEL.wide * 1.05;
    const y = Math.sin(a) * TUNNEL.crown * 1.04;
    if (j === 0) shape.moveTo(x, y - 0.1);
    else shape.lineTo(x, y);
  }
  const g = new THREE.ShapeGeometry(shape);
  // (stood across the passage, facing back into it)
  g.rotateY(Math.atan2(p.dir[0], p.dir[1]) + (flip ? Math.PI : 0));
  g.translate(p.at[0], p.y, p.at[1]);
  return g;
}

function build(rt, ctx = {}) {
  const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
  const group = new THREE.Group();
  group.name = 'room:tunnel';
  const kit = createRoomKit({ tier });
  const list = tunnelSamples(STEP);
  const first = list[0];
  const last = list.at(-1);
  const earth = kit.paint('#6e5640', { scan: 'mud', metres: 1.6, strength: 0.85, rough: 1, side: THREE.DoubleSide });
  const ground = kit.paint('#574634', { scan: 'mud', metres: 1.2, strength: 0.75, rough: 1 });
  const stone = kit.paint('#a08c74', { scan: 'rock', metres: 0.8, strength: 0.7, rough: 0.95 });
  const bark = kit.paint('#4a3624', { scan: 'bark', metres: 0.5, strength: 0.7, rough: 0.95 });
  const { walls, floor } = sweep(list);
  kit.add(earth, walls);
  kit.add(ground, floor);
  kit.add(earth, cap(last, true));

  let s = 41;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // stones in the walls, and stones fallen at their foot
  for (let i = 0; i < 46; i++) {
    const p = list[Math.floor(rnd() * list.length)];
    const right = [-p.dir[1], p.dir[0]];
    const side = rnd() < 0.5 ? -1 : 1;
    const a = rnd() * 1.2;
    const off = side * Math.cos(a) * TUNNEL.wide * 0.98;
    const r = 0.12 + rnd() * 0.22;
    kit.add(stone, new THREE.DodecahedronGeometry(r, 1), { at: [p.at[0] + right[0] * off, p.y + Math.sin(a) * TUNNEL.crown * 0.9, p.at[1] + right[1] * off], ry: rnd() * 6, rx: rnd() * 6, scale: [1, 0.7 + rnd() * 0.4, 1] });
  }
  // the roots through the roof: many by the Willow, fewer as you go
  for (let i = 0; i < (tier === 'low' ? 26 : 54); i++) {
    const t = Math.pow(rnd(), 1.8);
    const p = list[Math.min(list.length - 1, Math.floor(t * list.length))];
    const right = [-p.dir[1], p.dir[0]];
    const off = (rnd() - 0.5) * TUNNEL.wide * 1.3;
    const top = p.y + Math.sqrt(Math.max(0, 1 - (off / TUNNEL.wide) ** 2)) * TUNNEL.crown;
    const hang = 0.4 + rnd() * (t < 0.2 ? 1.3 : 0.7);
    const x = p.at[0] + right[0] * off;
    const z = p.at[1] + right[1] * off;
    const sway = [(rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6];
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, top + 0.2, z), new THREE.Vector3(x + sway[0] * 0.4, top - hang * 0.5, z + sway[1] * 0.4), new THREE.Vector3(x + sway[0], top - hang, z + sway[1])]);
    kit.add(bark, new THREE.TubeGeometry(curve, 6, 0.02 + rnd() * 0.05, 5, false));
  }
  // the Willow end: its roots knotted across the way out, the night between them
  for (let i = 0; i < 12; i++) {
    const right = [-first.dir[1], first.dir[0]];
    const off = (i / 11 - 0.5) * TUNNEL.wide * 2;
    const x = first.at[0] + right[0] * off + first.dir[0] * -0.2;
    const z = first.at[1] + right[1] * off + first.dir[1] * -0.2;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, -0.1, z), new THREE.Vector3(x + right[0] * 0.3 * Math.sin(i), 1.2, z + right[1] * 0.3 * Math.sin(i)), new THREE.Vector3(x - right[0] * 0.2, 2.4, z - right[1] * 0.2)]);
    kit.add(bark, new THREE.TubeGeometry(curve, 8, 0.06 + (i % 3) * 0.03, 6, false));
  }
  const skyMat = new MeshBasicNodeMaterial({ color: new THREE.Color('#2a3a66').multiplyScalar(1.4) });
  const sky = new THREE.Mesh(cap({ at: [first.at[0] - first.dir[0] * 0.6, first.at[1] - first.dir[1] * 0.6], y: first.y, dir: first.dir }, false), skyMat);
  group.add(sky);
  // a slope of earth and roots up to the way out
  kit.add(ground, new THREE.BoxGeometry(TUNNEL.wide * 2, 0.6, 1.6), { at: [first.at[0] - first.dir[0] * 0.2, first.y - 0.28, first.at[1] - first.dir[1] * 0.2], ry: Math.atan2(first.dir[0], first.dir[1]), rx: 0.35 });

  // the Shack end: a ladder up to the trapdoor, its square of warm light in the roof
  const up = [-last.dir[0], -last.dir[1]];
  const ladderAt = [last.at[0] - last.dir[0] * 0.35, last.at[1] - last.dir[1] * 0.35];
  const ry = Math.atan2(last.dir[0], last.dir[1]);
  for (const sx of [-0.25, 0.25]) kit.add('oak', new THREE.BoxGeometry(0.05, TUNNEL.crown + 0.6, 0.05).translate(sx, (TUNNEL.crown + 0.6) / 2, 0), { at: [ladderAt[0], last.y, ladderAt[1]], ry, rx: -0.12 });
  for (let i = 0; i < 7; i++) kit.add('oak', new THREE.BoxGeometry(0.55, 0.04, 0.05).translate(0, 0.3 + i * 0.36, -i * 0.043), { at: [ladderAt[0], last.y, ladderAt[1]], ry });
  const hatchMat = new MeshBasicNodeMaterial({ color: new THREE.Color('#8ea2d8').multiplyScalar(0.8) });
  const hatch = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85).rotateX(Math.PI / 2), hatchMat);
  hatch.position.set(ladderAt[0] + up[0] * 0.2, last.y + TUNNEL.crown * 0.98, ladderAt[1] + up[1] * 0.2);
  group.add(hatch);

  // the fungus: pale caps in clumps at the walls’ foot, glowing
  const glowA = kit.glow('#a8f0d8', 1.8);
  const glowB = kit.glow('#d8f0a8', 1.4);
  const clumps = [];
  for (let i = 0; i < 16; i++) {
    const p = list[Math.floor(((i + 0.5) / 16) * list.length)];
    const right = [-p.dir[1], p.dir[0]];
    const side = i % 2 ? 1 : -1;
    const base = [p.at[0] + right[0] * side * TUNNEL.wide * 0.86, p.at[1] + right[1] * side * TUNNEL.wide * 0.86];
    clumps.push([base[0], p.y + 0.25, base[1]]);
    for (let k = 0; k < 7; k++) {
      const r = 0.025 + rnd() * 0.05;
      kit.add(k % 3 ? glowA : glowB, new THREE.SphereGeometry(r, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), { at: [base[0] + (rnd() - 0.5) * 0.4, p.y + rnd() * 0.5, base[1] + (rnd() - 0.5) * 0.4], scale: [1, 0.5, 1] });
    }
  }
  // (their light: a few of the clumps lit for real, more on a stronger device)
  const lit = { low: 0, mid: 3, high: 6, ultra: 8 }[tier] ?? 6;
  const lights = [];
  for (let i = 0; i < lit; i++) {
    const c = clumps[Math.floor(((i + 0.5) / lit) * clumps.length)];
    const l = new THREE.PointLight('#9fe0c8', GLOW, 10, 1.5);
    l.position.set(c[0], c[1] + 0.2, c[2]);
    group.add(l);
    lights.push(l);
  }
  // the night at the Willow end and the Shack’s lamplight down the ladder
  const night = new THREE.PointLight('#7f94d0', tier === 'low' ? 0 : 6, 9, 1.5);
  night.position.set(first.at[0] + first.dir[0] * 1.2, first.y + 1.6, first.at[1] + first.dir[1] * 1.2);
  group.add(night);
  const shackGlow = new THREE.PointLight('#8ea2d8', tier === 'low' ? 0 : 3, 6, 1.5);
  shackGlow.position.set(hatch.position.x, hatch.position.y - 0.6, hatch.position.z);
  group.add(shackGlow);
  const hemi = new THREE.HemisphereLight(0xa89a88, 0x3a2e22, tier === 'low' ? 2.2 : 1.5);
  group.add(hemi);
  // an old lantern someone left on a nail halfway, out
  const mid = list[Math.floor(list.length * 0.55)];
  lamp(kit, group, { at: [mid.at[0] + -mid.dir[1] * 0.9, mid.y + 1.9, mid.at[1] + mid.dir[0] * 0.9], drop: 0.3, tier: 'low', colour: '#3a3020' });
  kit.build(group);

  // the walls the walk goes round: a run of circles down each side, and across the ends
  const colliders = [];
  for (const p of list) {
    const right = [-p.dir[1], p.dir[0]];
    for (const side of [-1, 1]) colliders.push({ at: [p.at[0] + right[0] * side * (TUNNEL.wide + 0.2), p.at[1] + right[1] * side * (TUNNEL.wide + 0.2)], r: 0.5 });
  }
  for (const [p, back] of [
    [first, -0.7],
    [last, 0.5],
  ]) {
    const right = [-p.dir[1], p.dir[0]];
    for (let k = -2; k <= 2; k++) colliders.push({ at: [p.at[0] + p.dir[0] * back + right[0] * k * 0.5, p.at[1] + p.dir[1] * back + right[1] * k * 0.5], r: 0.45 });
  }
  const xs = list.map((p) => p.at[0]);
  const zs = list.map((p) => p.at[1]);
  const pad = TUNNEL.wide + 0.5;
  const foot = tunnelFoot();
  const start = [first.at[0] + first.dir[0] * 1.4, first.at[1] + first.dir[1] * 1.4];
  let t = 0;
  return {
    id: 'tunnel',
    name: 'The passage under the Willow',
    group,
    // (just in under the Willow’s roots, looking down the passage)
    spawn: { at: [start[0], first.y, start[1]], yaw: walkYaw(first.dir) },
    colliders,
    floors: [],
    bounds: { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, z0: Math.min(...zs) - pad, z1: Math.max(...zs) + pad },
    floorAt: (x, z) => onTunnel(x, z)?.y ?? 0,
    doors: [
      { id: 'willow', at: [first.at[0] + first.dir[0] * 0.5, first.at[1] + first.dir[1] * 0.5], r: 0.9, name: 'The Willow’s roots', verb: 'Climb out', to: 'out' },
      { id: 'shack', at: [last.at[0] - last.dir[0] * 0.7, last.at[1] - last.dir[1] * 0.7], r: 0.8, name: 'The trapdoor', verb: 'Climb up', to: 'shack', toAt: SHACK_ROOM.up.at, toYaw: SHACK_ROOM.up.yaw },
    ],
    out: { to: 'out' },
    spots: [],
    places: [{ id: 'passage', name: 'The passage', at: list[Math.floor(list.length / 2)].at, r: 30 }],
    poses: {
      willow: { at: [start[0], first.y + 1.55, start[1]], look: [list[16].at[0], list[16].y + 1.1, list[16].at[1]] },
      bend: { at: [list[50].at[0], list[50].y + 1.5, list[50].at[1]], look: [list[66].at[0], list[66].y + 1.0, list[66].at[1]] },
      ladder: { at: [foot.at[0] - last.dir[0] * 2.5, last.y + 1.5, foot.at[1] - last.dir[1] * 2.5], look: [hatch.position.x, hatch.position.y - 0.5, hatch.position.z] },
      back: { at: [list[90].at[0], list[90].y + 1.5, list[90].at[1]], look: [list[70].at[0], list[70].y + 1.2, list[70].at[1]] },
    },
    use() {},
    step(dt) {
      t += dt;
      // (the fungus breathes, slowly, out of step with itself)
      lights.forEach((l, i) => (l.intensity = GLOW * (0.85 + 0.15 * Math.sin(t * 0.7 + i * 2.1))));
    },
    set() {},
    info: () => ({ ...countOf(group), length: Math.round(last.s) }),
    dispose() {
      sky.geometry.dispose();
      skyMat.dispose();
      hatch.geometry.dispose();
      hatchMat.dispose();
      kit.dispose();
      group.removeFromParent();
    },
  };
}

export default { id: 'tunnel', name: 'The passage under the Willow', build };
