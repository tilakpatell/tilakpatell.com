/* global document, getComputedStyle */
// The flight HUD's computed styles, every state of it, so a move of its CSS
// can be shown to change nothing (the one-flight-combat-core lane's C3):
//
//   node scripts/flight-hud-style-check.mjs --write <file>      what they are now
//   node scripts/flight-hud-style-check.mjs --against <file>    what moved since
//     [--maps universe,galaxy] [--parts overlay,cluster] [--order last|first|both] [--lines 200] [--tokens]
//
// A page per map, holding the sheets from disk (universe.css with its
// @imports, the HUD kit's hud.css and cluster.css, the galaxy's flight.css,
// and the kit's flight/flight.css last or first: --order) and the markup the
// maps draw: the overlay (runtime/hud/flight/FlightHud.jsx's FlightOverlay)
// and the flight cluster (galaxy/FlightCluster.jsx), rendered from the
// source through Vite's SSR, so they are the code's own. Inside the map's
// own wrapper: `.universe-page > .universe-map[data-ship='xwing']`, the
// galaxy's `.galaxy-page > .universe-map.galaxy-map[data-ship='xwing']`.
//
// States: the overlay's 64 (each of data-static; data-off; data-hot; the
// threats' data-on; data-way with data-hit; data-tough with data-kill, on
// or off), the cluster's 16 (.hud-cluster[data-on], .fc-target[data-on],
// .fc-speed[data-boost], .hud-vitals[data-low]). For each, at 1440×900,
// 390×844 and 844×390, with motion reduced and not: every element's
// computed style and its ::before's and ::after's, the transitions run to
// their end (an endless animation taken off, so the value is the rule's).
// Only what differs from a bare element of the same tag on a bare page is
// kept, and each distinct style once.
//
// Prints `smallest text: <px>` (the smallest font size of any text shown);
// with --against, `N differences (order: <o>)` and a line a difference,
// `size|motion|map|state|element|pseudo property: before -> after`, exit 1
// on any. A custom property (a token, --*) is not a difference unless
// --tokens: a change made by tokens adds them, and what they do shows in the
// properties they set; the tokens that moved are counted on their own line.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (k, d = null) => {
  const i = argv.indexOf(`--${k}`);
  return i < 0 ? d : (argv[i + 1] ?? true);
};
const write = flag('write');
const against = flag('against');
if (!write && !against) throw new Error('usage: flight-hud-style-check.mjs --write <file> | --against <file> [--maps universe,galaxy] [--parts overlay,cluster] [--order last|first|both]');
const MAPS = String(flag('maps', 'universe,galaxy')).split(',');
const PARTS = String(flag('parts', 'overlay,cluster')).split(',');
const ORDERS = (() => {
  const o = String(flag('order', write ? 'last' : 'both'));
  return o === 'both' ? ['last', 'first'] : [o];
})();
const SIZES = [
  [1440, 900],
  [390, 844],
  [844, 390],
];
const MOTIONS = ['no-preference', 'reduce'];

// ── the sheets, from disk ──
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
// (a sheet with its @imports in place, as Vite would bundle it)
const inlined = (p) =>
  read(p).replace(/@import\s+['"]([^'"]+)['"];?/g, (_, f) => {
    const q = join(dirname(p), f);
    return existsSync(q) ? inlined(q) : '';
  });
const sheets = (order) => {
  const kitFlight = read(join(ROOT, 'src/runtime/hud/flight/flight.css'));
  const rest = [inlined(join(ROOT, 'src/components/universe/universe.css')), read(join(ROOT, 'src/runtime/hud/hud.css')), read(join(ROOT, 'src/runtime/hud/cluster.css')), read(join(ROOT, 'src/components/galaxy/flight.css'))];
  return order === 'first' ? [kitFlight, ...rest] : [...rest, kitFlight];
};

// ── the markup, the code's own (Vite's SSR, with the site's config: its virtual modules) ──
async function markup() {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true } });
  try {
    // (React itself from Node: the modules' own import of it is left to Node too, so it's the one React)
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { default: FlightHud, FlightOverlay } = await vite.ssrLoadModule('/src/runtime/hud/flight/FlightHud.jsx');
    const ref = { current: null };
    const h = React.createElement;
    const overlay = renderToStaticMarkup(h(FlightOverlay, {}));
    // (the cluster as the galaxy draws it: its own until FlightCluster.jsx went, then FlightHud's with the galaxy's icons, chips and powers)
    if (existsSync(join(ROOT, 'src/components/galaxy/FlightCluster.jsx'))) {
      const { default: FlightCluster } = await vite.ssrLoadModule('/src/components/galaxy/FlightCluster.jsx');
      return { overlay, cluster: renderToStaticMarkup(h(FlightCluster, { rootRef: ref, ship: 'xwing', reduced: false, powersRef: ref, onPower: () => {}, radarRef: ref, buffsRef: ref })) };
    }
    const { RiShieldLine } = await import('react-icons/ri');
    const { default: GameIcon } = await vite.ssrLoadModule('/src/runtime/hud/GameIcon.jsx');
    const { default: PowerBar } = await vite.ssrLoadModule('/src/components/universe/PowerBar.jsx');
    const hud = h(FlightHud, {
      hudRef: ref,
      clusterRef: ref,
      vitalsIcon: h(RiShieldLine, { className: 'fc-shield-icon', 'aria-hidden': 'true' }),
      speedIcon: h(GameIcon, { name: 'hud:speed', className: 'fc-speed-icon' }),
      over: h('div', { className: 'fc-buffs', 'aria-hidden': 'true' }),
      powers: h(PowerBar, { ship: 'xwing', reduced: false, barRef: ref, onPress: () => {}, placement: 'cluster', picks: null, carry: null }),
    });
    const all = renderToStaticMarkup(hud);
    const at = all.indexOf('<div class="hud-cluster');
    const end = all.indexOf('<div class="universe-wanted"');
    return { overlay, cluster: all.slice(at, end) };
  } finally {
    await vite.close();
  }
}

const WRAP = {
  universe: (inner) => `<div class="universe-page"><div class="universe-map" data-ship="xwing">${inner}</div></div>`,
  galaxy: (inner) => `<div class="galaxy-page"><div class="universe-map galaxy-map" data-ship="xwing">${inner}</div></div>`,
};

// ── in the page: put a state on, run the transitions out, read every style ──
function measure({ part, states }) {
  const root = document.querySelector(part === 'overlay' ? '.universe-hud' : '.hud-cluster');
  const els = [root, ...root.querySelectorAll('*')];
  // (each element's name: its tag, its first class and its place among its like)
  const names = new Map();
  const seen = new Map();
  for (const el of els) {
    const base = `${el.tagName.toLowerCase()}${el.classList[0] ? `.${el.classList[0]}` : ''}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    names.set(el, n > 1 ? `${base}#${n}` : base);
  }
  // (a bare element of each tag, outside every styled wrapper, for what's the default)
  const bare = new Map();
  const blank = document.getElementById('bare');
  const defaults = (tag, pseudo) => {
    const key = `${tag}${pseudo}`;
    if (!bare.has(key)) {
      const el = document.createElement(tag);
      blank.append(el);
      const cs = getComputedStyle(el, pseudo || null);
      const o = {};
      for (let i = 0; i < cs.length; i++) o[cs[i]] = cs.getPropertyValue(cs[i]);
      bare.set(key, o);
    }
    return bare.get(key);
  };
  const settle = () => {
    for (const a of document.getAnimations()) {
      const t = a.effect?.getTiming?.();
      if (t && t.iterations === Infinity) a.cancel();
      else a.finish();
    }
  };
  const SET = {
    overlay: [
      ['static', [['.universe-hud', 'data-static']]],
      ['off', [['.universe-lock', 'data-off'], ['.universe-threat', 'data-off'], ['.universe-mate', 'data-off']]],
      ['hot', [['.universe-lock', 'data-hot'], ['.universe-reticle', 'data-hot'], ['.universe-lead', 'data-hot']]],
      ['threats', [['.universe-threat', 'data-on']]],
      ['way-hit', [['.universe-nav', 'data-way'], ['.universe-reticle', 'data-hit']]],
      ['tough-kill', [['.universe-lock', 'data-tough'], ['.universe-reticle', 'data-kill']]],
    ],
    cluster: [
      ['on', [['.hud-cluster', 'data-on']]],
      ['target', [['.fc-target', 'data-on']]],
      ['boost', [['.fc-speed', 'data-boost']]],
      ['low', [['.hud-vitals', 'data-low']]],
    ],
  }[part];
  const all = (sel) => (root.matches(sel) ? [root] : [...root.querySelectorAll(sel)]);
  const out = {};
  let smallest = { px: Infinity, at: null };
  for (let s = 0; s < states; s++) {
    const label = [];
    SET.forEach(([name, flags], bit) => {
      const on = Boolean(s & (1 << bit));
      if (on) label.push(name);
      for (const [sel, attr] of flags) for (const el of all(sel)) el.toggleAttribute(attr, on);
    });
    settle();
    const state = label.join('+') || 'none';
    const rows = {};
    for (const el of els) {
      for (const pseudo of ['', '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo || null);
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
        const d = defaults(el.tagName.toLowerCase(), pseudo);
        const o = {};
        for (let i = 0; i < cs.length; i++) {
          const k = cs[i];
          const v = cs.getPropertyValue(k);
          if (d[k] !== v) o[k] = v;
        }
        rows[`${names.get(el)}${pseudo}`] = o;
        // (the smallest text shown: an element of words, drawn, not hidden by a part above it)
        if (!pseudo && el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
          const px = parseFloat(cs.fontSize);
          if (px < smallest.px) smallest = { px, at: `${names.get(el)} (${state})` };
        }
      }
    }
    out[state] = rows;
  }
  return { out, smallest };
}

// ── every map, part, size and motion: one record ──
async function take(order, html) {
  const exe = process.env.CHROMIUM ?? ['/opt/pw-browsers/chromium'].find(existsSync);
  const browser = await chromium.launch({ executablePath: exe });
  const css = sheets(order).join('\n');
  const styles = {}; // hash → style, each distinct one once
  const index = new Map();
  const rows = {}; // `size|motion|map|state|element|pseudo` → hash
  let smallest = { px: Infinity, at: null };
  try {
    for (const [w, h] of SIZES)
      for (const motion of MOTIONS)
        for (const map of MAPS) {
          const page = await browser.newPage({ viewport: { width: w, height: h } });
          await page.emulateMedia({ reducedMotion: motion });
          // (the text the writer would put in, so the words have a size)
          const inner = PARTS.map((p) => html[p]).join('');
          await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="bare"></div>${WRAP[map](inner)}</body></html>`);
          await page.evaluate(() => {
            const put = (sel, t) => document.querySelectorAll(sel).forEach((e) => (e.textContent = t));
            put('.universe-lock-name', 'TIE Fighter');
            put('.universe-lock-dist', '6.1');
            put('.universe-nav-name', 'Course: Endor · J');
            put('.universe-nav-dist', '120');
            put('.universe-mate-name', 'Wedge');
            put('.fc-target-name', 'TIE Fighter');
            put('.fc-target-dist', '6.1');
          });
          for (const part of PARTS) {
            const { out, smallest: s } = await page.evaluate(measure, { part, states: part === 'overlay' ? 64 : 16 });
            if (s.px < smallest.px) smallest = { px: s.px, at: `${s.at}, ${map}, ${w}x${h}, motion ${motion}` };
            for (const [state, els] of Object.entries(out))
              for (const [el, style] of Object.entries(els)) {
                const key = JSON.stringify(style);
                let id = index.get(key);
                if (id === undefined) {
                  id = index.size;
                  index.set(key, id);
                  styles[id] = style;
                }
                const at = el.indexOf('::');
                rows[`${w}x${h}|${motion}|${map}|${part}:${state}|${at < 0 ? el : el.slice(0, at)}|${at < 0 ? '' : el.slice(at)}`] = id;
              }
          }
          await page.close();
        }
  } finally {
    await browser.close();
  }
  return { smallest, styles, rows };
}

const html = await markup();
if (write) {
  const r = await take(ORDERS[0], html);
  writeFileSync(write, JSON.stringify(r));
  console.log(`smallest text: ${r.smallest.px}px (${r.smallest.at})`);
  console.log(`wrote ${write}: ${Object.keys(r.rows).length} styles read, ${Object.keys(r.styles).length} distinct`);
} else {
  const was = JSON.parse(readFileSync(against, 'utf8'));
  let failed = 0;
  for (const order of ORDERS) {
    const now = await take(order, html);
    console.log(`smallest text: ${now.smallest.px}px (${now.smallest.at})`);
    const lines = [];
    let tokens = 0;
    const withTokens = argv.includes('--tokens');
    for (const key of new Set([...Object.keys(was.rows), ...Object.keys(now.rows)])) {
      // (only what this run read: a map or part left out isn't a difference)
      const [, , map, partState] = key.split('|');
      if (!MAPS.includes(map) || !PARTS.includes(partState.split(':')[0])) continue;
      const a = was.styles[was.rows[key]] ?? null;
      const b = now.styles[now.rows[key]] ?? null;
      if (!a || !b) {
        lines.push(`${key}: ${a ? 'there' : 'missing'} -> ${b ? 'there' : 'missing'}`);
        continue;
      }
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (a[k] === b[k]) continue;
        if (k.startsWith('--') && !withTokens) tokens++;
        else lines.push(`${key} ${k}: ${a[k] ?? '(default)'} -> ${b[k] ?? '(default)'}`);
      }
    }
    console.log(`${lines.length} differences (order: ${order})`);
    if (tokens) console.log(`(and ${tokens} tokens moved, not counted: --tokens counts them)`);
    const limit = Number(flag('lines', 200));
    for (const l of lines.slice(0, limit)) console.log(l);
    if (lines.length > limit) console.log(`… and ${lines.length - limit} more`);
    failed += lines.length;
  }
  process.exit(failed ? 1 : 0);
}
