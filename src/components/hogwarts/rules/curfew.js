// Curfew (the design’s §4.8): past the world’s 21:00 the castle’s corridors
// are Filch’s and Mrs Norris’s. Filch sees you 6 m into his lantern’s cone,
// Mrs Norris 10 m in a cat’s wide look, the prefects on the Grand Staircase
// and Snape on his round a little further than Filch; a moment in anyone’s
// sight and you’re caught: a toast, twenty points off and a walk back to
// your common room. The invisibility cloak hides you from Filch, the
// prefects and Snape, but not from the cat, and not from Peeves, who calls
// out where you are; Filch hears him (the sim’s `noise`) and comes at a
// hurry to where you were, and if you’re still there he walks into you,
// cloak or no cloak. A lit wand is a light under any cloak, and running is
// heard. Pure: the figures’ places come in from rules/people.js (through
// the walkers), the player’s from the walk, both in the Map’s frame.
//
//   CURFEW: { from, to } hours; SIGHT: { kind: { range, cone } } (cone: the half-angle, radians)
//   NOTICE (s in sight before you’re caught), FINE (points), HUNT (Filch’s hurry)
//   afterHours(hour) → whether it’s past curfew
//   watchers(figures) → [{ id, kind, name, x, z, dx, dz, inside, range, cone }]: who is watching
//   sees(w, player) → 0…1: how plainly a watcher sees the player now (0: not at all)
//   newCurfew() → the state: { alert, by, hunt, filch, peeves, caught, t }
//   step(state, { hour, dt, player, figures, house }) → { state, events }
//     player: { x, z, inside, cloak, lit, running }; figures: rules/people.js’s everyone()
//     events: { type: 'noticed', by } (someone has half a look: the HUD’s eye opens),
//             { type: 'peeves', line, at } (his bubble), { type: 'heard', at } (Filch is coming),
//             { type: 'caught', by, toast, to } and { type: 'points', house, delta, why }
//   filchAt(state, base) → Filch’s place: his own (rules/people.js’s) or where his hurry has got him

import { words } from './points';

export const CURFEW = { from: 21, to: 6 };
export const NOTICE = 0.7; // s: a moment in sight is caught; less is a fright
export const FINE = 20;
export const HUNT = { pace: 2.3, linger: 9, back: 1.4, bump: 1.4 }; // m/s to the noise, s he looks round there, m/s back, m he walks into you at
export const PEEVES = { reach: 8, every: 14 }; // m he spots you from, s between his calls
export const RUN_HEARD = 9; // m: Filch hears a run this far off

// (cone: half the angle, so a lantern held out lights ±35°, a cat looks ±80°)
export const SIGHT = {
  filch: { range: 6, cone: 0.61 },
  cat: { range: 10, cone: 1.4 },
  prefect: { range: 7, cone: 0.9 },
  snape: { range: 8, cone: 0.8 },
};
const LIT = 1.6; // a lit wand is seen this much further off, cloak or none

// what Peeves says when he spots you, in the open or under the cloak (the site’s own words)
export const PEEVES_LINES = {
  open: ['Oho! A little one out of bed! Argus! There’s a nose out past the bell!', 'Somebody smells of library at midnight. Somebody’s for it!', 'Walk this way, Mr Filch, there’s one loose on the stairs!', 'Tiptoe, tiptoe, all the way to detention!'],
  cloaked: ['A cloak, is it? Very pretty. Caretaker! Come and see the pretty cloak!', 'Nobody there, nobody there, and nobody’s breathing very loudly! Argus!', 'I can see your feet, invisible person. Mr Filch can’t. Mr Filch!'],
};

// what the toast says when you’re caught, by who caught you (the number said, as a teacher says it)
const SAID = words(FINE);
const CAUGHT = {
  filch: (h) => `Filch’s lantern found you, and ${SAID} points went from ${h}.`,
  cat: (h) => `Mrs Norris sat and stared until Filch came: ${SAID} points from ${h}.`,
  prefect: (h) => `A prefect marched you back to bed and took ${SAID} points from ${h}.`,
  snape: (h) => `Snape found you in the dark and took ${SAID} points from ${h} without a word.`,
  bump: (h) => `Filch walked straight into you, cloak and all: ${SAID} points from ${h}.`,
};
const HOUSE_NAME = { gryffindor: 'Gryffindor', hufflepuff: 'Hufflepuff', ravenclaw: 'Ravenclaw', slytherin: 'Slytherin' };

export const afterHours = (hour) => {
  const h = ((hour % 24) + 24) % 24;
  return h >= CURFEW.from || h < CURFEW.to;
};

// Who watches: Filch and his cat whenever they’re about at night, the
// prefects on their round, Snape on his
export function watchers(figures = []) {
  const out = [];
  for (const f of figures) {
    let kind = null;
    if (f.id === 'filch') kind = 'filch';
    else if (f.id === 'norris') kind = 'cat';
    else if (f.round === 'prefects') kind = 'prefect';
    else if (f.id === 'snape' && f.round === 'snape') kind = 'snape';
    if (!kind || f.rest) continue;
    const l = Math.hypot(f.dx ?? 0, f.dz ?? 1) || 1;
    out.push({ id: f.id, kind, x: f.x, z: f.z, dx: (f.dx ?? 0) / l, dz: (f.dz ?? 1) / l, inside: f.inside ?? null, ...SIGHT[kind] });
  }
  return out;
}

// How plainly a watcher sees you: nothing through a wall (another room, or
// out on the grounds while they’re in), nothing past their reach or outside
// their cone, more the nearer and the straighter ahead; the cloak hides you
// from all but the cat, and a lit wand shows under it
export function sees(w, p) {
  if (!p || w.inside !== p.inside || p.inside == null) return 0;
  const cloaked = p.cloak && w.kind !== 'cat';
  if (cloaked && !p.lit) return 0;
  const range = w.range * (p.lit ? LIT : 1);
  const dx = p.x - w.x;
  const dz = p.z - w.z;
  const d = Math.hypot(dx, dz);
  if (d > range) return 0;
  if (d < 0.8) return 1;
  const cos = (dx * w.dx + dz * w.dz) / d;
  const off = Math.acos(Math.max(-1, Math.min(1, cos)));
  if (off > w.cone) return 0;
  return Math.min(1, (1 - d / range) * 0.6 + (1 - off / w.cone) * 0.4 + 0.25);
}

export const newCurfew = () => ({ t: 0, alert: 0, by: null, hunt: null, filch: null, peeves: -Infinity, line: 0, caught: 0 });

// Filch’s place, his own or his hurry’s
export const filchAt = (state, base) => (state?.filch ? { ...base, x: state.filch.x, z: state.filch.z, dx: state.filch.dx, dz: state.filch.dz, moving: true } : base);

function toward(from, to, pace, dt) {
  const dx = to[0] - from.x;
  const dz = to[1] - from.z;
  const d = Math.hypot(dx, dz);
  const s = Math.min(d, pace * dt);
  if (d < 1e-6) return { ...from, arrived: true };
  return { x: from.x + (dx / d) * s, z: from.z + (dz / d) * s, dx: dx / d, dz: dz / d, arrived: s >= d - 1e-6 };
}

export function step(state, { hour, dt, player, figures = [], house = 'gryffindor' }) {
  const events = [];
  const s = { ...state, t: state.t + dt };
  const night = afterHours(hour);
  // Filch’s own place this moment, and the figures as the curfew sees them (his hurry in place of his round)
  const base = figures.find((f) => f.id === 'filch') ?? null;
  const seen = night ? watchers(figures.map((f) => (f.id === 'filch' ? filchAt(s, f) : f))) : [];

  // Filch’s hurry: to the noise, a look round, then back to his round
  if (s.hunt && base) {
    const here = s.filch ?? { x: base.x, z: base.z, dx: base.dx, dz: base.dz };
    if (s.hunt.until > s.t) {
      const go = toward(here, s.hunt.at, HUNT.pace, dt);
      s.filch = { x: go.x, z: go.z, dx: go.dx ?? here.dx, dz: go.dz ?? here.dz };
      if (go.arrived && !s.hunt.there) s.hunt = { ...s.hunt, there: true, until: Math.min(s.hunt.until, s.t + HUNT.linger) };
    } else {
      const back = toward(here, [base.x, base.z], HUNT.back, dt);
      s.filch = back.arrived ? null : { x: back.x, z: back.z, dx: back.dx, dz: back.dz };
      if (back.arrived) s.hunt = null;
    }
  }
  if (!night || !player || player.inside == null) {
    s.alert = Math.max(0, s.alert - dt * 2);
    s.by = null;
    return { state: s, events };
  }

  // who has a look at you, and how plainly
  let best = 0;
  let by = null;
  for (const w of seen) {
    const k = sees(w, player);
    if (k > best) {
      best = k;
      by = w.kind;
    }
  }
  // (walked into: Filch at the noise and you still standing in it)
  const f = s.filch ?? (base ? { x: base.x, z: base.z } : null);
  const bumped = s.hunt && f && base?.inside === player.inside && Math.hypot(f.x - player.x, f.z - player.z) < HUNT.bump;
  if (bumped) {
    best = 1;
    by = 'bump';
  }
  const was = s.alert;
  s.alert = best > 0 ? Math.min(1, s.alert + (dt * best) / NOTICE + (by === 'bump' ? 1 : 0)) : Math.max(0, s.alert - dt / (NOTICE * 2));
  s.by = best > 0 ? by : s.by;
  if (was === 0 && s.alert > 0 && by) events.push({ type: 'noticed', by });
  if (s.alert >= 1) {
    const name = HOUSE_NAME[house] ?? 'your house';
    const who = s.by ?? by ?? 'filch';
    events.push({ type: 'caught', by: who, toast: CAUGHT[who](name), to: house });
    events.push({ type: 'points', house, delta: -FINE, why: 'out after curfew' });
    return { state: { ...newCurfew(), t: s.t, caught: s.caught + 1, peeves: s.peeves }, events };
  }

  // Peeves: he sees you whatever you wear, says so, and Filch hears it
  const peeves = figures.find((x) => x.id === 'peeves');
  if (peeves && peeves.inside === player.inside && Math.hypot(peeves.x - player.x, peeves.z - player.z) < PEEVES.reach && s.t - s.peeves > PEEVES.every) {
    s.peeves = s.t;
    const lines = PEEVES_LINES[player.cloak ? 'cloaked' : 'open'];
    const line = lines[s.line % lines.length];
    s.line += 1;
    events.push({ type: 'peeves', line, at: [peeves.x, peeves.z] });
    if (base?.inside === player.inside) {
      s.hunt = { at: [player.x, player.z], until: s.t + 60, there: false };
      events.push({ type: 'heard', at: [player.x, player.z] });
    }
  }
  // a run is heard down a corridor
  if (player.running && base && base.inside === player.inside && Math.hypot(base.x - player.x, base.z - player.z) < RUN_HEARD && !s.hunt) {
    s.hunt = { at: [player.x, player.z], until: s.t + 30, there: false };
    events.push({ type: 'heard', at: [player.x, player.z] });
  }
  return { state: s, events };
}
