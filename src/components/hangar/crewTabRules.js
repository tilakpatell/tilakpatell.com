// The Hangar's Crew and Arms, as plain rules: each ship's two, and a crew
// member's card as their style has them (lib/crew/crewStyle.js's tp-crew,
// checked against the galaxy's tables, as its worlds check it): their name,
// the outfit, the blade (a Jedi's), the gun in their hand (anyone else's;
// their own when nothing they can carry is picked) and a line about them.
// Pure, tested.
//
//   crewOf(ship) → [who, who]
//   carries(who, gun) → boolean            a gun they may have in their hand
//   gunOf(who, style) → a gun's id, or null for a Jedi or Artoo
//   cardOf(who, style) → { name, outfit, blade: { hex, color, hilt } | null, gun, line }

import { HAND_WEAPONS, HILTS, PICKABLE, SABER_COLORS, heroById, skinsOf } from '../galaxy/shared/arms';

const CREWS = { cruiser: ['rick', 'morty'], rv: ['walt', 'jesse'], xwing: ['luke', 'artoo'], falcon: ['han', 'chewie'] };
export const crewOf = (ship) => CREWS[ship] ?? [];

// (Artoo isn't one of the galaxy's heroes: no body to dress, nothing in his hand but a shock prod)
const ARTOO = { name: 'R2-D2', blurb: 'An astromech who has saved the galaxy more times than anyone has thanked him for. Flies in the X-wing’s socket.' };

const jedi = (who) => heroById(who)?.weapon === 'saber';
export const carries = (who, gun) => {
  const own = heroById(who)?.weapon;
  if (!own || own === 'saber' || !HAND_WEAPONS[gun]) return false;
  return gun === own || PICKABLE.includes(gun);
};
export function gunOf(who, style) {
  const hero = heroById(who);
  if (!hero || jedi(who)) return null;
  return carries(who, style?.gun) ? style.gun : hero.weapon;
}

export function cardOf(who, style = {}) {
  const hero = heroById(who);
  if (!hero) return { name: who === 'artoo' ? ARTOO.name : who, outfit: null, blade: null, gun: null, line: who === 'artoo' ? ARTOO.blurb : '' };
  const looks = skinsOf(who);
  const outfit = (looks.find((l) => l.id === style.skin) ?? looks[0])?.name ?? null;
  let blade = null;
  if (jedi(who)) {
    const color = SABER_COLORS.find((c) => c.id === style.saber?.color) ?? SABER_COLORS.find((c) => c.id === hero.saber?.color) ?? SABER_COLORS[0];
    const hilt = HILTS.find((h) => h.id === style.saber?.hilt) ?? HILTS.find((h) => h.id === hero.saber?.hilt) ?? HILTS[0];
    blade = { hex: color.hex, color: color.name, hilt: hilt.name };
  }
  const gun = gunOf(who, style);
  return { name: hero.name, outfit, blade, gun: gun ? HAND_WEAPONS[gun].name : null, line: hero.blurb };
}
