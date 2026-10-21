// Which guide a page gets, what it's called, and whether its first visit
// gets a note by the "?" button (`nudge`: it has controls worth knowing). The
// universe and the galaxy don't: their "?" is in their own panel, their first
// hint already says where the controls are, and the note, up top, sat over
// the crew's line. Small
// on purpose: the corner button needs it from the first page, while what
// each guide says (pages.js) loads with the panel, the first time it opens.

export const GUIDES = {
  '/home': { title: 'Home' },
  '/experience': { title: 'Experience' },
  '/projects': { title: 'Projects' },
  '/project': { title: 'This project' },
  '/resume': { title: 'Résumé' },
  '/contact': { title: 'Contact' },
  '/travel': { title: 'Travel' },
  '/terminal': { title: 'The terminal' },
  '/universe': { title: 'The universe' },
  '/galaxy': { title: 'A galaxy far, far away' },
  '/galaxy/surface': { title: 'Down on the surface', nudge: true },
  '/galaxy/mission': { title: 'Mission briefing' },
  '/deathstar': { title: 'The Death Star', nudge: true },
  '/deathstar/inside': { title: 'Aboard the Death Star', nudge: true },
  '/fly': { title: 'Planet flight', nudge: true }, // planet flight (scripts/flight-island.mjs removes this row)
  // (no note by the "?": the game's own screens stand over the world from the first frame)
  '/battlefront': { title: 'Battlefront' },
  '/caribbean': { title: 'The Caribbean', nudge: true },
  '/invincible': { title: 'Invincible', nudge: true },
  '/hogwarts': { title: 'Hogwarts', nudge: true },
  '/middle-earth': { title: 'Middle-earth' },
  '/middle-earth/place': { title: 'A stop on the road', nudge: true },
  '/middle-earth/road': { title: 'The Road', nudge: true },
  '/avengers': { title: 'Avengers HQ', nudge: true },
  '/scranton': { title: 'Scranton', nudge: true },
  '/cybertron': { title: 'Cybertron', nudge: true },
  '/albuquerque': { title: 'Albuquerque', nudge: true },
  '/c-137': { title: 'Dimension C-137', nudge: true },
  '/c-137/citadel': { title: 'The Citadel of Ricks', nudge: true },
  '/c-137/planet': { title: 'A Rick and Morty planet' },
  '/dot-matrix': { title: 'Dot Matrix', nudge: true },
  '/dot-matrix/64': { title: 'Super Mario 64 on the N64', nudge: true },
  '/dot-matrix/minecraft': { title: 'Minecraft', nudge: true },
  '/earth': { title: 'Earth', nudge: true },
  '/music': { title: 'The music room', nudge: true },
};

// The deeper paths share their section's guide: every role is Experience,
// every place on the map the universe, every Rick and Morty planet landed on
// from the map one of its own (not C-137's, and not its street's basics).
const RULES = [
  [/^\/(universe(\/.*)?)?$/, '/universe'],
  [/^\/experience\/[^/]+$/, '/experience'],
  [/^\/projects\/[^/]+$/, '/project'],
  [/^\/galaxy\/[^/]+\/surface$/, '/galaxy/surface'],
  [/^\/galaxy\/[^/]+\/mission$/, '/galaxy/mission'],
  [/^\/galaxy\/[^/]+$/, '/galaxy'],
  [/^\/fly\/[^/]+$/, '/fly'], // planet flight
  [/^\/battlefront\/[^/]+(\/[^/]+)?$/, '/battlefront'],
  [/^\/middle-earth\/road$/, '/middle-earth/road'], // (the Road is a ride of its own, not a place on it)
  [/^\/middle-earth\/[^/]+$/, '/middle-earth/place'],
  [/^\/avengers\/[^/]+$/, '/avengers'], // a building's game opens over the compound, so it's the compound's guide
  [/^\/c-137\/(?!citadel$)[a-z0-9-]+$/, '/c-137/planet'],
];

export const guideKeyFor = (pathname) => (GUIDES[pathname] ? pathname : (RULES.find(([re]) => re.test(pathname))?.[1] ?? null));

// { key, title, nudge } for a path, or null
export function guideMeta(pathname) {
  const key = guideKeyFor(pathname);
  return key ? { key, nudge: false, ...GUIDES[key] } : null;
}
