// The Battlefront world's face (docs/health/RULES.md, "Worlds are islands"):
// its route, for a page or another world that links to it (the galaxy's
// landing menu points its Galactic Assault card here: the flow design's
// decision 3), and its module.

export const ROUTE = '/battlefront';
export const routeFor = (level = 'hoth', mode = 'galacticAssault') => `${ROUTE}/${level}/${mode}`;
export const LEVELS = ['hoth'];
export const MODES = ['galacticAssault'];
export { default as battlefrontModule } from './module.js';
