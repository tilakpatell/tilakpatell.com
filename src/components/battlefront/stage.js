// What stands over the Battlefront world at each moment of the way in
// (pure; BattlefrontWorld.jsx draws it). The world is mounted once, under
// the game's menu when the address names no mode, and from then on the
// game's own order: its loading screen until the level is ready, its spawn
// screen for the first life, its black wipe at Deploy, the field
// (docs/superpowers/specs/2026-10-13-hoth-landing-game-menu-design.md).
//
// standing({ inMenu, phase, ready, loaded, screens }) → { menu, loading, spawn, wipe, cover, name }
//   inMenu   the game's front end is open over the world
//   phase    'pre' (before the first deploy) | 'down' (the wipe going black) | 'up' (lifting) | 'in' (the field)
//   ready    waiting.js's readiness: the level in and nothing left to build
//   loaded   the level's stream has what the camera needs (false again when it falls behind in the field)
//   screens  the game's screens have loaded (their code comes apart from the world's)
//
//   menu     draw the front end
//   loading  draw the game's loading screen: on the way in, or as a veil in the field
//   spawn    the first life's spawn screen stands (kept under the wipe's black on its way down)
//   wipe     'down' | 'up' | null
//   cover    black over the parked camera's view: the screens' code has not come and nothing of theirs can cover it
//   name     'menu' | 'loading' | 'spawn' | 'field': the stage's mark for the checks (data-bf-stage)

export function standing({ inMenu = false, phase = 'pre', ready = false, loaded = true, screens = true } = {}) {
  const menu = Boolean(inMenu);
  const loading = !menu && ((phase === 'pre' && !ready) || (phase === 'in' && !loaded));
  const spawn = !menu && ((phase === 'pre' && ready) || phase === 'down');
  const wipe = phase === 'down' || phase === 'up' ? phase : null;
  const cover = !screens && (phase === 'pre' || phase === 'down');
  const name = menu ? 'menu' : loading ? 'loading' : spawn ? 'spawn' : 'field';
  return { menu, loading, spawn, wipe, cover, name };
}
