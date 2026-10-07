// Sneaking past watchers: anyone who walks a round and stops at each corner
// to look about (Farmer Maggot's dogs were the first; Bree's Nazgûl walk the
// lanes the same way, and Moria's troll, Shelob, the Easterlings' scouts,
// the Citadel's cops). They see in a cone, but not through houses or walls;
// they hear you run close by, smell you closer still, and anyone wearing the
// Ring shows to them from far off, through anything. Seen, they stop a
// moment, then give chase, and give up when you're out of reach.
//
// On the AI toolkit (lib/ai, the NPC intelligence design), where a town
// asks for it: seeing takes time (`far`: seconds to be sure of you at the
// edge of its sight, at once up close; a smell, the Ring or your running
// are at once), and half sure (`suspicious`, a share of that) it walks over
// to look, stands a moment, and goes back to its round (event
// 'suspicious'). Chasing, it knows you as it perceives you (lib/ai/
// perception): out of its sight it keeps the truth a couple of seconds
// (intuition), then runs for its guess of you; the chase lost, with
// `search` set it goes to where it last had you, then the watchers look
// about together (lib/ai/search: the corners of their rounds and the
// town's `spots` near there, shared, each taking the next; events 'lost'
// and 'searching'), for `search` seconds, then back to their rounds one at
// a time. Without those keys a town's watchers do exactly what they did.
//
// opts: sight (m), cone (half-angle, radians), smell, hear, ringSight (m),
// alert (s before the chase), chase and patrol (m/s), giveUp (s), leash (m),
// catch (m), look (s spent looking about at a corner); and, to opt in: far
// (s), suspicious (0…1), search (s), spots ([[x, z]…] worth a look), memory (s).

import { belief, createSenses, sense } from '../../../lib/ai/perception';
import { createSearch } from '../../../lib/ai/search';
import { seeded } from '../../../lib/seeded';
import { sightClear } from './walker';

const INTUITION = 2; // seconds it keeps the truth after losing sight of you
const LOST_AFTER = 1.6; // seconds out of sight in a chase before it's lost you

const turnTo = (face, want, k) => {
  let d = want - face;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return face + d * Math.min(1, k);
};

// (rand: what the shared search draws on, seeded so a town searches the
// same way every visit; seeded(11) unless the town hands its own)
export function newWatchers(rounds, { spots = [], rand = seeded(11) } = {}) {
  return {
    rounds,
    spots,
    rand,
    search: null, // (made when first needed: the watchers' shared search)
    list: rounds.map((r, i) => ({ id: i, x: r[0][0], z: r[0][1], face: Math.atan2(-((r[1] ?? r[0])[1] - r[0][1]), (r[1] ?? r[0])[0] - r[0][0]), leg: 1 % r.length, mode: 'patrol', t: 0, wait: 0.5 + i * 0.4, look: 0, unseen: 0, timer: 0, me: null, searched: false })),
  };
}

// can this watcher see (hear, smell) the walker `h`, this instant? world: {
// colliders, walls, ring } (ring: it's being worn)
export function watcherSees(w, h, opts, { colliders = [], walls = [], ring = false } = {}) {
  const dx = h.x - w.x;
  const dz = h.z - w.z;
  const d = Math.hypot(dx, dz);
  if (ring && d < (opts.ringSight ?? 30)) return true;
  if (d < opts.smell) return true;
  const clear = () => sightClear(w.x, w.z, h.x, h.z, colliders, walls);
  if (h.running && d < opts.hear) return clear();
  if (d > opts.sight) return false;
  let off = Math.atan2(-dz, dx) - (w.face + w.look);
  off = Math.atan2(Math.sin(off), Math.cos(off));
  return Math.abs(off) < opts.cone && clear();
}
// and whether that seeing is the kind that's sure at once (a smell, the Ring, your running)
const atOnce = (w, h, opts, { ring = false } = {}) => {
  const d = Math.hypot(h.x - w.x, h.z - w.z);
  return (ring && d < (opts.ringSight ?? 30)) || d < opts.smell || (h.running && d < opts.hear);
};

// Walk toward (tx, tz) at `speed`, kept out of things by `push`; true once there.
function walkTo(w, tx, tz, speed, dt, push, near = 0.2) {
  const dx = tx - w.x;
  const dz = tz - w.z;
  const d = Math.hypot(dx, dz);
  if (d < near) return true;
  const s = Math.min(d, speed * dt);
  let x = w.x + (dx / d) * s;
  let z = w.z + (dz / d) * s;
  if (push) [x, z] = push(x, z);
  w.x = x;
  w.z = z;
  w.face = turnTo(w.face, Math.atan2(-dz, dx), dt * 8);
  return false;
}

// what the watcher believes of the walker, kept by lib/ai/perception: the
// truth while it sees you (and for INTUITION after), a guess after that
const senses = (w, opts) => (w.senses ??= createSenses({ sight: { range: Infinity, cone: -1, far: 0.05 }, hearing: { range: opts.hear ?? 0 }, memory: opts.memory ?? 6, intuition: INTUITION }));
function perceive(w, h, sees, opts, dt) {
  w.me ??= { pos: { x: w.x, y: 0, z: w.z }, dir: null, beliefs: {}, now: 0 };
  w.me.pos.x = w.x;
  w.me.pos.z = w.z;
  sense(senses(w, opts), w.me, { targets: sees ? [{ id: 'you', at: { x: h.x, y: 0, z: h.z }, vel: { x: h.vx ?? 0, y: 0, z: h.vz ?? 0 }, hostile: true }] : [] }, dt);
  const b = belief(w.me, 'you');
  if (!b) return null;
  const sure = b.visible || w.me.now - b.seenAt <= INTUITION;
  return { x: sure ? h.x : b.at.x, z: sure ? h.z : b.at.z, sure };
}
const forget = (w) => {
  if (w.me) w.me.beliefs = {};
};

// the watchers' shared search, made for this town's rounds and spots
const searchOf = (ws, opts) =>
  (ws.search ??= createSearch({
    rand: ws.rand ?? seeded(11),
    time: opts.search ?? 10,
    stagger: 1.5,
    spots: (b) => {
      const near = [...ws.rounds.flat(), ...ws.spots].filter((p) => Math.hypot(p[0] - b.at.x, p[1] - b.at.z) < 30 && Math.hypot(p[0] - b.at.x, p[1] - b.at.z) > 2);
      return near.map((p) => ({ x: p[0], y: 0, z: p[1] }));
    },
  }));

// One step of the watch. h: the walker. world: { colliders, walls, ring,
// push(x, z) for keeping a chaser out of houses, active (false: they walk
// their rounds but notice nothing) }. Returns events: { type: 'seen' |
// 'lost' | 'caught' | 'suspicious' | 'searching', id }.
export function stepWatchers(ws, h, dt, opts, world = {}) {
  const ev = [];
  const active = world.active !== false;
  const far = opts.far ?? 0.05; // (seconds to be sure at the edge of its sight: at once, unless the town says)
  const halfSure = opts.suspicious ?? null;
  for (const w of ws.list) {
    const round = ws.rounds[w.id];
    w.t += dt;
    const sees = active && watcherSees(w, h, opts, world);
    // the timer: sure of you in `far` seconds at the edge of its sight,
    // quicker the closer; at once for a smell, the Ring or your running;
    // forgotten as quickly when you're gone
    if (sees) {
      const d = Math.hypot(h.x - w.x, h.z - w.z);
      w.timer = atOnce(w, h, opts, world) ? 1 : Math.min(1, w.timer + dt / Math.max(0.05, (far * d) / Math.max(1e-6, opts.sight)));
    } else w.timer = Math.max(0, w.timer - dt / Math.max(0.05, far));
    const seen = sees && w.timer >= 1;
    if (w.mode === 'patrol') {
      if (w.wait > 0) {
        w.wait -= dt;
        w.look = Math.sin((opts.look - w.wait) * 2.6) * 0.9; // looking about
      } else {
        w.look *= Math.max(0, 1 - dt * 6);
        const [tx, tz] = round[w.leg];
        if (walkTo(w, tx, tz, opts.patrol, dt, null)) {
          w.leg = (w.leg + 1) % round.length;
          w.wait = opts.look;
        }
      }
      if (seen) {
        w.mode = 'alert';
        w.t = 0;
        w.look = 0;
        ev.push({ type: 'seen', id: w.id });
      } else if (halfSure != null && sees && w.timer >= halfSure) {
        // half sure: over to look where it thought it saw something
        w.mode = 'suspicious';
        w.t = 0;
        w.look = 0;
        w.at = [h.x, h.z];
        w.looked = 0;
        ev.push({ type: 'suspicious', id: w.id });
      }
    } else if (w.mode === 'suspicious') {
      if (seen) {
        w.mode = 'alert';
        w.t = 0;
        ev.push({ type: 'seen', id: w.id });
      } else if (!active || w.t > opts.look * 2 + 6) {
        w.mode = 'back';
        w.t = 0;
      } else if (w.looked > 0 || walkTo(w, w.at[0], w.at[1], opts.patrol, dt, world.push, 0.6)) {
        // there: a look about, then back to the round
        w.looked += dt;
        w.look = Math.sin(w.looked * 2.6) * 0.9;
        if (w.looked > opts.look * 1.5) {
          w.mode = 'back';
          w.t = 0;
          w.look = 0;
        }
      }
    } else if (w.mode === 'alert') {
      w.face = turnTo(w.face, Math.atan2(-(h.z - w.z), h.x - w.x), dt * 10);
      perceive(w, h, sees, opts, dt);
      if (!active) w.mode = 'back';
      else if (w.t > opts.alert) {
        w.mode = 'chase';
        w.t = 0;
        w.unseen = 0;
      }
    } else if (w.mode === 'chase') {
      const d = Math.hypot(h.x - w.x, h.z - w.z);
      if (active && d < opts.catch) {
        w.mode = 'caught';
        ev.push({ type: 'caught', id: w.id });
        continue;
      }
      w.unseen = sees ? 0 : w.unseen + dt;
      const target = perceive(w, h, sees, opts, dt);
      if (!active || w.unseen > LOST_AFTER || w.t > opts.giveUp || d > opts.leash || !target) {
        w.t = 0;
        ev.push({ type: 'lost', id: w.id });
        if (active && opts.search != null && target) {
          // lost: to where it last had you, then the look about together
          const s = searchOf(ws, opts);
          if (!s.active) s.start({ at: { x: target.x, y: 0, z: target.z } }, { aggressive: true, truth: { x: h.x, y: 0, z: h.z } });
          w.mode = 'search';
          w.goal = null;
          ev.push({ type: 'searching', id: w.id });
        } else w.mode = 'back';
        forget(w);
        continue;
      }
      // after you: where it believes you are (the truth, a moment after losing sight; its guess after)
      walkTo(w, target.x, target.z, opts.chase, dt, world.push, 0);
      w.face = turnTo(w.face, Math.atan2(-(target.z - w.z), target.x - w.x), dt * 12);
    } else if (w.mode === 'search') {
      const s = searchOf(ws, opts);
      s.update(dt / ws.list.length); // (each watcher ticks it a share: once a frame all told)
      if (active && seen) {
        s.release(w.id);
        w.mode = 'alert';
        w.t = 0;
        ev.push({ type: 'seen', id: w.id });
        continue;
      }
      if (!active || s.done(w.id)) {
        w.mode = 'back';
        w.t = 0;
        w.goal = null;
        continue;
      }
      if (!w.goal) {
        const c = s.claim(w.id, { x: w.x, y: 0, z: w.z });
        w.goal = c ? [c.at.x, c.at.z] : null;
        if (!w.goal) {
          // nowhere to look: it stands and looks about where it is
          w.look = Math.sin(w.t * 2.6) * 0.9;
          continue;
        }
      }
      if (walkTo(w, w.goal[0], w.goal[1], opts.patrol * 1.3, dt, world.push, 0.6)) {
        s.arrive(w.id);
        w.goal = null;
      }
      // (the spots it can see from here are looked at as it goes: within its sight, nothing between)
      s.sweep(w.id, { x: w.x, y: 0, z: w.z }, (a, b) => Math.hypot(b.x - a.x, b.z - a.z) < opts.sight && sightClear(a.x, a.z, b.x, b.z, world.colliders ?? [], world.walls ?? []));
    } else if (w.mode === 'back') {
      // back to the round, and carry on
      const [tx, tz] = round[w.leg];
      if (walkTo(w, tx, tz, opts.patrol * 1.4, dt, world.push, 0.3)) {
        w.mode = 'patrol';
        w.wait = opts.look;
      }
      if (active && w.t > 1.5 && seen) {
        w.mode = 'alert';
        w.t = 0;
        ev.push({ type: 'seen', id: w.id });
      }
    }
  }
  return ev;
}
