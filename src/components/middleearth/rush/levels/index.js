// Every kitchen, by its id (../Rush.jsx mounts them; the map hub reads
// their stars). Each level says which chapter it belongs to (`town`).
import { AMON_HEN } from './amonhen';
import { CORMALLEN } from './cormallen';
import { HOUSES } from './houses';
import { ITHILIEN } from './ithilien';
import { LORIEN } from './lorien';
import { MORIA } from './moria';
import { PARTY } from './party';
import { PONY } from './pony';
import { RIVENDELL } from './rivendell';
import { TOWER } from './tower';
import { WEATHERTOP } from './weathertop';

export const LEVELS = { pony: PONY, rivendell: RIVENDELL, moria: MORIA, lorien: LORIEN, amonhen: AMON_HEN, party: PARTY, weathertop: WEATHERTOP, ithilien: ITHILIEN, tower: TOWER, cormallen: CORMALLEN, houses: HOUSES };

// the kitchen of a chapter (its town), if it has one
export const levelOf = (town) => Object.values(LEVELS).find((l) => l.town === town) ?? null;

// where a kitchen's best score is kept in the browser
export const bestKey = (id) => `tp-rush-best-${id}`;
