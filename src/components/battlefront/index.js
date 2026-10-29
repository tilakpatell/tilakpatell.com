// Battlefront's face (docs/health/RULES.md, "Worlds are islands"): bf2-web's engine, on the levels it plays
// (docs/decisions/2026-10-28-hoth-on-bf2-web.md; engine.js sends the visitor there). The site's own Battlefront game
// went on 2026-10-29 (docs/superpowers/plans/2026-10-29-battlefront-engine-only.md). A link from a galaxy world
// carries where it came from (`from`, that world's own page), so the engine's way back leads there.

import { ENGINE_WORLDS } from '../../lib/bf2web/levels.js';

export const ROUTE = '/battlefront';
// the galaxy's worlds the engine plays, as its build lists their levels (lib/bf2web/levels.js: Hoth's alone today)
export const LEVELS = ENGINE_WORLDS;
// a level's way into the engine, with the way back
export const menuRouteFor = (level = 'hoth', { from = null } = {}) => `${ROUTE}/${level}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
// the way back a route's search names, or null: a galaxy world's page alone
// (`/galaxy/<system>`), never another origin or an arbitrary path
export function wayBack(search = '') {
  const from = new URLSearchParams(String(search).replace(/^\?/, '')).get('from');
  const m = from && /^\/galaxy\/([a-z0-9-]+)$/.exec(from);
  if (!m) return null;
  return { label: `Back to ${m[1][0].toUpperCase()}${m[1].slice(1)}`, to: from };
}
