// What stands over the Battlefront world at each moment of the way in
// (pure; BattlefrontWorld.jsx draws it). The world is mounted once, under
// the game's menu when the address names no mode, and from then on the
// game's own order: its loading screen until the level is ready, its spawn
// screen for the first life, its black wipe at Deploy, the field
// (docs/superpowers/specs/2026-10-13-hoth-landing-game-menu-design.md).
//
// standing({ inMenu, phase, ready, loaded, screens }) → { menu, rest, loading, spawn, wipe, cover, name }
//   inMenu   the game's front end is open over the world
//   phase    'pre' (before the first deploy) | 'down' (the wipe going black) | 'up' (lifting) | 'in' (the field)
//   ready    waiting.js's readiness: the level in and nothing left to build
//   loaded   the level's stream has what the camera needs (false again when it falls behind in the field)
//   screens  the game's screens (their code comes apart from the world's): true, they have come; null, not yet;
//            false, they cannot (the import failed): the menu cannot be drawn, so it is not stood in, and nothing
//            of theirs will ever cover the view, so the page's stand-ins must show
//
//   menu     draw the front end
//   rest     the world rests under the menu: made and ready, and not drawn, so the menu has the whole frame
//            (while it loads it draws: the shaders of what the camera sees build from what is drawn)
//   loading  draw the game's loading screen: on the way in, or as a veil in the field
//   spawn    the first life's spawn screen stands (kept under the wipe's black on its way down)
//   wipe     'down' | 'up' | null
//   cover    black over the parked camera's view: the screens' code has not come and nothing of theirs can cover it
//   name     'menu' | 'loading' | 'spawn' | 'field': the stage's mark for the checks (data-bf-stage)
//
// latch(was, { inMenu, phase, ready }) → the way in has been ready once the spawn screen could stand
// deploysThrough(phase) → a Deploy goes through the wipe (until the field)
// phaseFor(phase, { parked }) → the phase, given what the world says of its camera

export function standing({ inMenu = false, phase = 'pre', ready = false, loaded = true, screens = true } = {}) {
  const menu = Boolean(inMenu) && screens !== false;
  const rest = menu && Boolean(ready);
  const loading = !menu && ((phase === 'pre' && !ready) || (phase === 'in' && !loaded));
  const spawn = !menu && ((phase === 'pre' && ready) || phase === 'down');
  const wipe = phase === 'down' || phase === 'up' ? phase : null;
  const cover = screens == null && (phase === 'pre' || phase === 'down');
  const name = menu ? 'menu' : loading ? 'loading' : spawn ? 'spawn' : 'field';
  return { menu, rest, loading, spawn, wipe, cover, name };
}

// Readiness is not a one-way thing: it goes false again for a beat whenever
// something new is built (a late cell's material, a body's own cut). Once the
// first spawn screen has stood it stays: it is not swapped for the loading
// screen and back, and its Deploy is not refused in such a beat (the old
// waiting screen dropped a click made then). Not held under the menu, where
// nothing shows it and the level may still be building.
export const latch = (was, { inMenu = false, phase = 'pre', ready = false } = {}) => Boolean(was) || (!inMenu && phase === 'pre' && Boolean(ready));

// A Deploy before the field is the wipe's: the first click starts it, and a
// second on the way down or up is its to refuse (sent straight to the world
// it deployed at once under a half-black wipe, and the wipe's own deploy
// followed it).
export const deploysThrough = (phase) => phase !== 'in';

// The page's phase follows the world: a soldier deployed some other way (a
// check's door on the world) has left the dark room, and the way in is over.
export const phaseFor = (phase, { parked } = {}) => (phase === 'pre' && parked === false ? 'in' : phase);
