// The Battlefront world's face (docs/health/RULES.md, "Worlds are islands"):
// its route, for a page or another world that links to it (the galaxy's
// landing menu, its system's panel and its briefing point Hoth's Galactic
// Assault here: the flow design's decision 3, flipped by the 2026-10-11
// deploy-flow design), and its module. A link from a galaxy world carries
// where it came from (`from`, that world's own page), so the game's menu
// and its end of round lead back there rather than to the universe map.

export const ROUTE = '/battlefront';
export const routeFor = (level = 'hoth', mode = 'galacticAssault', { from = null } = {}) => `${ROUTE}/${level}/${mode}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
// the way back a route's search names, or null: a galaxy world's page alone
// (`/galaxy/<system>`), never another origin or an arbitrary path
export function wayBack(search = '') {
  const from = new URLSearchParams(String(search).replace(/^\?/, '')).get('from');
  const m = from && /^\/galaxy\/([a-z0-9-]+)$/.exec(from);
  if (!m) return null;
  return { label: `Back to ${m[1][0].toUpperCase()}${m[1].slice(1)}`, to: from };
}
export const LEVELS = ['hoth'];
// the modes the game world runs (src/lib/battlefront/modes/index.js), and those each level's pack plays:
// a level's own modes are its map rulebook's (modes.json); a pack that lands adds its row
export const MODES = ['galacticAssault', 'strike', 'extraction', 'ewokHunt', 'supremacy'];
export const LEVEL_MODES = { hoth: ['galacticAssault'] };
export { default as battlefrontModule } from './module.js';
