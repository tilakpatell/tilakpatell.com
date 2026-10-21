// Herbology, the Mandrakes (quest 5, docs/superpowers/specs/2026-10-21-
// hogwarts-world-design.md §4.7). Earmuffs on, then four Mandrakes to
// repot before their crying gets through. Each pot is a timing: pull the
// Mandrake up (E) and it squirms, a marker swinging across a bar; push it
// into its new pot (E again) while the marker is in the green and it goes
// in; outside it, it wriggles free of your grip and keeps squalling. Every
// second one is out of the soil its cry builds, slowly through earmuffs and
// at once without: when the cry is through you faint for ten seconds, and
// it drops back into its old pot. Each pot is a little quicker and
// narrower than the last.
//
//   HERB, POTS, newHerbology({ earmuffs }), muffs(h, on), act(h) → { herb,
//   what, says }, stepHerbology(h, dt), marker(h) → 0…1, result(h),
//   herbologyBot(h) → 'act' | 'muffs' | null

export const HERB = {
  cry: 100, // the cry gets through at this
  muffled: 11, // a second, through earmuffs (about nine seconds a Mandrake)
  bare: 160, // a second, without
  faint: 10, // seconds out cold
  points: 10,
};
// each pot: the marker’s swing (seconds there and back) and the green’s
// middle and half-width on the bar
export const POTS = [
  { swing: 1.8, at: 0.5, half: 0.15 },
  { swing: 1.5, at: 0.62, half: 0.12 },
  { swing: 1.25, at: 0.38, half: 0.1 },
  { swing: 1.05, at: 0.55, half: 0.08 },
];

export const SAYS = {
  muffsOn: 'Earmuffs on. The greenhouse goes thick and quiet.',
  muffsOff: 'Earmuffs off. Mind what you pull up.',
  pulled: 'Up it comes, purple and furious.',
  potted: 'In it goes, soil over its head. It sulks.',
  missed: 'It wriggles out of your grip, squalling.',
  fainted: 'The cry gets through. Everything goes very far away.',
  woke: 'You come round on the greenhouse floor. Sprout is fanning you with a trowel.',
  done: 'Four Mandrakes repotted. Ten points, and a nice cup of tea.',
};

export function newHerbology({ earmuffs = false } = {}) {
  return { earmuffs, pot: 0, out: false, since: 0, cry: 0, faint: 0, done: false, misses: 0, faints: 0 };
}

export const muffs = (h, on) => (h.done || h.out ? h : { ...h, earmuffs: on });

// the marker: across the bar and back, once a swing, from the pull
export function marker(h) {
  if (!h.out) return 0;
  const pot = POTS[h.pot];
  const k = (h.since / pot.swing) % 1;
  return k < 0.5 ? k * 2 : 2 - k * 2;
}
export const inGreen = (h) => h.out && Math.abs(marker(h) - POTS[h.pot].at) <= POTS[h.pot].half;

export function act(h) {
  if (h.done || h.faint > 0) return { herb: h, what: null, says: null };
  if (!h.out) return { herb: { ...h, out: true, since: 0 }, what: 'pulled', says: SAYS.pulled };
  if (inGreen(h)) {
    const pot = h.pot + 1;
    const done = pot >= POTS.length;
    return { herb: { ...h, out: false, since: 0, cry: 0, pot, done }, what: 'potted', says: done ? SAYS.done : SAYS.potted };
  }
  return { herb: { ...h, misses: h.misses + 1 }, what: 'missed', says: SAYS.missed };
}

export function stepHerbology(h, dt) {
  if (h.done) return { herb: h, what: null };
  if (h.faint > 0) {
    const faint = Math.max(0, h.faint - dt);
    return { herb: { ...h, faint }, what: faint === 0 ? 'woke' : null };
  }
  if (!h.out) return { herb: h, what: null };
  const cry = h.cry + (h.earmuffs ? HERB.muffled : HERB.bare) * dt;
  if (cry >= HERB.cry) return { herb: { ...h, out: false, since: 0, cry: 0, faint: HERB.faint, faints: h.faints + 1 }, what: 'fainted' };
  return { herb: { ...h, since: h.since + dt, cry }, what: null };
}

export const result = (h) => (h.done ? { type: 'lesson', id: 'herbology', done: true, points: HERB.points } : null);

// the bot: earmuffs first, then a pull, and a push in the green’s middle
export function herbologyBot(h) {
  if (h.done || h.faint > 0) return null;
  if (!h.earmuffs && !h.out) return 'muffs';
  if (!h.out) return 'act';
  return Math.abs(marker(h) - POTS[h.pot].at) <= POTS[h.pot].half * 0.5 ? 'act' : null;
}
