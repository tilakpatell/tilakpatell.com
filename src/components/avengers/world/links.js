// The compound's addresses, one a building, named for the place and not the
// person (spec 2026-10-18-avengers-hq-fix-and-hub-design, §4). Pure and
// importing nothing, so App, the palette and the tour can read it without
// loading the compound.

export const HQ_HOME = '/avengers';

// in the compound's order (rules.js PLACES)
export const LINKS = [
  { slug: 'workshop', id: 'stark', game: 'Repulsor Range', words: 'repulsor range iron man tony stark workshop armour suit ultron friday' },
  { slug: 'lawn', id: 'thor', game: 'Hold the Lawn', words: 'hold the lawn thor mjolnir hammer chitauri lightning' },
  { slug: 'training', id: 'cap', game: 'Ricochet', words: 'ricochet captain america steve rogers shield training' },
  { slug: 'range', id: 'hawkeye', game: 'Trick Shot', words: 'trick shot hawkeye clint barton bow arrow archery range' },
  { slug: 'operations', id: 'widow', game: 'Infiltration', words: 'infiltration black widow natasha romanoff stealth spy operations' },
  { slug: 'lab', id: 'banner', game: 'Smash Run', words: 'smash run hulk bruce banner lab' },
  { slug: 'gate', id: 'spidey', game: 'Thwip!', words: 'thwip spider-man spiderman peter parker web swing school gate queens' },
  { slug: 'hangar', id: 'vault', game: 'Tesseract Run', words: 'tesseract run space stone hangar quinjet portal' },
];

const byId = (id) => LINKS.find((l) => l.id === id);
export const linkOf = (id) => {
  const l = byId(id);
  return l ? `${HQ_HOME}/${l.slug}` : null;
};
export const placeOf = (slug) => LINKS.find((l) => l.slug === slug)?.id ?? null;
export const gameOf = (id) => byId(id)?.game ?? null;

// How the command palette names the compound and each building's game;
// CommandPalette.jsx adds the group, the icon and the move.
export const HQ_PALETTE = [
  { id: 'w-av', label: 'Avengers HQ', keywords: 'marvel avengers compound tower iron man stark arc reactor thor mjolnir captain america shield hawkeye black widow hulk banner tesseract thanos infinity gauntlet snap spider-man spiderman peter parker queens web swing world', to: HQ_HOME },
  ...LINKS.map((l) => ({ id: `w-av-${l.slug}`, label: `Avengers HQ · ${l.game}`, keywords: `marvel avengers hq game ${l.words}`, to: `${HQ_HOME}/${l.slug}` })),
];

// The state of an address a door on the page pushed, as feed/feed.js's feedState.
export const hqState = { hq: true };

// The way out of a game: -1 when a door here pushed the entry, so the page's
// own /avengers is behind it; otherwise (a shared link, the palette, a link
// from another page) the compound replaces the game, and the site is never left.
export const backTarget = (location) => (location?.state?.hq === true && location.key !== 'default' ? -1 : HQ_HOME);

// The addresses the route /avengers/:place? matches: the router's matchPath is
// case-blind and takes a trailing slash, so the page key has to agree with it.
export const inHq = (pathname) => typeof pathname === 'string' && /^\/avengers(\/[^/]*)?\/?$/i.test(pathname);
