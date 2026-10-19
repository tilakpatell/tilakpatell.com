// The compound's addresses, one a building, named for the place and not the
// person (spec 2026-10-18-avengers-hq-fix-and-hub-design, §4). Pure and
// importing nothing, so App, the palette and the tour can read it without
// loading the compound.

export const HQ_HOME = '/avengers';

// in the compound's order (rules.js PLACES)
export const LINKS = [
  { slug: 'workshop', id: 'stark', game: 'Repulsor Range' },
  { slug: 'lawn', id: 'thor', game: 'Hold the Lawn' },
  { slug: 'training', id: 'cap', game: 'Ricochet' },
  { slug: 'range', id: 'hawkeye', game: 'Trick Shot' },
  { slug: 'operations', id: 'widow', game: 'Infiltration' },
  { slug: 'lab', id: 'banner', game: 'Smash Run' },
  { slug: 'gate', id: 'spidey', game: 'Thwip!' },
  { slug: 'hangar', id: 'vault', game: 'Tesseract Run' },
];

const byId = (id) => LINKS.find((l) => l.id === id);
export const linkOf = (id) => {
  const l = byId(id);
  return l ? `${HQ_HOME}/${l.slug}` : null;
};
export const placeOf = (slug) => LINKS.find((l) => l.slug === slug)?.id ?? null;
export const gameOf = (id) => byId(id)?.game ?? null;

// The state of an address a door on the page pushed, as feed/feed.js's feedState.
export const hqState = { hq: true };

// The way out of a game: -1 when a door here pushed the entry, so the page's
// own /avengers is behind it; otherwise (a shared link, the palette, a link
// from another page) the compound replaces the game, and the site is never left.
export const backTarget = (location) => (location?.state?.hq === true && location.key !== 'default' ? -1 : HQ_HOME);

// The addresses the route /avengers/:place? matches: the router's matchPath is
// case-blind and takes a trailing slash, so the page key has to agree with it.
export const inHq = (pathname) => typeof pathname === 'string' && /^\/avengers(\/[^/]*)?\/?$/i.test(pathname);
