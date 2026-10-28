// The way back from bf2-web's play page to the site (docs/decisions/2026-10-28-hoth-on-bf2-web.md). The page is
// bf2-web's, served as it was exported; the Worker adds this one script to it (play.js). The site sends the visitor
// with ?from=<the galaxy world they came from> (components/battlefront/engine.js); the script puts a link back in the
// corner while the game's front end shows, and after a round's Quit (the play page's own Quit: the instance shut down,
// the front end back, window.__playFlow's last session ended 'quit') goes there. Without a from, the link goes to the
// site's Battlefront and Quit stays the game's (back to its front end). A round that fails (the session's passed
// false: a download dropped, frame 0 never drawn, the GPU lost) leaves its reason in the corner, which the play page
// shows for 15 s only, with a button that copies it and the GPU the browser gave, for the visitor to send on.
//
//   returnFrom(search) → { to, label, onQuit }   to: the site's address (the site routes by its hash)
//   watchReturn(win, back)   the page's side: the link, the Quit and a failed round watched on the body's play-<state> class
//   withReturn(html) → the page with the script   RETURN_VERSION: the script's hash, in the page's ETag
//
// returnFrom and watchReturn run in the page as their source text, so neither may reach outside itself.

import { registerEngineCache } from './engineCache.js';
import { sourceOf } from './source.js';
import { steadyTimers } from './playTimers.js';

export function returnFrom(search) {
  const from = new URLSearchParams(String(search).replace(/^\?/, '')).get('from');
  const m = from && /^\/galaxy\/([a-z0-9-]+)$/.exec(from);
  if (!m) return { to: '/#/battlefront', label: 'Back to the site', onQuit: false };
  return { to: `/#${from}`, label: `Back to ${m[1][0].toUpperCase()}${m[1].slice(1)}`, onQuit: true };
}

export function watchReturn(win, back) {
  const doc = win.document;
  const style = doc.createElement('style');
  // (shown only on the front end: the play page names its state on the body, play-menu there)
  style.textContent =
    '.tp-return{position:fixed;top:20px;right:20px;z-index:2147483647;padding:8px 14px;font:600 13px/1.2 system-ui,sans-serif;' +
    'letter-spacing:.08em;text-transform:uppercase;color:#fff;text-decoration:none;background:rgba(0,0,0,.55);' +
    'border:1px solid rgba(255,255,255,.4)}.tp-return:hover,.tp-return:focus-visible{background:rgba(255,255,255,.18)}' +
    'body:not(.play-menu) .tp-return{display:none}';
  const link = doc.createElement('a');
  link.className = 'tp-return';
  link.href = back.to;
  link.textContent = back.label;
  doc.head.append(style);
  doc.body.append(link);
  // A round that failed: the play page shows why for 15 s; this keeps it up, with the GPU the browser gave, and a
  // button that copies both, for the visitor to send on
  const failed = (s) => {
    const box = doc.createElement('div');
    box.className = 'tp-failed';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:2147483647;max-width:560px;padding:12px 14px;font:13px/1.4 system-ui,sans-serif;color:#fff;background:rgba(80,0,0,.85);border:1px solid rgba(255,120,120,.6)';
    const why = String(s.error ?? s.endReason ?? 'unknown').split('\n')[0];
    box.textContent = `The round stopped: ${why}`;
    const copy = doc.createElement('button');
    copy.textContent = 'Copy the details';
    copy.style.cssText = 'display:block;margin-top:8px;font:inherit;color:#fff;background:none;border:1px solid #fff;padding:4px 10px;cursor:pointer';
    copy.onclick = async () => {
      const adapter = await win.navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null);
      const info = adapter?.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description } : null;
      const text = JSON.stringify({ error: String(s.error ?? ''), endReason: s.endReason ?? null, level: s.level ?? null, mode: s.mode ?? null, adapter: info, userAgent: win.navigator.userAgent, at: new Date().toISOString() }, null, 2);
      await win.navigator.clipboard?.writeText(text).catch(() => null);
      copy.textContent = 'Copied';
    };
    box.append(copy);
    doc.querySelector('.tp-failed')?.remove();
    doc.body.append(box);
  };
  let seen = 0;
  new win.MutationObserver(() => {
    const flow = win.__playFlow;
    if (flow?.state !== 'menu') return;
    const sessions = flow.sessions ?? [];
    if (sessions.length === seen) return;
    seen = sessions.length;
    const last = sessions.at(-1);
    if (last?.endReason === 'quit') {
      if (back.onQuit) win.location.assign(back.to);
    } else if (last && last.passed === false) failed(last);
  }).observe(doc.body, { attributes: true, attributeFilter: ['class'] });
}

// (first the page's short timers kept going while its tab is hidden, playTimers.js; then the way back; then the
// service worker that keeps the build on the visitor's disk, engineCache.js; the bundler's __name stood in for, source.js)
const SCRIPT = `<script>${sourceOf(`(${steadyTimers})(window);\n(${watchReturn})(window, (${returnFrom})(location.search));\n(${registerEngineCache})(window);`)}</script>`;

// FNV-1a, 32-bit: a new script is a new page for the browser's cache
let h = 0x811c9dc5;
for (let i = 0; i < SCRIPT.length; i++) h = Math.imul(h ^ SCRIPT.charCodeAt(i), 0x01000193) >>> 0;
export const RETURN_VERSION = h.toString(16).padStart(8, '0');

// (the exported page has no </body>: the script goes before one if it has, else at its end, in the body either way)
export function withReturn(html) {
  const at = html.lastIndexOf('</body>');
  return at < 0 ? html + SCRIPT : html.slice(0, at) + SCRIPT + html.slice(at);
}
