// The stories’ scenes, drawn: while the game plays a scene (rules/play/
// plot.js’s g.scene, its seconds SCENE_SECONDS’s), the camera leaves your
// shoulder for its shots, framed on the story’s own spots and people; the
// people in it play what the beat has them do (Ben and Vader’s duel, the
// Emperor’s lightning and his fall down the shaft, a father unmasked); the
// Falcon comes in on the tractor beam and goes out through the field, the
// Lambda sets down and lifts off; and the superlaser and the reactor flash
// where the scene says. The rules decide when a scene starts and ends; this
// only shows it, and lets everything go as it found it when it is over.
//
//   SCENES[id] → { shots: [shot], acts?: [act], ship?: { name, how }, flashes?: [flash] }
//     shot: { s, at, from, to, look?, lift? }: s seconds; at: the place it is framed on; from, to:
//       the camera at the shot’s start and end as [right, up, back] metres in that place’s own frame
//       (its yaw: back is behind where it faces); look: the place looked at (at, else); lift: how
//       high over it
//     place: { spot } | { tag } (someone the story spawned, by tag) | { you: true }
//     act: { tag, t, side?, play?, base?, loop?, face?, fall?, gone?, hide?, swing? }: on everyone the
//       story tags so (or 'you'), t seconds in, in that side's story only if it says; face: a tag to turn to; fall: let go as a ragdoll pushed
//       { x, y, z } (up the way they face, +y up); gone: out of the scene for good; hide: out of
//       sight, or back; swing: { from?, to: place, s, sag, side?, apart? } across on a line from a
//       pipe overhead, s seconds from `from` (where they stand, if it doesn't say: the jump that
//       starts a swing has put you across already) to `to`, dipping `sag` metres at the bottom of
//       it, `side` metres to the right of the way (and each one more after the first `apart` further)
//     ship: name 'falcon' | 'lambda'; how 'in' (from out past its spot down onto it) | 'out' (off it
//       and away) | 'down' (from above onto its pad) | 'up' (off its pad and away); near: the place
//       whose ship it is, where there are more than one
//     clips?, cast?: a scene of the game's own clips (lib/three/scenePlayer.js's, by id) and
//       { role: tag } who plays each role; a role nobody here plays is skipped, as is anyone
//       on another rig than the game's (none of the inside's people are on it yet)
//     flash: { t, at: place, ahead?, colour, size }   a flare of light (and, with size, an explosion)
//     beam: { t0, t1, at: place, from, to, colour, width }   a shaft of light from and to [right, up, back]
//       in the place's frame, lit from t0 to t1 seconds in, flickering (the superlaser)
//   frameOf(place) → { x, y, z, yaw }   pure, from a place resolved by `where`
//   offsetIn(frame, [right, up, back]) → { x, y, z }   pure
//   shotAt(scene, t) → { shot, k } | null   pure: the shot t seconds in, and how far through it (0…1)
//   ease(k) → 0…1   pure: in and out
//   swingAt(swing, t) → { x, y, z } | null   pure: where a swing has its swinger t seconds after it began
//   createCinematics({ people, layout, show, fx, scene, you }) → { sync(g, dt) → pose | null, playing, youAt, hidesYou, dispose() }
//     youAt: where your figure is drawn while a scene swings you across, null otherwise
//     you() → the player's figure, for the acts tagged 'you'
//     pose: { pos, look } the camera’s this frame while a scene plays, null otherwise

import * as THREE from 'three';
import { loadScene, playScene } from '../../../../lib/three/scenePlayer';

const EYE = 1.5; // metres over a spot or a person a shot looks at, unless it says
const SHIP_RISE = 14; // metres a ship comes down from or goes up to
const SHIP_RUN = 70; // metres it travels out to or in from
const PIPE = 3.2; // metres the pipe a swing's line hangs from is over the swingers' hands at the start
const GRIP = 2.05; // metres over a swinger's feet their hands are, on the line
const ROPE_R = 0.012; // metres: the line's thickness, a grapple's cord
const UP = new THREE.Vector3(0, 1, 0);
const ropeDir = new THREE.Vector3();

export const SCENES = {
  // the freighter drawn in on the beam, seen from the ranks on the deck
  tractor: {
    shots: [
      { s: 4, at: { spot: 'ranks' }, from: [2, 1.6, 4], to: [1, 2.2, 2], look: { spot: 'falcon' }, lift: 3 },
      { s: 4, at: { spot: 'ranks' }, from: [-3, 3.2, 9], to: [-1, 2.4, 6], look: { spot: 'falcon' }, lift: 2 },
    ],
    ship: { name: 'falcon', how: 'in' },
  },
  // Ben and Vader, blade on blade in the bay; Ben lifts his and is gone
  duel: {
    // (framed on the duel's spot, which faces out across the bay: Vader stands on it and Ben a
    // step to its right, so the camera keeps in front, on the open deck, and along their line)
    shots: [
      { s: 4, at: { spot: 'duel' }, from: [0.6, 1.9, -6.5], to: [0.6, 1.6, -4.6], lift: 1.3 },
      { s: 3, at: { spot: 'duel' }, from: [-1.5, 1.95, -0.7], to: [-1.3, 1.9, -0.9], look: { tag: 'duel-obiwan' }, lift: 1.55 },
      { s: 3, at: { spot: 'duel' }, from: [2.7, 1.7, -1], to: [3, 1.75, -1.4], look: { tag: 'duel-vader' }, lift: 1.7 },
    ],
    acts: [
      { tag: 'duel-obiwan', t: 0, face: 'duel-vader', base: 'stance' },
      { tag: 'duel-vader', t: 0, face: 'duel-obiwan', base: 'stance' },
      { tag: 'duel-vader', t: 0.6, play: 'sword.heavy' },
      { tag: 'duel-obiwan', t: 0.9, play: 'sword.block' },
      { tag: 'duel-obiwan', t: 2.2, play: 'sword.a' },
      { tag: 'duel-vader', t: 2.5, play: 'sword.block' },
      { tag: 'duel-vader', t: 3.8, play: 'sword.b' },
      { tag: 'duel-obiwan', t: 4.1, play: 'parry' },
      { tag: 'duel-obiwan', t: 6.2, base: null, play: 'idle.calm', loop: true },
      { tag: 'duel-vader', t: 7.4, play: 'sword.heavy' },
      { tag: 'duel-obiwan', t: 7.9, gone: true },
    ],
  },
  // across the chasm on the grapple’s line
  // (from the chasm's side, along it, as they swing out over it on Luke's line and up on to the far side)
  swing: {
    // (the room is narrow across the chasm: from behind the ledge, off to its side, as they go out
    // over the drop, then from past the far ledge as they come up on to it)
    shots: [
      { s: 2.1, at: { spot: 'chasm-ledge' }, from: [3, 1.5, 1.8], to: [3.1, 1.1, 1.1], lookAhead: 5, lift: -0.6 },
      { s: 1.9, at: { spot: 'chasm-far' }, from: [3.2, 1.1, -2.2], to: [3, 1.3, -2], lookAhead: -3, lift: 0.4 },
    ],
    acts: [
      { tag: 'you', t: 0.5, side: 'rebel', swing: { from: { spot: 'chasm-ledge' }, to: { spot: 'chasm-far' }, s: 2.6, sag: 2.4 } },
      { tag: 'with:leia', t: 0.5, swing: { from: { spot: 'chasm-ledge' }, to: { spot: 'chasm-far' }, s: 2.6, sag: 2.4, side: 0.35 } },
      // (the Imperial story sees the two of them go across from the upper ledge)
      { tag: 'chasm-pair', t: 0.5, swing: { from: { spot: 'chasm-ledge' }, to: { spot: 'chasm-far' }, s: 2.6, sag: 2.4, apart: 0.35 } },
    ],
  },
  // the freighter lifts off and goes out through the field
  escape: {
    shots: [
      { s: 3, at: { spot: 'falcon' }, from: [-12, 2.5, 18], to: [-14, 2, 20], lift: 3 },
      { s: 5, at: { spot: 'falcon' }, from: [8, 3, -24], to: [6, 2, -28], lift: 4 },
    ],
    ship: { name: 'falcon', how: 'out' },
    // (a Rebel is aboard, and the crew with you; the Empire's man sees it go from the deck)
    acts: [{ tag: 'you', t: 0, hide: true, side: 'rebel' }, ...['han', 'chewie', 'leia', 'luke', 'threepio', 'artoo'].map((k) => ({ tag: `with:${k}`, t: 0, hide: true }))],
  },
  // Vader's shuttle sets down in the dock
  arrive2: {
    shots: [
      { s: 4, at: { spot: 'vader-arrive' }, from: [6, 1.5, 6], to: [4, 1.7, 8], look: { spot: 'dock-ramp' }, lift: 4 },
      { s: 4, at: { spot: 'dock-ramp' }, from: [3, 1.6, 4], to: [2, 1.6, 3] },
    ],
    ship: { name: 'lambda', how: 'down', near: { spot: 'dock-ramp' } },
    // (aboard while it comes down: out on the ramp once it is down; the Empire's man is at his
    // console, and sees Vader come out)
    acts: [
      { tag: 'you', t: 0, hide: true, side: 'rebel' },
      { tag: 'vader', t: 0, hide: true },
      { tag: 'guards', t: 0, hide: true },
      { tag: 'you', t: 4, hide: false, side: 'rebel' },
      { tag: 'vader', t: 4, hide: false },
      { tag: 'guards', t: 4, hide: false },
    ],
  },
  // up the Emperor's tower, in the car with your father
  tower: { shots: [{ s: 6, at: { you: true }, from: [1.2, 1.8, 1.6], to: [0.8, 1.7, 1.2], lift: 1.6 }] },
  // the lightning, and Vader turning on his master
  throw: {
    shots: [
      { s: 3, at: { tag: 'emperor' }, from: [2, 1.4, 3], to: [1.4, 1.5, 2.4] },
      { s: 3, at: { spot: 'shaft-edge' }, from: [-4, 3, 5], to: [-3, 1.5, 4], lift: 0.5 },
    ],
    acts: [
      { tag: 'emperor', t: 0, play: 'cast.double', loop: true, lightning: 'you' },
      { tag: 'you', t: 0, play: 'electrocuted', loop: true },
      { tag: 'vader', t: 2.4, play: 'throw' },
      { tag: 'you', t: 2.9, play: 'kneel' },
      { tag: 'emperor', t: 2.9, play: 'lifted', loop: true, lightning: null },
      { tag: 'emperor', t: 3.6, fall: { x: 0, y: 4, z: 2 } },
    ],
    flashes: [{ t: 5.2, at: { spot: 'shaft-edge' }, colour: 0x8fb8ff, size: 2 }],
  },
  // at the ramp's foot, the mask off
  mask: {
    // (he sits on the ramp's foot facing out, you kneel in front of him, both under the shuttle's
    // nose: the camera keeps low at their sides, first his right, then across from his left)
    shots: [
      { s: 5, at: { tag: 'vader' }, from: [1.7, 0.8, -1.1], to: [1.3, 0.75, -0.8], lift: 0.75 },
      { s: 5, at: { tag: 'vader' }, from: [-2.3, 1.1, -1.3], to: [-1.9, 1, -1.1], lift: 0.7 },
    ],
    acts: [
      { tag: 'vader', t: 0, base: 'sit.ground' },
      { tag: 'you', t: 0, base: 'kneel' },
    ],
  },
  // the Emperor comes down the aisle between the ranks
  emperor: {
    shots: [
      { s: 5, at: { spot: 'emperor-ramp' }, from: [6, 1.2, -6], to: [5, 1.3, -10], look: { tag: 'procession' } },
      { s: 5, at: { tag: 'procession' }, from: [-2.5, 1.4, -4], to: [-2, 1.5, -2.6] },
    ],
  },
  // the superlaser fires on a cruiser in the window
  cruiser: {
    shots: [{ s: 6, at: { spot: 'firing-switch' }, from: [1.5, 1.8, 2.5], to: [0.8, 1.7, 1.6], lift: 1.6, lookAhead: 40 }],
    // (out past the window: the beam from under the station's dish to the cruiser, and where it lands)
    beams: [{ t0: 1.3, t1: 2.9, at: { spot: 'firing-switch' }, from: [-6, -14, -70], to: [30, 26, -420], colour: 0x5dff7a, width: 1.6 }],
    flashes: [
      { t: 1.4, at: { spot: 'firing-switch' }, ahead: 60, colour: 0x5dff7a },
      { t: 2.8, at: { spot: 'firing-switch' }, ahead: 380, colour: 0xffc070, size: 40 },
    ],
  },
  // out of the dock as the station goes up
  escape2: {
    // (from the dock's east side by its open mouth, clear of ST 321 on the next pad, as the
    // shuttle lifts and goes out past)
    shots: [{ s: 8, at: { spot: 'escape-shuttle' }, from: [-8, 3, -12], to: [-9, 4, -13], lift: 5 }],
    ship: { name: 'lambda', how: 'up', near: { spot: 'escape-shuttle' } },
    // (you're aboard, and your father with you)
    acts: [
      { tag: 'you', t: 0, hide: true },
      { tag: 'vader', t: 0, gone: true },
    ],
    flashes: [
      { t: 1, at: { spot: 'dock-ramp' }, colour: 0xffa040, size: 3 },
      { t: 3.2, at: { spot: 'vader-arrive' }, colour: 0xffd090, size: 4 },
      { t: 5.5, at: { spot: 'shuttle-ramp' }, colour: 0xffffff, size: 5 },
    ],
  },
};

export const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export function frameOf(p) {
  return p ? { x: p.x, y: p.y ?? 0, z: p.z, yaw: p.yaw ?? 0 } : null;
}

export function offsetIn(f, [right, up, back]) {
  const s = Math.sin(f.yaw);
  const c = Math.cos(f.yaw);
  // forward (sin, −cos), right (cos, sin): back is minus forward
  return { x: f.x + c * right - s * back, y: f.y + up, z: f.z + s * right + c * back };
}

export function shotAt(scene, t) {
  if (!scene?.shots?.length) return null;
  let from = 0;
  for (const shot of scene.shots) {
    if (t < from + shot.s) return { shot, k: Math.max(0, (t - from) / shot.s) };
    from += shot.s;
  }
  const last = scene.shots.at(-1);
  return { shot: last, k: 1 };
}

const lerp = (a, b, k) => a + (b - a) * k;

// out from the ledge and up to the far one as a pendulum goes, fastest at the bottom of the dip
export function swingAt(w, t) {
  if (!w) return null;
  const k = Math.min(1, Math.max(0, (t - w.t0) / w.s));
  const u = (1 - Math.cos(Math.PI * k)) / 2;
  return { x: lerp(w.from.x, w.to.x, u), y: lerp(w.from.y, w.to.y, u) - w.sag * Math.sin(Math.PI * u), z: lerp(w.from.z, w.to.z, u) };
}

export function createCinematics({ people, layout, show = null, fx = null, scene: world, you = null }) {
  let playing = null; // { id, spec, t, done: Set(act index), ship, flashes }
  let hidingYou = false; // a scene's say that your own figure is out of it (aboard the shuttle)
  let swungYou = null; // where your figure is while a swing carries it, { x, y, z, yaw }
  const pose = { pos: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 0 } };

  // a place, in the station: a spot (on its floor), someone by tag (where they are drawn), or you
  function where(place, g) {
    if (!place) return null;
    if (place.you) return { x: g.you.x, y: g.you.y, z: g.you.z, yaw: g.you.yaw };
    if (place.spot) {
      const s = layout.station.spots?.[place.spot];
      if (!s) return null;
      return { x: s.x, y: layout.floorAt(s.room, s.x, s.z) ?? layout.rooms.get(s.room)?.y ?? 0, z: s.z, yaw: s.yaw ?? 0 };
    }
    if (place.tag) {
      const p = g.crew?.people.find((q) => q.tag === place.tag && q.hp > 0) ?? g.crew?.people.find((q) => q.tag === place.tag);
      return p ? { x: p.x, y: p.y ?? 0, z: p.z, yaw: p.yaw ?? 0 } : null;
    }
    return null;
  }

  // the actors by the story's tag (everyone it tags so: the Royal Guards are two), or you
  const figuresOf = (tag, g) => {
    if (tag === 'you') return [{ p: { ...g.you, id: 'you' }, fig: you?.() ?? null, you: true }];
    return (g.crew?.people ?? []).filter((q) => q.tag === tag).map((p) => ({ p, fig: people.figure?.(p.id) ?? null }));
  };

  // the ship's holder in the scene, and where it stood, to fly it from or to and put back
  // A camera where the shot puts it, unless that is in a wall, a ship or the furniture: then
  // pulled in towards what it looks at until it stands in a room and clear of every solid there
  function clearOf(g, at, look) {
    for (let k = 0; k <= 0.85; k += 0.05) {
      const p = { x: lerp(at.x, look.x, k), y: lerp(at.y, look.y, k), z: lerp(at.z, look.z, k) };
      const room = layout.roomAt(p.x, p.y, p.z);
      if (!room) continue;
      const solid = (g.solidsOf?.(room) ?? []).some((o) =>
        o.box ? p.x > o.box.x0 - 0.3 && p.x < o.box.x1 + 0.3 && p.z > o.box.z0 - 0.3 && p.z < o.box.z1 + 0.3 && p.y > (o.box.y0 ?? -Infinity) - 0.3 && p.y < (o.box.y1 ?? Infinity) + 0.3 : o.circle && Math.hypot(p.x - o.circle.x, p.z - o.circle.z) < o.circle.r + 0.3,
      );
      if (!solid) return p;
    }
    return at;
  }

  // the ship by name, the one nearest the scene's own place when there are more than one (two
  // Lambdas stand in the second station's dock)
  function shipOf(name, near) {
    let found = null;
    let best = Infinity;
    const p = new THREE.Vector3();
    world.traverse((o) => {
      if (o.name !== name) return;
      o.getWorldPosition(p);
      const d = near ? Math.hypot(p.x - near.x, p.z - near.z) : 0;
      if (d < best) {
        best = d;
        found = o;
      }
    });
    if (!found) return null;
    found.updateMatrixWorld(true);
    const home = found.position.clone();
    // the way out: to the room's open side (its arch on to the magnetic field), else the way the ship faces
    const w = found.getWorldPosition(home.clone());
    const room = layout.rooms.get(layout.roomAt(w.x, w.y + 1, w.z));
    const mouth = room?.doors.map((d) => layout.doors.get(d)).find((d) => d?.kind === 'arch' && layout.rooms.get(d.a === room.id ? d.b : d.a)?.kind === 'field');
    let out = mouth ? { x: mouth.x - w.x, z: mouth.z - w.z } : { x: -Math.sin(found.rotation.y), z: -Math.cos(found.rotation.y) };
    const l = Math.hypot(out.x, out.z) || 1;
    out = { x: out.x / l, z: out.z / l };
    let gear = null;
    world.traverse((o) => {
      if (!gear && o.name === `${name}-gear`) gear = o;
    });
    return { object: found, gear, home, out, wasVisible: found.visible };
  }

  function flyShip(ship, how, k) {
    const o = ship.object;
    // its landing gear (rooms/hangar.js's, beside the ship, not under it) only while it stands
    if (ship.gear) ship.gear.visible = how === 'in' || how === 'down' ? k > 0.92 : k < 0.12;
    const h = ship.home;
    const { x: fx, z: fz } = ship.out;
    const e = ease(k);
    if (how === 'in') {
      const away = 1 - e;
      o.position.set(h.x - fx * SHIP_RUN * away, h.y + SHIP_RISE * 0.3 * away * away, h.z - fz * SHIP_RUN * away);
    } else if (how === 'out') {
      const up = Math.min(1, k * 2.5);
      const go = Math.max(0, k * 1.4 - 0.4) ** 2;
      o.position.set(h.x + fx * SHIP_RUN * go, h.y + 3 * ease(up) + go * 6, h.z + fz * SHIP_RUN * go);
    } else if (how === 'down') {
      o.position.set(h.x, h.y + SHIP_RISE * (1 - e), h.z);
    } else if (how === 'up') {
      o.position.set(h.x + fx * SHIP_RUN * e * e, h.y + SHIP_RISE * e, h.z + fz * SHIP_RUN * e * e);
    }
    o.updateMatrixWorld(true);
  }

  function begin(id, g) {
    const spec = SCENES[id];
    const near = spec?.ship?.near ? where(spec.ship.near, g) : null;
    playing = spec ? { id, spec, t: 0, done: new Set(), flashes: new Set(), beams: new Map(), swings: [], ship: spec.ship ? shipOf(spec.ship.name, near) : null, lit: null, film: null } : null;
    // (a scene of the game's own clips, played on its cast by role: lib/three/scenePlayer.js)
    if (spec?.clips) {
      const run = playing;
      loadScene(spec.clips).then((sc) => {
        if (!sc || playing !== run) return;
        const cast = Object.fromEntries(Object.entries(spec.cast ?? {}).map(([role, tag]) => [role, figuresOf(tag, g)[0]?.fig ?? null]));
        run.film = playScene(sc, cast);
      });
    }
  }

  function end(g) {
    if (!playing) return;
    const { ship, spec } = playing;
    if (ship) {
      // in: parked where it was; out: gone with the scene, as the story has it
      if (spec.ship.how === 'in' || spec.ship.how === 'down') ship.object.position.copy(ship.home);
      else ship.object.visible = false;
      if (ship.gear) ship.gear.visible = spec.ship.how === 'in' || spec.ship.how === 'down';
      ship.object.updateMatrixWorld(true);
    }
    if (playing.lit) show?.lightning?.(playing.lit.from, playing.lit.to, false);
    playing.film?.stop();
    dropBeams();
    dropRopes();
    swungYou = null;
    // the actors back to what the rules have them doing
    for (const a of spec.acts ?? []) {
      if (a.side && g.side !== a.side) continue;
      for (const it of figuresOf(a.tag, g)) {
        if (it.you) {
          hidingYou = false;
          // (your figure's own base and upper body are put back by the scene's caller, as you are)
          it.fig?.stop?.('full');
          continue;
        }
        if (!it.fig) continue;
        it.fig.base?.(null);
        it.fig.stop?.('full');
        // (one the scene took out stays out: Ben is gone; the rest are the rules' again)
        if (!spec.acts.some((b) => b.tag === a.tag && b.gone)) people.stage?.(it.p.id, null);
      }
    }
    playing = null;
  }

  function actsAt(g) {
    const { spec, t, done } = playing;
    (spec.acts ?? []).forEach((a, i) => {
      if (done.has(i) || t < a.t) return;
      done.add(i);
      if (a.side && g.side !== a.side) return;
      figuresOf(a.tag, g).forEach((it, n) => act(a, it, g, n));
    });
    if (playing.lit) show?.lightning?.(playing.lit.from, playing.lit.to, true);
  }

  // one act on one actor (the n-th the tag has)
  function act(a, it, g, n = 0) {
    if (a.swing) swingFrom(a, it, g, n);
    if (a.hide !== undefined) {
      if (it.you) hidingYou = a.hide;
      else people.stage?.(it.p.id, { hidden: a.hide });
    }
    const fig = it.fig;
    if (!fig) return;
    if (a.face) {
      const other = where({ tag: a.face }, g);
      if (other) people.stage?.(it.p.id, { yaw: Math.atan2(other.x - it.p.x, -(other.z - it.p.z)) });
    }
    if (a.base !== undefined) fig.base?.(a.base);
    if (a.play) fig.play?.(a.play, { loop: Boolean(a.loop) });
    if (a.gone) people.stage?.(it.p.id, { hidden: true });
    if (a.fall) {
      const yaw = it.p.yaw ?? 0;
      const [s, c] = [Math.sin(yaw), Math.cos(yaw)];
      fig.fall?.({ collide: null, push: { x: s * a.fall.z + c * a.fall.x, y: a.fall.y, z: -c * a.fall.z + s * a.fall.x }, speed: Math.hypot(a.fall.x, a.fall.y, a.fall.z) });
    }
    if (a.lightning !== undefined) {
      if (a.lightning) {
        const to = where(a.lightning === 'you' ? { you: true } : { tag: a.lightning }, g);
        const from = { x: it.p.x, y: (it.p.y ?? 0) + 1.3, z: it.p.z };
        playing.lit = to ? { from, to: { x: to.x, y: to.y + 1.2, z: to.z } } : null;
      } else if (playing.lit) {
        show?.lightning?.(playing.lit.from, playing.lit.to, false);
        playing.lit = null;
      }
    }
  }

  // A swing begun: from where the actor stands to its place across (both put out to the side by
  // `side`), on a line from a pipe over the middle of the way; the lead swinger's line is drawn
  function swingFrom(a, it, g, n) {
    const from = a.swing.from ? where(a.swing.from, g) : it.you ? where({ you: true }, g) : { x: it.p.x, y: it.p.y ?? 0, z: it.p.z };
    const there = where(a.swing.to, g);
    if (!from || !there) return;
    const yaw = Math.atan2(there.x - from.x, -(there.z - from.z));
    const side = (a.swing.side ?? 0) + (a.swing.apart ?? 0) * n;
    const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
    const w = {
      id: it.you ? null : it.p.id,
      you: Boolean(it.you),
      fig: it.fig,
      t0: playing.t,
      s: a.swing.s,
      sag: a.swing.sag ?? 0,
      yaw,
      from: { x: from.x + c * side, y: from.y, z: from.z + s * side },
      to: { x: there.x + c * side, y: there.y, z: there.z + s * side },
      landed: false,
      rope: null,
    };
    if (side === 0) {
      // (a cord a couple of centimetres thick, one metre long, stretched to the line each frame)
      w.rope = new THREE.Mesh(new THREE.CylinderGeometry(ROPE_R, ROPE_R, 1, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.9 }));
      w.rope.name = 'cinematic-rope';
      w.rope.frustumCulled = false;
      w.pipe = { x: (w.from.x + w.to.x) / 2, y: Math.max(w.from.y, w.to.y) + GRIP + PIPE, z: (w.from.z + w.to.z) / 2 };
      world.add(w.rope);
    }
    it.fig?.play?.('jump.loop', { loop: true });
    playing.swings.push(w);
  }

  function swingsAt() {
    for (const w of playing.swings) {
      const p = swingAt(w, playing.t);
      if (!w.landed && playing.t >= w.t0 + w.s) {
        w.landed = true;
        w.fig?.play?.('jump.land');
      }
      if (w.you) swungYou = { ...p, yaw: w.yaw };
      else people.stage?.(w.id, { at: p, yaw: w.yaw });
      if (w.rope) {
        const d = ropeDir.set(p.x - w.pipe.x, p.y + GRIP - w.pipe.y, p.z - w.pipe.z);
        w.rope.scale.set(1, d.length(), 1);
        w.rope.position.set(w.pipe.x + d.x / 2, w.pipe.y + d.y / 2, w.pipe.z + d.z / 2);
        w.rope.quaternion.setFromUnitVectors(UP, d.normalize());
        // (let go of once across)
        w.rope.visible = !w.landed;
      }
    }
  }
  function dropRopes() {
    for (const w of playing?.swings ?? []) {
      if (!w.rope) continue;
      w.rope.removeFromParent();
      w.rope.geometry.dispose();
      w.rope.material.dispose();
    }
  }

  // the beams lit now: one additive shaft each, made as they light and freed as the scene ends
  function beamsAt(g) {
    const { spec, t } = playing;
    (spec.beams ?? []).forEach((b, i) => {
      const on = t >= b.t0 && t < b.t1;
      let mesh = playing.beams.get(i);
      if (on && !mesh) {
        const f = frameOf(where(b.at, g));
        if (!f) return;
        const a = offsetIn(f, b.from);
        const z = offsetIn(f, b.to);
        const v = new THREE.Vector3(z.x - a.x, z.y - a.y, z.z - a.z);
        const geo = new THREE.CylinderGeometry(b.width / 2, b.width / 2, v.length(), 10, 1, true);
        const mat = new THREE.MeshBasicMaterial({ color: b.colour, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'cinematic-beam';
        mesh.position.set((a.x + z.x) / 2, (a.y + z.y) / 2, (a.z + z.z) / 2);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
        mesh.frustumCulled = false;
        world.add(mesh);
        playing.beams.set(i, mesh);
      }
      if (mesh) {
        mesh.visible = on;
        // (it flickers as it burns, and thins as it goes out)
        if (on) mesh.material.opacity = 0.65 + 0.35 * Math.sin(t * 60) * Math.sin(t * 23) * (t > b.t1 - 0.3 ? (b.t1 - t) / 0.3 : 1);
      }
    });
  }
  function dropBeams() {
    for (const mesh of playing?.beams?.values() ?? []) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }

  function flashesAt(g) {
    const { spec, t, flashes } = playing;
    (spec.flashes ?? []).forEach((f, i) => {
      if (flashes.has(i) || t < f.t) return;
      flashes.add(i);
      const at = frameOf(where(f.at, g));
      if (!at) return;
      const p = f.ahead ? offsetIn(at, [0, 3, -f.ahead]) : { x: at.x, y: at.y + 1.5, z: at.z };
      fx?.flare?.(p);
      if (f.size) fx?.explode?.(p, f.size);
    });
  }

  return {
    get playing() {
      return playing?.id ?? null;
    },
    // where a swing has your figure, while it does
    get youAt() {
      return playing ? swungYou : null;
    },
    // whether a scene has your figure out of sight (you're aboard the shuttle as it lands)
    get hidesYou() {
      return Boolean(playing) && hidingYou;
    },
    sync(g, dt) {
      const id = g?.scene?.id ?? null;
      if (playing && playing.id !== id) end(g);
      if (!id) return null;
      if (!playing) begin(id, g);
      if (!playing) return null;
      playing.t = g.scene.t ?? playing.t + dt;
      actsAt(g);
      swingsAt();
      flashesAt(g);
      beamsAt(g);
      const { spec } = playing;
      if (playing.ship) {
        const total = spec.shots.reduce((s, x) => s + x.s, 0);
        flyShip(playing.ship, spec.ship.how, Math.min(1, playing.t / Math.max(0.1, total)));
      }
      const at = shotAt(spec, playing.t);
      if (!at) return null;
      const { shot, k } = at;
      const f = frameOf(where(shot.at, g));
      if (!f) return null;
      const e = ease(k);
      const off = shot.from.map((v, i) => lerp(v, shot.to[i], e));
      const lf = frameOf(where(shot.look ?? shot.at, g)) ?? f;
      const look = shot.lookAhead ? offsetIn(lf, [0, 0, -shot.lookAhead]) : lf;
      Object.assign(pose.look, { x: look.x, y: look.y + (shot.lift ?? EYE), z: look.z });
      Object.assign(pose.pos, clearOf(g, offsetIn(f, off), pose.look));
      return pose;
    },
    dispose() {
      dropBeams();
      dropRopes();
      playing = null;
    },
  };
}
