// The flight cluster's writer (Cluster.jsx, Vitals.jsx and Arms.jsx's
// markup): called by a world's frame loop every frame, it writes the
// vitals (shields in a ship, health on foot) and the arms (the line
// picked, its name and the ordnance rack; or, on foot, the gun in the hand,
// its name and its heat, the vent's marker running while it's locked), each
// only when what it shows has changed. Nothing is made per call: what's compared is a number or a
// string, and the writers are made once. A world writes its own blocks in
// the row (the galaxy's radar, speed and target) itself.
//
//   createFlightCluster() → { place(root, v) }
//     v: { on, vitals: { value, max, low } | null, arms: ArmsView | null, abilities?: [Tile] }
//     Tile: { name?, left (seconds, or a held one's share of its tank spent), full, on, held? } (Abilities.jsx's tiles, in order)
//   createAbilitiesWriter() → { place(root, tiles) }   the same tiles anywhere else (a touch screen's thumbs)
//     ArmsView: { name, line ('primary' | 'secondary' | 'ordnance'), index (0–2), ammo, max, filling (0–1) }
//       or, a gun in the hand: { name, line: 'hand', heat (0–1), locked, vent (0–1, while locked) | null }
//   PIPS                   the most rack pips drawn (a rack of more shows as many)
//   vitalsPct(value, max)  the whole percent shown, 0–100

export const PIPS = 8;

export const vitalsPct = (value, max) => (max > 0 && Number.isFinite(value) ? Math.round(Math.max(0, Math.min(1, value / max)) * 100) : 0);

const flag = (name) => (el, on) => el.toggleAttribute(name, on);
const text = (el, s) => (el.textContent = s);
const pct = (el, v) => (el.textContent = `${v}%`);
const share = (el, v) => el.style.setProperty('--v', String(v / 100));
const line = (el, v) => (el.dataset.line = v);
const hide = (el, v) => (el.hidden = v);
const fill = (el, v) => el.style.setProperty('--fill', (v / 100).toFixed(2));
const ON = flag('data-on');
const LOW = flag('data-low');
const LOCKED = flag('data-locked');
const heat = (el, v) => el.style.setProperty('--heat', (v / 100).toFixed(2));
const ventAt = (el, v) => el.style.setProperty('--vent', v < 0 ? '0' : (v / 100).toFixed(2));
const FULL = flag('data-full');
// (each line's and pip's keys in the cache, made once: a frame makes no strings)
const LINE_KEYS = ['l0', 'l1', 'l2'];
const keysOf = (p) => Array.from({ length: PIPS }, (_, i) => `${p}${i}`);
const PIP_HIDE = keysOf('ph');
const PIP_FULL = keysOf('pf');
const PIP_FILL = keysOf('pg');

// the abilities' tiles (Abilities.jsx): each one's name, the shade of its
// cooldown and its seconds (a tenth under ten), and whether it's on; a held
// one (a jetpack) shows its tank spent, and no seconds
const COOL = flag('data-cooling');
const shade = (el, v) => el.style.setProperty('--k', (v / 100).toFixed(2));
function abilitiesWriter() {
  let root = null;
  let tiles = [];
  const was = new Map();
  const put = (el, key, value, write) => {
    if (!el || was.get(key) === value) return;
    was.set(key, value);
    write(el, value);
  };
  return (el, list) => {
    if (el !== root) {
      root = el;
      tiles = el ? [...el.querySelectorAll('.hud-ability')].map((t) => ({ t, name: t.querySelector('.hud-ability-name'), left: t.querySelector('.hud-ability-left') })) : [];
      was.clear();
    }
    if (!el || !list) return;
    for (let i = 0; i < tiles.length && i < list.length; i++) {
      const { t, name, left } = tiles[i];
      const a = list[i];
      if (a.name != null) put(name, `n${i}`, a.name, text);
      const cooling = !a.held && a.left > 0.05;
      const k = a.held ? Math.max(0, Math.min(1, a.left)) : cooling && a.full > 0 ? Math.min(1, a.left / a.full) : 0;
      put(t, `k${i}`, Math.round(k * 100), shade);
      put(t, `c${i}`, cooling, COOL);
      put(t, `o${i}`, Boolean(a.on), ON);
      put(left, `l${i}`, cooling ? (a.left < 10 ? a.left.toFixed(1) : a.left.toFixed(0)) : '', text);
    }
  };
}
export function createAbilitiesWriter() {
  const write = abilitiesWriter();
  return { place: (root, list) => write(root, list) };
}

// the cluster's parts under its root (found apart from place: a function
// that makes closures over its own arguments makes a record for them on
// every call, made or not)
function partsOf(root) {
  const q = (c) => root?.querySelector(c) ?? null;
  const all = (c) => (root ? [...root.querySelectorAll(c)] : []);
  return { root, vitals: q('.hud-vitals'), vitalsN: q('.hud-vitals-n'), arms: q('.hud-arms'), name: q('.hud-arms-name'), lines: all('.hud-arms-line'), pips: all('.hud-arms-pip'), heat: q('.hud-arms-heat'), abilities: q('.hud-abilities') };
}

export function createFlightCluster() {
  const writeAbilities = abilitiesWriter();
  let els = { root: null };
  const was = new Map();
  const put = (el, key, value, write) => {
    if (!el || was.get(key) === value) return;
    was.set(key, value);
    write(el, value);
  };
  return {
    place(root, v) {
      if (root !== els.root) {
        els = partsOf(root);
        was.clear();
      }
      if (!root) return;
      put(root, 'on', Boolean(v?.on), ON);
      if (!v?.on) return;
      const vt = v.vitals;
      if (vt) {
        const p = vitalsPct(vt.value, vt.max);
        put(els.vitals, 'v', p, share);
        put(els.vitals, 'low', Boolean(vt.low), LOW);
        put(els.vitalsN, 'vn', p, pct);
      }
      // (the tiles come and go with what they show, on foot or in a fight: looked for again when the one held has gone)
      if (v.abilities) {
        if (!els.abilities || els.abilities.isConnected === false) els.abilities = root.querySelector('.hud-abilities');
        writeAbilities(els.abilities, v.abilities);
      }
      const a = v.arms;
      put(els.arms, 'aon', Boolean(a), ON);
      if (!a) return;
      put(els.arms, 'line', a.line, line);
      put(els.name, 'name', a.name, text);
      if (a.line === 'hand') {
        // (whole percents, so a gun cooling a hair a frame writes a few times a second, not every frame)
        put(els.heat, 'heat', Math.round(Math.max(0, Math.min(1, a.heat ?? 0)) * 100), heat);
        put(els.arms, 'locked', Boolean(a.locked), LOCKED);
        put(els.heat, 'vent', a.vent == null ? -1 : Math.round(a.vent * 100), ventAt);
        return;
      }
      put(els.arms, 'locked', false, LOCKED);
      for (let i = 0; i < els.lines.length && i < LINE_KEYS.length; i++) put(els.lines[i], LINE_KEYS[i], i === a.index, ON);
      const max = Math.max(0, Math.floor(a.max));
      const ammo = Math.max(0, Math.floor(a.ammo));
      const filling = ammo < max ? Math.round(Math.max(0, Math.min(1, a.filling)) * 100) : 0;
      for (let i = 0; i < els.pips.length && i < PIPS; i++) {
        const pip = els.pips[i];
        put(pip, PIP_HIDE[i], i >= max, hide);
        put(pip, PIP_FULL[i], i < ammo, FULL);
        put(pip, PIP_FILL[i], i === ammo ? filling : 0, fill);
      }
    },
  };
}
