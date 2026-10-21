// The power tiles' writer (PowerBar.jsx's: the HUD kit's Powers markup):
// each tile's ring, its seconds and its word (where the power stands, or a
// refusal's reason for a couple of seconds), written only when what it shows
// has changed. The maps' powers.js calls it every frame, and so does the
// C-137 street's fight, with what the powers say (shipPowers.js's view).
//
//   createPowerTiles() → { place(root, on, view, denied, now) }
//   view: shipPowers.js's view(st), or null (nothing to show)
//   denied: { slot, why, until (performance.now() ms) } | null
//   WHY_WORDS: a refusal's word, by its why; DENIED_FOR: how long it's said (ms)

const SLOTS = ['primary', 'ultimate'];
const PHASE_WORDS = { ready: 'ready', active: 'on', cooling: 'cooling down', charging: 'charging' };
export const WHY_WORDS = { held: 'Held', solid: 'No room', shield: 'Shielded', empty: 'Nobody near', cooling: 'Cooling', charging: 'Charging', active: 'On', none: '' };
export const DENIED_FOR = 2000;

export function createPowerTiles() {
  let bar = { root: null };
  return {
    place(root, on, v, denied = null, now = performance.now()) {
      if (root !== bar.root) {
        const q = (slot) => root?.querySelector(`[data-slot="${slot}"]`) ?? null;
        const part = (slot, sel) => q(slot)?.querySelector(sel) ?? null;
        bar = { root, on: null, slots: Object.fromEntries(SLOTS.map((slot) => [slot, q(slot)])), small: Object.fromEntries(SLOTS.map((slot) => [slot, part(slot, 'small')])), state: Object.fromEntries(SLOTS.map((slot) => [slot, part(slot, '.hud-power-state')])), sig: {} };
      }
      if (!root) return;
      const shown = Boolean(on && v);
      if (shown !== bar.on) {
        bar.on = shown;
        root.toggleAttribute('data-on', shown);
      }
      if (!shown) return;
      for (const slot of SLOTS) {
        const el = bar.slots[slot];
        if (!el) continue;
        const x = v[slot];
        const k = Math.round(x.k * 50) / 50;
        const text = x.phase === 'active' || x.phase === 'cooling' ? `${x.left}s` : x.phase === 'charging' ? `${Math.floor(x.charge * 100)}%` : '';
        // (the cluster's word: a refusal's reason for a couple of seconds, else where the power stands)
        const no = denied && denied.slot === slot && now < denied.until ? (WHY_WORDS[denied.why] ?? '') : '';
        const words = no || (x.phase === 'active' ? `On ${x.left}s` : x.phase === 'cooling' ? `${x.left}s` : x.phase === 'charging' ? `${Math.floor(x.charge * 100)}%` : 'Ready');
        const sig = `${x.phase}|${k}|${text}|${no}`;
        if (bar.sig[slot] === sig) continue;
        const phaseWas = bar.sig[slot]?.split('|')[0];
        bar.sig[slot] = sig;
        el.style.setProperty('--k', String(k));
        if (bar.small[slot]) bar.small[slot].textContent = text;
        if (bar.state[slot]) bar.state[slot].textContent = words;
        el.toggleAttribute('data-denied', Boolean(no));
        if (phaseWas !== x.phase) {
          el.dataset.phase = x.phase;
          el.setAttribute('aria-label', `${x.name} (${x.key}): ${PHASE_WORDS[x.phase]}`);
        }
      }
    },
  };
}
