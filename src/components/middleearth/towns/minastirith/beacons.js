// On the side: Gondor calls for aid. Once the beacon over the Citadel is
// lit, the fire runs west along the White Mountains to Rohan, beacon by
// beacon. Watch them catch, then name them in the order they caught: three
// to begin with, one more each time, up to all seven. Name one wrong and
// they're lit again from the first. The names on the buttons are shuffled
// each round. Pure: the panel in ./MinasTirithWorld.jsx draws what it says.
//
//   BEACONS: [{ id, name }], east to west (the order they catch)
//   CHAIN: the timing and the rounds
//   newChain(seed) → the game; stepChain(c, dt) → events ('light' { i, id }, 'ask')
//   alight(c) → how many are burning now; nameBeacon(c, id) → 'right' |
//     'round' (all of this many: one more next) | 'lit' (all seven) | 'wrong' | null

import { seeded } from '../../../../lib/seeded';

export const BEACONS = [
  { id: 'amon-din', name: 'Amon Dîn' },
  { id: 'eilenach', name: 'Eilenach' },
  { id: 'nardol', name: 'Nardol' },
  { id: 'erelas', name: 'Erelas' },
  { id: 'min-rimmon', name: 'Min-Rimmon' },
  { id: 'calenhad', name: 'Calenhad' },
  { id: 'halifirien', name: 'Halifirien' },
];
export const CHAIN = { first: 3, wait: 0.8, show: 1.1, pause: 1.4 };

function shuffle(ids, rand) {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function newChain(seed = 1) {
  const rand = seeded(seed);
  return { round: CHAIN.first, phase: 'show', t: 0, shown: 0, said: 0, slips: 0, state: 'on', rand, deck: shuffle(BEACONS.map((b) => b.id), rand) };
}

// how many are burning: those caught so far while they're shown, those named while you name them
export const alight = (c) => (c.phase === 'show' ? c.shown : c.phase === 'ask' || c.phase === 'next' ? c.said : c.state === 'lit' ? BEACONS.length : 0);

export function stepChain(c, dt) {
  const ev = [];
  if (c.state !== 'on') return ev;
  c.t += dt;
  if (c.phase === 'show') {
    const due = Math.min(c.round, Math.max(0, Math.floor((c.t - CHAIN.wait) / CHAIN.show) + 1));
    while (c.shown < due) {
      ev.push({ type: 'light', i: c.shown, id: BEACONS[c.shown].id });
      c.shown += 1;
    }
    if (c.t >= CHAIN.wait + c.round * CHAIN.show) {
      c.phase = 'ask';
      c.said = 0;
      c.t = 0;
      ev.push({ type: 'ask' });
    }
  } else if ((c.phase === 'next' || c.phase === 'wrong') && c.t >= CHAIN.pause) {
    c.phase = 'show';
    c.t = 0;
    c.shown = 0;
    c.deck = shuffle(c.deck, c.rand);
  }
  return ev;
}

export function nameBeacon(c, id) {
  if (c.state !== 'on' || c.phase !== 'ask') return null;
  if (BEACONS[c.said].id !== id) {
    c.slips += 1;
    c.phase = 'wrong';
    c.t = 0;
    return 'wrong';
  }
  c.said += 1;
  if (c.said < c.round) return 'right';
  if (c.round >= BEACONS.length) {
    c.state = 'lit';
    c.phase = 'done';
    return 'lit';
  }
  c.round += 1;
  c.phase = 'next';
  c.t = 0;
  return 'round';
}
