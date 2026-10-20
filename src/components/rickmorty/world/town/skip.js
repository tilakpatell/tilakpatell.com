// Skipping a stone on the park's pond (the `pond` thing to do): the first
// press picks a stone up and a power bar swings, up and down; the second
// throws it. Thrown with the bar in the sweet band it skips five times or
// more; under it, fewer; over it, it's thrown too hard and plunks after a
// hop or two. Five skips is the thing done. Pure and import-free, stepped by
// the street (./scene.js draws the stone and its rings); tested in Node.
//
//   newSkip() → game
//   stepSkip(game, { press, away }, dt) → game
//     press: E this frame; away: Morty's walked off from the shore (the aim's dropped)
//     events: pick | throw { n, power } | land { n, power } | drop
//   skipsFor(power) → how many times a stone thrown that hard skips
//   skipReadout(game) → { on, vitals, line }   for the HUD's meter

export const TUNING = Object.freeze({
  swing: 1.4, // seconds for the bar to go from empty to full (and as long back)
  sweet: [0.72, 0.9], // the band that skips well
  need: 5, // skips for the thing to be done
  flight: 2.6, // seconds from the throw till the next stone can be picked up
});

export const WORDS = Object.freeze({
  aim: 'Throw when the bar’s in the green',
  skips: (n) => (n === 0 ? 'Plunk. Straight in.' : n === 1 ? 'One skip, then gone.' : `${n} skips.`),
  hard: 'Too hard: it digs in.',
  best: (n) => `${n} skips. That’s the one.`,
});

export function newSkip() {
  return { phase: 'idle', t: 0, power: 0, n: null, best: 0, events: [] };
}

// the bar's height t seconds into a swing: up for `swing`, down for `swing`, again
export const barAt = (t, swing = TUNING.swing) => {
  const u = (t / swing) % 2;
  return u <= 1 ? u : 2 - u;
};

export function skipsFor(power) {
  const [lo, hi] = TUNING.sweet;
  if (power > hi) return Math.max(0, Math.round(2 - (power - hi) * 20));
  if (power >= lo) {
    // (five at the band's edges, seven at its heart)
    const mid = (lo + hi) / 2;
    return 5 + Math.round(2 * (1 - Math.abs(power - mid) / ((hi - lo) / 2)));
  }
  return Math.max(0, Math.round((power / lo) * 4.4 - 0.4));
}

export function stepSkip(prev, { press = false, away = false } = {}, dt = 1 / 60) {
  const g = { ...prev, events: [] };
  if (g.phase === 'aim' && away) {
    g.phase = 'idle';
    g.events.push({ type: 'drop' });
    return g;
  }
  if (g.phase === 'idle') {
    if (press) {
      Object.assign(g, { phase: 'aim', t: 0, power: 0 });
      g.events.push({ type: 'pick' });
    }
    return g;
  }
  if (g.phase === 'aim') {
    g.t += Math.min(dt, 0.1);
    g.power = barAt(g.t);
    if (press) {
      const n = skipsFor(g.power);
      Object.assign(g, { phase: 'thrown', t: 0, n, best: Math.max(g.best, n) });
      g.events.push({ type: 'throw', n, power: g.power });
    }
    return g;
  }
  // thrown: the stone's in the air, then in the water
  g.t += Math.min(dt, 0.1);
  if (g.t >= TUNING.flight - 1e-9) {
    g.phase = 'idle';
    g.events.push({ type: 'land', n: g.n, power: g.power });
  }
  return g;
}

// what the HUD's meter shows: the bar while aiming, nothing otherwise
export function skipReadout(g) {
  if (!g || g.phase !== 'aim') return { on: false, vitals: null, line: '' };
  const [lo, hi] = TUNING.sweet;
  return { on: true, vitals: { value: Math.round(g.power * 100), max: 100, low: g.power < lo || g.power > hi }, line: WORDS.aim };
}

// what's said once a stone's come down, and whether it did the thing
export function landed(n, { power = 0 } = {}) {
  const text = n >= TUNING.need ? WORDS.best(n) : power > TUNING.sweet[1] ? `${WORDS.hard} ${WORDS.skips(n)}` : WORDS.skips(n);
  return { text, done: n >= TUNING.need };
}
