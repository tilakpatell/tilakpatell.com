// The worlds whose ground is the 2017 game's own level: flying into one, or
// landing on it, opens the game's menu over that level (the Battlefront
// world's `/battlefront/<level>`), and nothing of the galaxy's surface is
// fetched or built on the way (the 2026-10-13 design: Hoth first, the others
// as their levels are ported). The address is written out here, with the way
// back to this world in its `from`, because a world does not import another
// world's files; src/pages/battlefrontRoutes.test.js holds each row to the
// Battlefront world's own route. Pure.
//
//   gameMenuFor(system) → the address, or null for a world that lands on its surface
//   landsOnSurface(system) → false for a game world: a page lists nothing of a surface for it
//   wayDown(system, district) → { to, game }: where the galaxy goes when you land

export const GAME_MENU = { hoth: '/battlefront/hoth?from=%2Fgalaxy%2Fhoth' };

export const gameMenuFor = (system) => GAME_MENU[system] ?? null;

export const landsOnSurface = (system) => !GAME_MENU[system];

export function wayDown(system, district = null) {
  const menu = gameMenuFor(system);
  if (menu) return { to: menu, game: true };
  return { to: `/galaxy/${system}/surface${district ? `?district=${encodeURIComponent(district)}` : ''}`, game: false };
}
