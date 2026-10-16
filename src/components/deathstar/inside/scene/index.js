// The Death Star’s inside, drawn: what module.js draws through each frame.
// It holds nothing the game needs. The rooms come and go with the stream
// (built near you, drawn while seen, freed far off); the doors’ leaves are
// drawn here from the game’s door states, since a room leaves its doorways
// open in their frames (a sliding door parts sideways into the wall, a
// blast door drops from above, a hatch swings on its hinge); the player
// is a rigged figure (figures.js), a stormtrooper whenever in armour; the
// people aboard are drawn from the game’s crew (people.js) and the bolts
// in the air from its combat (fx.js), the blades, the windows’ views and
// what the game’s events look like (show.js); and the camera stands over the
// shoulder or at the eyes, kept out of the walls (camera.js). The game
// steps at 30 Hz and a frame falls between two steps, so the player is
// drawn between where the last two steps put them. Everything is in the
// house look (lib/three/houseNodes.js: the station is drawn on the node
// renderer); bloom is the module’s (rt.gfx.post), so render() draws just
// the scene through the camera.
//
//   leafPlaces(door, open) → [{ x0, x1, y0, y1, lead, swing? }]   pure: the leaves’ rects still in the
//     doorway (x along the door from its middle, y up from its floor), `lead` the edge that moves;
//     a hatch’s one leaf is always whole, turned `swing` radians on its x0 edge
//   createTrack() → { push(time, body), at(alpha) → { x, y, z, yaw }, speed(), velocity(out?), turn() }   pure:
//     a body between its last two steps; a jump of more than 3 m (a lift ride, a teleport) is drawn where it lands
//   playerAct({ crouch, sit, moving, aim, gun, blade, shotAgo, swungAgo }) → { base, upper }   pure: what the
//     player’s figure plays: sat in a seat, crouched still or crouch-walking, the gun held out while aiming and fired
//     for a moment after each shot, a blade’s stroke for a moment after each swing
//   roomsOf(stream) → { shown(roomId), built(roomId), dt }   what people.js is told of the rooms: drawn
//     while the stream shows them, standing from when they are built until the stream frees them (a
//     body is let go only then, so the two mustn’t be swapped: a door shut on the dead would take them)
//   createScene(renderer, { tier, small, station }) → { scene, camera, layout, ready, sync, hear, warm, resize, render, timeScale, tune, dispose }
//     sync(g, alpha, look?)   once a frame, after the game’s steps: g as rules/game.js keeps it
//       ({ side, you: body & { room, crouch, hp, gun, armour, hero, pitch? }, doors, time, crew?, combat? }),
//       alpha how far the frame is from the last step to the next; look: { yaw, pitch, view, aim } as
//       the module holds them (the mouse turns the eye every frame, not every step); without it, the
//       body’s yaw, level, third person. crew: rules/brains.js’s ({ people }), each person drawn;
//       combat: rules/combat.js’s ({ bolts }), every bolt in the air given to the effects, then they step
//     hear(events)   the game’s events drained since the last frame: the flashes, sparks and clashes they make
//     ready: settles once the rooms’ builders are in hand
//     warm(target?) → Promise   compiles the fight’s effects for where the scene is drawn (the bloom
//       chain’s buffer, or the screen without one), so the first shot doesn’t stall a frame
//     resize(w, h), render(), dispose() (puts the renderer’s tone mapping back as it found it)

import * as THREE from 'three';
import { houseOn } from '../../../../lib/three/houseNodes';
import { passable } from '../rules/doors';
import { buildLayout, offTags } from '../rules/layout';
import { seatOf } from '../rules/seats';
import { STATIONS } from '../rules/stations';
import { CAMERA, cameraPose, wallHits } from './camera';
import { createCinematics } from './cinematics';
import { colliderFor } from './fall';
import { loadPerson, motionOf, playerKind } from './figures';
import { createFx } from './fx';
import { createKit } from './kit';
import { createPeople } from './people';
import { createShow } from './show';
import { createStream } from './stream';
import { createFeel, feelGroups } from '../../../../lib/three/feel';
import { createSpring } from '../../../../lib/spring';
import { prefersReducedMotion } from '../../../../lib/hooks';

const STEP = 1 / 30; // the game’s step (rules/game.js)
const JUMP = 3; // metres between two steps that are a ride or a teleport, not a stride
const EASE_OUT = 3; // metres a second the camera eases back out once a wall is passed
const FOV = 70; // degrees, top to bottom, on a screen wider than tall
const THICK = { slide: 0.08, hatch: 0.1, blast: 0.3 }; // a leaf’s thickness
const LEAF = { color: 0x666b72, roughness: 0.42, metalness: 0.45 }; // the leaves’ grey: lighter than the trim, darker than the walls
const SWING = (100 * Math.PI) / 180; // how far an open hatch has turned on its hinge: past square, back towards the wall
const TINY = 1e-3; // metres: a leaf thinner than this has gone into the wall
// frames between walks of the scene for what has come into it since: the
// node house has no frame guard to put the look on a thing before it is
// first drawn, so what comes in late (the Falcon, a loaded prop) is in the
// look within a few frames, not half a second
const ADOPT_EVERY = 4;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function leafPlaces(door, open) {
  const { w, h } = door;
  const k = clamp(open ?? 0, 0, 1);
  const rects = [];
  if (door.kind === 'arch') return rects;
  if (door.kind === 'slide') {
    const s = (k * w) / 2;
    // each half slides out by s; what has gone past the jamb is in the wall
    rects.push({ x0: -w / 2, x1: 0 - s, y0: 0, y1: h, lead: 'x1' }, { x0: 0 + s, x1: w / 2, y0: 0, y1: h, lead: 'x0' });
  } else if (door.kind === 'hatch') {
    // a hatch is one leaf hung on its x0 edge: it turns out of the way whole, so it is always there
    rects.push({ x0: -w / 2, x1: w / 2, y0: 0, y1: h, lead: 'x1', swing: k * SWING });
  } else rects.push({ x0: -w / 2, x1: w / 2, y0: k * h, y1: h, lead: 'y0' });
  return rects.filter((r) => r.x1 - r.x0 > TINY && r.y1 - r.y0 > TINY);
}

export function createTrack() {
  let prev = null;
  let cur = null;
  const snap = (time, b) => ({ time, x: b.x, y: b.y, z: b.z, yaw: b.yaw ?? 0 });
  return {
    push(time, body) {
      if (cur && time === cur.time) return;
      const next = snap(time, body);
      // a new game (time going back), a ride or a teleport: drawn where it is, not swept there
      const jumped = !cur || time < cur.time || Math.hypot(next.x - cur.x, next.y - cur.y, next.z - cur.z) > JUMP;
      prev = jumped ? next : cur;
      cur = next;
    },
    at(alpha) {
      if (!cur) return { x: 0, y: 0, z: 0, yaw: 0 };
      const a = clamp(alpha, 0, 1);
      return { x: prev.x + (cur.x - prev.x) * a, y: prev.y + (cur.y - prev.y) * a, z: prev.z + (cur.z - prev.z) * a, yaw: prev.yaw + wrap(cur.yaw - prev.yaw) * a };
    },
    speed() {
      if (!cur || cur.time <= prev.time) return 0;
      return Math.hypot(cur.x - prev.x, cur.z - prev.z) / (cur.time - prev.time);
    },
    // the way it is going (m/s, in the world) and how fast it turns (rad/s, + towards +x)
    velocity(o = { x: 0, z: 0 }) {
      const dt = cur && cur.time > prev.time ? cur.time - prev.time : 0;
      return Object.assign(o, dt ? { x: (cur.x - prev.x) / dt, z: (cur.z - prev.z) / dt } : { x: 0, z: 0 });
    },
    turn() {
      return cur && cur.time > prev.time ? wrap(cur.yaw - prev.yaw) / (cur.time - prev.time) : 0;
    },
  };
}

const SHOT = 0.35; // seconds the player’s figure fires for after a shot
const AHEAD = 2.6; // metres past you in the view a friend standing in it is faded
const STROKE = 0.55; // seconds a blade’s stroke plays for after a swing
const STROKES = ['sword.a', 'sword.b', 'sword.c']; // the strokes, in turn
const CROUCH_PACE = 1.0; // metres a second the crouch walk covers at its own speed
// the station shaking while it comes apart (rules/breach.js): a tremor's jolt, easing off, over a
// tremble that never stops while it goes
const QUAKE_MOST = 0.07; // metres the biggest tremor moves the camera
const QUAKE_FOR = 1.3; // seconds a tremor shakes it
const TREMBLE = 0.006; // metres it trembles by all the while
// a hit on you this hard (combat.js's knock: the DL-44's) jolts the view and
// holds the game a moment
export const HEAVY = { from: 25, stop: 70 };
// a landing's squat: set at once by the speed it hit at (× per, to max),
// rung back on a spring (the plan's k 120, c 8); a step down under `from`
// m/s is nothing
const SQUAT = { per: 0.025, max: 0.3, from: 3 };

export function playerAct({ crouch = false, sit = false, moving = false, aim = false, gun = null, blade = null, shotAgo = Infinity, swungAgo = Infinity } = {}) {
  if (sit) return { base: 'sit.idle', upper: null };
  const base = crouch ? (moving ? 'crouch.walk' : 'crouch') : null;
  let upper = null;
  if (blade && !gun) upper = swungAgo < STROKE ? 'stroke' : null;
  else if (gun) upper = shotAgo < SHOT ? 'shoot.pistol' : aim ? 'aim.pistol' : null;
  return { base, upper };
}

export function roomsOf(stream) {
  return {
    shown: (id) => stream.built.get(id)?.group.visible ?? false,
    built: (id) => stream.built.has(id),
    dt: 0,
  };
}

export function createScene(renderer, { tier = 'high', small = false, station = 'ds1' } = {}) {
  const layout = buildLayout(STATIONS[station] ?? STATIONS.ds1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 2000);
  // a faint cool fill under the lamps, so a face turned from every lamp
  // isn’t lost, and the house look has a sky light to take its shade from
  const hemi = new THREE.HemisphereLight(0x9aa6b8, 0x0d0f13, 0.35);
  scene.add(hemi);
  const was = { toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure };
  renderer.toneMappingExposure = 1;
  const house = houseOn({ renderer, scene, hemi, look: { fog: false } });
  const kit = createKit(renderer, { tier, small });
  const stream = createStream(kit, layout, scene, { renderer, tier, small });
  const rooms = roomsOf(stream);
  // (each figure and gun takes the house look as it comes into the scene, before it is first drawn)
  const people = createPeople(scene, kit, { tier, renderer, adopt: house.adopt, layout });
  const fx = createFx(scene, { small });
  const show = createShow(scene, { renderer, tier, layout, people, fx });
  // (the stories' scenes: `person` is the player's figure as it is when one plays)
  const cine = createCinematics({ people, layout, show, fx, scene, you: () => person });
  const leafMat = new THREE.MeshStandardMaterial(LEAF);
  // every leaf’s body and edge, a unit cube scaled to its part
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const leaves = new Map(); // doorId → { group, parts: [{ body, edge }] }
  const track = createTrack();
  let person = null;
  let wanted = null; // the kind the player should be drawn as
  let downed = false;
  let downAt = -Infinity;
  let held = CAMERA.back; // how far behind the shoulder the camera stood last frame
  // what the player’s figure plays (playerAct’s), and when it last fired or swung, by the game’s clock
  const played = { base: undefined, upper: undefined, stroke: 0 };
  let shotAt = -Infinity;
  let swungAt = -Infinity;
  let quake = 0; // metres of shake a tremor has left
  // every shake (a tremor, the tremble, a heavy hit on you) on the one feel:
  // trauma², at most QUAKE_MOST metres, held still under reduced motion (the
  // feel reads it), and the hitstop the module's loop slows its steps by
  const feel = createFeel({ offset: QUAKE_MOST, baseFov: camera.fov });
  const squat = createSpring({ k: 120, c: 8, max: SQUAT.max });
  const still = prefersReducedMotion(); // (no squat under reduced motion)
  let inScene = false; // whether a scene had the camera last frame
  let lit = false; // whether the Emperor's lightning was drawn on you last frame
  let armrest = null; // Luke's saber on the throne's armrest, once it is taken
  const vel = { x: 0, z: 0 };
  let shown = -1; // the last displayed time
  let frames = 0;
  let seenRooms = -1;
  let disposed = false;

  // ── the player ──

  function becomes(kind) {
    if (kind === wanted) return;
    wanted = kind;
    loadPerson(kind, { renderer })
      .then((p) => {
        if (disposed || wanted !== kind) return p.dispose();
        person?.dispose();
        person = p;
        downed = false;
        // (a new figure has played nothing yet)
        played.base = played.upper = undefined;
        scene.add(p.object);
        house.adopt(p.object);
      })
      .catch((err) => console.error(`Aboard the Death Star: the player’s figure (${kind}) didn’t load`, err));
  }

  // ── the doors’ leaves ──

  // One leaf a moving part: a box for its body, scaled each frame to the
  // part still in the doorway, and a dark seam (a sliding door’s meeting
  // edge, a hatch’s free edge) or a lip (a dropping door’s foot) riding its
  // leading edge. Both hang from a pivot on the leaf’s x0 edge, which only
  // a hatch turns.
  function leavesFor(door) {
    const group = new THREE.Group();
    group.name = `door-${door.id}`;
    group.position.set(door.x, door.y, door.z);
    group.rotation.y = door.axis === 'z' ? Math.PI / 2 : 0;
    const t = THICK[door.kind] ?? THICK.slide;
    const parts = leafPlaces(door, 0).map(({ lead }) => {
      const pivot = new THREE.Group();
      const body = new THREE.Mesh(unitBox, leafMat);
      body.scale.z = t;
      const edge = new THREE.Mesh(unitBox, kit.mat(door.kind === 'blast' ? 'trim' : 'black'));
      edge.scale.z = t + 0.02;
      pivot.add(body, edge);
      group.add(pivot);
      return { lead, pivot, body, edge };
    });
    scene.add(group);
    house.adopt(group);
    return { group, parts };
  }

  function placeLeaves(door, entry, open) {
    const rects = leafPlaces(door, open);
    for (const { lead, pivot, body, edge } of entry.parts) {
      const r = rects.find((q) => q.lead === lead);
      pivot.visible = Boolean(r);
      if (!r) continue;
      const [w, h, t] = [r.x1 - r.x0, r.y1 - r.y0, body.scale.z];
      pivot.position.x = r.x0;
      pivot.rotation.y = r.swing ?? 0;
      body.scale.set(w, h, t);
      body.position.set(w / 2, (r.y0 + r.y1) / 2, 0);
      if (lead === 'y0') {
        const lip = Math.min(0.12, h);
        edge.scale.set(w, lip, t + 0.02);
        edge.position.set(w / 2, r.y0 + lip / 2, 0);
      } else {
        const seam = Math.min(0.03, w);
        edge.scale.set(seam, h, t + 0.02);
        edge.position.set(lead === 'x1' ? w - seam / 2 : seam / 2, body.position.y, 0);
      }
    }
  }

  function dropLeaves(id) {
    leaves.get(id).group.removeFromParent();
    leaves.delete(id);
  }

  function syncLeaves(doors) {
    for (const door of layout.doors.values()) {
      if (door.kind === 'arch') continue;
      const near = stream.built.has(door.a) || stream.built.has(door.b);
      if (!near) {
        if (leaves.has(door.id)) dropLeaves(door.id);
        continue;
      }
      if (!leaves.has(door.id)) leaves.set(door.id, leavesFor(door));
      const entry = leaves.get(door.id);
      entry.group.visible = rooms.shown(door.a) || rooms.shown(door.b);
      if (entry.group.visible) placeLeaves(door, entry, doors?.[door.id]?.open ?? 0);
    }
  }

  // ── a frame ──

  function sync(g, alpha = 1, look = {}) {
    if (disposed || !g?.you) return;
    const you = g.you;
    const time = g.time ?? performance.now() / 1000;
    track.push(time, you);
    const now = time - STEP * (1 - clamp(alpha, 0, 1));
    const dt = shown < 0 ? 0 : clamp(now - shown, 0, 0.25);
    shown = now;
    const at = track.at(alpha);
    const yaw = look.yaw ?? you.yaw ?? 0;
    const pitch = look.pitch ?? you.pitch ?? 0;
    const view = look.view ?? g.view ?? 'third';
    const aim = Boolean(look.aim);

    // the camera: snapped in to a wall at once, eased back out after it
    const hits = wallHits(layout, (id) => passable(g.doors, id), (room) => g.solidsOf?.(room) ?? []);
    // (sat down, the eyes are about as low as crouched)
    const low = Boolean(you.crouch || you.seat);
    const pose = cameraPose({ ...at, crouch: low }, { view, yaw, pitch, aim, reach: view === 'first' ? Infinity : held + EASE_OUT * dt }, hits);
    held = view === 'first' ? 0 : pose.dist;
    camera.position.set(pose.pos.x, pose.pos.y, pose.pos.z);
    camera.lookAt(pose.look.x, pose.look.y, pose.look.z);
    // a story's scene takes the camera for its shots
    const shot = cine.sync(g, dt);
    // (a scene over: whatever it had your figure play, it takes up again what you are doing)
    if (inScene && !shot) played.base = played.upper = undefined;
    inScene = Boolean(shot);
    if (shot) {
      camera.position.set(shot.pos.x, shot.pos.y, shot.pos.z);
      camera.lookAt(shot.look.x, shot.look.y, shot.look.z);
    }
    // the Emperor's lightning on you in a fight (rules/play/duel.js), from his hands to your chest
    const caster = !shot && g.duel?.lit ? g.crew?.byId.get(g.duel.lit) : null;
    if (caster) {
      show.lightning?.({ x: caster.x, y: caster.y + 1.3, z: caster.z }, { x: you.x, y: you.y + 1.2, z: you.z }, true);
      lit = true;
    } else if (lit) {
      show.lightning?.(null, null, false);
      lit = false;
    }
    // (metres of shake as the trauma that moves the camera that far: held at least that)
    const shake = quake + (g.flags?.has('breach') ? TREMBLE : 0);
    const want = Math.sqrt(Math.min(1, shake / QUAKE_MOST));
    const has = feel.state().trauma;
    if (want > has) feel.trauma(want - has);
    feel.setBaseFov(camera.fov);
    feel.update(dt, camera);
    quake = Math.max(0, quake - (QUAKE_MOST / QUAKE_FOR) * dt);

    // Luke's saber gone from the throne's armrest once it is taken: by you, or pulled to Luke by the Force
    // (and back on it if a checkpoint goes back to before)
    const taken = Boolean(g.items?.has('saber'));
    if (taken && !armrest?.parent) armrest = scene.getObjectByName('armrest-saber') ?? null;
    if (armrest) armrest.visible = !taken;

    becomes(playerKind({ side: g.side ?? you.side, hero: you.hero, armour: you.armour }));
    if (person) {
      const o = person.object;
      // (where you stand, or where a scene has swung you)
      const drawn = cine.youAt ?? at;
      o.position.set(drawn.x, drawn.y, drawn.z);
      o.rotation.y = -drawn.yaw;
      // (its feet at its origin: the squat is about them)
      const q = squat.step(dt);
      o.scale.set(1 + q / 2, 1 - q, 1 + q / 2);
      // (in first person the eye is inside the head; a scene's camera sees you)
      o.visible = (view !== 'first' || Boolean(shot)) && !cine.hidesYou;
      person.hold(you.gun ?? null);
      person.setAim(wrap(yaw - at.yaw), pitch, aim || now - shotAt < SHOT);
      if ((you.hp ?? 1) <= 0 && !downed) {
        person.play('die');
        downAt = now;
      }
      // down a moment on the fall clip, then a ragdoll on the deck; up again, the clips take over
      if (downed && !person.fallen && now - downAt > 0.15) person.fall?.({ collide: colliderFor(layout, { room: you.room, at: you, off: offTags(layout, g.flags ?? new Set()), open: (id) => passable(g.doors, id) }), push: { x: -Math.sin(at.yaw), y: 0, z: Math.cos(at.yaw) }, speed: 2 });
      if ((you.hp ?? 1) > 0 && downed) {
        person.rise?.();
        person.play(null);
      }
      downed = (you.hp ?? 1) <= 0;
      const speed = track.speed();
      const want = playerAct({ crouch: you.crouch, sit: Boolean(you.seat), moving: speed > 0.3, aim, gun: you.gun ?? null, blade: you.blade ?? null, shotAgo: now - shotAt, swungAgo: now - swungAt });
      if (want.base !== played.base) person.base(want.base);
      if (want.base === 'crouch.walk' && person.anim?.actions['crouch.walk']) person.anim.actions['crouch.walk'].timeScale = speed / CROUCH_PACE;
      if (want.upper !== played.upper || (want.upper === 'stroke' && played.stroke !== swungAt)) {
        if (want.upper === 'stroke') {
          // each swing the next of the strokes, from its start
          played.stroke = swungAt;
          played.n = ((played.n ?? -1) + 1) % STROKES.length;
          person.play(STROKES[played.n], { layer: 'upper' });
        } else if (want.upper) person.play(want.upper, { layer: 'upper', loop: true });
        else person.stop('upper');
      }
      Object.assign(played, { base: want.base, upper: want.upper });
      // the walk paced to where the body goes, ahead and aside of where it faces
      const v = track.velocity(vel);
      const [fx, fz] = [Math.sin(at.yaw), -Math.cos(at.yaw)];
      person.update(dt, downed ? 0 : motionOf(v.x * fx + v.z * fz, v.x * -fz + v.z * fx, -track.turn()));
    }

    stream.update(you.room, (id) => (g.doors?.[id]?.open ?? 0) > 0, now, dt, { eye: camera.position, g });
    // the people after the stream, so they are drawn in the rooms as it now has them; every bolt
    // in the air given before the effects step (one not given again is gone)
    rooms.dt = dt;
    // (the doors and the bridges as they are, for the dead to fall against)
    rooms.open = (id) => passable(g.doors, id);
    rooms.off = offTags(layout, g.flags ?? new Set());
    // (and the camera and your chest, so anyone between them is faded out of the way; none in first person)
    rooms.camera = view === 'first' && !shot ? null : camera.position;
    rooms.focus = { x: at.x, y: at.y + (low ? 0.9 : 1.3), z: at.z };
    rooms.ahead = { x: at.x + Math.sin(yaw) * AHEAD, y: rooms.focus.y, z: at.z - Math.cos(yaw) * AHEAD };
    rooms.side = g.side ?? you.side;
    rooms.seatOf = (p) => seatOf(g, p);
    if (g.crew) people.sync(g.crew, alpha, camera.position, rooms);
    for (const b of g.combat?.bolts ?? []) fx.bolt(b);
    fx.update(dt);
    show.sync({ g, at, yaw, crouch: you.crouch, rooms, dt, t: now, hand: person && person.object.visible && !person.fallen ? person.hand : null });
    // a room just built, the Falcon berthed late, a reflection made again:
    // each brings materials the house look hasn’t met (adopting is once a
    // material: a walk past what it has met is cheap)
    if (frames++ % ADOPT_EVERY === 0 || stream.built.size !== seenRooms) {
      seenRooms = stream.built.size;
      house.adopt(scene);
    }
    syncLeaves(g.doors);
  }

  function resize(w, h) {
    const aspect = Math.max(1e-3, w / Math.max(1, h));
    camera.aspect = aspect;
    // on a screen taller than wide, as much to either side as a wide one shows
    const half = (FOV / 2) * (Math.PI / 180);
    camera.fov = aspect >= 1 ? FOV : Math.min(100, (2 * Math.atan(Math.tan(half) / aspect) * 180) / Math.PI);
    camera.updateProjectionMatrix();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    person?.dispose();
    person = null;
    cine.dispose();
    people.dispose();
    show.dispose();
    fx.dispose();
    for (const id of [...leaves.keys()]) dropLeaves(id);
    stream.dispose();
    kit.dispose();
    leafMat.dispose();
    unitBox.dispose();
    scene.remove(hemi);
    renderer.toneMapping = was.toneMapping;
    renderer.toneMappingExposure = was.exposure;
  }

  const warm = (target = null) => Promise.all([fx.warm(renderer, camera, target), show.warm(renderer, camera, target)]);
  // the game’s events since the last frame, for the flashes, sparks and clashes they make
  const hear = (events) => {
    if (disposed) return;
    show.hear(events);
    people.hear(events);
    for (const e of events ?? []) {
      if (e.type === 'quake') quake = Math.max(quake, QUAKE_MOST * (e.size ?? 1));
      if (e.type === 'land' && !still && e.speed > SQUAT.from) squat.x = Math.min(SQUAT.max, e.speed * SQUAT.per);
      if (e.type === 'hurt' && (e.amount ?? 0) >= HEAVY.from) {
        feel.trauma(Math.min(0.8, e.amount / 60));
        feel.hitstop(HEAVY.stop);
      }
      if (e.by !== 'you') continue;
      if (e.type === 'shot') shotAt = shown;
      else if (e.type === 'swing') swungAt = shown;
    }
  };

  // timeScale(dt): the share of a frame the game runs (the module's loop takes it, once a frame: a
  // hitstop slows the steps); tune(): the ?debug panel's groups
  return { scene, camera, layout, ready: stream.ready, sync, hear, warm, resize, render: () => renderer.render(scene, camera), timeScale: (dt) => feel.timeScale(dt), tune: () => feelGroups(feel), dispose };
}
