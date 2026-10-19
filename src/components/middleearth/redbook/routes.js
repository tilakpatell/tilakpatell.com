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
