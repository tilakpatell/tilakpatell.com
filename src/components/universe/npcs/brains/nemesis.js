// A nemesis (Vader, Tammy, Tuco): an enemy who comes for you in person and
// flies the fight itself, weighing its moves (lib/ai/utility) in three
// phases that rank above one another (dual utility: the fury always
// outranks the duel).
// 1. The duel: it circles you close and fast, firing, and picks, every
//    half-second it's free, among a pass (a dive through a point just
//    behind and above you, more likely the longer since the last), a jink
//    (off to one side and back round the other, the longer you've had it in
//    front of your nose), a bait (you've sat on its tail for NPC.tail
//    seconds: it slows right down so you fly past, then swings in behind
//    you) and the orbit. A shot of yours coming at it (world.stims: your
//    shots, with where they're aimed) breaks it hard off your nose for
//    NPC.break seconds, whatever it was doing.
// 2. Hurt to NPC.summon of its hull, it falls back out of your reach,
//    calls its friends in (a `calls` event: the scene sends a small pack of
//    its faction) and fires from range for NPC.fallback seconds, then
//    comes in again.
// 3. Hurt to NPC.fury, it throws everything at you: a quarter faster, a
//    pass every couple of seconds, firing at nearly twice the rate, and it
//    jinks sooner.
// It knows you only as it perceives you (npcRules.js): lose it behind a
// moon and it chases its guess of you, says so (`search`), and says so
// again when it has you back (`found`); its guess gone, it looks about
// where it last had you for NPC.search seconds, then breaks off.
// It has a word for everything: coming in, you hitting it (the engine's
// hit line), falling back, the fury, your shields failing, breaking off.
// Hurt to NPC.retreat (or after NPC.nemesis seconds) it breaks off and
// goes, and it remembers: each time it comes back it's tougher (its hull up
// a quarter a meeting, to double), it greets you as an old enemy, once it
// has a grudge (it had to run, or you shot it down) it brings friends from
// the start, and it comes in from the other side to the one it left by.
import { consider, cooldown, curve, pick } from '../../../../lib/ai/utility';
import { NPC, add, apart, forwardOf, rightOf, sub, unit, velocityOf } from './common';

const RETHINK = 0.5; // seconds between its choices while it's free to choose

// whether you're sat on its tail: close, your nose on it, and the two of
// you flying the same way (crossing your nose is a jink's business)
const onItsTail = (me, you) => {
  const d = apart(me.pos, you);
  if (d > 22 || d < 1e-3) return false;
  const toMe = unit(sub(me.pos, you));
  const f = forwardOf(you);
  const yourNoseOnIt = toMe.x * f.x + toMe.z * f.z;
  const v = me.vel;
  const vl = Math.hypot(v.x, v.y, v.z);
  const sameWay = vl > 0.5 ? (v.x * f.x + v.z * f.z) / vl : 0;
  return yourNoseOnIt > 0.85 && sameWay > 0.4;
};
// a shot of yours coming its way this frame
const underFire = (me, world) => (world.stims ?? []).some((s) => s.from === 'you' && s.aim && apart(s.aim, me.pos) < 5);

const OPTIONS = [
  { id: 'orbit', weight: 0.5, considerations: [] },
  { id: 'pass', weight: 1.1, considerations: [(c) => cooldown(c.sincePass, c.passEvery), (c) => (c.d < 40 ? 1 : 0)] },
  { id: 'jink', weight: 1.4, considerations: [(c) => consider(c.inFront, [c.jinkAt * 0.5, c.jinkAt], curve.poly(2))] },
  { id: 'bait', weight: 1.6, considerations: [(c) => consider(c.tailed, [NPC.tail * 0.4, NPC.tail]), (c) => cooldown(c.sinceBait, 12)] },
  { id: 'fallback', weight: 2, rank: 1, considerations: [(c) => (c.summon ? 1 : 0)] },
];

export default function nemesis(npc, me, world, dt, rand) {
  const m = me.mind;
  const you = world.you;
  const mem = me.memory ?? { met: 1, grudge: 0 };
  if (!m.set) {
    m.set = true;
    const k = 1 + 0.25 * Math.min(4, (mem.met ?? 1) - 1);
    me.hpMax = Math.round(me.hpMax * k);
    me.hp = me.hpMax;
    // (the side it circles on: the other to the one it left by last time)
    m.side = mem.last?.from === 'right' ? -1 : mem.last?.from === 'left' ? 1 : me.n % 2 ? 1 : -1;
    m.a = 0;
    m.mode = 'orbit';
    m.phase = 1;
    m.inFront = 0;
    m.tailed = 0;
    m.passAt = -Infinity;
    m.baitAt = -Infinity;
    m.thinkAt = 0;
    m.until = 0;
  }
  const left = me.hp / me.hpMax;
  const retreat = () => {
    mem.grudge = (mem.grudge ?? 0) + 1;
    mem.last = { how: 'retreat', from: m.side > 0 ? 'right' : 'left' };
    return { leave: true, say: 'retreat', event: { type: 'retreat' } };
  };
  if (left <= NPC.retreat || me.clock > NPC.nemesis) return retreat();
  // lost you: it looks about where it last had you, then breaks off
  if (!you) {
    m.lostFor = (m.lostFor ?? 0) + dt;
    if (m.lostFor > NPC.search || !me.last) return retreat();
    m.a += dt * 0.6 * m.side;
    const around = add(me.last, { x: Math.cos(m.a) * NPC.orbit, y: Math.sin(m.a * 1.3) * 2, z: Math.sin(m.a) * NPC.orbit });
    return { to: around, speed: npc.stats.speed * 0.8, say: 'search' };
  }
  m.lostFor = 0;
  const d = apart(me.pos, you);
  let say = null;
  let event = null;
  if (you.guessed) {
    if (!m.searching) {
      m.searching = true;
      say = 'search';
    }
  } else if (m.searching) {
    m.searching = false;
    say = 'found';
  }
  if (d < NPC.seen && !m.greeted) {
    m.greeted = true;
    say = (mem.met ?? 1) > 1 ? 'again' : 'hello';
    if ((mem.grudge ?? 0) > 0 && !m.called) {
      m.called = true;
      event = { type: 'calls', faction: npc.faction };
    }
  }
  // the phases: hurt to NPC.summon it falls back out of your reach, calls
  // its friends in and fires from range for a while (its 'half' line); hurt
  // to NPC.fury it comes in with everything (its 'fury' line)
  let summon = false;
  if (m.phase === 1 && left <= NPC.summon) {
    m.phase = 2;
    summon = true;
    say ??= 'half';
    if (!m.summoned) {
      m.summoned = true;
      event ??= { type: 'calls', faction: npc.faction, size: 2 };
    }
  }
  if (m.phase === 2 && left <= NPC.fury) {
    m.phase = 3;
    m.mode = 'orbit';
    m.until = 0;
    m.passAt = me.clock - NPC.pass * 0.5;
    say ??= 'fury';
  }
  if ((world.shield ?? 100) < 35 && !m.weak) {
    m.weak = true;
    say ??= 'weak';
  }
  const fury = m.phase === 3;
  const quick = fury ? 1.25 : 1;
  const fireRate = fury ? 0.6 : 1;
  const f = forwardOf(you);
  const r = rightOf(you);
  const match = velocityOf(you);
  // what it's seeing: you in front of its nose, you on its tail
  const toMe = unit(sub(me.pos, you));
  const front = toMe.x * f.x + toMe.z * f.z;
  m.inFront = front > 0.8 && d < 28 ? m.inFront + dt : 0;
  m.tailed = onItsTail(me, you) ? m.tailed + dt : Math.max(0, m.tailed - dt * 2);
  // a shot coming: break hard off your nose, whatever it was doing
  if (underFire(me, world) && m.mode !== 'break' && m.mode !== 'fallback' && me.clock - (m.brokeAt ?? -Infinity) > 4) {
    m.mode = 'break';
    m.brokeAt = me.clock;
    m.until = me.clock + NPC.break;
    m.breakTo = add(add(me.pos, r, m.side * 30), { x: 0, y: (rand() - 0.5) * 10, z: 0 });
    m.side = -m.side;
    say ??= 'evade';
  }
  // a committed move runs its course; otherwise, every so often, it chooses
  const committed = m.mode !== 'orbit' && me.clock < m.until;
  if (!committed) {
    if (m.mode !== 'orbit') m.mode = 'orbit';
    if (me.clock >= m.thinkAt || summon) {
      m.thinkAt = me.clock + RETHINK;
      const ctx = { d, sincePass: me.clock - m.passAt, passEvery: fury ? NPC.pass * 0.5 : NPC.pass, inFront: m.inFront, jinkAt: NPC.jink * (fury ? 0.7 : 1), tailed: m.tailed, sinceBait: me.clock - m.baitAt, summon };
      const choice = pick(OPTIONS, ctx, { current: m.mode, momentum: 0.1, rank: (o) => o.rank ?? 0, rand, spread: 0.15 });
      m.scores = choice?.scores ?? null; // (what it weighed: npcRules.js notes it in the trace)
      const id = choice?.id ?? 'orbit';
      if (id === 'pass') {
        m.mode = 'pass';
        m.until = me.clock + 2.6;
        m.passAt = me.clock + rand() * (fury ? 1 : 3);
      } else if (id === 'jink') {
        m.mode = 'jink';
        m.until = me.clock + 2.2;
        m.jinkTo = add(add(add(you, r, m.side * 24), f, -6), { x: 0, y: (rand() - 0.5) * 8, z: 0 });
        m.side = -m.side;
        m.inFront = 0;
        say ??= 'evade';
      } else if (id === 'bait') {
        m.mode = 'bait';
        m.until = me.clock + NPC.bait;
        m.baitAt = me.clock;
        m.tailed = 0;
        say ??= 'bait';
      } else if (id === 'fallback') {
        m.mode = 'fallback';
        m.until = me.clock + NPC.fallback;
      }
    }
  }
  switch (m.mode) {
    case 'break':
      return { to: m.breakTo, speed: npc.stats.speed * 1.2 * quick, say, event };
    case 'fallback': {
      // out at twice the orbit, abreast of you, firing from range
      const spot = add(add(add(you, r, m.side * NPC.orbit * 2.2), f, 4), { x: 0, y: 1.5, z: 0 });
      return { to: spot, match, fire: 'you', say, event };
    }
    case 'jink':
      return { to: m.jinkTo, speed: npc.stats.speed * 1.15 * quick, say, event };
    case 'bait': {
      // nearly stopped, drifting on the way it was going: you overshoot, and
      // it swings in behind you as its bait runs out
      const late = me.clock > m.until - 0.6;
      const spot = late ? add(add(you, f, -6), { x: 0, y: 1, z: 0 }) : add(me.pos, unit(me.vel.x || me.vel.z ? me.vel : f), 2);
      return { to: spot, speed: late ? npc.stats.speed * quick : npc.stats.speed * 0.35, fire: late ? 'you' : null, say, event };
    }
    case 'pass': {
      // through a point just behind and above you, then round again
      const spot = add(add(you, f, -4), { x: 0, y: 1.5, z: 0 });
      if (apart(me.pos, spot) < 2) m.until = 0;
      return { to: spot, match, fire: 'you', fireRate, speed: npc.stats.speed * 1.1 * quick, say, event };
    }
    default: {
      // round you, close and quick, a little ahead more often than not
      m.a += dt * 0.6 * m.side * quick;
      const c = Math.cos(m.a);
      const s = Math.sin(m.a);
      const spot = add(add(add(you, r, c * NPC.orbit * 0.8), f, (s + 0.5) * NPC.orbit * 0.8), { x: 0, y: Math.sin(m.a * 1.3) * 2.5, z: 0 });
      return { to: spot, match, fire: 'you', fireRate, speed: npc.stats.speed * quick, say, event };
    }
  }
}
nemesis.lines = ['again', 'half', 'fury', 'weak', 'evade', 'retreat', 'bait', 'search', 'found']; // (the lines a crew must have for one, beyond everyone's)
