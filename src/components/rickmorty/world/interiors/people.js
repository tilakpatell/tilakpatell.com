// The rooms' people, for ../interiors.js: Rick and the Smiths from the
// Meshy cast (portal/meshyCast.js), loaded once for every room that asks,
// and people in shapes, the show's way, for the teacher and for anyone whose
// model won't load. Each one stands (or sits, through seat(): one way for
// every sitter in the world) on its animator, breathing in its own time, its
// head turning to Morty when he comes up and its hands going while he talks
// to it (../living.js's attend); inHand() puts something in a figure's right
// hand (Beth's wine, Rick's flask).

import * as THREE from 'three';
import { mergeParts } from '../kit';
import { attend } from '../living';
import { CYL, lathe } from './shell';
import { loadClip } from '../../../../lib/three/clipLibrary';

// The cast (Rick and the Smiths), loaded once for every room that asks;
// whoever doesn't load is drawn in shapes. They only stand (and Jerry sits),
// so no run; the walk stays, as the cast turns the idle (Meshy's stands 41°
// off to one side) and Jerry's sat clip to face the way it does.
export async function needCast(kit, names) {
  const need = kit.need ?? ((n, o) => kit.cast.load(null, n, o));
  try {
    await need(names, { clips: ['idle', 'walk'] });
  } catch {
    /* stand-ins */
  }
}

// A person standing at (x, z), facing `face` (rules.js's heading), `h` tall:
// the Meshy figure for `kind`, or a code-drawn one to `look` (if it won't
// load, or `meshy` is false). Its tick plays the idle, and turns its head to
// Morty within `near` m or while he talks to it (`id`: whom his word's to,
// rules.js's PEOPLE id), its hands going while he does.
export function person(R, kind, { x, z, face, h, look, y = 0, meshy = true, id = kind, near = 3 }) {
  const c = meshy ? R.kit.cast.make(kind) : null;
  let fig;
  if (c) {
    c.group.scale.setScalar(h / c.height);
    const b = {};
    fig = {
      group: c.group,
      cast: c,
      hand: c.hand,
      tick: (t, dt, state) => {
        c.update(t, 0, 0, { dt });
        attend(c, b, id, t, state, { y, near });
      },
    };
  } else fig = toonPerson(R, look, h);
  fig.group.position.set(x, y, z);
  fig.group.rotation.y = face + Math.PI / 2;
  R.group.add(fig.group);
  if (fig.tick) R.tick(fig.tick);
  return fig;
}

// ── sat down ──
//
// seat(R, c, { x, z, face, id }, { h, seatY, wait }) → { group, cast } | null:
// `c` (a figure from the cast) sat, `h` tall, facing `face`, its hips on the
// seat at (x, seatY, z). Its own sat clip if it was loaded with one, else the
// clip library's sitting idle, through its animator's base (meshyCast's
// c.base('sit')), so each sitter breathes in its own time and a word or a
// look plays on its upper half without standing it up. The way into the
// seat is played through out of sight, a tenth of a second at a time, and
// where its hips came to rest is measured then (a clip carries each body
// its own way: a short-legged one sits lower and further back), so it's on
// its seat from the first frame it's seen. Null if it can't sit (it isn't
// rigged), or isn't sat within `wait` ms, so a room never waits long on it.
// Its tick: its idle, and its head on Morty as person()'s is.
const SEAT_WAIT = 8000;
const SAT = ['seat', 'sit.idle']; // the base it sits in: its own sat clip (meshyCast's name for it), or the library's
export async function seat(R, c, { x, z, face, id = c?.kind }, { h, seatY, wait = SEAT_WAIT, near = 2.5 }) {
  if (!c?.anim || !c.base) return null;
  c.group.scale.setScalar(h / c.height);
  c.group.rotation.y = face + Math.PI / 2;
  c.group.position.set(x, 0, z);
  let cut = false;
  c.base('sit').then((r) => (cut = r === 'cut'));
  // (the files first: the library's sitting clips, when it has no sat clip
  // of its own; then the animator's turns of the clock till it's there: its
  // sat clip, the base, at its whole weight)
  if (!c.act?.sit) await Promise.race([Promise.all(['sit.idle', 'sit.enter'].map((n) => loadClip(n))), new Promise((done) => setTimeout(done, wait))]);
  const there = () => SAT.some((n) => (c.anim.actions[n]?.getEffectiveWeight() ?? 0) > 0.999);
  for (let i = 0; i < 120 && !cut && !there(); i++) {
    c.update(0, 0, 0, { dt: 0.1 });
    await null;
  }
  if (!there()) {
    c.base(null);
    return null;
  }
  c.group.updateMatrixWorld(true);
  const hips = c.group.getObjectByName('Hips');
  const at = hips ? hips.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(x, seatY, z);
  c.group.position.set(2 * x - at.x, seatY - at.y, 2 * z - at.z);
  R.group.add(c.group);
  const b = {};
  R.tick((t, dt, state) => {
    c.update(t, 0, 0, { dt });
    attend(c, b, id, t, state, { y: 0, near });
  });
  return { group: c.group, cast: c };
}

// ── in a hand ──
//
// inHand(c, obj, { reach = 0.09 }) → obj | null: `obj` (built in metres, its
// grip at its origin, its up +y) put in the figure's right hand, upright as
// the figure stands now, a little way down from the wrist past the palm.
// It moves with the hand from then on: a glass raised to the lips tips with
// it. Call it once the figure's posed (after an update), not in its bind pose.
export function inHand(c, obj, { reach = 0.09 } = {}) {
  const hand = c?.hand;
  const arm = hand?.parent;
  if (!hand || !arm?.isBone) return null;
  c.group.updateMatrixWorld(true);
  const wrist = hand.getWorldPosition(new THREE.Vector3());
  const along = wrist.clone().sub(arm.getWorldPosition(new THREE.Vector3())).normalize();
  const grip = wrist.addScaledVector(along, reach);
  const world = new THREE.Matrix4().compose(grip, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
  hand.matrixWorld.clone().invert().multiply(world).decompose(obj.position, obj.quaternion, obj.scale);
  hand.add(obj);
  return obj;
}

// Something kept in a figure's hand from its first frame stood (inHand
// wants it posed); `show(c)`, if given, says each frame whether it's out
export function holding(R, c, obj, { reach, show = null } = {}) {
  if (!c?.hand) return null;
  let held = false;
  obj.visible = false;
  R.tick(() => {
    if (!held) held = Boolean(inHand(c, obj, { reach }));
    obj.visible = held && (show ? show(c) : true);
  });
  return obj;
}

// Rick at his bench: at whatever's on it now and then (`interact`), and
// a pull on his flask, which is out of his coat only while he drinks
export function tinker(R, c) {
  if (!c?.anim) return;
  c.anim.idles({ fidgets: ['interact', 'interact', 'drink'], every: [5, 12] });
  holding(R, c, hipFlask(R), { reach: 0.08, show: (f) => f.anim.playing('upper') === 'drink' });
}

// Beth's glass of wine: a stemmed glass, the wine a third up its bowl,
// held by the stem (its middle at the origin)
export function wineGlass(R) {
  const g = new THREE.Group();
  const m = R.kit.mats;
  const glass = new THREE.Mesh(R.own(lathe([[0.034, -0.045], [0.034, -0.04], [0.006, -0.036], [0.005, 0.03], [0.012, 0.036], [0.036, 0.06], [0.043, 0.095], [0.04, 0.13]], 20)), m.glass);
  const wine = new THREE.Mesh(R.own(lathe([[0, 0.04], [0.026, 0.05], [0.036, 0.068], [0.039, 0.085], [0, 0.085]], 20)), m.toon(0x7a1430));
  glass.renderOrder = 2;
  g.add(wine, glass);
  return g;
}

// Rick's hip flask: a curved silver flask with its cap, held round its
// middle, out only while he drinks
function hipFlask(R) {
  const g = new THREE.Group();
  const m = R.kit.mats;
  const body = new THREE.Mesh(R.own(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 16, 1).scale(1, 1, 0.38)), m.metal);
  const neck = new THREE.Mesh(R.own(new THREE.CylinderGeometry(0.012, 0.016, 0.02, 10).translate(0, 0.07, 0)), m.metal);
  const cap = new THREE.Mesh(R.own(new THREE.CylinderGeometry(0.016, 0.016, 0.018, 10).translate(0, 0.088, 0)), m.toon(0x5a5f66));
  g.add(body, neck, cap);
  return g;
}

// ── the multiverse's people (rules.js's PEOPLE from Phase 2 on) ──
//
// Each is a Meshy figure that loads the first time its room is walked into,
// so the world's first download doesn't carry them, and is left out if it
// won't load: never a person in shapes for these (the plan's rule).

// fn, once, the first frame Morty is in this room (only the room he's in ticks)
export function onEntry(R, fn) {
  let asked = false;
  R.tick(() => {
    if (asked) return;
    asked = true;
    fn();
  });
}

// the figure for `kind` with `clips`, loaded (or not: null) within `wait` ms
async function figure(R, kind, clips, wait = 15000) {
  const kit = R.kit;
  try {
    const need = kit.need ? kit.need([kind], { clips }) : kit.cast.load(null, [kind], { clips });
    await Promise.race([need, new Promise((done) => setTimeout(done, wait))]);
  } catch {
    return null;
  }
  return kit.cast?.make?.(kind) ?? null;
}

// One of them sat in their own sat clip (Meshy made each one's): `h` tall,
// facing `face`, hips on the seat at (x, seatY, z), through seat() above.
// Null if it won't load, or has no sat clip.
export async function seatOwn(R, kind, { x, z, face, id = kind }, { h, seatY }) {
  const c = await figure(R, kind, ['idle', 'walk', 'sit']);
  if (!c?.act?.sit) return null;
  return seat(R, c, { x, z, face, id }, { h, seatY });
}

// One of them as a hologram, standing in their idle: see-through cyan over
// their own colours, flickering a little, drawn without the cast's line (a
// projection has no outline). `flat` is a group of the room's for what's
// drawn flat (its glow).
export async function hologram(R, kind, { x, z, face, id = kind }, { h, flat }) {
  const c = await figure(R, kind, ['idle', 'walk']);
  if (!c) return null;
  c.group.scale.setScalar(h / c.height);
  c.group.position.set(x, 0.04, z);
  c.group.rotation.y = face + Math.PI / 2;
  const mats = [];
  c.group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.ink) {
      o.visible = false;
      return;
    }
    const m = R.own(new THREE.MeshBasicMaterial({ map: o.material.map ?? null, color: 0x7ff0ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    o.material = m;
    o.castShadow = false;
    o.receiveShadow = false;
    mats.push(m);
  });
  flat.add(c.group);
  const b = {};
  R.tick((t, dt, state) => {
    c.update(t, 0, 0, { dt });
    attend(c, b, id, t, state, { near: 3 });
    // (a flicker now and then, as a projection has)
    const flick = Math.sin(t * 23) > 0.96 ? 0.25 : 0;
    for (const m of mats) m.opacity = 0.5 + Math.sin(t * 2.2) * 0.06 - flick;
  });
  return { group: c.group, cast: c };
}

// A person in shapes, the show's way (a big round head, dot eyes), merged
// into one mesh: { h, skin, shirt, pants, shoes, hair, style, moustache,
// coat, sleeves, belt }. Faces +z; stands on y = 0.
export function toonPerson(R, look, h = 1.8) {
  const {
    skin = 0xf2c9a0,
    shirt = 0xf2d23c,
    pants = 0x3b4a6b,
    shoes = 0x2a221e,
    hair = 0x3a2a1e,
    style = 'short',
    moustache = null,
    coat = null,
    sleeves = 'long',
    belt = null,
    tie = null,
    glasses = false,
    sit = false,
  } = look ?? {};
  const parts = [];
  // sat, everything from the hips up is lower, on a seat 0.45 m up
  const drop = sit ? 0.3 : 0;
  const leg = R.frame(0, 0, 0, { list: parts });
  const f = R.frame(0, 0, 0, { list: parts, y: -drop });
  // legs and shoes
  for (const s of [-1, 1]) {
    if (sit) {
      leg.cyl(pants, s * 0.1, 0.5, 0.2, 0.08, 0.44, Math.PI / 2, 0);
      leg.cyl(pants, s * 0.1, 0.07, 0.42, 0.075, 0.45);
      leg.box(shoes, s * 0.1, 0, 0.46, 0.13, 0.08, 0.27);
    } else {
      leg.cyl(pants, s * 0.1, 0.07, 0, 0.075, 0.76);
      leg.box(shoes, s * 0.1, 0, 0.04, 0.13, 0.08, 0.27);
    }
  }
  // body
  f.part(new THREE.CapsuleGeometry(0.2, 0.42, 4, 12), shirt, 0, 1.06, 0, 0, 1, 1, 0.72);
  if (belt != null) f.cyl(belt, 0, 0.8, 0, 0.205, 0.06, 0, 0, CYL).cyl(0xc9a64a, 0, 0.8, 0.15, 0.03, 0.06, Math.PI / 2);
  if (coat != null) {
    f.part(new THREE.CapsuleGeometry(0.215, 0.5, 4, 12), coat, 0, 0.98, -0.01, 0, 1, 1, 0.74);
    f.box(coat, 0, 0.42, -0.02, 0.4, 0.42, 0.3);
    f.box(shirt, 0, 1.0, 0.145, 0.14, 0.42, 0.02);
  }
  if (tie != null) f.box(tie, 0, 0.92, 0.152, 0.06, 0.42, 0.015);
  f.cyl(skin, 0, 1.36, 0, 0.06, 0.12);
  // arms: sleeves and hands
  for (const s of [-1, 1]) {
    const sl = coat ?? shirt;
    if (sleeves === 'short' && coat == null) {
      f.part(new THREE.CapsuleGeometry(0.068, 0.12, 4, 8), sl, s * 0.27, 1.26, 0, 0, 1, 1, 1, 0, s * 0.18);
      f.part(new THREE.CapsuleGeometry(0.052, 0.36, 4, 8), skin, s * 0.3, 0.98, sit ? 0.13 : 0.02, 0, 1, 1, 1, sit ? -0.6 : 0, s * 0.12);
    } else if (sit) f.part(new THREE.CapsuleGeometry(0.062, 0.42, 4, 8), sl, s * 0.27, 1.06, 0.12, 0, 1, 1, 1, -0.55, s * 0.08);
    else f.part(new THREE.CapsuleGeometry(0.062, 0.48, 4, 8), sl, s * 0.29, 1.06, 0.01, 0, 1, 1, 1, 0, s * 0.15);
    f.ball(skin, s * (sit ? 0.25 : 0.34), sit ? 0.86 : 0.77, sit ? 0.3 : 0.03, 0.06);
  }
  // the head: round, big, with dot eyes and a nose
  const hy = 1.6;
  f.ball(skin, 0, hy, 0, 0.18, 1.08);
  f.ball(skin, 0, hy - 0.03, 0.17, 0.035);
  for (const s of [-1, 1]) {
    f.ball(0xffffff, s * 0.065, hy + 0.035, 0.15, 0.048);
    f.ball(0x111111, s * 0.065, hy + 0.035, 0.193, 0.014);
    f.ball(skin, s * 0.18, hy, 0, 0.035);
    if (glasses) f.part(new THREE.TorusGeometry(0.05, 0.008, 6, 16), 0x222222, s * 0.065, hy + 0.035, 0.19);
  }
  f.box(0x6b3a2e, 0, hy - 0.1, 0.162, 0.07, 0.012, 0.01);
  if (moustache != null) f.part(new THREE.CapsuleGeometry(0.022, 0.09, 4, 8), moustache, 0, hy - 0.066, 0.175, 0, 1, 1, 0.8, 0, Math.PI / 2);
  // hair
  if (style === 'short' || style === 'side') {
    f.ball(hair, 0, hy + 0.06, -0.02, 0.19, 0.78);
    f.box(hair, 0, hy + 0.08, 0.1, 0.3, 0.09, 0.1, 0, -0.35);
    for (const s of [-1, 1]) f.box(hair, s * 0.165, hy - 0.04, -0.03, 0.05, 0.16, 0.22);
  } else if (style === 'spiky') {
    f.ball(hair, 0, hy + 0.04, -0.03, 0.185, 0.7);
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + (i / 8) * 2.4;
      f.part(new THREE.ConeGeometry(0.06, 0.24, 6), hair, Math.sin(a) * 0.17, hy + 0.1 + Math.cos(a) * 0.05, -0.08 - Math.cos(a) * 0.06, 0, 1, 1, 1, -0.9, -a * 0.9);
    }
  } else if (style === 'pony' || style === 'bob') {
    f.ball(hair, 0, hy + 0.05, -0.02, 0.195, 0.85);
    f.box(hair, 0, hy + 0.1, 0.11, 0.3, 0.08, 0.08, 0, -0.4);
    if (style === 'pony') f.part(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), hair, 0, hy + 0.06, -0.24, 0, 1, 1, 1, 0.9);
    else for (const s of [-1, 1]) f.box(hair, s * 0.17, hy - 0.1, -0.02, 0.06, 0.3, 0.26);
  }
  const geo = R.own(mergeParts(parts));
  const group = new THREE.Group();
  const body = new THREE.Mesh(geo, R.kit.mats.toon(0xffffff, { vertexColors: true }));
  body.castShadow = true;
  body.receiveShadow = true;
  body.scale.setScalar(h / 1.8);
  group.add(body);
  const seed = Math.random() * 10;
  return {
    group,
    body,
    tick(t) {
      body.scale.y = (h / 1.8) * (1 + Math.sin(t * 2.1 + seed) * 0.008);
      body.rotation.z = Math.sin(t * 0.7 + seed) * 0.015;
    },
  };
}

