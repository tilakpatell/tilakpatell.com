// What's live down on a world, in a line, for the galaxy panel's Land button,
// read from the system's briefing alone (systems.js's game) so the map's
// page doesn't carry the missions: modes.test.js holds it to modes.js's own
// liveLine for every landable world.
//
// landLine(sys) → 'Galactic Assault · Story' | ''

import BOOK from '../../../data/bf2017/modes.json';
import { starfighterAt } from './missions/starfighterMaps';

// (the names the mode menu's cards carry: the game's own, modes.json)
const named = (id, own) => BOOK.names?.modes?.[id]?.text ?? own;

// (the galaxy's own battle, or the game's level in the Battlefront world, by its battle's address or its menu's: Hoth's)
const isAssault = (to) => /[?&]mission=assault\b/.test(to ?? '') || /^\/battlefront\/[a-z0-9-]+(\/galacticAssault|\?|$)/.test(to ?? '');
const assaulted = (g) => (g?.status === 'live' && isAssault(g.to)) || Boolean(g?.also?.some((a) => isAssault(a.to)));
// (Heroes vs Villains and Blast: a line each on the briefing, missions/hvv.js and blast.js)
const listed = (g, id) => Boolean(g?.also?.some((a) => new RegExp(`[?&]mission=${id}\\b`).test(a.to ?? '')));
// (lane 6's modes, in modes.js's order, when a briefing lists their mission)
const OTHER = [
  ['strike', 'Strike'],
  ['extraction', 'Extraction'],
  ['ewokHunt', 'Ewok Hunt'],
  ['supremacy', 'Supremacy'],
];
const storied = (g) => g?.status === 'live' && Boolean(g.to) && !isAssault(g.to);

export const landLine = (sys) =>
  [assaulted(sys?.game) ? named('galacticAssault', 'Galactic Assault') : null, sys && starfighterAt(sys.id) ? named('starfighter', 'Starfighter Assault') : null, listed(sys?.game, 'hvv') ? named('hvv', 'Heroes vs Villains') : null, listed(sys?.game, 'blast') ? named('blast', 'Blast') : null, ...OTHER.map(([id, name]) => (listed(sys?.game, id) ? named(id, name) : null)), storied(sys?.game) ? 'Story' : null].filter(Boolean).join(' · ');
