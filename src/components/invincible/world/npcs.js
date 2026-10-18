// Who's about the city, and what they say when Mark comes by: Debbie on
// the porch at home, Cecil outside the GDA's door with his arms folded,
// Atom Eve flying her patrol round downtown (she stops to talk if he
// catches her up), and the townspeople at Burger Mart, outside the school
// and on the Guardians' plaza, who turn to look at him. The people are
// ./people.js's, and what they say ./lines.js's; this places them, turns
// them and says who's near.

import * as THREE from 'three';
import { personFor } from './people';
import { CAST } from '../cast';
import { LINES } from './lines';
import { crowdCount, newBrain, poseOf, stepBrain } from './brains';
import { newEve, stepEve } from './companions';
import { near } from './map';
import { seeded } from '../../../lib/seeded';

const CIVS = ['civA', 'civB', 'civC'];

const NAMES = { debbie: 'Mom', cecil: 'Cecil', eve: 'Atom Eve', omni: 'Dad', manager: 'Burger Mart manager', student: 'A classmate', fan: 'Someone from the city' };

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));


// a person stood somewhere: a holder at their hips, so they can lean and fly
// (`cast`: the HD figures' templates by kind, ./people.js's loadCast). The
// townspeople (a `spot` and a place in it) get a brain (./brains.js): they
// stand about, chat, wander a few steps, look, wave, gather, run and cheer.
function stand(scene, cast, kind, seed, { x, z, y = 0, face = 0, mode = 'idle', role = kind, r = 9, spot = null, n = 0 }) {
  // a townsperson is one of the cast's three, by seed
  const who = kind === 'person' ? CIVS[seed % CIVS.length] : kind;
  const person = personFor(kind, seed, cast[who], CAST[who]);
  const holder = new THREE.Group();
  const hipY = person.hipY;
  holder.add(person.root);
  holder.position.set(x, y + hipY, z);
  holder.rotation.y = face;
  scene.add(holder);
  const brain = spot ? newBrain({ home: [x, z], yaw: face, group: spot }) : null;
  return { kind, role, person, holder, hipY, home: [x, y, z], face, look: face, mode, base: mode, r, phase: seed * 1.7, name: NAMES[role] ?? NAMES[kind], lines: LINES[role] ?? LINES[kind] ?? LINES.fan, brain, spot, n, out: true };
}

export function createNpcs(scene, world, cast = {}) {
  const P = Object.fromEntries(world.places.map((p) => [p.id, p]));
  const L = Object.fromEntries(world.landmarks.map((l) => [l.id, l]));
  const all = [];

  // Mom, on the porch
  {
    const h = world.houses.find((q) => q.home);
    const s = h.yaw === 0 ? 1 : -1;
    const fz = h.z + s * (h.d / 2);
    all.push(stand(scene, cast, 'debbie', 1, { x: h.x - 1.3, z: fz + s * 1.4, y: 0.3, face: s > 0 ? 0 : Math.PI, mode: 'idle', r: 10 }));
  }
  // Cecil, at the GDA's door
  {
    const g = P.gda;
    all.push(stand(scene, cast, 'cecil', 2, { x: g.door[0] + 2.5, z: g.door[1] - 1, face: 0, mode: 'arms', r: 12 }));
  }
  // Burger Mart: the manager at the door, two in line
  {
    const b = P.burgermart;
    all.push(stand(scene, cast, 'person', 3, { x: b.door[0] - 1.5, z: b.door[1] + 1.5, face: Math.PI / 2, mode: 'arms', role: 'manager', spot: 'burger', n: 0 }));
    all.push(stand(scene, cast, 'person', 4, { x: b.door[0] + 1.5, z: b.door[1] - 2, face: -Math.PI / 2, mode: 'talk', role: 'fan', spot: 'burger', n: 1 }));
    all.push(stand(scene, cast, 'person', 5, { x: b.door[0] + 2.2, z: b.door[1] - 0.6, face: -Math.PI / 2 - 0.5, mode: 'idle', role: 'fan', spot: 'burger', n: 2 }));
  }
  // the school steps
  {
    const s = P.school;
    for (let i = 0; i < 4; i++) all.push(stand(scene, cast, 'person', 10 + i, { x: s.door[0] - 6 + i * 3.6, z: s.door[1] + 3 + (i % 2) * 1.5, face: Math.PI + (i - 1.5) * 0.4, mode: i % 2 ? 'talk' : 'idle', role: 'student', spot: 'school', n: i }));
  }
  // the plaza: people round the hall
  {
    const g = L.guardians;
    for (let i = 0; i < 6; i++) {
      const a = 0.5 + i * 0.42;
      all.push(stand(scene, cast, 'person', 20 + i, { x: g.x + Math.cos(a) * 23, z: g.z + Math.sin(a) * 23, face: a + Math.PI, mode: i % 3 === 0 ? 'talk' : 'idle', role: 'fan', r: 8, spot: 'plaza', n: i }));
    }
  }
  // Atom Eve, on patrol (her rules: ./companions.js)
  const eve = stand(scene, cast, 'eve', 7, { x: 0, z: 0, y: 160, mode: 'fly', r: 40 });
  eve.flying = true;
  // (her loop goes over the towers on it: the highest roof within 30 m)
  const roofs = [];
  const roof = (x, z) => near(world, x, z, 30, roofs).reduce((y, b) => (x > b.x0 - 30 && x < b.x1 + 30 && z > b.z0 - 30 && z < b.z1 + 30 ? Math.max(y, b.y1) : y), 0);
  eve.rules = newEve({ cx: 120, cz: -140, rad: 460, speed: 32, y: 165, roof });
  eve.p = new THREE.Vector3(...eve.rules.p);
  eve.v = new THREE.Vector3();
  eve.lean = new THREE.Quaternion();
  all.push(eve);

  const tmpQ = new THREE.Quaternion();
  const yawQ = new THREE.Quaternion();
  const dir = new THREE.Vector3();

  // how many of each spot's people are out at this time of day (the rest go home)
  const SPOTS = { burger: 3, school: 4, plaza: 6 };
  function setTime(name) {
    for (const n of all) if (n.spot) n.out = n.n < crowdCount(SPOTS[n.spot], name, { school: n.spot === 'school' });
  }
  const r = seeded(17);

  // `crowd`: what the townspeople sense besides him (./brains.js's sense):
  // { slam: [x, z] | null, hit: [x, z] | null, fight, won, time }
  function update(frameDt, t, hero, crowd = {}) {
    // (a tab hidden a minute and back is one short step, as the rules' are)
    const dt = Math.min(frameDt, 0.05);
    const ev = [];
    const hp = hero.p;
    const sense = { hero: hp, heroMode: hero.mode, heroSpeed: Math.hypot(...hero.v), slam: crowd.slam ?? null, hit: crowd.hit ?? null, carried: crowd.carried ?? null, line: crowd.line ?? null, fight: Boolean(crowd.fight), won: Boolean(crowd.won), time: crowd.time ?? 'noon' };
    for (const n of all) {
      if (n.flying) continue;
      if (n.brain) {
        n.holder.visible = n.out && Math.hypot(hp[0] - n.brain.at[0], hp[2] - n.brain.at[1], hp[1] - n.home[1]) < 260;
        if (!n.holder.visible) continue;
        n.brain = stepBrain(n.brain, sense, dt, r);
        n.holder.position.x = n.brain.at[0];
        n.holder.position.z = n.brain.at[1];
        n.holder.rotation.y = n.brain.yaw;
        // (the manager keeps his arms folded while there's nothing to do)
        const pose = poseOf(n.brain);
        n.person.pose({ mode: pose === 'idle' && n.base === 'arms' ? 'arms' : pose, t, phase: n.phase }, dt);
        continue;
      }
      const dx = hp[0] - n.home[0];
      const dz = hp[2] - n.home[2];
      const d = Math.hypot(dx, dz, hp[1] - n.home[1]);
      const near = d < 30;
      // they turn to look at him when he's about
      const to = near ? Math.atan2(dx, dz) : n.face;
      n.look += angle(to - n.look) * (1 - Math.exp(-3 * dt));
      n.holder.rotation.y = n.look;
      const mode = d < n.r ? (n.kind === 'debbie' && hero.mode === 'air' ? 'wave' : n.base === 'arms' ? 'arms' : 'talk') : n.role === 'fan' && near && hero.mode === 'air' ? 'wave' : n.base;
      // (only drawn and posed near enough to see)
      n.holder.visible = d < 260;
      if (n.holder.visible) n.person.pose({ mode, t, phase: n.phase }, dt);
    }

    // Eve (./companions.js): her loop, over to him when he hangs about,
    // at his side when he flies off, into a fight; what she says and who
    // she knocks out go back to the world (`ev`)
    const e = eve;
    const out = stepEve(e.rules, { hero: hp, heroV: hero.v, heroMode: hero.mode, lesson: crowd.lesson ?? null, mission: crowd.mission ?? null, foes: (crowd.foes ?? []).map((f) => f.p), talk: Boolean(crowd.talk), time: crowd.time ?? 'noon' }, frameDt);
    e.rules = out.eve;
    for (const x of out.ev) ev.push(x.type === 'eveHit' ? { ...x, foe: crowd.foes[x.foe]?.id } : x);
    e.p.fromArray(e.rules.p);
    e.v.fromArray(e.rules.v);
    const sp = e.v.length();
    // face where she's going, or him when she's stopped
    const yaw = sp > 3 ? Math.atan2(e.v.x, e.v.z) : Math.atan2(hp[0] - e.p.x, hp[2] - e.p.z);
    e.look += angle(yaw - e.look) * (1 - Math.exp(-4 * dt));
    e.holder.position.copy(e.p);
    e.holder.rotation.set(0, e.look, 0);
    // along her flight when she's going, upright when she's not (her crown
    // turned along it; or, when her fly clip lies along it itself, her front)
    const k = Math.min(1, Math.max(0, (sp - 6) / 20));
    const axis = k > 0.4 && e.person.clips.includes('fly') ? Z : Y;
    dir.copy(sp > 0.1 ? e.v : axis).normalize();
    yawQ.setFromAxisAngle(Y, -e.look);
    dir.applyQuaternion(yawQ);
    dir.lerpVectors(axis, dir, k).normalize();
    tmpQ.setFromUnitVectors(axis, dir);
    e.lean.slerp(tmpQ, 1 - Math.exp(-5 * dt));
    e.holder.quaternion.multiply(e.lean);
    e.person.pose({ mode: k > 0.4 ? 'fly' : 'hover', t, phase: e.phase }, dt);
    return ev;
  }

  // who's near enough to talk: [{ id, name, lines, head: [x, y, z], d }]
  function talkers(hero) {
    const out = [];
    for (const n of all) {
      const p = n.flying ? n.p : n.holder.position;
      const d = Math.hypot(hero.p[0] - p.x, hero.p[1] + 1 - p.y, hero.p[2] - p.z);
      if (d < n.r) out.push({ id: `${n.role}-${n.phase}`, role: n.role, name: n.name, lines: n.lines, head: [p.x, p.y + n.person.height * 0.55, p.z], d });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  return { all, eve, update, talkers, setTime };
}
