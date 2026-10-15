// The cockpit each ship you fly shows from the pilot's seat (scene.js's
// buildCab): the game's own cockpit mesh where Star Wars Battlefront II
// (2017) has one for the kind (the X-wing's and the Falcon's, lane V's
// surface/<kind>cockpit.glb: cockpit/vehicles/game.js), the intro's built cab
// for the RV and the cruiser, which the game has no model of (lane S1 of the
// galaxy-in-space design, decision 2).
//
//   CABS: kind → () → Promise<{ build }>
//   GAME_CABS: the kinds whose cab is the game's

export const GAME_CABS = new Set(['xwing', 'falcon']);
export const CABS = {
  falcon: () => import('../cockpit/vehicles/game').then((m) => m.cab('falcon')),
  xwing: () => import('../cockpit/vehicles/game').then((m) => m.cab('xwing')),
  cruiser: () => import('../cockpit/vehicles/cruiserNodes'),
  rv: () => import('../cockpit/vehicles/rvNodes'),
};
