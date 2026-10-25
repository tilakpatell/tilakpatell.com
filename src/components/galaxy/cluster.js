// The flight cluster's writer (FlightCluster.jsx's markup), called by
// galaxy/scene.js every frame: the deflectors and the arms (the HUD kit's
// own writer, runtime/hud/cluster.js, as every world's cluster has them),
// and the galaxy's own blocks: the speed against the boost's top, the kills
// this flight and the target, each written only when what it shows has
// changed (the HUD kit's rule: numbers through refs in the frame loop,
// never React's state). Called every frame, so it makes next to nothing per
// call: what's compared is a number (the text is made only when it's
// written), but for the target's distance, compared as the short text the
// lock's bracket says (frame.js's distText, so the two never differ), and
// the writers are made once. The pickups' effects over the row are
// chips (buffs): one made per kind while it lasts.
import { createFlightCluster } from '../../runtime/hud/cluster.js'; // (the writer alone: the kit's index brings its parts and sheets)
import { distText } from '../../runtime/hud/flight/frame.js';

const text = (el, s) => (el.textContent = s);
const num = (el, v) => (el.textContent = String(v));
const speedText = (el, v) => (el.textContent = `SPD ${v}`);
const bar = (per) => (el, v) => el.style.setProperty('--v', String(v / per));
const flag = (name) => (el, on) => el.toggleAttribute(name, on);
const WRITE = { boost: flag('data-boost'), speed: bar(50), hull: bar(50), hullOn: flag('data-on'), targetOn: flag('data-on') };

// An effect as a chip says it (pickups.js's buffs): its share left, to the
// bar's fiftieth, and its time in whole seconds, or the bubble's points left
const share = (b) => Math.round(Math.min(1, b.left / b.of) * 50);
const words = (b) => (b.points !== null && b.points !== undefined ? Math.ceil(b.points) : Math.ceil(b.left));
const said = (b) => (b.points !== null && b.points !== undefined ? String(words(b)) : `${words(b)}s`);
export const buffChips = (list) => list.map((b) => ({ kind: b.kind, name: b.name, v: String(share(b) / 50), text: said(b) }));

// `v`: { on, shield (0–100), low, speed, top, boosting, kills, lock: null | { name, dist (units), hp (0–1 or null) },
//   arms: the kit's ArmsView (runtime/hud/cluster.js) | null }
export function createCluster() {
  let els = { root: null };
  const was = new Map();
  const kit = createFlightCluster();
  const vitals = { value: 100, max: 100, low: false }; // (the one record handed to the kit's writer, filled each frame)
  const kitNow = { on: false, vitals, arms: null };
  const chips = new Map(); // kind → { el, time (its <i>), share, words } (the chips on the page, and what each shows)
  const put = (el, key, value, write) => {
    if (!el || was.get(key) === value) return;
    was.set(key, value);
    write(el, value);
  };
  return {
    place(root, v) {
      if (root !== els.root) {
        const q = (c) => root?.querySelector(c) ?? null;
        els = { root, speed: q('.fc-speed'), speedN: q('.fc-speed-n'), kills: q('.fc-kills-n'), target: q('.fc-target'), tName: q('.fc-target-name'), tDist: q('.fc-target-dist'), tHp: q('.fc-target-hp') };
        was.clear();
      }
      if (!root) return;
      kitNow.on = Boolean(v.on);
      vitals.value = v.shield;
      vitals.low = Boolean(v.low);
      kitNow.arms = v.arms ?? null;
      kit.place(root, kitNow);
      if (!v.on) return;
      const k = v.top > 0 ? Math.min(1, Math.abs(v.speed) / v.top) : 0;
      put(els.speed, 'sp', Math.round(k * 50), WRITE.speed);
      put(els.speed, 'boost', Boolean(v.boosting), WRITE.boost);
      put(els.speedN, 'spn', Math.round(Math.abs(v.speed) * 10), speedText);
      put(els.kills, 'kills', v.kills, num);
      const t = v.lock;
      put(els.target, 'ton', Boolean(t), WRITE.targetOn);
      if (!t) return;
      put(els.tName, 'tn', t.name, text);
      put(els.tDist, 'td', distText(t.dist), text);
      const tough = t.hp !== null && t.hp !== undefined;
      put(els.tHp, 'thon', tough, WRITE.hullOn);
      if (tough) put(els.tHp, 'thp', Math.round(t.hp * 50), WRITE.hull);
    },
    // the effects over the row (`list`: pickups.js's buffs(), each { kind, name, left, of, points }): a chip each, its bar and time
    // written only when they change, and a chip gone when its effect is
    buffs(root, list) {
      if (!root) return;
      if (!list.length && !chips.size) return;
      for (const [kind, c] of chips) {
        let still = false;
        for (const b of list) if (b.kind === kind) still = true;
        if (still) continue;
        c.el.remove();
        chips.delete(kind);
      }
      for (const b of list) {
        let c = chips.get(b.kind);
        if (!c) {
          const doc = root.ownerDocument;
          const el = doc.createElement('span');
          el.className = 'fc-buff';
          el.dataset.kind = b.kind;
          const name = doc.createElement('b');
          name.textContent = b.name;
          const time = doc.createElement('i');
          el.append(name, time);
          root.append(el);
          c = { el, time, share: -1, words: -1 };
          chips.set(b.kind, c);
        }
        const k = share(b);
        if (k !== c.share) {
          c.share = k;
          c.el.style.setProperty('--v', String(k / 50));
        }
        const w = words(b);
        if (w !== c.words) {
          c.words = w;
          c.time.textContent = said(b);
        }
      }
    },
  };
}
