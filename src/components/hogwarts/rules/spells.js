// The wand’s nine spells, as plain numbers (docs/superpowers/specs/
// 2026-10-21-hogwarts-world-design.md §4.5). A spell is a row; casting it
// at something is a pure answer: what happens (`effects`, for
// play/wandfx.js to draw) and what it costs the house (`points`, never
// more than nothing: a spell gains no points by itself, a lesson does).
// The wheel’s keys are the table’s, 1 to 9.
//
//   SPELLS, spellById(id), spellByKey(n)
//   newWand({ house, learnt, t }) → the wand’s state: { t, ready, lit,
//     held, shield, duel, house, learnt }
//   at(wand, t) → the wand at time t (the world’s seconds)
//   readyIn(wand, id) → seconds before it can be cast again (0: now)
//   cast(wand, spell, target) → { wand, effects, points, why }
//   release(wand) → { wand, effects }: Leviosa let go (the key up)
//   shieldUp(wand), beat(wand): Protego’s shield, and whether a bolt
//     striking it now is thrown back (the first part of it) or only stopped
//   newBolt(spell, from, to, owner), stepBolt(bolt, dt, bodies) → { bolt,
//     hit }: a duel spell’s bolt, flown and hit-tested against figures and
//     shields; throwBack(bolt, owner) sends one back along its line
//   patronusFor(house) → the shape a house’s Patronus runs as
//
// A target is what the wand is pointed at: { kind, id, dist, ... } with
// the kinds below (a person, a knockable thing, a door or chest, a fire
// that can be lit, a thing that comes to Accio), or null (the air: a bolt
// goes along the wand’s line, a light comes on, a shield goes up).

export const HOUSES = ['gryffindor', 'hufflepuff', 'ravenclaw', 'slytherin'];

// The nine, in the wheel’s order. `kind` is what the spell does; `range`
// metres (0: on the wand itself); `cost` the points a cast at a person
// outside a duel takes (the misdeed: Snape appears for it); `cooldown`
// seconds; `needs`: what must be learnt first, or null. `move` is the
// cast’s clip: a flick (ual-cast) or a push (ual-cast.double).
export const SPELLS = [
  { id: 'lumos', key: 1, word: 'Lumos', off: 'Nox', colour: '#fff1c9', kind: 'light', range: 0, cost: 0, cooldown: 0.3, needs: null, move: 'flick', icon: 'sun' },
  { id: 'leviosa', key: 2, word: 'Wingardium Leviosa', colour: '#b9e4ff', kind: 'lift', range: 14, cost: 5, cooldown: 0.5, needs: null, move: 'flick', icon: 'feather' },
  { id: 'alohomora', key: 3, word: 'Alohomora', colour: '#ffd36e', kind: 'unlock', range: 5, cost: 0, cooldown: 1, needs: null, move: 'flick', icon: 'key' },
  { id: 'accio', key: 4, word: 'Accio', colour: '#8fd3ff', kind: 'summon', range: 20, cost: 5, cooldown: 1.2, needs: null, move: 'push', icon: 'magnet' },
  { id: 'incendio', key: 5, word: 'Incendio', colour: '#ff7a26', kind: 'fire', range: 9, cost: 15, cooldown: 1.5, needs: null, move: 'push', icon: 'flame' },
  { id: 'expelliarmus', key: 6, word: 'Expelliarmus', colour: '#ff2a3a', kind: 'bolt', range: 30, cost: 10, cooldown: 1.1, needs: null, move: 'push', icon: 'bolt', bolt: { speed: 15, radius: 0.16 } },
  { id: 'stupefy', key: 7, word: 'Stupefy', colour: '#6fa8ff', kind: 'bolt', range: 30, cost: 15, cooldown: 2.4, needs: null, move: 'push', icon: 'bolt', bolt: { speed: 19, radius: 0.2 } },
  { id: 'protego', key: 8, word: 'Protego', colour: '#cfe6ff', kind: 'shield', range: 0, cost: 0, cooldown: 1.6, needs: null, move: 'flick', icon: 'shield' },
  { id: 'patronum', key: 9, word: 'Expecto Patronum', colour: '#e6f2ff', kind: 'patronus', range: 40, cost: 0, cooldown: 8, needs: 'patronus', move: 'push', icon: 'paw' },
];

const BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));
export const spellById = (id) => BY_ID[id] ?? null;
export const spellByKey = (n) => SPELLS.find((s) => s.key === n) ?? null;

// What each kind of spell takes hold of. A pumpkin is on the list because
// Hagrid’s are bigger than you and a first-year will try.
export const LIFTS = ['feather', 'stone', 'chair', 'pumpkin', 'book', 'cushion'];
export const COMES = ['broom', 'trunk', 'snitch', 'book', 'feather', 'stone', 'cushion', 'scarf'];
export const BURNS = ['torch', 'fireplace', 'cauldron', 'bale', 'candle', 'feather'];
// a fire that goes out on its own (seconds); the rest stay lit
export const LASTS = { bale: 6, feather: 2.5 };
export const OPENS = ['door', 'chest', 'gate'];

// Protego: the shield’s second, the first part of which throws a bolt
// back (the beat), the rest only stopping it
export const SHIELD = { up: 1, beat: 0.4 };

// A house’s Patronus (my call, in the spec): the stag for Gryffindor,
// the hare for Ravenclaw (a reader will know whose that is), an otter for
// Hufflepuff, a fox for Slytherin.
export const PATRONUS = { gryffindor: 'stag', ravenclaw: 'hare', hufflepuff: 'otter', slytherin: 'fox' };
export const patronusFor = (house) => PATRONUS[house] ?? 'stag';

// What the wand says when a spell won’t do anything (a toast each, the
// site’s own words)
export const SAYS = {
  cooling: 'Your wand is still warm from the last one.',
  far: 'Too far for that one. Get closer.',
  nothing: 'Nothing there for that spell to take hold of.',
  open: 'It isn’t locked.',
  lit: 'Already burning.',
  door: 'It won’t. Some doors here have opinions.',
  misdeed: 'A spell at a person, outside a duel. Snape saw.',
};

export function newWand({ house = 'gryffindor', learnt = [], t = 0 } = {}) {
  return { t, ready: {}, lit: false, held: null, shield: null, duel: false, house, learnt: [...learnt] };
}

export const at = (wand, t) => (t === wand.t ? wand : { ...wand, t });

export function readyIn(wand, id) {
  return Math.max(0, (wand.ready[id] ?? 0) - wand.t);
}

const fizzle = (wand, why, extra = {}) => ({ wand, effects: [{ type: 'fizzle', why, say: SAYS[why] ?? why, ...extra }], points: 0, why: null });

// the wand after a cast that happened: the cooldown taken
const spent = (wand, spell, change = {}) => ({ ...wand, ...change, ready: { ...wand.ready, [spell.id]: wand.t + spell.cooldown } });

export function cast(wand, spell, target = null) {
  if (typeof spell === 'string') spell = spellById(spell);
  if (!spell) throw new Error('cast: no such spell');
  const left = readyIn(wand, spell.id);
  if (left > 0) return fizzle(wand, 'cooling', { left });
  if (spell.needs && !wand.learnt.includes(spell.needs)) {
    // (the books’ first tries: a silver mist, and the cooldown spent all the same)
    return { wand: spent(wand, spell), effects: [{ type: 'wisp', colour: spell.colour }], points: 0, why: null };
  }
  const person = target?.kind === 'person';
  if (target && spell.range > 0 && (target.dist ?? 0) > spell.range) return fizzle(wand, 'far', { range: spell.range });
  // a spell at a person outside a duel: whatever else it does, it costs
  const misdeed = person && !wand.duel && spell.cost > 0;
  const out = (w, effects) => {
    if (!misdeed) return { wand: w, effects, points: 0, why: null };
    return { wand: w, effects: [...effects, { type: 'misdeed', at: target.id, cost: spell.cost, say: SAYS.misdeed }], points: -spell.cost, why: 'misdeed' };
  };

  switch (spell.kind) {
    case 'light': {
      const lit = !wand.lit;
      return out(spent(wand, spell, { lit }), [{ type: 'light', on: lit, word: lit ? spell.word : spell.off }]);
    }
    case 'lift': {
      if (wand.held) return { ...release(wand), points: 0, why: null };
      if (person) return out(spent(wand, spell), [{ type: 'flash', colour: spell.colour, at: target.id }]);
      if (!target || !LIFTS.includes(target.kind)) return fizzle(wand, 'nothing');
      return out(spent(wand, spell, { held: target.id }), [{ type: 'lift', id: target.id, thing: target.kind }]);
    }
    case 'unlock': {
      if (!target || !OPENS.includes(target.kind)) return fizzle(wand, 'nothing');
      if (!target.locked) return fizzle(wand, 'open');
      if (target.allowed === false) return out(spent(wand, spell), [{ type: 'refuse', id: target.id, say: target.why ?? SAYS.door }]);
      return out(spent(wand, spell), [{ type: 'open', id: target.id }]);
    }
    case 'summon': {
      if (person) return out(spent(wand, spell), [{ type: 'flash', colour: spell.colour, at: target.id }]);
      if (!target || !COMES.includes(target.kind)) return fizzle(wand, 'nothing');
      return out(spent(wand, spell), [{ type: 'pull', id: target.id, thing: target.kind }]);
    }
    case 'fire': {
      if (person) return out(spent(wand, spell), [{ type: 'flash', colour: spell.colour, at: target.id }]);
      if (!target || !BURNS.includes(target.kind)) return fizzle(wand, 'nothing');
      if (target.lit) return fizzle(wand, 'lit');
      return out(spent(wand, spell), [{ type: 'ignite', id: target.id, thing: target.kind, lasts: LASTS[target.kind] ?? Infinity }]);
    }
    case 'bolt':
      return out(spent(wand, spell), [{ type: 'bolt', spell: spell.id, colour: spell.colour, at: target?.id ?? null }]);
    case 'shield':
      return out(spent(wand, spell, { shield: wand.t }), [{ type: 'shield', until: wand.t + SHIELD.up }]);
    case 'patronus':
      return out(spent(wand, spell), [{ type: 'patronus', shape: patronusFor(wand.house), range: spell.range }]);
    default:
      return fizzle(wand, 'nothing');
  }
}

// Leviosa let go: whatever was held drops where it is
export function release(wand) {
  if (!wand.held) return { wand, effects: [] };
  return { wand: { ...wand, held: null }, effects: [{ type: 'drop', id: wand.held }] };
}

export const shieldUp = (wand) => wand.shield != null && wand.t >= wand.shield && wand.t < wand.shield + SHIELD.up;
export const beat = (wand) => shieldUp(wand) && wand.t - wand.shield < SHIELD.beat;
// what a body’s shield is to a bolt arriving now: 'beat', 'up' or null
export const shieldOf = (wand) => (beat(wand) ? 'beat' : shieldUp(wand) ? 'up' : null);

// A bolt: { spell, colour, r, p: [x, y, z], v: [x, y, z], owner, life,
// back } (`back` once a shield has sent it home). It flies straight; its
// life is the spell’s range at its speed.
export function newBolt(spell, from, to, owner) {
  if (typeof spell === 'string') spell = spellById(spell);
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  const s = spell.bolt.speed;
  return { spell: spell.id, colour: spell.colour, r: spell.bolt.radius, p: [...from], v: [(d[0] / l) * s, (d[1] / l) * s, (d[2] / l) * s], owner, life: spell.range / s, back: false };
}

export const throwBack = (bolt, owner) => ({ ...bolt, v: [-bolt.v[0], -bolt.v[1], -bolt.v[2]], owner, back: true, life: Math.max(bolt.life, 2) });

// A body a bolt can hit: { id, p: [x, y, z] (the feet), r, h, shield:
// null | 'beat' | 'up' }, an upright capsule. A bolt that meets a body
// with a shield up is stopped (or thrown back on the beat); one that meets
// a body with none hits it. Nobody is hit by their own bolt going out.
export const SHIELD_R = 1.1; // the dome stands this far out from the body’s axis
export function stepBolt(bolt, dt, bodies = []) {
  if (bolt.life <= 0) return { bolt, hit: null };
  const q = [bolt.p[0] + bolt.v[0] * dt, bolt.p[1] + bolt.v[1] * dt, bolt.p[2] + bolt.v[2] * dt];
  let first = null;
  for (const b of bodies) {
    if (b.id === bolt.owner) continue;
    const reach = (b.shield ? SHIELD_R : (b.r ?? 0.35)) + bolt.r;
    const t = segmentToCapsule(bolt.p, q, b, reach);
    if (t != null && (!first || t < first.t)) first = { t, b };
  }
  if (!first) return { bolt: { ...bolt, p: q, life: bolt.life - dt }, hit: null };
  const { t, b } = first;
  const p = lerp3(bolt.p, q, t);
  if (b.shield === 'beat') return { bolt: { ...throwBack(bolt, b.id), p }, hit: { id: b.id, by: bolt.spell, how: 'back', p } };
  if (b.shield) return { bolt: { ...bolt, p, life: 0 }, hit: { id: b.id, by: bolt.spell, how: 'blocked', p } };
  return { bolt: { ...bolt, p, life: 0 }, hit: { id: b.id, by: bolt.spell, how: 'hit', p } };
}

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// where along a→b (0…1) the segment first comes within `reach` of the
// body’s upright axis (feet to head), or null; sampled finely enough for
// a bolt’s step (a frame’s flight is under a metre)
function segmentToCapsule(a, b, body, reach) {
  const n = 8;
  const [bx, by, bz] = body.p;
  const top = by + (body.h ?? 1.7);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const z = a[2] + (b[2] - a[2]) * t;
    const cy = Math.min(top, Math.max(by, y));
    if (Math.hypot(x - bx, y - cy, z - bz) <= reach) return t;
  }
  return null;
}
