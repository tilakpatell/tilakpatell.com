// What the people of a place do while Morty's about: the NPC layer the
// dial's destinations (dimensions/stage.js), the street (visitors.js) and
// Blips and Chitz's regulars (arcade.js) share. Each figure placed with `ai`
// gets a brain here; the place steps it each frame with the render state,
// and the brains talk to RmWorld through state.emit ('caught', 'bark',
// 'spotted', 'duel', 'strike', 'done').
//
// Its body shows what the brain decided and decides nothing itself (the
// seam lib/ai/body.js draws): its feet paced to the ground it really covers
// (./living.js's stepMotion, so nothing skates), its eyes on Morty while it
// hunts him and its head sweeping about once it's lost him, a wave the first
// time Morty comes up to someone with something to say (lib/ai/social.js's
// greeting), its hands going while it says it or while Morty talks to it
// (lib/ai/react.js's `say`), a sharp look when it spots him and a jab when it
// catches him, a step aside for Morty walking at a walker, and walkers going
// round him and whoever else stands about rather than through them.
//
//   createNpcs({ id, area, solids, words, others }) → { add(c, spot) → n, step(n, t, dt, state),
//     calm(), hunt(on), lookout(mode), fire(shot), list(), npcs, hunting }
//
// id: the area's; area: its box { x0, x1, z0, z1 }, kept to; solids: what's
// in the way ({ x, z, w, d } boxes and { x, z, r } posts); words: { caught,
// spotted }, the place's lines when a hunter catches or sees him; others:
// (state) → [{ x, z, r }], who else stands in the way this frame (the
// street's motorcade and agents). The state: the render state ({ morty,
// done, emit, fading, talk }: `talk` is Morty's word to someone while it
// plays, { id, n, hold }, n a new number for each word).

import * as THREE from 'three';
import { avoid, createContext, resolve, seek, separate } from '../../../lib/ai/steer';
import { createSocial } from '../../../lib/ai/social';
import { seeded } from '../../../lib/seeded';
import { STRIKE, aimFor, land, newDuel, strike as strikeAt } from './dimensions/duel';
import { EYES, heard, lineHold, scanAt, stepMotion } from './living';

const SEARCH = 5; // seconds a hunter who's lost Morty looks about for him
const MORTY_R = 0.4; // the room Morty takes up, to a walker going round him (m)
const UP = new THREE.Vector3(0, 1, 0);
const hash = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h | 0;
};

// a duel's hunter to a bolt: a person's height and a body's width round him
const BODY = { tall: 1.8, r: 0.4 };

export function createNpcs({ id, area: A, solids = [], words = {}, others = null }) {
  // ── NPC behaviour ──
  // Anyone placed may carry `ai`: what they do while Morty's about.
  //   wander: [[x, z, face?], …]   walks the points in turn (speed m/s, pause s at each;
  //         `face`: which way to turn while it waits there, an arcade cabinet's)
  //   cheer: 0…1            at a stop, the chance it cheers (or gloats) a moment after arriving
  //   watch: r              turns to Morty when he's within r
  //   bark: { r, lines, every }  says one of `lines` when he's within r, at most every `every` s
  //   hunt: { speed, catchR, near?, lose?, until?, always?, line? }  goes for Morty while
  //         the place is hunting (S.hunt(true), or on its own when he's within `near`,
  //         given up past `lose`; `always`: from the start), and tells RmWorld 'caught'
  //         (state.emit) within catchR, with `line` or the place's `caught`; `until`: a
  //         task that, done, ends it
  //         duel: { hp, mortyHp?, task, won?, unlock? }: a fight instead of a catch (./duel.js): within reach he
  //         strikes (the 'punch' clip; RmWorld's 'strike' takes a point off Morty), and
  //         Morty's shots take his: the area's 'fire' action (F in RmWorld) says where
  //         to aim, the bolt flies (../rmShots.js) against 'bodies', and 'hit' is
  //         told when one lands; at nought he
  //         falls (the 'fall' clip), stays down for the page load (never set on Morty again, nor is his
  //         place: it hunts no more), and `task` is done ('done'), with `won` said; `unlock` its
  //         achievement, handed over by the place's stage once `task` is done. The duel is told to RmWorld as 'duel' { hp, max } as it goes.
  //   lookout: true        turned by the place's game (lookout(mode): the vat's
  //         freeze, ./games/freeze.js): its back to the room ('away'), at Morty
  //         with its head on him ('look'), started at him once ('seen'); no word
  //         and no wave while it's turned; `null`, as it was (calm clears it)
  //   clip: a shared clip looped while standing (Evil Morty's crossed arms)
  //   home: kept where placed between behaviours; `calm` puts everyone back
  const npcs = [];
  let hunting = false;
  let lookouts = null; // (the place's game turning its lookouts: 'away' | 'look' | 'seen' | null)
  const ROOM_PAD = 0.8;
  const clampIn = (o) => {
    o.x = Math.min(A.x1 - ROOM_PAD, Math.max(A.x0 + ROOM_PAD, o.x));
    o.z = Math.min(A.z1 - ROOM_PAD, Math.max(A.z0 + ROOM_PAD, o.z));
  };
  const headingTo = (dx, dz) => Math.atan2(-dz, dx);
  // what's in the way of anyone walking here: the place's solids as circles
  // for the steering's avoid (a box as a row of circles along its long side,
  // each as wide as its short one, so a bench doesn't close the aisle)
  const blocks = solids.flatMap((o) => {
    if (o.r != null) return [{ at: { x: o.x, z: o.z }, r: o.r }];
    const long = Math.max(o.w, o.d);
    const short = Math.min(o.w, o.d);
    const n = Math.max(1, Math.ceil(long / short));
    const alongX = o.w >= o.d;
    return Array.from({ length: n }, (_, i) => {
      const u = n === 1 ? 0 : -long / 2 + short / 2 + (i * (long - short)) / (n - 1);
      return { at: { x: o.x + (alongX ? u : 0), z: o.z + (alongX ? 0 : u) }, r: short / 2 };
    });
  });

  // ── the crowd, once a frame: who stands about, and what they are to each
  // other and to Morty (social.js: a greeting, a step out of his way) ──
  const social = createSocial({ rand: seeded(hash(id)) });
  const crowd = { t: null, says: new Map(), posts: [], morty: null };
  const frameOf = (t, state) => {
    if (crowd.t === t) return;
    crowd.t = t;
    const m = state?.morty;
    crowd.posts = (others?.(state) ?? []).map((o) => ({ at: { x: o.x, z: o.z }, r: o.r ?? 0.3 }));
    crowd.morty = m ? { at: { x: m.x, z: m.z }, r: MORTY_R } : null;
    const people = [];
    for (const n of npcs) {
      if (!n.c.group.visible || n.dead) continue;
      const p = n.c.group.position;
      // (only a walker steps aside; a hunter never waves)
      people.push({ id: n.key, x: p.x, z: p.z, yaw: n.c.group.rotation.y, busy: Boolean(n.ai.hunt) || !n.ai.wander?.length, line: !n.ai.hunt && Boolean(n.ai.bark || n.who) });
    }
    crowd.says.clear();
    const you = m ? { x: m.x, z: m.z, yaw: (m.face ?? 0) + Math.PI / 2, speed: m.speed ?? 0 } : null;
    for (const e of social.step(people, t, 0, { you })) crowd.says.set(e.who, e);
  };

  // a step towards `to` for `n`, round the solids, the others, whoever
  // stands about and (unless it's after him) Morty (context steering,
  // lib/ai/steer.js): where it's heading, or null if it's stuck. A hunter
  // only minds the solids nearer than Morty: a counter at his back is no
  // wall between them (it would mask every way to him, and he'd never be caught)
  const steerTo = (n, to, speed, dt, { round = true } = {}) => {
    const g = n.c.group;
    const from = { x: g.position.x, z: g.position.z };
    const ctx = (n.ctx ??= createContext(16));
    ctx.interest.fill(0);
    ctx.danger.fill(0);
    seek(ctx, from, to, 1);
    const vel = { x: Math.cos(n.heading ?? 0) * speed, z: -Math.sin(n.heading ?? 0) * speed };
    const toT = Math.hypot(to.x - from.x, to.z - from.z);
    for (const b of blocks) if (round || Math.hypot(b.at.x - from.x, b.at.z - from.z) - b.r < toT) avoid(ctx, from, vel, b, 0.45, 2.5);
    for (const b of crowd.posts) avoid(ctx, from, vel, b, 0.35, 1.5);
    if (round && crowd.morty) avoid(ctx, from, vel, crowd.morty, 0.35, 1.5);
    separate(
      ctx,
      from,
      npcs.filter((o) => o !== n && o.c.group.visible).map((o) => ({ x: o.c.group.position.x, z: o.c.group.position.z })),
      1.3,
    );
    const { dir, strength } = resolve(ctx, { blend: 0.25 });
    if (strength < 1e-4) return null;
    const l = Math.hypot(dir.x, dir.z) || 1;
    g.position.x += (dir.x / l) * speed * dt;
    g.position.z += (dir.z / l) * speed * dt;
    n.heading = headingTo(dir.x, dir.z);
    return n.heading;
  };
  const turnTo = (c, face, dt, k = 8) => {
    const want = face + Math.PI / 2;
    let diff = want - c.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    c.group.rotation.y += diff * Math.min(1, dt * k);
  };
  // a stop with Morty or someone else standing on it: near enough is there
  const taken = (x, z) => [crowd.morty, ...crowd.posts].some((b) => b && Math.hypot(b.at.x - x, b.at.z - z) < b.r + 0.6);

  const stepNpc = (n, t, dt, state) => {
    frameOf(t, state);
    const { c, ai } = n;
    const m = state?.morty;
    const done = state?.done ?? [];
    const g = c.group;
    const toM = m ? Math.hypot(m.x - g.position.x, m.z - g.position.z) : Infinity;
    // (Morty's eyes, for a head to turn to)
    const eyes = m ? { x: m.x, y: n.y + EYES, z: m.z } : null;
    const faceM = m ? headingTo(m.x - g.position.x, m.z - g.position.z) : n.face;
    const say = crowd.says.get(n.key);
    let move = 0;
    let look = null; // where its head turns this frame
    // Morty's word to it: its hands going while it plays, its head on him, a walker stopped for it
    if (heard(state?.talk, n.id, n.talkN)) {
      n.talkN = state.talk.n;
      n.talkUntil = t + (state.talk.hold ?? 2);
      if (eyes) c.react?.('say', { hold: state.talk.hold ?? 2, target: eyes });
    }
    const h = ai.hunt;
    const huntOver = h?.until && done.includes(h.until);
    if (h && !huntOver) {
      if (!n.hunting && !n.dead && (hunting || h.always || (h.near != null && toM < h.near))) {
        n.hunting = true;
        n.searchUntil = 0;
        // (one who's spotted him on his own says so: RmWorld's word and sound)
        if (!hunting && !h.always && !h.duel) {
          state.emit?.('spotted', { area: id, who: n.id, name: n.who ?? n.name, text: h.spotted ?? words.spotted ?? 'They’ve seen you. Move.' });
          if (eyes) c.react?.('alert', { target: eyes });
        }
      }
      if (n.hunting && !hunting && h.lose != null && toM > h.lose) {
        n.hunting = false;
        n.searchUntil = t + SEARCH; // (it looks about for him a while)
      }
    } else n.hunting = false;
    const talking = n.talkUntil > t && !n.hunting && m;
    const turned = Boolean(ai.lookout && lookouts && m);
    if (n.dead) {
      // down for the count: nothing more from him
    } else if (n.hunting && m) {
      look = eyes;
      if (h.duel && !n.duel) {
        n.duel = newDuel({ hp: h.duel.hp ?? 6, mortyHp: h.duel.mortyHp ?? 3 });
        state.emit?.('duel', { area: id, who: n.id, name: n.who ?? n.name, hp: n.duel.hp, max: n.duel.max, mortyHp: n.duel.mortyHp, mortyMax: n.duel.mortyMax });
      }
      const face = faceM;
      const reach = h.duel ? STRIKE.reach : h.catchR;
      if (toM > reach) {
        const went = steerTo(n, { x: m.x, z: m.z }, Math.min(h.speed, (toM - reach * 0.8) / Math.max(dt, 1e-3)), dt, { round: false });
        move = went == null ? 0 : Math.min(1, h.speed / 3);
        turnTo(c, went ?? face, dt);
      } else if (h.duel) {
        turnTo(c, face, dt);
        if (!state.fading && t - (n.struckAt ?? -1e9) > STRIKE.every) {
          n.struckAt = t;
          n.duel = strikeAt(n.duel);
          c.play?.('punch', { hold: 0.1 });
          state.emit?.('strike', { area: id, who: n.id, name: n.who ?? n.name, hp: n.duel.hp, max: n.duel.max, mortyHp: n.duel.mortyHp, mortyMax: n.duel.mortyMax, beaten: n.duel.beaten, text: h.line ?? words.caught });
        }
      } else {
        turnTo(c, face, dt);
        if (!state.fading && t - (n.caughtAt ?? -1e9) > 3) {
          n.caughtAt = t;
          state.emit?.('caught', { area: id, who: n.id, name: n.who ?? n.name, text: h.line ?? words.caught });
          c.react?.('caught', { target: eyes });
        }
      }
    } else if (ai.wander?.length) {
      const [tx, tz] = ai.wander[n.i % ai.wander.length];
      const dist = Math.hypot(tx - g.position.x, tz - g.position.z);
      const sp = ai.speed ?? 1.1;
      const way = say?.mode === 'makeway' ? say : null;
      if (way) {
        // Morty walking at it: a step aside, still facing the way it was (its hips turn), its eyes on him
        const d = Math.hypot(way.to.x - g.position.x, way.to.z - g.position.z);
        const went = d > 0.05 ? steerTo(n, way.to, Math.min(sp * 1.2, d / Math.max(dt, 1e-3)), dt) : null;
        move = went == null ? 0 : Math.min(0.5, sp / 2.4);
        look = eyes;
        if (way.shove && t - (n.shovedAt ?? -1e9) > 2) {
          n.shovedAt = t;
          c.react?.('hit', { where: 'chest', moving: true });
        }
      } else if (talking) {
        turnTo(c, faceM, dt, 4);
      } else if (n.waitTill > t) {
        if (ai.watch && toM < ai.watch) turnTo(c, faceM, dt, 4);
        else {
          // (at a stop that says which way to face: an arcade cabinet)
          const at = ai.wander[(n.i + ai.wander.length - 1) % ai.wander.length];
          if (at[2] != null) turnTo(c, at[2], dt, 3);
        }
        if (n.cheerAt != null && t >= n.cheerAt) {
          n.cheerAt = null;
          c.react?.('win', {});
        }
      } else if (dist < 0.3 || (dist < 1.6 && taken(tx, tz))) {
        n.i++;
        n.waitTill = t + (ai.pause ?? 1.5) * (0.6 + (0.8 * ((n.i * 7919) % 10)) / 10);
        // (a regular whose game went well)
        if (ai.cheer && (((n.i * 0.618034 + n.seed) % 1) + 1) % 1 < ai.cheer) n.cheerAt = t + 0.8 + ((n.i * 0.37) % 1) * 1.5;
      } else {
        const went = steerTo(n, { x: tx, z: tz }, Math.min(sp, dist / Math.max(dt, 1e-3)), dt);
        move = went == null ? 0 : Math.min(0.5, sp / 2.4);
        if (went != null) turnTo(c, went, dt, 6);
        // (stuck a while against something: on to the next point)
        n.stuck = went == null ? (n.stuck ?? 0) + dt : 0;
        if (n.stuck > 2) {
          n.i++;
          n.stuck = 0;
        }
      }
      if (talking || (ai.watch && toM < ai.watch)) look = eyes;
    } else if (turned) {
      // the place's game turns it: its back to the room, or at Morty
      if (lookouts === 'away') turnTo(c, n.face + Math.PI, dt, 4);
      else {
        turnTo(c, faceM, dt, 6);
        look = eyes;
        if (lookouts === 'seen' && !n.saw) {
          n.saw = true;
          c.react?.('alert', { target: eyes });
        }
      }
    } else if (ai.watch && m) {
      if (toM < ai.watch || talking) {
        turnTo(c, faceM, dt, 4);
        look = eyes;
      } else turnTo(c, n.face, dt, 2);
    }
    if (!n.dead && !n.hunting && !turned) {
      // a hunter that's lost him looks about; anyone else he's greeted, or who's talking to him, at him
      if (n.searchUntil > t) look = scanAt({ x: g.position.x, z: g.position.z, yaw: g.rotation.y }, t, { phase: n.phase });
      else if (talking || say?.look) look ??= eyes;
    }
    let barked = false;
    // (not while the place's hunters are after him: what's said of the hunt stays up to be read; not from the ground)
    if (ai.bark && m && !n.dead && !turned && !hunting && toM < ai.bark.r && t > (n.barkAt ?? -1e9) + (ai.bark.every ?? 14) && !state.fading) {
      n.barkAt = t;
      n.barkN = (n.barkN ?? -1) + 1;
      const text = ai.bark.lines[n.barkN % ai.bark.lines.length];
      state.emit?.('bark', { area: id, who: n.id, name: n.who ?? n.name, text });
      c.react?.('say', { hold: lineHold(text), target: eyes });
      barked = true;
    }
    // (the first time he comes up: a wave, unless it's just started talking to him, which is greeting enough)
    if (say?.wave && !barked && !n.dead && !n.hunting && !turned && eyes) c.react?.('greet', { target: eyes });
    clampIn(g.position);
    g.position.y = n.y;
    // the feet, by the ground it covered this frame; the bones over the clips, once it's placed
    const next = { x: g.position.x, z: g.position.z, yaw: g.rotation.y };
    const motion = stepMotion(n.prev, next, dt, { scale: g.scale.x || 1 });
    n.prev = next;
    n.frame.forward.set(Math.sin(next.yaw), 0, Math.cos(next.yaw));
    c.update?.(t, move, 0, { dt, motion, frame: n.frame });
    // its head: asked again only while it's on something, or to let go
    if (look || n.looking) {
      c.look?.(look);
      n.looking = Boolean(look);
    }
  };
  const calmNpcs = () => {
    hunting = false;
    lookouts = null;
    for (const n of npcs) {
      n.hunting = false;
      n.saw = false;
      // (a duel's hunter who's not been beaten gets up and goes home; one who has stays down)
      if (!n.dead) {
        n.duel = null;
        if (n.ai.clip) n.c.play?.(n.ai.clip, { loop: true });
        else n.c.stop?.();
      }
      n.i = 0;
      n.waitTill = 0;
      n.y = n.y0;
      n.c.group.position.set(n.home.x, n.y, n.home.z);
      n.c.group.rotation.y = n.face + Math.PI / 2;
      // (and put back, not walked back: no stride across the room, no search, its head ahead)
      n.prev = null;
      n.searchUntil = 0;
      n.talkUntil = 0;
      n.cheerAt = null;
      if (n.looking) {
        n.c.look?.(null);
        n.looking = false;
      }
    }
  };

  // a figure that does something: its brain, stepped by step() (`who`: the
  // name its own line gives it; `name`: its kind's, ./dimensions/names.js,
  // so what it says is never captioned with its id)
  const add = (c, { x, z, y = 0, face = 0, ai, id: nid = c.kind, who = null, name = null }) => {
    const seed = ((hash(`${id}:${nid}:${npcs.length}`) >>> 0) % 1000) / 1000;
    const n = { c, ai, id: nid, who, name, home: { x, z }, y, y0: y, face, i: 0, waitTill: 0, hunting: false, key: npcs.length, seed, phase: seed, prev: null, looking: false, searchUntil: 0, talkUntil: 0, talkN: null, cheerAt: null, frame: { forward: new THREE.Vector3(0, 0, 1), up: UP } };
    npcs.push(n);
    if (ai.clip) c.play?.(ai.clip, { loop: true });
    return n;
  };
  const step = (n, t, dt, state) => stepNpc(n, t, dt, state);
  // where everyone is, for the QA scripts
  const list = () => npcs.map((n) => ({ id: n.id, x: +n.c.group.position.x.toFixed(1), z: +n.c.group.position.z.toFixed(1), hunting: n.hunting, visible: n.c.group.visible, hp: n.duel?.hp ?? null, dead: Boolean(n.dead) }));
  // the place's hunters, after Morty (or not; never while its duel's hunter is down: the fight was the thing)
  const hunt = (on = true) => {
    hunting = on && !npcs.some((n) => n.dead);
    if (!hunting) for (const n of npcs) n.hunting = false;
  };
  // the duel's hunter, while he's after Morty and up
  const duellist = () => npcs.find((n) => n.ai.hunt?.duel && n.hunting && !n.dead && n.c.group.visible) ?? null;
  // Morty's shot, from where he stands facing `face`: where to aim (the
  // duel's hunter's middle, if he's in the cone; null, along his facing)
  const fire = ({ x, z, face }) => {
    const n = duellist();
    if (!n) return null;
    const p = n.c.group.position;
    const to = aimFor({ x, z }, face, { x: p.x, z: p.z });
    return { who: n.id, at: to && { x: p.x, y: p.y + BODY.tall * 0.55, z: p.z } };
  };
  // what a bolt can hit here: the duel's hunter as a capsule (lib/combat/bolt.js's body)
  const bodies = () => {
    const n = duellist();
    if (!n) return [];
    const p = n.c.group.position;
    return [{ id: n.id, a: [p.x, p.y + BODY.r, p.z], b: [p.x, p.y + BODY.tall - BODY.r, p.z], r: BODY.r, side: 'them', ref: 'duel' }];
  };
  // a bolt of Morty's has landed on `id`: a point off him, and at nought he falls
  const hit = (id) => {
    const n = npcs.find((o) => o.id === id && o.ai.hunt?.duel && !o.dead);
    if (!n) return null;
    n.duel ??= newDuel({ hp: n.ai.hunt.duel.hp ?? 6, mortyHp: n.ai.hunt.duel.mortyHp ?? 3 });
    n.duel = land(n.duel);
    if (n.duel.hit) n.c.play?.(n.duel.down ? 'fall' : 'hit', n.duel.down ? { hold: 1e9 } : { hold: 0 });
    if (n.duel.down) {
      n.dead = true;
      n.hunting = false;
      hunting = false;
      if (n.looking) {
        n.c.look?.(null);
        n.looking = false;
      }
    }
    return { hit: n.duel.hit, down: n.duel.down, hp: n.duel.hp, max: n.duel.max, who: n.id, task: n.ai.hunt.duel.task ?? null, won: n.ai.hunt.duel.won ?? null };
  };
  return {
    add,
    step,
    calm: calmNpcs,
    hunt,
    lookout: (mode) => {
      lookouts = mode;
    },
    fire,
    bodies,
    hit,
    list,
    npcs,
    get hunting() {
      return hunting;
    },
  };
}
