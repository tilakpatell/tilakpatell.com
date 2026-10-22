// The people aboard, drawn from what the crew’s rules say of each
// ({ id, kind, x, y, z, yaw, room, hp, mode, anim, aim }). Each kind is
// loaded once and copied (lib/three/gltf.js caches a model by its URL and
// figures.js copies it for each person): the crew, the troops and
// Chewbacca (the cockpit’s Meshy model, on the crew’s own skeleton) on the
// site’s shared rig, walked and fought on its clips; the surfaces’ droids
// as they were modelled, rocking as they roll; and two built here in code
// until scripts/meshy-deathstar.mjs makes them models: the IT-O (a black
// sphere with its red eye and its syringe) and the dianoga (an eyestalk and
// tentacles up out of the compactor’s water). The Death Star trooper wears
// his black helmet, built here too, over the officer’s uniform.
//
// Only the tier’s count nearest the camera animate (24 high, 14 mid, 8
// low), a body still going down before anyone living; the rest stand
// still. Every figure is posed the first time it is drawn, played on to
// where what it is doing comes to rest (a body found dead lies there, not
// falling as you look), and a still one is played on again whenever the
// rules have it do something new (so a body killed with no turn at moving
// lies on the deck, one that loses its turn mid-fall lands, and one whose
// fall ran its course out of sight is seen lying when it comes back into
// view). Figures are made only for people within 60 m in a room that
// stands, nearest first and two a frame, so a crowd coming into view never
// stalls a frame; anyone past 60 m or in a room that isn’t drawn is
// hidden, and anyone whose room is freed is let go. A person is drawn
// between the game’s last two steps, so they move smoothly at any frame
// rate. A body stays where it fell for as long as the crew keeps it, until
// its room is freed: hidden while the room stands undrawn (a door shut on
// it), let go for good once the stream frees the room. One that fell where
// no room stood is drawn lying there once its room is built.
//
//   LIVE → { ultra, high, mid, low }   how many people animate on each tier;  FAR: 60 m, past which nobody is drawn
//   liveCount(tier) → n
//   lodPick(items, at, { count, far }, out?) → Map<id, 'live' | 'still' | 'hidden'>   pure
//     items: [{ id, x, y, z, falling?, settled?, shown? }]: falling, a body still going down (live before
//     anyone nearer); settled, a body done falling; shown false, in a room not drawn
//   actOf(person, { blade, armed }) → { base, full, upper, raised, dead }   pure: what the figure plays
//     for what the rules say the person is doing: a base state in place of the walk (a stance, a
//     console, talk, a seat, a kneel; null: walking, running or standing on its gait), a whole-body
//     one-shot (a flinch), an upper-body loop (aiming, shooting), whether its gun is up, and death
//   hitClip(dir, yaw, high) → clip   pure: the flinch for a hit from `dir` (the way the bolt went) on
//     someone facing `yaw`: the chest or the head from in front, a shoulder from the side, doubled up
//     from behind
//   fallClip(dir, yaw, id) → clip   pure: back from a hit in front, forward from one behind; with no
//     hit known, the same one for the same person every time
//   aimAngles(from, yaw, at) → { yaw, pitch }   pure: the turn (+ right) and tilt (+ up) from facing `yaw` to `at`
//   createTrack() → { push(body, dt), at(alpha), speed(), velocity(out?), turn() }   pure: a body between
//     its last two steps; dt: the frame’s time since the last push
//   motionFrom(track, yaw) → figures.js’s motion   pure: the speed ahead and aside, and the turn
//   blocks(at, tall, camera, focus) → bool   pure: whether a body at `at` stands between the camera
//     and the point it looks at you by (your chest), or has the camera inside it
//   createPeople(scene, kit, { tier, renderer, adopt, layout }) → { sync(crew, alpha, cameraAt, rooms?), hear(events), figure(id), stage(id, how | null), handOf(id),
//     muzzle(id, out), dispose() }
//     layout: the station's (rules/layout.js), for the dead to fall against as ragdolls (without it
//     they fall on their clips); rooms.open(doorId) and rooms.off (layout.offTags's): its doors and
//     floors as they are now; rooms.camera and rooms.focus (your chest): anyone between them is faded,
//     and rooms.ahead (a little way past you in the view) with rooms.side: a friend before it too;
//     rooms.seatOf(person) (rules/seats.js): where one sat down is drawn, on the seat
//     adopt(object): handed each figure and gun as it goes into the scene (the house look’s adopt)
//     crew: { people: Map | [person] } (or the people themselves); alpha: how far the frame is from the
//     last step to the next; cameraAt: { x, y, z }
//     rooms: { shown(roomId), built(roomId), dt }: the rooms drawn and the rooms standing (the stream’s
//       built, not yet freed; every room, without them), and the frame’s seconds (the clock’s, without it)
//     muzzle(id, out) → out | null   where the person’s gun’s muzzle is, for a shot’s flare

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadGltf } from '../../../../lib/three/gltf';
import { CAST } from '../rules/cast';
import { colliderFor } from './fall';
import { PEOPLE, loadGame, loadPerson, motionOf } from './figures';
import { buildGun, disposeGuns } from './guns';
import { FAR, LIVE, liveCount, lodPick } from '../../../../lib/three/lodPick';

// (LIVE, FAR, liveCount, lodPick: lib/three/lodPick.js's, shared with the galaxy's ground)
export { FAR, LIVE, liveCount, lodPick };
const STEP = 1 / 30; // the game’s step
const JUMP = 3; // metres between two steps that are a ride or a teleport, not a stride
const SETTLE = 1.5 * STEP; // seconds unmoved after which a body has stopped, not paused between steps
const FALL = 2.5; // seconds a fall takes to play: after it a body needs no animating
const LAND = { time: FALL, step: 0.25 }; // how far a still figure is played on to land what it was given, and in what steps
const MAKE = 2; // figures made a frame at most
const CHEST = 0.75; // of a person’s height, where a gun is held for aiming
const HOVER = 1.45; // metres: the IT-O floats at a standing man’s eyes
const DEEP = 1.0; // the compactor’s water over the floor the dianoga lies on (ds1.js)
const FALLS = ['die.back', 'die.fwd'];
// A body shot dead starts down on its fall clip, then goes as a ragdoll: RAG_AFTER seconds in, at
// SHOT_SPEED m/s at the chest the way the bolt went (a blade's cut a little harder)
const RAG_AFTER = 0.15;
const SHOT_SPEED = 2.4;
const CUT_SPEED = 3.2;
const SETTLE_MOST = 6; // seconds a still body's fall is played through, at most, when it has no turn
const SEEN_THROUGH = 0.18; // how solid someone between the camera and you is drawn
const HEAD = 1.45; // metres up a body a hit counts as one to the head

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const hashOf = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

// what a pose the rules name looks like, from the clip library: at attention, working a console,
// talking with their hands, sat, kneeling, sat on the floor, lying there, limping along held up
const LEAN = 0.14; // radians one held up leans in to whoever holds him
const POSES = { attention: 'idle.calm', work: 'counter.idle', talk: 'talk', sit: 'sit.idle', kneel: 'kneel', ground: 'sit.ground', lie: 'lie', limp: 'walk.injured', guard: 'stance', lightning: 'cast.double' };
// a duellist's strokes, light and heavy, taken in turn (rules/play/duel.js counts them on the person)
const SWORD = {
  strike: ['sword.light.a', 'sword.light.b', 'sword.light.c', 'sword.light.d'],
  heavy: ['sword.heavy.a', 'sword.heavy.b', 'sword.heavy.c'],
};

export function actOf(p, { blade = false, armed = true } = {}) {
  const raised = p.mode === 'fight' || p.mode === 'search' || p.anim === 'aim' || p.anim === 'shoot' || Boolean(p.mind?.duel);
  if (p.mode === 'dead') return { base: null, full: null, upper: null, raised: false, dead: true };
  // knocked down: thrown back, then on one knee until they are up
  if (p.mode === 'down') return { base: 'kneel', full: p.anim === 'hit' ? 'hit.knock' : null, upper: null, raised: false, dead: false };
  const moving = p.anim === 'walk' || p.anim === 'run';
  const base = moving ? null : (POSES[p.anim] ?? (blade && raised ? 'stance' : null));
  // (a stroke, or the Force reached out with a hand)
  const strokes = SWORD[p.anim];
  const full = p.anim === 'hit' ? 'hit' : strokes ? strokes[(p.strokes ?? 0) % strokes.length] : p.anim === 'cast' ? 'cast' : null;
  // a gun up is held out at the aim, the legs still walking under it
  const upper = armed && !blade && raised ? (p.anim === 'shoot' ? 'shoot.pistol' : 'aim.pistol') : null;
  return { base, full, upper, raised, dead: false };
}

// along: + the bolt went the way they face (a hit from behind); across: + it went to their right (from their left)
const sides = (dir, yaw) => ({ along: dir.x * Math.sin(yaw) - dir.z * Math.cos(yaw), across: dir.x * Math.cos(yaw) + dir.z * Math.sin(yaw) });

export function hitClip(dir, yaw, high = false) {
  if (!dir) return 'hit.trooper';
  const { along, across } = sides(dir, yaw);
  if (along < -0.5) return high ? 'hit.head' : 'hit.chest';
  if (along > 0.5) return 'hit.stomach';
  return across > 0 ? 'hit.shoulder.l' : 'hit.shoulder.r';
}

export function fallClip(dir, yaw, id = '') {
  // the same person falls the same way however often they are drawn
  if (!dir) return FALLS[hashOf(id) % FALLS.length];
  return sides(dir, yaw).along > 0 ? 'die.fwd' : 'die.back';
}

export function aimAngles(from, yaw, at) {
  const dx = at.x - from.x;
  const dz = at.z - from.z;
  return { yaw: wrap(Math.atan2(dx, -dz) - yaw), pitch: Math.atan2(at.y - from.y, Math.hypot(dx, dz)) };
}

// Whether a body stands between the camera and you, so it hides you: its
// middle within a body's width of the line from the camera to your chest,
// short of you; or the camera inside it. Pure.
const BLOCK = 0.55; // metres from the line that count as on it
export function blocks(at, tall, camera, focus) {
  if (!camera || !focus) return false;
  const c = { x: at.x, y: at.y + tall * 0.55, z: at.z };
  const dx = focus.x - camera.x;
  const dy = focus.y - camera.y;
  const dz = focus.z - camera.z;
  const l2 = dx * dx + dy * dy + dz * dz;
  if (l2 < 1e-6) return false;
  const t = ((c.x - camera.x) * dx + (c.y - camera.y) * dy + (c.z - camera.z) * dz) / l2;
  if (t > 0.92) return false;
  const k = Math.max(0, t);
  const px = camera.x + dx * k - c.x;
  const pz = camera.z + dz * k - c.z;
  const py = camera.y + dy * k - c.y;
  return Math.hypot(px, pz) < BLOCK && Math.abs(py) < tall * 0.55;
}

export function createTrack() {
  const prev = { x: 0, y: 0, z: 0, yaw: 0 };
  const cur = { x: 0, y: 0, z: 0, yaw: 0 };
  const out = { x: 0, y: 0, z: 0, yaw: 0 };
  let have = false;
  let still = 0; // seconds since it last moved
  let gap = STEP; // seconds between its last two moves
  const copy = (to, b) => Object.assign(to, { x: b.x ?? 0, y: b.y ?? 0, z: b.z ?? 0, yaw: b.yaw ?? 0 });
  return {
    push(b, dt = 0) {
      const moved = !have || b.x !== cur.x || b.y !== cur.y || b.z !== cur.z || (b.yaw ?? 0) !== cur.yaw;
      if (moved) {
        const jumped = !have || Math.hypot(b.x - cur.x, b.y - cur.y, b.z - cur.z) > JUMP;
        copy(prev, jumped ? b : cur);
        copy(cur, b);
        gap = Math.max(STEP, still + dt);
        still = 0;
        have = true;
      } else if ((still += dt) > SETTLE) copy(prev, cur);
    },
    at(alpha) {
      const a = clamp(alpha, 0, 1);
      return Object.assign(out, { x: prev.x + (cur.x - prev.x) * a, y: prev.y + (cur.y - prev.y) * a, z: prev.z + (cur.z - prev.z) * a, yaw: prev.yaw + wrap(cur.yaw - prev.yaw) * a });
    },
    speed: () => Math.hypot(cur.x - prev.x, cur.z - prev.z) / gap,
    // the way it is going (m/s, in the world) and how fast it turns (rad/s, + towards +x)
    velocity: (o = { x: 0, z: 0 }) => Object.assign(o, { x: (cur.x - prev.x) / gap, z: (cur.z - prev.z) / gap }),
    turn: () => wrap(cur.yaw - prev.yaw) / gap,
  };
}

// The animator’s motion for a body the track has between two steps: its speed ahead and to its
// right of where it faces, and its turn (+ to the left, as locomotion has it)
const _vel = { x: 0, z: 0 };
export function motionFrom(track, yaw) {
  const v = track.velocity(_vel);
  return motionOf(v.x * Math.sin(yaw) - v.z * Math.cos(yaw), v.x * Math.cos(yaw) + v.z * Math.sin(yaw), -track.turn());
}

// ── built in code ──

const _c = new THREE.Color();
const _t = new THREE.Color();
const noise = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

// A part coloured between two colours vertex by vertex, by where each
// vertex is (so a seam’s twin vertices match), and, given `shag`, pushed
// out and down a little at random so its skin reads as rough, not smooth.
function part(geo, from, to = from, shag = 0) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const h = noise(x, y, z);
    if (shag) pos.setXYZ(i, x + nor.getX(i) * shag * h, y + (nor.getY(i) - 0.5) * shag * h, z + nor.getZ(i) * shag * h);
    _c.setHex(from).lerp(_t.setHex(to), h);
    colours.set([_c.r, _c.g, _c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  if (shag) geo.computeVertexNormals();
  return geo;
}
const joined = (geos) => {
  const g = mergeGeometries(geos);
  for (const p of geos) p.dispose();
  return g;
};
const at = (geo, x, y, z) => geo.translate(x, y, z);

// how far over a fall has turned a body, 0…1 of the way: down fast, with a bump as it lands
const fallen = (k) => (k < 0.8 ? (k / 0.8) ** 2 : 1 - Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.06);

// What every figure built here does: falls (tipping over backwards about
// its feet, unless it floats or swims) and gets up from a knockdown,
// flinches and keeps its aim; none has a hand, so none holds a gun. `pose`
// moves its parts; `owned`, what it frees when it goes (its geometry, a
// skeleton).
function builtFigure(kind, tall, { object, body, owned, tips = true, pose }) {
  object.name = `person-${kind}`;
  const s = { t: 0, go: 0, fall: 0, falling: false, hit: 0, yaw: 0, pitch: 0 };
  return {
    object,
    kind,
    tall,
    built: true,
    play(name, { layer = 'full' } = {}) {
      if (layer !== 'full') return;
      s.falling = typeof name === 'string' && name.startsWith('die');
      if (typeof name === 'string' && (name.startsWith('hit') || name === 'shot')) s.hit = 1;
    },
    // (nothing built here sits, crouches, works a console or turns its head)
    base() {},
    stop() {},
    look() {},
    setAim(yaw, pitch) {
      Object.assign(s, { yaw: clamp(yaw || 0, -1.2, 1.2), pitch: clamp(pitch || 0, -0.9, 0.9) });
    },
    hold() {},
    update(dt, speed = 0) {
      s.t += dt;
      s.go += (clamp(speed / 1.6, 0, 1.6) - s.go) * (1 - Math.exp(-dt * 8));
      s.fall = clamp(s.fall + (s.falling ? dt / 0.7 : -dt / 0.9), 0, 1);
      s.hit = Math.max(0, s.hit - dt * 4);
      if (tips) body.rotation.x = fallen(s.fall) * (Math.PI / 2) * 0.96;
      pose(s, dt);
    },
    dispose() {
      object.removeFromParent();
      for (const g of owned) g.dispose();
    },
  };
}

// The IT-O: a glossy black sphere hanging in the air, its red eye, a ring
// of instruments round it, and its arms: the syringe, and a pincer.
function buildIto(tall, mats, kit) {
  const r = tall / 2;
  const shell = new THREE.SphereGeometry(r, 28, 18);
  const metal = joined([
    new THREE.TorusGeometry(r * 1.01, 0.008, 6, 40).rotateX(Math.PI / 2),
    at(new THREE.TorusGeometry(0.034, 0.008, 6, 20), 0, 0.02, -r * 0.97),
    at(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6), 0.03, r + 0.05, 0),
    at(new THREE.CylinderGeometry(0.03, 0.04, 0.04, 12), 0, -r - 0.01, 0),
    // the syringe: an arm out of its right side, the barrel and its needle
    at(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6).rotateZ(-1.0), r * 0.9 + 0.05, -0.04, 0),
    at(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 10).rotateX(Math.PI / 2), r + 0.12, -0.08, -0.05),
    at(new THREE.ConeGeometry(0.004, 0.09, 6).rotateX(-Math.PI / 2), r + 0.12, -0.08, -0.145),
    // the pincer on the left
    at(new THREE.CylinderGeometry(0.007, 0.007, 0.14, 6).rotateZ(1.1), -r * 0.9 - 0.05, -0.05, 0),
    at(new THREE.BoxGeometry(0.008, 0.05, 0.012).rotateZ(0.3), -r - 0.12, -0.1, -0.012),
    at(new THREE.BoxGeometry(0.008, 0.05, 0.012).rotateZ(-0.3), -r - 0.1, -0.1, 0.012),
  ]);
  const eye = at(new THREE.SphereGeometry(0.026, 14, 10), 0, 0.02, -r * 0.94);
  const object = new THREE.Group();
  const body = new THREE.Group();
  const ball = new THREE.Group();
  ball.add(new THREE.Mesh(shell, mats.gloss), new THREE.Mesh(metal, kit.mat('rail')), new THREE.Mesh(eye, kit.mat('red')));
  body.add(ball);
  object.add(body);
  return builtFigure('ito', tall, {
    object,
    body,
    owned: [shell, metal, eye],
    tips: false, // (a floating droid drops where it is)
    pose(s) {
      // a slow hover; a fallen one lies on the deck where it dropped
      const down = s.fall;
      ball.position.y = (HOVER + Math.sin(s.t * 1.7) * 0.03) * (1 - down) + r * down;
      ball.rotation.set(s.pitch * 0.5 - s.hit * 0.4, -s.yaw * 0.8, Math.sin(s.t * 0.9) * 0.05 + down * 0.6, 'YXZ');
    },
  });
}

// The dianoga: an eyestalk and four tentacles, each a chain of bones in
// one skinned mesh, up out of the water; the rest of it stays under.
function buildDianoga(tall, mats) {
  const SEGS = 6;
  const chains = [{ x: 0, z: 0, len: tall + 0.45, r0: 0.1, r1: 0.055, eye: true }, ...[0.4, 1.9, 3.5, 5.0].map((a, i) => ({ x: Math.cos(a) * 0.35, z: Math.sin(a) * 0.35, len: 1.5 + i * 0.12, r0: 0.1, r1: 0.016, out: a }))];
  const geos = [];
  const bones = [];
  const roots = [];
  chains.forEach((c, n) => {
    const seg = c.len / SEGS;
    let parent = null;
    for (let j = 0; j <= SEGS; j++) {
      const b = new THREE.Bone();
      if (parent) {
        b.position.y = seg;
        parent.add(b);
      } else {
        b.position.set(c.x, DEEP - 0.35, c.z);
        roots.push(b);
      }
      bones.push(b);
      parent = b;
    }
    const g = part(new THREE.CylinderGeometry(c.r1, c.r0, c.len, 12, SEGS * 3).translate(c.x, DEEP - 0.35 + c.len / 2, c.z), 0x23271d, 0x4f4b38, 0.012);
    const pos = g.attributes.position;
    const index = new Uint16Array(pos.count * 4);
    const weight = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const along = clamp((pos.getY(i) - (DEEP - 0.35)) / seg, 0, SEGS - 1e-6);
      const j = Math.floor(along);
      const f = along - j;
      index.set([n * (SEGS + 1) + j, n * (SEGS + 1) + j + 1, 0, 0], i * 4);
      weight.set([1 - f, f, 0, 0], i * 4);
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
    geos.push(g);
  });
  const skinGeo = joined(geos);
  const skin = new THREE.SkinnedMesh(skinGeo, mats.skin);
  skin.add(...roots);
  skin.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skin.bind(skeleton);
  skin.frustumCulled = false;
  // the eye at the stalk’s tip, looking out along −z: pale, ringed, a dark slit
  const eyeGeo = joined([part(new THREE.SphereGeometry(0.09, 20, 14), 0xb9b48e, 0xd9d3b0), part(at(new THREE.CircleGeometry(0.05, 20).rotateY(Math.PI), 0, 0, -0.0895), 0x6a3a14, 0x8a5a24), part(at(new THREE.PlaneGeometry(0.014, 0.06).rotateY(Math.PI), 0, 0, -0.0905), 0x030303)]);
  const eye = new THREE.Mesh(eyeGeo, mats.eye);
  eye.name = 'dianoga-eye';
  eye.position.y = 0.04;
  bones[SEGS].add(eye);
  const object = new THREE.Group();
  const body = new THREE.Group();
  body.add(skin);
  object.add(body);
  return builtFigure('dianoga', tall, {
    object,
    body,
    // (the skeleton too: drawn, it keeps its bones’ matrices in a texture of its own)
    owned: [skinGeo, eyeGeo, skeleton],
    tips: false,
    pose(s) {
      // dead, it sinks out of sight and stays down
      body.position.y = -s.fall * (tall + 0.6);
      chains.forEach((c, n) => {
        for (let j = 0; j <= SEGS; j++) {
          const b = bones[n * (SEGS + 1) + j];
          const wave = Math.sin(s.t * (c.eye ? 0.9 : 1.3) + j * 0.7 + n * 1.7);
          if (c.eye) {
            // the stalk sways, and leans its eye towards what it watches, flinching back when hit
            b.rotation.set((j ? wave * 0.06 : 0) + (j === 1 ? s.pitch * -0.3 + s.hit * 0.5 : 0), j === 1 ? -s.yaw * 0.5 : 0, j ? Math.cos(s.t * 0.7 + j) * 0.05 : 0);
          } else {
            // a tentacle leans out of the water from its root and curls on along its length as it writhes
            const bend = j === 0 ? 0.55 : 0.12 + wave * 0.3;
            b.rotation.set(Math.sin(c.out) * bend, 0, -Math.cos(c.out) * bend);
          }
        }
      });
    },
  });
}

const BUILT = { ito: buildIto, dianoga: buildDianoga };

// The Death Star trooper’s helmet: a black bowl with its skirt flared at
// the back and sides, the visor and the jaw guard. One shape for every
// trooper (helmetGeometry), each one sized to the head it sits on (from
// the head bone to the top of the head).
function helmetGeometry() {
  const geos = [
    new THREE.LatheGeometry([[0, 0.17], [0.07, 0.165], [0.115, 0.14], [0.14, 0.09], [0.145, 0.03], [0.15, -0.02], [0.175, -0.06], [0.168, -0.066], [0.14, -0.03]].map(([x, y]) => new THREE.Vector2(x, y)), 28),
    at(new THREE.BoxGeometry(0.17, 0.07, 0.04), 0, 0.05, -0.135),
    at(new THREE.BoxGeometry(0.11, 0.06, 0.05), 0, -0.04, -0.12),
  ];
  return joined([part(geos[0], 0x0c0c0e), part(geos[1], 0x020203), part(geos[2], 0x141416)]);
}

function helmetOn(fig, geo, mats) {
  const helmet = new THREE.Mesh(geo, mats.gloss);
  helmet.name = 'helmet';
  const o = fig.object;
  o.updateMatrixWorld(true);
  const head = o.getObjectByName('Head');
  const top = o.getObjectByName('head_end');
  if (!head || !top) {
    helmet.position.y = fig.tall - 0.13;
    o.add(helmet);
    return helmet;
  }
  // placed at the head in the figure’s own space at rest, then hung from the head bone so it turns with it
  const a = head.getWorldPosition(new THREE.Vector3());
  const b = top.getWorldPosition(new THREE.Vector3());
  const span = a.distanceTo(b);
  const world = new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), new THREE.Quaternion(), new THREE.Vector3().setScalar(span / 0.2));
  new THREE.Matrix4().copy(head.matrixWorld).invert().multiply(world).decompose(helmet.position, helmet.quaternion, helmet.scale);
  head.add(helmet);
  return helmet;
}

// A droid from the surfaces, as it was modelled: scaled to its height,
// its own idle playing if it has one; it rocks as it rolls and tips over
// when it is destroyed.
function buildProp(kind, tall, gltf) {
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const k = tall / Math.max(size.y, 1e-6);
  model.scale.multiplyScalar(k);
  model.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  const turn = new THREE.Group();
  turn.rotation.y = Math.PI; // (the surfaces’ models face +z)
  turn.add(model);
  const object = new THREE.Group();
  const body = new THREE.Group();
  body.add(turn);
  object.add(body);
  const mixer = gltf.animations?.length ? new THREE.AnimationMixer(model) : null;
  mixer?.clipAction(gltf.animations[0]).play();
  const fig = builtFigure(kind, tall, {
    object,
    body,
    owned: [],
    pose(s, dt) {
      mixer?.update(dt);
      turn.rotation.z = Math.sin(s.t * 9) * 0.05 * Math.min(1, s.go);
      turn.position.y = Math.abs(Math.sin(s.t * 9)) * 0.012 * Math.min(1, s.go) * tall;
    },
  });
  const dispose = fig.dispose;
  fig.dispose = () => {
    mixer?.stopAllAction();
    dispose();
  };
  return fig;
}

// ── the people ──

export function createPeople(scene, kit, { tier = 'high', renderer = null, adopt = null, layout = null } = {}) {
  const count = liveCount(tier);
  const mats = {
    skin: new THREE.MeshStandardMaterial({ name: 'ds-dianoga', vertexColors: true, roughness: 0.6, metalness: 0 }),
    eye: new THREE.MeshStandardMaterial({ name: 'ds-eye', vertexColors: true, roughness: 0.15, metalness: 0 }),
    gloss: new THREE.MeshStandardMaterial({ name: 'ds-gloss', vertexColors: true, roughness: 0.22, metalness: 0.3 }),
  };
  let helmetShape = null; // the Death Star troopers’ one helmet shape, made for the first of them
  const records = new Map(); // id → { id, kind, fig, track, clip, gun, blaster, fallFor, posed, seen }
  // bodies by id, each with the frame the crew last listed it in: `lying`, seen dead in a room that
  // stood (so let go when that room is freed); `cleared`, let go, and never drawn again
  const lying = new Map();
  const cleared = new Map();
  const items = []; // what lodPick weighs, one kept per person drawn and reused frame to frame
  let listed = 0;
  const wanted = []; // [distance, person, in view] for people near who have no figure yet
  const picks = new Map();
  const pendingHits = new Map(); // id → a hit heard before the figure was made
  const staging = new Map(); // id → a scene's say over how they're drawn, before their figure is made
  let frame = 0;
  let last = null;
  let disposed = false;

  // a loaded figure (the built ones are made at once, in follow)
  async function figureFor(kind) {
    const c = CAST[kind];
    // (the game’s body first where the cast names its row, figures.js’s loadGame, a droid on its own rig drawn as the surfaces’ are; one in a helmet built here wears the game’s armour, undyed; the site’s model below if it won’t come)
    const game = c?.game && !disposed ? await loadGame(c.game, { kind, tall: c.tall, tint: c.tint ?? null, dye: c.helmet ? null : (c.dye ?? null) }) : null;
    if (game) return game.droid ? buildProp(kind, c.tall, game.droid) : game;
    // a model with no rig of the shared kind is one of the surfaces’ droids
    const g = c?.model && !PEOPLE[kind] ? await loadGltf(c.model, { renderer }) : null;
    if (g?.scene && !g.scene.getObjectByName('Hips')) {
      const copy = await loadGltf(c.model, { renderer, fresh: true });
      return buildProp(kind, c.tall, copy);
    }
    const fig = await loadPerson(PEOPLE[kind] || !c ? kind : c.model, { tall: c?.tall, tint: c?.tint ?? null, dye: c?.dye ?? null, renderer, game: null });
    fig.object.name = `person-${kind}`;
    if (c?.helmet === 'dstrooper' && !disposed) helmetOn(fig, (helmetShape ??= helmetGeometry()), mats);
    return fig;
  }

  function place(r, fig) {
    if (disposed || records.get(r.id) !== r) return fig.dispose();
    r.fig = fig;
    // out of sight until a sync has put it in its place and posed it
    fig.object.visible = false;
    scene.add(fig.object);
    adopt?.(fig.object);
  }

  function follow(p) {
    // base, full, upper: what the figure was last asked to play (actOf’s); dead: its fall begun;
    // hit: the last hit it took ({ dir, high }), for the flinch and the fall
    const r = { id: p.id, kind: p.kind, fig: null, track: createTrack(), base: undefined, full: undefined, upper: undefined, dead: false, hit: pendingHits.get(p.id) ?? null, staged: staging.get(p.id) ?? null, gun: undefined, blaster: null, fallFor: 0, posed: false, seen: frame };
    records.set(p.id, r);
    staging.delete(p.id);
    const c = CAST[p.kind];
    if (c?.built) place(r, BUILT[c.built](c.tall, mats, kit));
    else figureFor(p.kind).then((fig) => place(r, fig), (err) => console.error(`Aboard the Death Star: ${p.kind} didn’t load`, err));
    return r;
  }

  // a body the crew no longer lists needs no remembering
  function forget(bodies) {
    for (const [id, seen] of bodies) if (seen !== frame) bodies.delete(id);
  }

  function drop(r) {
    records.delete(r.id);
    r.blaster?.removeFromParent();
    r.fig?.dispose();
  }

  // a person this frame: where the rules have them, and what lodPick needs to weigh them
  function see(r, p, inView, dt) {
    r.seen = frame;
    r.track.push(p, dt);
    const it = items[listed] ?? (items[listed] = {});
    listed++;
    const fall = p.mode === 'dead' || p.mode === 'down';
    it.id = p.id;
    it.x = p.x;
    it.y = p.y ?? 0;
    it.z = p.z;
    // (a ragdoll is down once it lies still; a figure built here, once its fall has played)
    const down = r.fig?.fallen ? r.fig.settled : r.fallFor >= FALL;
    it.falling = fall && !down;
    it.settled = p.mode === 'dead' && down;
    it.shown = inView;
    it.p = p;
  }

  // the gun in a person’s hands: the shared rig’s figures hold their own
  // and carry it to their aim, so ours goes inside theirs (theirs hidden)
  function arm(r, gun) {
    r.gun = gun;
    // (ours out first: a figure frees the geometry of what it holds, and ours is shared)
    r.blaster?.removeFromParent();
    r.blaster = null;
    r.fig.hold(gun);
    // (a figure built here has no hand to hold one)
    if (!gun || r.fig.built) return;
    const holder = r.fig.object.getObjectByName(`gun-${gun}`);
    if (!holder) return;
    for (const o of holder.children) o.visible = false;
    r.blaster = buildGun(gun);
    if (!r.blaster) return;
    holder.add(r.blaster);
    adopt?.(r.blaster);
  }

  // A figure played on, in steps (so a clip’s fade in and out run their
  // course as they would), far enough to land what it was last given: a
  // fall lies down, a flinch is over and back to standing, and one never
  // yet drawn stands in its pose, not as it was made.
  // The dead let go as ragdolls against the station (fall.js): pushed the way the bolt or the
  // blade went, or back from where they faced when nobody saw what hit them
  function letGo(r, p, yaw, world) {
    if (!layout || r.fig.fallen || !r.fig.fall) return;
    const dir = r.hit?.dir ?? { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) };
    const v = r.track.velocity({ x: 0, z: 0 });
    const collide = colliderFor(layout, { room: p.room, at: p, off: world?.off, open: world?.open ?? (() => false) });
    r.fig.fall({ collide, push: dir, speed: r.hit?.cut ? CUT_SPEED : SHOT_SPEED, velocity: { x: v.x, y: 0, z: v.z } });
  }

  function land(r, p, yaw, world) {
    // a body with no turn at moving is laid down at once: its ragdoll played through until it lies still
    if (r.dead && layout && r.fig.fall) {
      letGo(r, p, yaw, world);
      for (let t = 0; t < SETTLE_MOST && r.fig.fallen && !r.fig.settled; t += LAND.step) r.fig.update(LAND.step);
    }
    for (let t = 0; t < LAND.time; t += LAND.step) r.fig.update(LAND.step, 0);
    // (once more with no time: the gait takes back the weight a finished clip let go of)
    r.fig.update(0, 0);
    r.posed = true;
    if (r.dead) r.fallFor = FALL;
  }

  // What the rules have the person doing, asked of the figure where it has changed; whether anything was
  function act(r, want, yaw) {
    const fig = r.fig;
    if (want.dead) {
      if (r.dead) return false;
      r.dead = true;
      fig.stop('upper');
      fig.base(null);
      fig.play(fallClip(r.hit?.dir, yaw, r.id));
      r.base = r.full = r.upper = null;
      return true;
    }
    let changed = false;
    if (r.dead) {
      // (up again: a checkpoint put them back)
      r.dead = false;
      fig.rise?.();
      fig.play(null);
      changed = true;
    }
    if (want.base !== r.base) {
      fig.base(want.base);
      r.base = want.base;
      changed = true;
    }
    if (want.full !== r.full) {
      if (want.full) fig.play(want.full === 'hit' ? hitClip(r.hit?.dir, yaw, r.hit?.high) : want.full);
      r.full = want.full;
      changed = true;
    }
    if (want.upper !== r.upper) {
      if (want.upper) fig.play(want.upper, { layer: 'upper', loop: true });
      else fig.stop('upper');
      r.upper = want.upper;
      changed = true;
    }
    return changed;
  }

  function draw(r, p, pick, alpha, dt, world) {
    const fig = r.fig;
    const o = fig.object;
    const c = CAST[p.kind];
    const gun = p.gun !== undefined ? p.gun : (c?.gun ?? null);
    const want = actOf(p, { blade: c?.blade?.type === 'saber', armed: gun != null });
    const fall = want.dead || p.mode === 'down';
    if (!fall) r.fallFor = 0;
    o.visible = pick !== 'hidden';
    if (!o.visible) {
      // out of sight a fall goes on all the same, and one that runs its course there is
      // to be landed when next seen (a still figure’s clip unchanged would never be played on)
      if (fall && r.fallFor < FALL && (r.fallFor += dt) >= FALL) r.posed = false;
      return;
    }
    // (a scene may carry someone where the rules don't: swung across the chasm; and one sat down is
    // drawn on the seat, not in it: rules/seats.js)
    const sat = want.base === 'sit.idle' && !r.staged?.at ? world?.seatOf?.(p) : null;
    const at = r.staged?.at ? { ...r.track.at(alpha), ...r.staged.at } : sat ? { ...r.track.at(alpha), ...sat } : r.track.at(alpha);
    o.position.set(at.x, at.y, at.z);
    o.rotation.y = -(r.staged?.yaw ?? at.yaw);
    // (one held up leans in to whoever holds him: rules/play/plot.js's holdUp)
    if (p.held || r.leant) o.rotation.z = (p.held ?? 0) * LEAN;
    r.leant = Boolean(p.held);
    // (a scene can take someone out of it: Ben, gone in the duel)
    if (r.staged?.hidden) o.visible = false;
    // faded while it stands between the camera and you, eased in and out
    // (and a friend just ahead of you in the view: an enemy there is the one you need to see)
    const friend = c && world?.side && (c.side === world.side || c.side === 'neutral');
    const see = blocks(at, fig.tall, world?.camera, world?.focus) || (friend && blocks(at, fig.tall, world?.camera, world?.ahead)) ? SEEN_THROUGH : 1;
    r.fade = (r.fade ?? 1) + (see - (r.fade ?? 1)) * Math.min(1, dt * 10);
    fig.fade?.(r.fade);
    const wasDead = r.dead;
    const changed = act(r, want, at.yaw);
    if (r.dead && !wasDead) r.fallFor = 0;
    if (gun !== r.gun) arm(r, gun);
    if (p.aim) {
      const a = aimAngles({ x: at.x, y: at.y + fig.tall * CHEST, z: at.z }, at.yaw, p.aim);
      fig.setAim(a.yaw, a.pitch, want.raised);
    } else fig.setAim(0, 0, want.raised);
    if (!r.posed || (pick !== 'live' && (changed || (fall && r.fallFor < FALL && !fig.settled)))) land(r, p, at.yaw, world);
    else if (pick === 'live') {
      if (fall) r.fallFor += dt;
      if (r.dead && r.fallFor >= RAG_AFTER) letGo(r, p, at.yaw, world);
      fig.update(dt, fall ? 0 : motionFrom(r.track, at.yaw));
    }
  }

  return {
    sync(crew, alpha = 1, cameraAt = null, rooms = null) {
      if (disposed) return;
      const now = performance.now() / 1000;
      const dt = rooms?.dt ?? (last === null ? 0 : clamp(now - last, 0, 0.1));
      last = now;
      frame++;
      const at = cameraAt ?? { x: 0, y: 0, z: 0 };
      const all = crew?.people ?? crew ?? [];
      listed = 0;
      wanted.length = 0;
      for (const p of all instanceof Map ? all.values() : all) {
        if (p?.id == null) continue;
        if (cleared.has(p.id)) {
          cleared.set(p.id, frame);
          continue;
        }
        // (someone the rules have in no room is drawn by distance alone)
        const standing = p.room == null || !rooms?.built || rooms.built(p.room);
        const inView = standing && (p.room == null || !rooms?.shown || rooms.shown(p.room));
        let r = records.get(p.id);
        if (r && r.kind !== p.kind) {
          drop(r);
          r = undefined;
        }
        if (!standing) {
          // its room freed (or not yet built): nothing of it drawn, and a body that lay in it while it stood is gone with it
          if (lying.has(p.id)) {
            lying.delete(p.id);
            cleared.set(p.id, frame);
          }
          if (r) drop(r);
          continue;
        }
        if (p.mode === 'dead') lying.set(p.id, frame);
        if (r) see(r, p, inView, dt);
        else {
          const d = Math.hypot(p.x - at.x, (p.y ?? 0) - at.y, p.z - at.z);
          if (d <= FAR) wanted.push([d, p, inView]);
        }
      }
      // figures for the nearest of those near without one, a couple a frame, so a crowd never stalls one
      wanted.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < Math.min(MAKE, wanted.length); i++) see(follow(wanted[i][1]), wanted[i][1], wanted[i][2], dt);
      // (a Map walked while it is deleted from carries on with what is left)
      for (const r of records.values()) if (r.seen !== frame) drop(r);
      forget(lying);
      forget(cleared);
      items.length = listed;
      lodPick(items, at, { count }, picks);
      for (const it of items) {
        const r = records.get(it.id);
        if (r?.fig) draw(r, it.p, picks.get(it.id), alpha, dt, rooms);
      }
    },

    // the game’s events since the last frame: who was hit, from which way and how high, for the
    // flinch and the fall (one not drawn yet keeps it until it is)
    hear(events) {
      for (const e of events ?? []) {
        if (e.type !== 'hit' || e.target == null || e.target === 'you') continue;
        const hit = { dir: e.dir ?? null, high: false, cut: e.by === 'blade' };
        const r = records.get(e.target);
        if (r) {
          hit.high = e.y - (r.fig?.object.position.y ?? 0) > HEAD;
          r.hit = hit;
        } else pendingHits.set(e.target, hit);
      }
      if (pendingHits.size > 64) pendingHits.clear();
    },

    // someone’s figure, while they have one (cinematics.js plays a scene’s clips on it)
    figure(id) {
      return records.get(id)?.fig ?? null;
    },
    // a scene’s say over how someone is drawn, kept until it lets them go: { yaw, hidden }
    stage(id, how) {
      const r = records.get(id);
      // (someone not drawn yet is staged once they are: a scene's first act comes before their figure)
      const was = r ? r.staged : staging.get(id);
      const now = how ? { ...was, ...how } : null;
      if (r) {
        r.staged = now;
        staging.delete(id);
        // (let go by a scene: whatever it played over them, they take up again what the rules have them doing)
        if (!now) r.base = r.full = r.upper = undefined;
      } else if (now) staging.set(id, now);
      else staging.delete(id);
    },

    // the bone of someone’s right hand, for what they hold in it (a sabre), while they are drawn
    handOf(id) {
      const r = records.get(id);
      return r?.fig?.object.visible && !r.fig.fallen ? (r.fig.hand ?? null) : null;
    },

    muzzle(id, out = new THREE.Vector3()) {
      const m = records.get(id)?.fig?.object.getObjectByName('muzzle');
      if (!m) return null;
      m.updateWorldMatrix(true, false);
      return m.getWorldPosition(out);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const r of [...records.values()]) drop(r);
      for (const m of Object.values(mats)) m.dispose();
      helmetShape?.dispose();
      disposeGuns();
      lying.clear();
      cleared.clear();
    },
  };
}
