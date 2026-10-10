// What's live down on a world, in a line, for the galaxy panel's Land button,
// read from the system's briefing alone (systems.js's game) so the map's
// page doesn't carry the missions: modes.test.js holds it to modes.js's own
// liveLine for every landable world.
//
// landLine(sys) → 'Galactic Assault · Story' | ''

import { starfighterAt } from './missions/starfighterMaps';

const isAssault = (to) => /[?&]mission=assault\b/.test(to ?? '');
const assaulted = (g) => (g?.status === 'live' && isAssault(g.to)) || Boolean(g?.also?.some((a) => isAssault(a.to)));
// (Heroes vs Villains and Blast: a line each on the briefing, missions/hvv.js and blast.js)
const listed = (g, id) => Boolean(g?.also?.some((a) => new RegExp(`[?&]mission=${id}\\b`).test(a.to ?? '')));
const storied = (g) => g?.status === 'live' && Boolean(g.to) && !isAssault(g.to);

export const landLine = (sys) => [assaulted(sys?.game) ? 'Galactic Assault' : null, sys && starfighterAt(sys.id) ? 'Starfighter Assault' : null, listed(sys?.game, 'hvv') ? 'Heroes vs Villains' : null, listed(sys?.game, 'blast') ? 'Blast' : null, storied(sys?.game) ? 'Story' : null].filter(Boolean).join(' · ');
