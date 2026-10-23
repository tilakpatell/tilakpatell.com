// The crew's abilities on the universe map's planets, on G and V, as the
// galaxy's worlds have them (galaxy/surface/abilityRules.js, lent through
// galaxy/shared/fight.js): each crew member carries their own pair, as the
// galaxy's heroes do (heroes.js: Rick's portal hop and overcharge, Morty's
// sprint and medpack, Walt's fulminate and overcharge, Jesse's sprint and
// overcharge, Han's detonite charge and sharpshooter, Chewie's leap and
// furious bowcaster, Luke's push and repulse; Artoo, who isn't one of the
// galaxy's heroes, his booster rockets and a patch-up), each on its own
// cooldown. What each kind does is here as numbers on the planet (a person
// is { n, f, h }, `n` up from the planet's middle; distances along the
// ground; METRE map units a metre): a push's reach and cone and the shove
// it gives, a thrown charge's arc, its fuse and its blast, the hop's way
// on, a sprint's and an overcharge's time, the jetpack's tank. Pure, so
// it's tested in Node; footAbilityPlay.js plays them in the scene.
//
//   ARTOO, PLAYED, KNOCK_FOR, BLAST
//   cardOf(id), kindOf(id)       a card (the galaxy's, or Artoo's) and how it plays
//   pairOf(who) → { power, second }   the card ids a crew member carries (a kind the planets don't play is the site's own for it)
//   newAbilities() → the scene's record: { cool: { power, second } (when each is ready), hot (overcharged till), fast (sprinting till), jet }
//   spend(st, slot, id, now) → { ok: true, kind, card } | { ok: false, why: 'none' | 'held' | 'cooling', left? }
//   overcharged(st, now), sprintOf(st, now) (a speed multiplier)
//   lift(st, w, hold, dt, metre) → w (the jetpack held: thrusting while there's fuel, refilled on the ground)
//   tilesOf(st, pair, now) → [{ key, slot, id, name, left, full, on }] for the HUD
//   knockOf(card) → { range, cone, force, lift, damage } (a repulse all round); damageOf(card) what its hit lands on a trooper
//   inReach(me, t, R, f, metre) → { hit, k (1 close … 0.4 at the edge), d }
//   shoveOf(me, t, speed) → { dir (along the ground, away), speed, left, total }
//   throwOf(me, card, R, metre) → a charge thrown along the facing: { p, v, age, card }
//   throwStep(g, dt, R, metre) → the charge a step on: { ...g, p, v, age, landed, boom }
//   blastOn(d, card, metre) → { hit, k, damage } (d: map units from where it went off)
//   hopTo(me, card, R, clear, metre) → { n, f } a portal's reach on (shorter if the far end's blocked), or null

import { ABILITIES, JET, abilitiesOf, forceOf, hitOf, jetStep, newJet } from '../galaxy/shared/fight';
import { heroById } from '../galaxy/shared/arms';
import { bearing, flat, offset, vec } from './foot';

const { add, scale, len, unit, dot } = vec;

// Artoo's own: the booster rockets he flies on (Attack of the Clones), held
// like the jetpack, and a patch-up from his arm
export const ARTOO = {
  artooRockets: { kind: 'jetpack', name: 'Booster rockets', about: 'Artoo’s: hold to fly. The tank refills on the ground.', cool: 0, hold: true },
  artooPatch: { kind: 'medpack', name: 'Patch-up', about: 'Artoo’s: a third of your health back, from his arm.', cool: 25, heal: 35 },
};
// the kinds the map's planets play (everything the crew carry)
export const PLAYED = ['push', 'repulse', 'detonator', 'fulminate', 'overcharge', 'medpack', 'hop', 'sprint', 'jetpack'];
// how long a shove carries a body (the galaxy's abilityRules.js KNOCK_FOR), in seconds
export const KNOCK_FOR = 1;
// a thrown charge's blast on you and whoever it throws (the galaxy's surface/scene.js stepBombs): health off you at its middle, the shove and the lift (metres a second) at its middle
export const BLAST = { you: 30, shove: 8, lift: 4, gravity: 14, hand: 1.4, ahead: 0.6 };

export const cardOf = (id) => ABILITIES[id] ?? ARTOO[id] ?? null;
export const kindOf = (id) => cardOf(id)?.kind ?? (cardOf(id) ? id : null);

export function pairOf(who) {
  if (who === 'artoo') return { power: 'artooRockets', second: 'artooPatch' };
  const hero = heroById(who);
  if (!hero) return { power: 'detonator', second: 'overcharge' };
  const p = abilitiesOf(hero);
  return { power: PLAYED.includes(kindOf(p.power)) ? p.power : 'detonator', second: PLAYED.includes(kindOf(p.second)) ? p.second : 'overcharge' };
}

export const newAbilities = () => ({ cool: { power: 0, second: 0 }, hot: 0, fast: 0, jet: newJet() });

export function spend(st, slot, id, now) {
  const card = cardOf(id);
  if (!card) return { ok: false, why: 'none' };
  if (card.hold) return { ok: false, why: 'held' };
  if (now < st.cool[slot]) return { ok: false, why: 'cooling', left: st.cool[slot] - now };
  st.cool[slot] = now + card.cool;
  const kind = kindOf(id);
  if (kind === 'overcharge') st.hot = now + card.dur;
  if (kind === 'sprint') st.fast = now + card.dur;
  return { ok: true, kind, card };
}
export const overcharged = (st, now) => now < st.hot;
export const sprintOf = (st, now) => (now < st.fast ? ABILITIES.sprint.speed : 1);

export function lift(st, w, hold, dt, metre) {
  jetStep(st.jet, { hold, grounded: (w.h ?? 0) <= 1e-6, dt });
  if (!st.jet.on) return w;
  // (up against gravity while it burns, to its top speed: the walk's own gravity is after this)
  const vh = Math.min(JET.lift * metre, (w.vh ?? 0) + (9.8 + JET.thrust) * metre * dt);
  return { ...w, vh, h: Math.max(w.h ?? 0, 1e-4) };
}

export function tilesOf(st, pair, now) {
  return ['power', 'second'].map((slot) => {
    const id = pair[slot];
    const card = cardOf(id);
    const kind = kindOf(id);
    const left = card?.hold ? (JET.tank - st.jet.fuel) / JET.tank : Math.max(0, st.cool[slot] - now);
    const full = card?.hold ? 1 : (card?.cool ?? 1);
    const on = kind === 'overcharge' ? now < st.hot : kind === 'sprint' ? now < st.fast : kind === 'jetpack' ? st.jet.on : false;
    return { key: slot === 'power' ? 'G' : 'V', slot, id, name: card?.name ?? '', left, full, on, held: Boolean(card?.hold) };
  });
}

export function knockOf(card) {
  const f = forceOf(card);
  return card?.kind === 'repulse' ? { ...f, cone: Math.PI } : f;
}
export const damageOf = (card) => hitOf(card, false);

export function inReach(me, t, R, f, metre) {
  const d = Math.acos(Math.max(-1, Math.min(1, dot(me.n, t.n)))) * R;
  if (d > f.range * metre) return { hit: false, k: 0, d };
  const toward = add(t.n, me.n, -1);
  if (len(toward) > 1e-9 && Math.abs(bearing(me.n, me.f, toward)) > f.cone) return { hit: false, k: 0, d };
  return { hit: true, k: 1 - (d / (f.range * metre)) * 0.6, d };
}

export function shoveOf(me, t, speed) {
  const away = add(t.n, me.n, -1);
  const dir = len(away) > 1e-9 ? flat(away, t.n) : flat(me.f, t.n);
  return { dir, speed, left: KNOCK_FOR, total: KNOCK_FOR };
}

export function throwOf(me, card, R, metre) {
  const up = unit(me.n);
  const p = add(scale(up, R + (me.h ?? 0) + BLAST.hand * metre), me.f, BLAST.ahead * metre);
  const v = add(scale(me.f, card.speed * metre), up, card.lift * metre);
  return { p, v, age: 0, card };
}

export function throwStep(g, dt, R, metre) {
  const down = scale(unit(g.p), -BLAST.gravity * metre * dt);
  let v = add(g.v, down);
  let p = add(g.p, v, dt);
  const age = g.age + dt;
  let landed = false;
  if (len(p) <= R) {
    p = scale(unit(p), R + 0.05 * metre);
    v = [0, 0, 0];
    landed = true;
  }
  return { ...g, p, v, age, landed, boom: landed || age >= g.card.fuse };
}

export function blastOn(d, card, metre) {
  const r = card.radius * metre;
  if (d > r) return { hit: false, k: 0, damage: 0 };
  const k = 1 - d / r;
  return { hit: true, k, damage: Math.max(1, Math.round(card.damage * (0.4 + 0.6 * k))) };
}

export function hopTo(me, card, R, clear, metre) {
  for (const share of [1, 0.75, 0.5]) {
    const to = offset(me, card.reach * metre * share, 0, R);
    if (clear(to)) return to;
  }
  return null;
}
