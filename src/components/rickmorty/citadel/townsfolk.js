// Mortytown's people, every one a Meshy figure (../portal/meshyCast.js) in
// the show's toon look, each on its animator: the cast where ./mortytown.js
// stands them (Big Morty sat on a stool by The Creepy Morty's door, Slick
// Morty on his corner, the campaign manager, Rick D. Sanchez III and Simple
// Rick at the factory's back door, Cop Morty and his partner outside Morty
// Mart), Evil Rick walking the middle of the road, the street's Mortys round
// their loops, and the three Locos where ./locos.js has them. They're
// loaded the first time the lift comes down, not with the Citadel; a figure
// whose model doesn't load is left out, nothing stands in for it.
//
// The cast look at Rick with their heads as he comes by, turning to him
// only when he's well round (./bodies.js's regard), and talk with their
// hands while their line's up; Evil Rick stares through him as he passes;
// the street's Mortys step aside for him, their corners eased, their feet
// paced to the street; a Loco crouches in his alley (base 'crouch'), gives
// himself up with a fright, and, lost, slinks home on foot down the alley
// he came from rather than appearing there (the hunt's rules put him home
// at once; only the drawing walks); Cop Morty cuffs each one handed over.
//
// createTownsfolk({ parent, tier }) → Promise<{ update(state, t, cam, opts),
//   headOf(id), at(id), movers, dispose }>

import * as THREE from 'three';
import { createMeshyCast } from '../portal/meshyCast';
import { pushOut } from '../../middleearth/towns/walker';
import { turn } from '../../../lib/three/gait';
import { CAST, COLLIDERS, LOOPS, WALKS, WALLS } from './mortytown';
import { along, lookAt, yawOf } from './people';
import { CAST_INK } from './look';
import { catchUp, easeTurn, moveFor, regard, sayFor, stepBody } from './bodies';

// kind → the model and how tall it stands, hat and all, in metres
const SHIRTS = [0xf3d84b, 0x7fc77a, 0xe0795a, 0xa98ad8, 0x63b5d9, 0xf0a0c0];
export const KINDS = {
  bigmorty: { a: 'bigmorty', h: 1.56 },
  slickmorty: { a: 'slickmorty', h: 1.52 },
  campaignmorty: { a: 'campaignmorty', h: 1.5 },
  rickd3: { a: 'rickd3', h: 2.15 },
  simplerick: { a: 'simplerick', h: 1.85 },
  evilrick: { a: 'evilrick', h: 1.85 },
  copmorty: { a: 'copmorty', h: 1.5 },
  cop: { a: 'cop', h: 1.85 },
  'loco-a': { a: 'loco-a', h: 1.5 },
  'loco-b': { a: 'loco-b', h: 1.5 },
  'loco-c': { a: 'loco-c', h: 1.5 },
  morty: { a: 'morty', h: 1.5, shirts: SHIRTS },
};
const RIGGED = new Set(Object.values(KINDS).map((k) => k.a));
// the street's Mortys, by the device
const STREET = { high: 8, mid: 4, low: 2 };
const PACE = 1.25;
const EYES = 1.72; // Rick's eyes (m)
const NOTICE = 5.5; // the cast look round at Rick this near
const WAY = { ahead: 3.2, wide: 0.9, off: 1.15, rate: 2.2 }; // a street Morty stepping out of Rick's way
const SLINK = 1.5; // a lost Loco's pace home (m/s)
const KEEP = 4.6; // and a found one's, catching up with his rules' place
const push = (x, z) => pushOut(x, z, 0.3, COLLIDERS, WALLS);

export async function createTownsfolk({ parent, tier = 'high', loader = null }) {
  const meshy = createMeshyCast({ kinds: KINDS, rigged: RIGGED, cull: true, ink: tier === 'low' ? 0 : CAST_INK, ...(loader ? { loader } : {}) });
  const assets = [...RIGGED];
  await Promise.all([meshy.load(null, assets.filter((a) => a !== 'bigmorty'), { clips: ['idle', 'walk', 'run'] }), meshy.load(null, ['bigmorty'], { clips: ['idle', 'walk', 'run', 'sit'] })]);

  const all = [];
  const make = (kind, variant = 0) => {
    const f = meshy.make(kind, variant);
    if (!f) return null;
    f.group.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    parent.add(f.group);
    f.rg = {};
    all.push(f);
    return f;
  };
  const seat = (f) => {
    if (!f?.base) return;
    f.base('sit', { fade: 0 });
    f.sitting = true;
  };

  // the cast, where they stand (Big Morty sat on his stool)
  const cast = new Map();
  for (const c of CAST) {
    const f = make(c.kind);
    if (!f) continue;
    f.home = c;
    f.yaw = yawOf(c.face);
    f.group.position.set(c.x, c.id === 'bigmorty' ? 0.02 : 0, c.z);
    f.group.rotation.y = f.yaw;
    if (c.id === 'bigmorty') seat(f);
    cast.set(c.id, f);
  }
  // who walks: Evil Rick, and the street's Mortys
  const loops = LOOPS.map((loop) => {
    const lengths = loop.map((a, i) => Math.hypot(loop[(i + 1) % loop.length][0] - a[0], loop[(i + 1) % loop.length][1] - a[1]));
    return { loop, lengths, total: lengths.reduce((s, l) => s + l, 0) };
  });
  const walkers = [];
  for (const w of WALKS) {
    const f = make(w.kind);
    if (!f) continue;
    Object.assign(f, { id: w.id, home: w, loop: loops[w.loop], s0: 0, dir: 1, pace: PACE * 0.85, aside: 0 });
    walkers.push(f);
  }
  const n = STREET[tier] ?? STREET.high;
  for (let i = 0; i < n; i++) {
    const f = make('morty', i);
    if (!f) continue;
    const L = loops[1 + (i % (loops.length - 1))];
    Object.assign(f, { loop: L, s0: (L.total * (i * 0.29 + 0.07)) % L.total, dir: i % 2 ? -1 : 1, pace: PACE * (0.92 + ((i * 7) % 5) * 0.05), aside: 0 });
    walkers.push(f);
  }
  // the Locos, wherever the hunt has them
  const locos = new Map(['loco-a', 'loco-b', 'loco-c'].map((id) => [id, make(id)]).filter(([, f]) => f));

  const tmp = new THREE.Vector3();
  const rickHead = new THREE.Vector3();
  let lastT = null;
  let camera = null;
  let budget = null;
  let view = null;
  const animate = (f, t, { move = null, motion = null } = {}) => {
    let lodRate = 1;
    if (budget) {
      f.group.getWorldPosition(tmp);
      lodRate = budget.rate(tmp, camera, view ? view(tmp) : true);
    }
    f.update(t, move ?? (motion ? moveFor(Math.hypot(motion.speed, motion.side)) : 0), 0, { motion, lodRate });
  };
  const stepTo = (f, x, z, yaw, dt, ease = 10) => {
    const step = { x, z, yaw };
    const jumped = !f.prev || Math.hypot(x - f.prev.x, z - f.prev.z) > 2.5;
    const body = stepBody(f.prev, step, dt);
    f.prev = step;
    f.group.position.set(x, 0, z);
    f.yaw = f.yaw == null || jumped ? yaw : turn(f.yaw, yaw, dt, ease);
    f.group.rotation.y = f.yaw;
    return body;
  };
  let sayingAt = null;

  // state: the world's (./scene.js), with Rick's spot in the district's frame
  // and the hunt's Locos; t: seconds; cam: the camera, in the world;
  // opts: { camera, budget, view } (./people.js's)
  const update = (state, t, cam, opts = {}) => {
    const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    camera = opts.camera ?? (cam ? { position: cam } : null);
    budget = opts.budget ?? null;
    view = opts.view ?? null;
    const h = state.rick;
    // (his head, in the world: the district's frame moved to where it's drawn)
    parent.updateWorldMatrix(true, false);
    rickHead.set(h.x, EYES, h.z).applyMatrix4(parent.matrixWorld);
    const saying = state.saying ?? null;
    const sayNew = saying && saying !== sayingAt;
    sayingAt = saying;
    for (const f of cast.values()) {
      const d = Math.hypot(h.x - f.home.x, h.z - f.home.z);
      if (d < NOTICE) {
        if (!f.sitting) f.yaw = regard(f.yaw, Math.atan2(h.x - f.home.x, h.z - f.home.z), dt, f.rg);
        lookAt(f, rickHead);
      } else {
        f.rg.turning = false;
        f.yaw = easeTurn(f.yaw, yawOf(f.home.face), dt, 2);
        lookAt(f, null);
      }
      f.group.rotation.y = f.yaw;
      if (sayNew && saying.id === `town:${f.home.id}`) f.react('say', { t, target: rickHead, hold: sayFor(saying.line) });
      animate(f, t);
    }
    for (const f of walkers) {
      const [x0, z0, heading] = along(f.loop.loop, f.loop.lengths, f.loop.total, f.s0 + f.dir * f.pace * t);
      const face = f.dir > 0 ? heading : heading + Math.PI;
      // out of Rick's way: a step to the side while he's ahead and coming on
      const fx = Math.cos(face);
      const fz = -Math.sin(face);
      const along2 = (h.x - x0) * fx + (h.z - z0) * fz;
      const lat = (h.x - x0) * -fz + (h.z - z0) * fx; // (+: Rick off to its right)
      const want = along2 > -0.5 && along2 < WAY.ahead && Math.abs(lat) < WAY.wide && f.home?.id !== 'evilrick' ? -Math.sign(lat || 1) * WAY.off : 0;
      f.aside += Math.max(-WAY.rate * dt, Math.min(WAY.rate * dt, want - f.aside));
      let [x, z] = [x0 - fz * f.aside, z0 + fx * f.aside];
      if (f.aside) [x, z] = push(x, z);
      const body = stepTo(f, x, z, yawOf(face), dt, 6);
      // Evil Rick stares through you as he passes
      lookAt(f, f.home?.id === 'evilrick' && Math.hypot(h.x - x, h.z - z) < 6 ? rickHead : null);
      animate(f, t, { motion: body.motion });
    }
    // (only the hunt's Locos are out: none before it's open, none once they're handed over)
    const out = new Set((state.locos ?? []).map((l) => l.id));
    for (const [id, f] of locos) {
      f.group.visible = out.has(id);
      if (!f.group.visible) f.vis = null;
    }
    for (const l of state.locos ?? []) {
      const f = locos.get(l.id);
      if (!f) continue;
      // drawn: on foot to wherever his rules have him (home at once, when he's lost: walked there)
      const v = (f.vis ??= { x: l.x, z: l.z, face: l.face, speed: 0 });
      const hiding = l.state === 'hiding';
      catchUp(v, l, dt, { speed: hiding ? SLINK : KEEP, snap: 90, push });
      const home = hiding && v.speed === 0;
      // hiding: crouched in his alley, facing its mouth; found: up, with a fright
      const crouch = home ? 'crouch' : null;
      if (crouch !== (f.atBase ?? null)) {
        if (f.atBase === 'crouch' && l.state === 'following') f.react('gunfire', { t, moving: true, target: rickHead });
        f.atBase = crouch;
        f.base(crouch);
      }
      const yaw = yawOf(v.speed > 0.05 ? v.face : l.face);
      const body = stepTo(f, v.x, v.z, yaw, dt, 8);
      lookAt(f, l.state === 'following' ? rickHead : null);
      // handed over: Cop Morty cuffs him
      if (l.state === 'delivered' && f.state !== 'delivered') cast.get('copmorty')?.play('interact');
      f.state = l.state;
      animate(f, t, { motion: body.motion });
    }
  };

  // where someone's head is, in the world (for the speech bubble)
  const head = new THREE.Vector3();
  const headOf = (id) => {
    const f = cast.get(id) ?? walkers.find((w) => w.id === id) ?? locos.get(id);
    if (!f || !f.group.visible) return null;
    f.group.getWorldPosition(head);
    head.y += (f.sitting ? f.height * 0.72 : f.height) + 0.3;
    return head;
  };
  // where a walker is now, in the district's frame (Evil Rick, to talk to)
  const at = (id) => {
    const f = walkers.find((w) => w.id === id);
    return f ? { x: f.group.position.x, z: f.group.position.z } : null;
  };

  const dispose = () => {
    for (const f of all) {
      f.anim?.dispose();
      f.mixer?.stopAllAction();
      f.group.removeFromParent();
    }
    all.length = 0;
    meshy.dispose();
  };

  return { update, headOf, at, movers: all, dispose };
}
