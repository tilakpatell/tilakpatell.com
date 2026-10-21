// Who you fly as (./flight.js and ./brawl.js take the numbers; ./scene.js
// swaps the figure; ./powers.js is the power on F): Mark, and once earned,
// Atom Eve, Omni-Man and Thragg, as one table. Pure.
//
// hero(id) → { id, name, figure (../cast.js's row), flight (multipliers on
//   FLY's numbers), fists (a blow's weight: 1 is one of a foe's `hits`),
//   power (./powers.js's id, or null), voice (./voicelines.js's speaker),
//   chip (the HUD's title) }
// canPlay(id, { story, unlocked }) → whether it is earned: Eve by her race's
//   best, Omni-Man by episode 8 (`truth`), Thragg by Think, Mark! won on
//   Viltrumite (`regent`); Mark always. An unknown id is Mark.

export const DEFAULT = 'mark';
export const ONE = Object.freeze({});

export const HEROES = {
  mark: { id: 'mark', name: 'Mark', figure: 'mark', flight: ONE, fists: 1, power: null, voice: 'mark', chip: 'INVINCIBLE · THE GRAYSONS’ CITY', needs: null },
  eve: { id: 'eve', name: 'Atom Eve', figure: 'eve', flight: { top: 0.8, turn: 1.3 }, fists: 1, power: 'transmute', voice: 'eve', chip: 'ATOM EVE · THE GRAYSONS’ CITY', needs: { race: 'everace' } },
  omniman: { id: 'omniman', name: 'Omni-Man', figure: 'omni', flight: { top: 1.6, cruise: 1.3, accel: 1.4, boostAccel: 1.5, barrier: 0.75, rearm: 0.75 }, fists: 1.5, power: 'linebreak', voice: 'omniman', chip: 'OMNI-MAN · THE GRAYSONS’ CITY', needs: { achievement: 'truth' } },
  thragg: { id: 'thragg', name: 'Thragg', figure: 'thragg', flight: { top: 1.8, cruise: 1.4, accel: 1.5, boostAccel: 1.6 }, fists: 2, power: 'shout', voice: 'thragg', chip: 'THRAGG · THE GRAYSONS’ CITY', needs: { achievement: 'regent' } },
};
export const ORDER = ['mark', 'eve', 'omniman', 'thragg'];

export const hero = (id) => HEROES[id] ?? HEROES[DEFAULT];

export function canPlay(id, { story = null, unlocked = [] } = {}) {
  const h = HEROES[id];
  if (!h) return false;
  if (!h.needs) return true;
  if (h.needs.race) return story?.best?.[h.needs.race] != null;
  if (h.needs.achievement) return unlocked.includes(h.needs.achievement);
  return false;
}

// what a locked hero wants, for the menu
export function lockLine(id) {
  const h = HEROES[id];
  if (!h?.needs) return null;
  if (h.needs.race) return 'Win Eve’s race';
  return h.needs.achievement === 'truth' ? 'Play episode 8' : 'Win Think, Mark! on Viltrumite';
}

// a kept hero id read back: one the table has, else Mark
export const keptHero = (v) => (typeof v === 'string' && HEROES[v] ? v : DEFAULT);
