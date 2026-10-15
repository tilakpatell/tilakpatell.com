// Blades and the Force against you. Whoever fights with a blade (Vader,
// the Royal Guards with their pikes, Obi-Wan) or the Force (the Emperor)
// and is set on you fights on saber.js's rules. A stroke winds up, lands
// its blow and recovers. A guard blocks, and parries if it has only just
// come up. A heavy stroke breaks a held guard. Stamina pays for all of it.
// force.js's vaderMind chooses each fighter's moves. Only Vader has the
// Force, so only he pushes or grips; for the guards and Obi-Wan those
// choices never come up. emperorMind throws the Emperor's lightning and
// his taunts. When you hold a blade you fight back on the same rules:
// fire strokes light, fire with your guard up strokes heavy, your guard
// (aim) blocks and parries, and a dodge (the jump key, passed as `dodge`) dodges. A blow on them goes
// through combat.hurt, so the crew's minds see the hit and the stagger.
// A blow on you comes off your health. A push throws you back, a grip
// lifts you and chokes you for 2 s, and lightning burns, half as much
// through a guard that faces it. Your raised arms count as a guard, since
// Luke meets the Emperor without his saber. Neither the grip nor the
// lightning kills on its own. A blow that lands on anyone not duelling
// (a trooper) cuts them as battle.js's blade always did. Each step it
// tells brains.js through `p.mind.duel` whether the fighter closes in or
// stands, and what it is doing. g.duel.lit is the Emperor whose lightning
// is on you, for the scene to draw. A Vader the story sets on you is never
// killed: at half his health he gives ground, which the story hears as his
// tag put down, and he stops fighting. Pure apart from the game it changes.
//
//   duelStep(g, input, dt) → void   after the crew's step; input: rules/game.js's, its jump as `dodge`
//   foesOf(g) → [person]            who is duelling you this step

import { CAST } from '../cast';
import { hurt } from '../combat';
// (force.js's useForce is no React hook, whatever its name: called by another here so the linter knows it)
import { createForce, emperorMind, forceStep, stopForce, useForce as cast, vaderMind } from '../force';
import { createFighter, resolveClash, saberStep, STROKES } from '../saber';
import { cutAt, youDown } from './battle';
import { feedPlot } from './plot';

const RANGE = 16; // metres off a fighter still duels you from (the Emperor's lightning reaches 12)
const NEAR = 1.6; // metres a blade fighter closes to
const SHOVE = 0.35; // seconds a push throws you for
// of a stroke's damage, what it takes off your health: saber.js's numbers are for a duel of equals,
// and you are one body against the station (Vader's heavy a quarter of you, a guard's pike less)
const HARM = { vader: 0.6, royalguard: 0.45, obiwan: 0.6 };
const LIVE = new Set(['fight', 'scripted']);

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const blade = (p) => Boolean(CAST[p.kind]?.blade);
const caster = (p) => p.kind === 'emperor';

// set on you: brains.js's fight with you as its mark, or the story's word (a hostile with a script)
const setOn = (p) => (p.mode === 'fight' && p.mind?.fight?.target === 'you') || (p.mode === 'scripted' && p.hostile === true);

function foesOf(g) {
  const you = g.you;
  if (!(you.hp > 0)) return [];
  return g.crew.people.filter((p) => p.hp > 0 && LIVE.has(p.mode) && (blade(p) || caster(p)) && setOn(p) && p.room === you.room && flat(p, you) <= RANGE && Math.abs(p.y - you.y) < 3);
}

// a fighter for a body, kept between steps, its place and health the body's
function fighterOf(state, id, body, side) {
  let f = state.fighters.get(id);
  if (!f) {
    f = createFighter({ id, x: body.x, z: body.z, yaw: body.yaw, side, hp: body.hp });
    state.fighters.set(id, f);
  }
  Object.assign(f, { x: body.x, z: body.z, yaw: body.yaw, hp: body.hp });
  return f;
}

// what a fighter's stroke looks like on the figure, in turn
function strokeAnim(p, kind) {
  p.strokes = (p.strokes ?? 0) + 1;
  return kind === 'heavy' ? 'heavy' : 'strike';
}

export function duelStep(g, input, dt) {
  const you = g.you;
  const state = (g.duel ??= { fighters: new Map(), minds: new Map(), lit: null, gripped: 0, shove: null });
  state.gripped = Math.max(0, state.gripped - dt);
  const foes = foesOf(g);
  // (whoever has stopped duelling lets go of what they held)
  for (const id of [...state.minds.keys()]) {
    if (foes.some((p) => p.id === id)) continue;
    const m = state.minds.get(id);
    stopForce(m.force);
    if (state.lit === id) state.lit = null;
    state.minds.delete(id);
    state.fighters.delete(id);
    const p = g.crew.byId.get(id);
    if (p?.mind) p.mind.duel = null;
    if (p) p.guard = false;
  }

  // you: a blade or your raised arms against the Emperor
  const guarding = Boolean(input.aim) && (Boolean(you.blade) || foes.some(caster));
  const me = fighterOf(state, 'you', you, you.side);
  const mine = you.blade && !you.gun ? saberStep(me, { strike: input.fire ? (guarding ? 'heavy' : 'light') : null, guard: guarding && !input.fire, dodge: Boolean(input.dodge) && foes.length > 0 }, dt) : saberStep(me, { guard: guarding }, dt);
  for (const e of mine) if (e.type === 'stroke') g.events.push({ type: 'swing', by: 'you', colour: you.blade, kind: e.kind });

  const all = [...mine.map((e) => ({ e, f: me, p: null }))];
  let forced = 0;
  for (const p of foes) {
    const f = fighterOf(state, p.id, p, p.side);
    let m = state.minds.get(p.id);
    if (!m) {
      m = { force: createForce(p.kind), last: null, read: null, now: g.time, saidAt: g.time - 4 };
      state.minds.set(p.id, m);
    }
    m.me = f;
    m.now = g.time;
    const d = flat(p, you);
    if (caster(p)) {
      const want = emperorMind(m, me, g.rand);
      if (want.force === 'lightning') {
        const ev = cast(m.force, 'lightning', f, [me]);
        if (ev) state.lit = p.id;
      }
      if (want.say) g.events.push({ type: 'say', who: 'emperor', name: CAST.emperor.name, text: want.say });
      p.mind.duel = { move: null, anim: m.force.channel ? 'lightning' : 'idle' };
    } else {
      const want = p.mode === 'down' ? {} : vaderMind(m, me, g.rand);
      if (want.force) {
        const ev = cast(m.force, want.force, f, [me]) ?? [];
        for (const x of ev) {
          if (x.type === 'push') {
            state.shove = { x: x.dir.x, z: x.dir.z, t: SHOVE };
            g.events.push({ type: 'pushed', by: p.id });
          } else if (x.type === 'choke') {
            g.events.push({ type: 'choked', by: p.kind });
          }
        }
      }
      const ev = saberStep(f, { strike: want.strike ?? null, guard: Boolean(want.guard), dodge: Boolean(want.dodge) }, dt);
      let anim = f.guard ? 'guard' : f.stagger > 0 ? 'hit' : m.force.channel ? 'cast' : p.mind.duel?.anim === 'strike' || p.mind.duel?.anim === 'heavy' ? p.mind.duel.anim : 'idle';
      for (const x of ev) {
        if (x.type === 'stroke') anim = strokeAnim(p, x.kind);
        all.push({ e: x, f, p });
      }
      if (!f.stroke && (anim === 'strike' || anim === 'heavy')) anim = f.guard ? 'guard' : 'idle';
      p.guard = f.guard;
      p.mind.duel = { move: want.move === 'in' || d > STROKES.heavy.reach ? 'in' : null, near: NEAR, anim };
    }
    // the Force each step: a grip held, lightning burning (what it costs you counted apart from blows)
    const was = me.hp;
    for (const x of forceStep(m.force, f, [me], dt)) {
      if (x.type === 'choke') state.gripped = Math.max(state.gripped, 0.1);
      if (x.type === 'end' && state.lit === p.id) state.lit = null;
    }
    forced += Math.max(0, was - me.hp);
  }

  // the blows, each once on each fighter it reaches
  for (const { e, f, p } of all) {
    if (e.type !== 'blow') continue;
    if (!p) {
      // yours: on each duellist in reach, and a cut on anyone else in front
      let met = false;
      for (const q of foes) {
        const qf = state.fighters.get(q.id);
        if (!qf || caster(q)) continue;
        const r = resolveClash(me, qf);
        if (r.result === 'none' || r.result === 'miss') continue;
        met = true;
        blowOn(g, q, r, you);
      }
      if (!met) cutAt(g, you.yaw, STROKES[e.kind].damage * (e.kind === 'heavy' ? 2 : 3));
    } else {
      const r = resolveClash(f, me);
      if (r.result === 'none' || r.result === 'miss') continue;
      if (r.result === 'hit') {
        const amount = r.damage * (HARM[p.kind] ?? 0.5);
        const what = hurt(you, amount, g.time);
        g.events.push({ type: 'hurt', amount, from: { x: p.x, z: p.z }, what, by: 'blade' });
        if (what === 'dead') youDown(g);
      } else g.events.push({ type: 'deflect', x: (you.x + p.x) / 2, y: you.y + 1.2, z: (you.z + p.z) / 2, by: r.result });
    }
  }
  // what the Force did to you this step, the grip and the lightning never past your last breath
  const amount = Math.min(forced, you.hp - 1);
  if (amount > 0) {
    you.hp -= amount;
    you.hurtAt = g.time;
    g.events.push({ type: 'hurt', amount, from: null, what: 'hurt', by: state.lit ? 'lightning' : 'choke' });
  }
}

// your blow on a duellist: a hit hurts them through combat.hurt (which the crew's minds see); a
// guard that meets it rings. A story's Vader beaten to half his health gives ground instead.
function blowOn(g, q, r, you) {
  const at = { x: (you.x + q.x) / 2, y: q.y + 1.2, z: (you.z + q.z) / 2 };
  if (r.result === 'hit') {
    q.hurtBy = 'you';
    const half = (q.max ?? CAST[q.kind].hp) / 2;
    const yields = q.kind === 'vader' && g.plot && !g.plot.done && q.hostile === true;
    hurt(q, yields ? Math.min(r.damage, q.hp - half) : r.damage, g.time);
    if (yields && q.hp <= half) {
      q.hostile = false;
      feedPlot(g, { type: 'killed', kind: q.kind, tag: q.tag });
    }
    const d = flat(q, you) || 1;
    g.events.push({ type: 'hit', target: q.id, ...at, damage: r.damage, by: 'blade', dir: { x: (q.x - you.x) / d, y: 0, z: (q.z - you.z) / d } });
  } else if (r.result !== 'dodged') g.events.push({ type: 'deflect', ...at, by: r.result });
}

// a push's throw this step, if one is on: the way to shove you, for rules/game.js to walk you
export function shoveOf(g, dt) {
  const s = g.duel?.shove;
  if (!s) return null;
  s.t -= dt;
  if (s.t <= 0) g.duel.shove = null;
  return { x: s.x, z: s.z };
}

// whether a grip holds you off your feet this step
export const gripped = (g) => (g.duel?.gripped ?? 0) > 0;
