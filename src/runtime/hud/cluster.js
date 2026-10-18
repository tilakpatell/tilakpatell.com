// The flight cluster's writer (Cluster.jsx, Vitals.jsx and Arms.jsx's
// markup): called by a world's frame loop every frame, it writes the
// vitals (shields in a ship, health on foot) and the arms (the line
// picked, its name and the ordnance rack), each only when what it shows
// has changed. Nothing is made per call: what's compared is a number or a
// string, and the writers are made once. A world writes its own blocks in
// the row (the galaxy's radar, speed and target) itself.
//
//   createFlightCluster() → { place(root, v) }
//     v: { on, vitals: { value, max, low } | null, arms: ArmsView | null }
//     ArmsView: { name, line ('primary' | 'secondary' | 'ordnance'), index (0–2), ammo, max, filling (0–1) }
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
const FULL = flag('data-full');

export function createFlightCluster() {
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
        const q = (c) => root?.querySelector(c) ?? null;
        const all = (c) => (root ? [...root.querySelectorAll(c)] : []);
        els = { root, vitals: q('.hud-vitals'), vitalsN: q('.hud-vitals-n'), arms: q('.hud-arms'), name: q('.hud-arms-name'), lines: all('.hud-arms-line'), pips: all('.hud-arms-pip') };
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
      const a = v.arms;
      put(els.arms, 'aon', Boolean(a), ON);
      if (!a) return;
      put(els.arms, 'line', a.line, line);
      put(els.name, 'name', a.name, text);
      els.lines.forEach((l, i) => put(l, `l${i}`, i === a.index, ON));
      const max = Math.max(0, Math.floor(a.max));
      const ammo = Math.max(0, Math.floor(a.ammo));
      const filling = ammo < max ? Math.round(Math.max(0, Math.min(1, a.filling)) * 100) : 0;
      els.pips.forEach((pip, i) => {
        put(pip, `ph${i}`, i >= max, hide);
        put(pip, `pf${i}`, i < ammo, FULL);
        put(pip, `pg${i}`, i === ammo ? filling : 0, fill);
      });
    },
  };
}
