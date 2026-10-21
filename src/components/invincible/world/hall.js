// The inside of the Guardians of the Globe's hall, drawn (./hallRules.js
// has the room's numbers; ./inside.js runs it): a round stone floor under
// the dome seen from within, a wall of columns and glass, the eight on
// their plinths with their names over them (the kit's stand-ins, ./people.js,
// until each has a model), Cecil's board at the back with the season on it,
// and the doorway on the south with the plaza's light in it. Code-built as
// ./landmarks.js builds the outside; drawn only while the zone is `hall`
// (./scene.js), at the plaza's own place, the city hidden round it.

import * as THREE from 'three';
import { PartBuilder } from '../../avengers/hq/kit/shapes';
import { hot } from '../../avengers/hq/stage';
import { HALL, PLINTHS, plinthFace } from './hallRules';
import { GUARDIANS } from './guardians';
import { personFor } from './people';
import { sign } from './landmarks';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, s = 24) => new THREE.CylinderGeometry(r0, r1, h, s);
const WALL = 9; // the wall's height; the dome from there to HALL.high

export function buildHall() {
  const group = new THREE.Group();
  group.name = 'hall';
  group.visible = false;
  const b = new PartBuilder();
  const mats = {
    // (a room, not a street: darker stone than the outside's, and little of the sky in it)
    floor: new THREE.MeshStandardMaterial({ color: 0x6e675c, roughness: 0.6, envMapIntensity: 0.25 }),
    ring: new THREE.MeshStandardMaterial({ color: 0x1d2b4a, roughness: 0.6 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x9a9385, roughness: 0.75, envMapIntensity: 0.25 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x4e4942, roughness: 0.85, envMapIntensity: 0.25 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe6b84a, roughness: 0.28, metalness: 1, envMapIntensity: 0.5 }),
    // (seen from within: their backs face the room)
    wall: new THREE.MeshStandardMaterial({ color: 0x5f5a52, roughness: 0.8, side: THREE.BackSide, envMapIntensity: 0.2 }),
    dome: new THREE.MeshStandardMaterial({ color: 0x1c2a3c, roughness: 0.6, metalness: 0.1, side: THREE.BackSide, envMapIntensity: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x3a5670, roughness: 0.15, metalness: 0.5, side: THREE.BackSide, transparent: true, opacity: 0.6, envMapIntensity: 0.3 }),
    lamp: new THREE.MeshBasicMaterial({ color: hot(0xfff1c8, 1.8), toneMapped: false }),
    sky: new THREE.MeshBasicMaterial({ color: hot(0xdff1ff, 1.6), toneMapped: false, side: THREE.BackSide }),
  };
  const R = HALL.r;
  // the floor, a ring of blue round the middle, and a gold disc at its heart
  b.add('floor', cyl(R, R, 0.4, 64), { p: [0, -0.2, 0] });
  b.add('ring', new THREE.RingGeometry(6, 7.5, 64).rotateX(-Math.PI / 2), { p: [0, 0.02, 0] });
  b.add('gold', cyl(1.2, 1.2, 0.06, 32), { p: [0, 0.03, 0] });
  // the wall: a drum, columns before it, glass between, a cornice; the dome over
  b.add('wall', cyl(R, R, WALL, 64, 1, true), { p: [0, WALL / 2, 0] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    b.add('stone', cyl(0.7, 0.8, WALL, 14), { p: [Math.sin(a) * (R - 1.2), WALL / 2, Math.cos(a) * (R - 1.2)] });
    // the lamps between the columns
    const l = a + Math.PI / 16;
    b.add('lamp', new THREE.SphereGeometry(0.3, 10, 8), { p: [Math.sin(l) * (R - 1), WALL - 2.2, Math.cos(l) * (R - 1)] });
  }
  b.add('glass', cyl(R - 0.6, R - 0.6, WALL - 3, 64, 1, true), { p: [0, WALL / 2 + 1, 0] });
  b.add('stone', new THREE.TorusGeometry(R - 0.8, 0.5, 8, 64).rotateX(Math.PI / 2), { p: [0, WALL, 0] });
  const dome = new THREE.SphereGeometry(R, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, (HALL.high - WALL) / R, 1);
  b.add('dome', dome, { p: [0, WALL, 0] });
  b.add('sky', cyl(4, 4, 0.2, 32), { p: [0, HALL.high - 0.3, 0] }); // the oculus
  // the plinths, each with a gold band and a step before it
  PLINTHS.forEach((p, i) => {
    const f = plinthFace(i);
    b.add('stoneDark', cyl(1.6, 1.8, HALL.plinthH, 24), { p: [p[0], HALL.plinthH / 2, p[2]] });
    b.add('gold', new THREE.TorusGeometry(1.65, 0.06, 6, 32).rotateX(Math.PI / 2), { p: [p[0], HALL.plinthH - 0.1, p[2]] });
    b.add('stone', box(2.4, 0.2, 1), { p: [p[0] + Math.sin(f) * 2.2, 0.1, p[2] + Math.cos(f) * 2.2], r: [0, f, 0] });
  });
  // Cecil's board at the back: a panel on a stand, the season on it
  const [bx, bz] = HALL.board;
  b.add('stoneDark', box(7, 0.3, 2.4), { p: [bx, 0.15, bz] });
  b.add('ring', box(6, 3.4, 0.4), { p: [bx, 2.2, bz - 0.6] });
  b.add('gold', box(6.2, 0.12, 0.5), { p: [bx, 4, bz - 0.6] });
  // the doorway: a frame in the wall on the south, the plaza's light in it, a mat before it
  const [dx, dz] = HALL.door;
  b.add('stone', box(5.6, 0.3, 1.2), { p: [dx, 5.1, R - 0.9] });
  for (const sd of [-1, 1]) b.add('stone', box(0.6, 5, 1.2), { p: [dx + sd * 2.6, 2.5, R - 0.9] });
  b.add('gold', new THREE.RingGeometry(2.4, 2.8, 48).rotateX(-Math.PI / 2), { p: [dx, 0.02, dz] });
  group.add(b.build(mats));
  const light = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.8), new THREE.MeshBasicMaterial({ color: hot(0xdff1ff, 2.2), toneMapped: false, side: THREE.DoubleSide }));
  light.position.set(dx, 2.4, R - 1.1);
  group.add(light);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3), new THREE.MeshStandardMaterial({ map: sign('THE SEASON · CECIL STEDMAN, GDA', { bg: '#0e1a33', fg: '#ffd23a', size: 0.5 }), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.25 }));
  board.material.emissiveMap = board.material.map;
  board.position.set(bx, 2.2, bz - 0.38);
  group.add(board);

  // the eight, on their plinths, facing the room, their names over them
  const figs = GUARDIANS.map((g, i) => {
    const person = personFor(g.id, 31 + i);
    const holder = new THREE.Group();
    holder.add(person.root);
    const p = PLINTHS[i];
    holder.position.set(p[0], HALL.plinthH + person.hipY, p[2]);
    holder.rotation.y = plinthFace(i);
    group.add(holder);
    const name = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.5), new THREE.MeshBasicMaterial({ map: sign(g.name.toUpperCase(), { bg: '#1d2b4a', fg: '#f5c518', size: 0.8 }), toneMapped: false, side: THREE.DoubleSide }));
    name.position.set(p[0], HALL.plinthH + person.height + 0.5, p[2]);
    name.rotation.y = plinthFace(i);
    group.add(name);
    return { g, person, holder, name, phase: i * 1.3, look: plinthFace(i) };
  });
  const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  return {
    group,
    // each turns to Mark when he is near, and speaks with their hands beside him
    update(t, hero, dt) {
      const hp = hero.p;
      for (const f of figs) {
        const dx = hp[0] - f.holder.position.x;
        const dz = hp[2] - f.holder.position.z;
        const d = Math.hypot(dx, dz);
        const to = d < 12 ? Math.atan2(dx, dz) : plinthFace(figs.indexOf(f));
        f.look += angle(to - f.look) * (1 - Math.exp(-3 * dt));
        f.holder.rotation.y = f.look;
        f.person.pose({ mode: d < HALL.talkR + 1 ? 'talk' : f.g.mode === 'fly' ? 'idle' : 'arms', t, phase: f.phase }, dt);
      }
    },
    setNight(k) {
      mats.lamp.color.copy(hot(0xfff1c8, 1.2 + 1.6 * k));
      mats.sky.color.copy(hot(k > 0.5 ? 0x1a2a4a : 0xdff1ff, 1.6));
    },
    dispose() {
      for (const f of figs) f.person.dispose();
      for (const m of Object.values(mats)) m.dispose();
      light.material.dispose();
      board.material.map?.dispose();
      board.material.dispose();
      for (const f of figs) {
        f.name.material.map?.dispose();
        f.name.material.dispose();
      }
    },
  };
}
