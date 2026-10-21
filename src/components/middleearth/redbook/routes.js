// Where the book and the Palantír go (the design’s §2, §5): a page’s Play
// it is its chapter’s address, its Walk it the Road from its stage; the
// stone’s pins are every page’s place on the map, and the places with a
// game but no page (hidden.js’s), which open their game.

import { HIDDEN } from '../hidden';
import { place } from '../geography';
import { placeAt } from '../sheet';
import { PAGES } from './pages';

export const playTo = (page) => (page?.play ? `/middle-earth/${page.play}` : null);
export const walkTo = (page) => (page?.walk ? `/middle-earth/road?at=${page.walk}` : null);
export const MAP = '/middle-earth/map';

const played = new Set(PAGES.map((p) => p.play));
export const PINS = [
  ...PAGES.map((p) => ({ id: p.id, page: p.id, name: place(p.place).name, at: placeAt(p.place), to: null })),
  ...HIDDEN.filter((h) => !played.has(h.id)).map((h) => ({ id: h.id, page: null, name: h.name, at: h.at, to: `/middle-earth/${h.id}` })),
];

export const goFor = (pin) => (pin.page ? { page: pin.page } : { to: pin.to });

// From a chapter’s game back to the book: the first page that plays it (a
// game with no page of its own, Orthanc or Edoras, opens the book at its
// start), and the Road’s stage that page walks (null when it has none)
const pageOf = (chapter) => PAGES.find((p) => p.play === chapter) ?? null;
export const bookPageFor = (chapter) => (pageOf(chapter) ?? PAGES[0]).id;
export const walkFor = (chapter) => pageOf(chapter)?.walk ?? null;

// From a stage of the Road back to the book: the page that walks it
// (Ithilien has none of its own: it is in the Marshes’ page), else the start
const FOLDED = { ithilien: 'marshes' };
export const bookPageForStage = (stage) => FOLDED[stage] ?? PAGES.find((p) => p.walk === stage)?.id ?? PAGES[0].id;
