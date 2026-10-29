// Where Hoth is played (docs/decisions/2026-10-28-hoth-on-bf2-web.md): on bf2-web’s engine, its play site under
// /battlefront/engine/<build>/ (the Worker’s, cloudflare/play.js), when a build is published and the browser can run
// it, else on the site’s world. A first visit downloads the whole cooked scene (play.json’s mb, about 2.2 GB), so the
// visitor is asked once and the answer kept on the device; the address can say instead: ?engine=0 keeps the site’s
// world, ?engine=1 goes even where the browser seems unable (to see why it fails). The engine’s page is opened by the
// browser itself, not the router: its headers isolate it, and isolation holds only for a page loaded so. Pure.
//
//   ENGINE_LEVELS   CHOICE_KEY   engineUrl(play, back) → the play site’s address, or null while no build is published
//     back: the way back (components/battlefront’s wayBack), carried as ?from= so the engine’s page can return there
//     (cloudflare/playReturn.js)
//   playOn({ level, play, support, search, choice, back }) → { go: url } | { ask: { url, mb } } | { wait: true } | null (the site’s world)
//     support: lib/bf2web/engineSupport’s answer for this browser, asked beforeIsolation; null while its adapter’s
//     features are being read (wait: neither world is begun)
//     choice: what the visitor said before on this device, 'engine' | 'site' | null

// the levels bf2-web plays
export const ENGINE_LEVELS = ['hoth'];
// localStorage: 'engine' | 'site', the visitor's answer on this device
export const CHOICE_KEY = 'tp-bf2-engine';

export function engineUrl(play, back = null) {
  if (!play?.build || !play.site) return null;
  return `/battlefront/engine/${play.build}/${back?.to ? `?from=${encodeURIComponent(back.to)}` : ''}`;
}

export function playOn({ level, play, support, search = '', choice = null, back = null }) {
  const url = engineUrl(play, back);
  if (!url || !ENGINE_LEVELS.includes(level)) return null;
  const asked = new URLSearchParams(search).get('engine');
  if (asked === '0') return null;
  if (asked === '1') return { go: url };
  if (choice === 'site') return null;
  if (!support) return { wait: true };
  if (!support.ok) return null;
  return choice === 'engine' ? { go: url } : { ask: { url, mb: play.mb ?? null } };
}

// Battlefront is bf2-web's engine and game only (the owner, 2026-10-29: "battlefront should ONLY be the engine and game"):
// no site world behind it and no choice between the two. Where the engine can run, the page goes to it; where it can't,
// the reasons are named and nothing else plays.
//   engineOnly({ level, play, support, back }) → { go: url } | { wait: true } | { unavailable: [why, …] }
export function engineOnly({ level = 'hoth', play, support, back = null }) {
  const url = engineUrl(play, back);
  if (!url) return { unavailable: ['no engine build is published'] };
  if (!ENGINE_LEVELS.includes(level)) return { unavailable: [`bf2-web does not play ${level} yet`] };
  if (!support) return { wait: true };
  if (!support.ok) return { unavailable: support.missing };
  return { go: url };
}
