// Where Battlefront is played (docs/decisions/2026-10-29-battlefront-is-bf2-webs-engine.md): on bf2-web's engine
// alone, its play site under /battlefront/engine/<build>/ (the Worker's, cloudflare/play.js), where a build is
// published and the browser can run it. Where it can't, the reasons are named and nothing else plays. The engine's
// page is opened by the browser itself, not the router: its headers isolate it, and isolation holds only for a page
// loaded so. Pure.
//
//   engineUrl(play, back) → the play site's address, or null while no build is published
//     back: the way back (index.js's wayBack), carried as ?from= so the engine's page can return there
//     (cloudflare/playReturn.js)
//   engineOnly({ level, play, support, back }) → { go: url } | { wait: true } | { unavailable: [why, …] }
//     support: lib/bf2web/engineSupport's answer for this browser, asked beforeIsolation; null while its adapter's
//     features are being read

import { LEVELS } from './index.js';

export function engineUrl(play, back = null) {
  if (!play?.build || !play.site) return null;
  return `/battlefront/engine/${play.build}/${back?.to ? `?from=${encodeURIComponent(back.to)}` : ''}`;
}

export function engineOnly({ level = 'hoth', play, support, back = null }) {
  const url = engineUrl(play, back);
  if (!url) return { unavailable: ['no engine build is published'] };
  if (!LEVELS.includes(level)) return { unavailable: [`bf2-web does not play ${level} yet`] };
  if (!support) return { wait: true };
  if (!support.ok) return { unavailable: support.missing };
  return { go: url };
}
