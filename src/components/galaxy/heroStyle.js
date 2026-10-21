// The galaxy's hero and the crew's own style (lib/crew/crewStyle.js's
// tp-crew, which the Hangar's Crew and Arms write): one choice a person,
// wherever it's made. The galaxy's worlds dress the hero picked by it
// (heroes.js's readHero takes it), and what their deploy panel changes for
// one of the crews (an outfit, a blade, a gun) is written back to it. The
// first time it's read, the hero picked in the galaxy's own key seeds it, so
// nobody's choice is lost. The saves are handed in (runtime/local.js's
// localSaves()), so it's tested in Node.
//
//   readCrewStyle(saves, heroRaw) → crew        (seeded from tp-galaxy-hero once, and kept)
//   keepHeroStyle(saves, hero)                  a hero's choice (readHero's shape) kept as their style

import { CREW_KEY, CREW_WHO, readCrew, registerCrew, seedFromHero, setStyle } from '../../lib/crew/crewStyle';
import { heroById } from './heroes';

const parse = (raw) => {
  if (typeof raw !== 'string') return raw ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function readCrewStyle(saves, heroRaw) {
  registerCrew(saves);
  const crew = readCrew(saves.get(CREW_KEY, null));
  const seeded = seedFromHero(crew, parse(heroRaw));
  if (seeded !== crew) saves.set(CREW_KEY, seeded);
  return seeded;
}

export function keepHeroStyle(saves, hero) {
  if (!CREW_WHO.includes(hero?.id)) return;
  registerCrew(saves);
  const jedi = heroById(hero.id)?.weapon === 'saber';
  const crew = readCrew(saves.get(CREW_KEY, null));
  saves.set(CREW_KEY, setStyle(crew, hero.id, { skin: hero.skin ?? null, saber: jedi ? { color: hero.color, hilt: hero.hilt } : null, gun: jedi ? null : (hero.gun ?? null) }));
}
