// The walkway cabinets at Blips and Chitz, and the one that plays: Plumbus
// Smash. Plumbuses come down three chutes; a press smashes the lowest one in
// a chute that's in the hammer's reach, one that gets to the end costs a
// life, and a swing at a chute with nothing in reach sticks the stick for a
// moment. Beat the all-nines high score (somebody's 9,999) before the lives
// run out. Pure, stepped at a fixed dt by ./Cabinet.jsx; tested in Node.
// Its randomness is Roy's (roy/rules.js's rand), carried in the state.
//
//   newCabinet({ game, seed, perks }) → game
//   stepCabinet(game, input, dt) → game   input: { smash: chute } pressed since the last step
//
// `perks` (the shop's, P13) are taken and, until the shop decides what they
// do here, none is read.

export const CABINETS = {
  cabinet1: { name: 'Space Mortyball' },
  cabinet2: { name: 'Plumbus Smash', target: 10000 },
  cabinet3: { name: 'Cronenberg Crush' },
};
// the names as the marquees and the posters draw them (world/arcade.js)
export const MARQUEES = Object.fromEntries(Object.entries(CABINETS).map(([id, c]) => [id, c.name.toUpperCase()]));
export const playable = (id) => Boolean(CABINETS[id]?.target);

export const TUNING = Object.freeze({
  lanes: 3,
  lives: 3,
  smash: 250, // points a plumbus
  reach: 0.62, // how far down a chute (0 to 1) the hammer reaches from
  stuck: 0.5, // seconds the stick sticks after a swing at nothing
  spawn: [1.1, 0.42], // seconds between plumbuses, at the start and at full speed
  fall: [2.6, 1.25], // seconds down a chute, likewise
  ramp: 40, // plumbuses smashed to full speed
});

function rand(state) {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s >>> 0];
}

// (the options may carry `perks`; none is read yet)
export function newCabinet({ game = 'cabinet2', seed = 1 } = {}) {
  return { game, rng: seed >>> 0 || 1, t: 0, score: 0, target: CABINETS[game]?.target ?? Infinity, lives: TUNING.lives, phase: 'play', drops: [], next: 0.6, n: 0, smashed: 0, stuck: 0, events: [] };
}

export function stepCabinet(prev, input = {}, dt = 1 / 60) {
  if (prev.phase !== 'play') return { ...prev, events: [] };
  const step = Math.min(dt, 0.1);
  const g = { ...prev, drops: prev.drops.map((d) => ({ ...d })), events: [] };
  const k = Math.min(1, g.smashed / TUNING.ramp);
  const lerp = ([a, b]) => a + (b - a) * k;
  g.t += step;
  g.stuck = Math.max(0, g.stuck - step);
  // the press: the lowest plumbus in reach in that chute, or a swing at nothing
  if (input.smash != null && g.stuck <= 0) {
    const low = g.drops.filter((d) => d.lane === input.smash && d.y >= TUNING.reach).sort((a, b) => b.y - a.y)[0];
    if (low) {
      g.drops = g.drops.filter((d) => d !== low);
      g.score += TUNING.smash;
      g.smashed += 1;
      g.events.push({ type: 'smash', lane: input.smash });
      if (g.score >= g.target) {
        g.phase = 'won';
        g.events.push({ type: 'won' });
        return g;
      }
    } else {
      g.stuck = TUNING.stuck;
      g.events.push({ type: 'whiff', lane: input.smash });
    }
  }
  // down the chutes; one at the end is a life
  const fall = lerp(TUNING.fall);
  for (const d of g.drops) d.y += step / fall;
  for (const d of g.drops.filter((o) => o.y >= 1)) {
    g.lives -= 1;
    g.events.push({ type: 'miss', lane: d.lane });
  }
  g.drops = g.drops.filter((d) => d.y < 1);
  if (g.lives <= 0) {
    g.lives = 0;
    g.phase = 'lost';
    g.events.push({ type: 'lost' });
    return g;
  }
  // and the next ones in
  while (g.t >= g.next) {
    const [v, rng] = rand(g.rng);
    g.rng = rng;
    const lane = Math.floor(v * TUNING.lanes);
    g.n += 1;
    g.drops.push({ id: g.n, lane, y: 0 });
    g.events.push({ type: 'drop', lane });
    g.next += lerp(TUNING.spawn);
  }
  return g;
}
