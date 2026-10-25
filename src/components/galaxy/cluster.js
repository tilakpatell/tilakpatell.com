// The pickups' chips over the flight cluster (FlightHud.jsx's cluster's
// `over`: the galaxy's row of effects), called by galaxy/scene.js every
// frame, each chip written only when what it shows has changed (the HUD
// kit's rule: numbers through refs in the frame loop, never React's state).
// Called every frame, so it makes nothing per call: what's compared is a
// number (the text is made only when it's written). One chip is made per
// kind while its effect lasts. (The cluster itself, the shields, the line
// picked, the speed, the kills and the target, is the HUD kit's:
// runtime/hud/flight/flightHud.js writes it on both maps.)

// An effect as a chip says it (pickups.js's buffs): its share left, to the
// bar's fiftieth, and its time in whole seconds, or the bubble's points left
const share = (b) => Math.round(Math.min(1, b.left / b.of) * 50);
const words = (b) => (b.points !== null && b.points !== undefined ? Math.ceil(b.points) : Math.ceil(b.left));
const said = (b) => (b.points !== null && b.points !== undefined ? String(words(b)) : `${words(b)}s`);
export const buffChips = (list) => list.map((b) => ({ kind: b.kind, name: b.name, v: String(share(b) / 50), text: said(b) }));

export function createCluster() {
  const chips = new Map(); // kind → { el, time (its <i>), share, words } (the chips on the page, and what each shows)
  return {
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
