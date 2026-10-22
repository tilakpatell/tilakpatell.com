// Inside Hagrid’s hut (the design’s §4.3): one room, an octagon nine metres
// across under the cone of its roof, everything in it a size too big for
// anyone else. The fire in its great stone hearth with the kettle hung over
// it (and, in Christmas week, an egg in the coals that is not a hen’s), the
// bed against the wall under a patchwork quilt, the table scrubbed white with
// its two mugs like buckets and a plate of rock cakes, the one chair, the
// hams and the pheasants hanging from the rafters, the crossbow’s twin on
// the wall, the window to the pumpkin patch. Built on Lane D’s room kit
// (rooms/kit.js, rooms/parts/), a room for rooms/index.js (registered by ./hut.js).
//
//   build(rt, ctx) → { id, name, group, spawn, colliders, floors, doors, places, bounds, floorAt, poses, step(dt), set({ week, hour }), info(), dispose() }
//     ctx: { house, tier, props: { week, hour } }
//   HUT_ROOM: its numbers (pure), for the test

import * as THREE from 'three';
import { createRoomKit, countOf, instanced } from '../../rooms/kit';
import { bed, chair, fireplace, frame, table } from '../../rooms/parts/furniture';
import { createFire } from '../../rooms/parts/fire';

export const HUT_ROOM = { r: 4.4, wall: 3.3, peak: 8.2, door: { at: [0, 4.15], w: 1.6, h: 2.6 }, christmas: 8 };
const SIDES = 8;
const TAU = Math.PI * 2;

function shell(kit) {
  const { r, wall, peak } = HUT_ROOM;
  // the floor in wide boards, a rag rug by the fire
  kit.box('board', 0, -0.25, 0, 2 * r + 0.6, 0.25, 2 * r + 0.6);
  kit.box(kit.paint('#6e3b2a', { rough: 1 }), -0.6, 0.002, -1.6, 2.4, 0.02, 1.6);
  // eight walls of rough stone, the door’s gap in the south one (+z), a window in two
  const apothem = r * Math.cos(Math.PI / SIDES);
  const side = 2 * r * Math.sin(Math.PI / SIDES);
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * TAU;
    const x = Math.sin(a) * (apothem + 0.25);
    const z = Math.cos(a) * (apothem + 0.25);
    if (i === 0) {
      // (the door’s face: stone either side of the doorway and over it)
      const jamb = (side - HUT_ROOM.door.w) / 2;
      for (const s of [-1, 1]) kit.box('rock', s * (HUT_ROOM.door.w / 2 + jamb / 2), 0, z, jamb, wall, 0.5);
      kit.box('rock', 0, HUT_ROOM.door.h, z, HUT_ROOM.door.w + 0.02, wall - HUT_ROOM.door.h, 0.5);
      // the door itself, shut behind you: heavy planks and iron straps
      kit.box('darkoak', 0, 0, z - 0.2, HUT_ROOM.door.w, HUT_ROOM.door.h, 0.1);
      for (const y of [0.4, 1.3, 2.2]) kit.box('iron', 0, y, z - 0.26, HUT_ROOM.door.w - 0.1, 0.08, 0.02);
    } else kit.box('rock', x, 0, z, side + 0.35, wall, 0.5, { ry: a });
  }
  // the roof inside: rafters up to the point, and the boards between them, dark with smoke
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * TAU + Math.PI / SIDES;
    const len = Math.hypot(r, peak - wall);
    const tilt = Math.atan2(r, peak - wall);
    kit.box('darkoak', Math.sin(a) * r * 0.5, wall + (peak - wall) * 0.5 - len / 2, Math.cos(a) * r * 0.5, 0.2, len, 0.2, { ry: a, rx: tilt });
  }
  kit.cyl(kit.paint('#2a1e16', { rough: 1, side: THREE.BackSide }), 0, wall - 0.05, 0, 0.05, r + 0.3, peak - wall + 0.1, { seg: SIDES, open: true, ry: Math.PI / SIDES });
  // a tie beam across, the hams and the birds hung from it
  kit.box('darkoak', 0, wall - 0.1, 0.4, 2 * r - 0.4, 0.22, 0.22);
}

function furnish(kit) {
  // the hearth on the north wall (−z), big enough to sit in
  const fire = fireplace(kit, { at: [0, 0, -HUT_ROOM.r * 0.9 + 0.35], ry: 0, w: 1.9, h: 1.7, mat: 'rock' });
  // the kettle on its hook over the fire: a squat iron pot, a lid, a handle
  const f = frame(kit, { at: [0, 0, -HUT_ROOM.r * 0.9 + 0.5] });
  f.box('iron', 0, 1.65, 0, 0.05, 0.5, 0.05);
  f.cyl('iron', 0, 0.95, 0, 0.26, 0.3, 0.42, { seg: 12 });
  f.cyl('iron', 0, 1.37, 0, 0.12, 0.24, 0.08, { seg: 12 });
  // the bed against the west wall, a size up, under its patchwork
  bed(kit, { at: [-3.0, 0, 0.3], ry: Math.PI / 2, hangings: '#5d4a6e', len: 3.1, w: 1.9 });
  // the table, its one great chair, two mugs like buckets, a plate of rock cakes
  table(kit, { at: [1.9, 0, 0.6], ry: 0.2, len: 2.2, w: 1.3, top: 1.0, mat: 'board' });
  chair(kit, { at: [1.2, 0, 1.9], ry: Math.PI + 0.3, back: 1.7, seat: 0.62 });
  for (const [x, z] of [
    [1.6, 0.1],
    [2.3, 0.9],
  ])
    kit.cyl(kit.paint('#7a6a58', { rough: 0.8 }), x, 1.03, z, 0.14, 0.12, 0.26, { seg: 10 });
  kit.cyl(kit.paint('#c9b89a', { rough: 0.9 }), 1.8, 1.03, 1.3, 0.24, 0.22, 0.03, { seg: 14 });
  // a dresser on the east wall, the crossbow’s twin over it, a pair of boots by it
  kit.box('darkoak', 3.6, 0, -0.9, 0.5, 1.6, 1.6, { ry: -Math.PI / 2 + 0.4 });
  kit.box('board', 3.85, 1.9, -0.9, 0.08, 0.1, 1.2, { ry: -Math.PI / 2 + 0.4 });
  kit.box('darkoak', 3.4, 0, 1.6, 0.36, 0.5, 0.2, { ry: 0.3 });
  kit.box('darkoak', 3.35, 0, 2.0, 0.36, 0.5, 0.2, { ry: 0.2 });
  // the colliders: the walls (a ring of circles), the hearth, the bed, the table, the dresser
  const apothem = HUT_ROOM.r * Math.cos(Math.PI / SIDES);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    // (the doorway’s gap open: you come in and go out through it)
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.2) continue;
    kit.solid(Math.sin(a) * (apothem + 0.1), Math.cos(a) * (apothem + 0.1), 0.35);
  }
  kit.solid(0, -HUT_ROOM.r * 0.9 + 0.3, 1.2);
  kit.wall(-3.0, -1.2, -3.0, 1.8, 0.8);
  kit.solid(1.9, 0.6, 0.85);
  kit.solid(3.5, -0.9, 0.6);
  return fire;
}

// what hangs from the beam and the rafters: hams, a string of onions, pheasants by their feet
function hanging(kit) {
  const ham = new THREE.SphereGeometry(0.22, 10, 8).scale(1, 1.5, 0.8);
  const bird = new THREE.SphereGeometry(0.12, 8, 6).scale(1, 2.2, 1);
  const hamMat = kit.paint('#7a3e26', { rough: 0.7 });
  const birdMat = kit.paint('#5a4a32', { rough: 1 });
  const hams = instanced(ham, hamMat, [-1.6, -0.5, 0.7].map((x, i) => ({ at: [x, HUT_ROOM.wall - 0.75 - 0.1 * i, 0.4], ry: i })));
  const birds = instanced(bird, birdMat, [1.6, 2.1, -2.2].map((x, i) => ({ at: [x, HUT_ROOM.wall - 0.6, 0.4 + 0.1 * i], ry: i * 2 })));
  return { group: new THREE.Group().add(hams, birds), dispose: () => (ham.dispose(), bird.dispose()) };
}

function build(rt, ctx = {}) {
  const house = ctx.house ?? null;
  const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
  const props = ctx.props ?? {};
  const group = new THREE.Group();
  group.name = 'room:hut';
  const kit = createRoomKit({ house, tier });
  shell(kit);
  const fireAt = furnish(kit);
  kit.build(group);
  const hung = hanging(kit);
  group.add(hung.group);
  const fire = createFire({ at: fireAt, w: 1.3, h: 1.1, tongues: 4, tier });
  group.add(fire.group);
  // the egg in the coals, in Christmas week (a dragon’s, though no one is to say so)
  const egg = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10).scale(1, 1.3, 1), kit.paint('#3e3a30', { rough: 0.5, metal: 0.2 }));
  egg.position.set(fireAt[0] + 0.25, fireAt[1] - 0.05, fireAt[2] + 0.1);
  group.add(egg);
  // the room’s light: the fire’s warmth, the window’s cold, the dark under the roof
  const hemi = new THREE.HemisphereLight(0xffd9a8, 0x2a2018, 0.55);
  const lamp = new THREE.PointLight(0xffb469, 6, 9, 1.6);
  lamp.position.set(0.5, 2.4, 0.4);
  group.add(hemi, lamp);
  house?.adopt?.(group);

  const set = ({ week = null } = {}) => {
    if (week != null) egg.visible = week >= HUT_ROOM.christmas && week < HUT_ROOM.christmas + 2;
  };
  set({ week: props.week ?? 1 });
  let t = 0;
  const room = {
    id: 'hut',
    name: 'Hagrid’s hut',
    group,
    spawn: { at: [0, 0, HUT_ROOM.door.at[1] - 1.2], yaw: 0 },
    colliders: kit.colliders.map((c) => ({ kind: 'circle', at: c.at, r: c.r })),
    floors: [],
    doors: [{ id: 'out', at: [0, HUT_ROOM.door.at[1]], r: 0.8, faces: 0, name: 'Out to the pumpkins', to: 'out' }],
    places: [{ id: 'hut', name: 'Hagrid’s hut', at: [0, 0], r: HUT_ROOM.r }],
    bounds: { x0: -HUT_ROOM.r, x1: HUT_ROOM.r, z0: -HUT_ROOM.r, z1: HUT_ROOM.r },
    floorAt: () => 0,
    poses: { door: { at: [0, 1.7, 3.2], look: [0, 1.1, -3] }, fire: { at: [1.6, 1.6, 1.2], look: [0, 0.9, -3.6] } },
    step(dt) {
      t += dt;
      fire.step(dt);
      lamp.intensity = 5.4 + Math.sin(t * 9.1) * 0.5 + Math.sin(t * 3.3) * 0.4;
    },
    set,
    info: () => ({ ...countOf(group) }),
    dispose() {
      fire.dispose();
      hung.dispose();
      egg.geometry.dispose();
      kit.dispose();
      group.removeFromParent();
    },
  };
  return room;
}

export default { id: 'hut', name: 'Hagrid’s hut', build };
