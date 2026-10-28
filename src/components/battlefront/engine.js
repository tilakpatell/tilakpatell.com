// Where Hoth is played (docs/decisions/2026-10-28-hoth-on-bf2-web.md): on bf2-web’s engine, its play site under
// /battlefront/engine/<build>/ (the Worker’s, cloudflare/play.js), when a build is published and the browser can run
// it, else on the site’s world. The address can say: ?engine=0 keeps the site’s world, ?engine=1 goes even where the
// browser seems unable (to see why it fails). The engine’s page is opened by the browser itself, not the router: its
// headers isolate it, and isolation holds only for a page loaded so. Pure.
//
//   ENGINE_LEVELS   engineUrl(play) → the play site’s address, or null while no build is published
//   playOn({ level, play, support, search }) → the engine’s address, or null (the site’s world)
//     support: lib/bf2web/engineSupport’s answer for this browser, asked beforeIsolation

// the levels bf2-web plays
export const ENGINE_LEVELS = ['hoth'];

export const engineUrl = (play) => (play?.build && play.site ? `/battlefront/engine/${play.build}/` : null);

export function playOn({ level, play, support, search = '' }) {
  const url = engineUrl(play);
  if (!url || !ENGINE_LEVELS.includes(level)) return null;
  const asked = new URLSearchParams(search).get('engine');
  if (asked === '0') return null;
  if (asked === '1') return url;
  return support?.ok ? url : null;
}
