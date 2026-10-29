// The worlds bf2-web's engine plays (docs/decisions/2026-10-29-battlefront-is-
// bf2-webs-engine.md), as its build lists them (lib/bf2web/levels.js's
// ENGINE_WORLDS: Hoth's alone today): flying into one, or landing on it, opens the engine's
// menu over the game's own level (`/battlefront/<level>`), and nothing of the
// galaxy's surface is fetched or built on the way. The galaxy's own surface of
// such a world is free roam, on a button of its own (the panel's and the
// briefing's), and the site's own missions there are withheld
// (surface/missions/index.js's missionOf): the engine's round is its battle.
// The address is written out here, with the way back to this world in its
// `from`, because a world does not import another world's files;
// src/pages/battlefrontRoutes.test.js holds each row to the Battlefront
// route. Pure but for the build's record.
//
//   gameMenuFor(system) → the engine's address, or null for a world that lands on its surface
//   freeRoamOnly(system) → true for a world the engine plays: its surface is free roam alone
//   wayDown(system, district, { free }) → { to, game }: where the galaxy goes when you land
//                                          (free: the surface's free roam, an engine world's own button)
//   groundBattle(systemRow) → where a world's battle is fought on the ground, or null

import { ENGINE_WORLDS } from '../../lib/bf2web/levels.js'; // (with its extension: the prerender reads this file in Node)

export const GAME_MENU = Object.fromEntries(ENGINE_WORLDS.map((w) => [w, `/battlefront/${w}?from=${encodeURIComponent(`/galaxy/${w}`)}`]));

export const gameMenuFor = (system) => GAME_MENU[system] ?? null;

export const freeRoamOnly = (system) => Boolean(GAME_MENU[system]);

export function wayDown(system, district = null, { free = false } = {}) {
  const menu = free ? null : gameMenuFor(system);
  if (menu) return { to: menu, game: true };
  const query = [district && `district=${encodeURIComponent(district)}`, free && 'mode=free'].filter(Boolean).join('&');
  return { to: `/galaxy/${system}/surface${query ? `?${query}` : ''}`, game: false };
}

// Where the battle on a world is fought on the ground (the war card's link):
// the engine for a world it plays, else the assault its briefing lists
// (systems.js's `game.also`), else nowhere. Takes the system's row, since
// systems.js reads this file.
export const groundBattle = (system) => (system ? (gameMenuFor(system.id) ?? system.game?.also?.find((a) => a.id === 'assault' && a.to)?.to ?? null) : null);
