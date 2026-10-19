// The chase kind: the cruiser's game (episode 5, Heat). Shake the Federation
// ship by flying through six rings over the street, in order, while its
// laser is on you: three hits and the run's lost, and the first ring starts
// it again. The first ring starts a run only while a patrol's up to shake.
// Won, the patrol keeps off a while (`rest`). Pure and import-free (the
// browser check imports it in plain Node), stepped by RmWorld's tick right
// after the street's fight (./streetFight.js), whose hits on the cruiser it
// counts; the street isn't a dial place, so place() and the stage don't
// carry it. Its rings are drawn by ../chaseRings.js.
//
//   newChase({ rings, hits, perks }) → game
//   stepChase(game, input, dt) → game
//     input: { at: { x, y, z } (the cruiser), flying, hit (the patrol's hits
//     this step), down (the patrol shot down), grounded (the engines out) }
//     events: start | ring { n } | hit { left } | won { t } | lost { grounded } | wait | off
//   shaken(game) → whether the patrol's keeping off after a win
//   chaseReadout(game) → { on, vitals, line }   for the HUD's meter
//   chaseGoal(game) → { x, z } of the next ring, for the map
//   chaseStart(game) → { x, y, z, yaw } where a lost run starts again
//   chaseCalls(events, to) what C-137 does about them, through the calls it
//     hands over: { fight, now, ship(kind), note(text), complete(id), tell(e), again() }
//
// `perks` (the shop's, P13) are taken and, until the shop decides what they
// do here, none is read.

export const TUNING = Object.freeze({
  hits: 3, // the patrol's laser hits that lose a run
  r: 5, // a ring's radius, metres (the cruiser's is 1.7)
  jump: 6, // a move longer than this in one step (a portal, a warp) isn't a pass
  rest: 10, // seconds the patrol keeps off after a win
});

const E = Math.PI / 2;
// x, y, z: its middle; yaw: the way through it (the cruiser's: its nose is (sin yaw, cos yaw))
export const COURSE = Object.freeze([
  { x: -5, y: 9, z: 0, yaw: E }, // over the road in front of the Smiths'
  { x: 46, y: 15, z: -20, yaw: E }, // over Shoney's
  { x: 118, y: 18, z: 0, yaw: 0 }, // the street's east end, coming round
  { x: 40, y: 22, z: 42, yaw: -E }, // behind the school
  { x: -7, y: 32, z: 44, yaw: -E }, // over the Gotron's head
  { x: -62, y: 12, z: 0, yaw: -E }, // the west end of the road
]);

export const SAYS = {
  lost: 'Three hits and the Federation ship had you: back to the first ring.',
  wait: 'No Federation ship to shake: the next one’s round in a minute.',
  grounded: 'The deflectors went and the engines with them: the first ring again once they’re back.',
};

const BACK = 12; // metres before the first ring a lost run starts again

// (the options may carry `perks`; none is read yet)
export function newChase({ rings = COURSE, hits = TUNING.hits } = {}) {
  return { phase: 'idle', rings, max: hits, next: 0, hits: 0, t: 0, rest: 0, at: null, events: [] };
}

// from a to b through the ring's plane, inside it, either way, and not a jump
function passes(ring, a, b) {
  if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > TUNING.jump) return false;
  const nx = Math.sin(ring.yaw);
  const nz = Math.cos(ring.yaw);
  const da = (a.x - ring.x) * nx + (a.z - ring.z) * nz;
  const db = (b.x - ring.x) * nx + (b.z - ring.z) * nz;
  if (!((da < 0 && db >= 0) || (da > 0 && db <= 0))) return false;
  const k = da / (da - db);
  return Math.hypot(a.x + (b.x - a.x) * k - ring.x, a.y + (b.y - a.y) * k - ring.y, a.z + (b.z - a.z) * k - ring.z) <= TUNING.r;
}

const afresh = (g) => Object.assign(g, { phase: 'idle', next: 0, hits: 0, t: 0 });

export function stepChase(prev, input = {}, dt = 1 / 60) {
  const { flying = false, hit = 0, down = false, grounded = false } = input;
  const g = { ...prev, events: [] };
  // won or lost: the first ring again, at once (the quick retry)
  if (g.phase === 'won' || g.phase === 'lost') afresh(g);
  g.rest = Math.max(0, g.rest - dt);
  const from = prev.at;
  g.at = input.at ? { x: input.at.x, y: input.at.y, z: input.at.z } : null;
  // landed (or nowhere): a run ends, quietly
  if (!flying || !g.at) {
    if (g.phase === 'run') g.events.push({ type: 'off' });
    afresh(g);
    return g;
  }
  const passed = Boolean(from) && passes(g.rings[g.next], from, g.at);
  if (g.phase === 'idle') {
    // (the engines out, a cruiser coasting through starts nothing)
    if (!passed || grounded) return g;
    if (down) {
      g.events.push({ type: 'wait' });
      return g;
    }
    Object.assign(g, { phase: 'run', next: 1, rest: 0 });
    g.events.push({ type: 'start' }, { type: 'ring', n: 0 });
    return g;
  }
  // the patrol gone (it can't be shot down mid-run: ./streetFight.js holds it)
  if (down) {
    g.events.push({ type: 'off' });
    afresh(g);
    return g;
  }
  g.t += dt;
  for (let i = 0; i < hit && g.hits < g.max; i++) {
    g.hits += 1;
    g.events.push({ type: 'hit', left: g.max - g.hits });
  }
  if (g.hits >= g.max || grounded) {
    g.phase = 'lost';
    g.events.push({ type: 'lost', grounded: Boolean(grounded) });
    return g;
  }
  if (passed) {
    g.events.push({ type: 'ring', n: g.next });
    g.next += 1;
    if (g.next >= g.rings.length) {
      Object.assign(g, { phase: 'won', rest: TUNING.rest });
      g.events.push({ type: 'won', t: g.t });
    }
  }
  return g;
}

export const shaken = (g) => g.rest > 0;

export function chaseReadout(g) {
  if (!g || g.phase !== 'run') return { on: false, vitals: null, line: '' };
  const left = g.max - g.hits;
  return { on: true, vitals: { value: left, max: g.max, low: left === 1 }, line: `Ring ${g.next + 1} of ${g.rings.length}, ${left} ${left === 1 ? 'hit' : 'hits'} left` };
}

export function chaseGoal(g) {
  if (!g) return null;
  const r = g.rings[g.next] ?? g.rings[0];
  return { x: r.x, z: r.z };
}

export function chaseStart(g) {
  const r = g.rings[0];
  return { x: r.x - Math.sin(r.yaw) * BACK, y: r.y, z: r.z - Math.cos(r.yaw) * BACK, yaw: r.yaw };
}

// start: the patrol turned on the cruiser, and the cruiser says so; won: the
// patrol let go (held through the rest, so the shots still in the air don't
// turn it), the cruiser's word, the fly task ticked and the story told; lost:
// the patrol let go, its shots cleared, a word, and the run started again
// before the first ring (lost with the engines out, the cruiser comes down
// where it is, and the first ring's lit for when they're back); wait: why
// there's no run; off: the patrol let go
export function chaseCalls(events, to) {
  for (const e of events) {
    if (e.type === 'start') {
      to.fight.chase(true, to.now);
      to.ship('chase');
    } else if (e.type === 'won') {
      to.fight.chase(false, to.now, TUNING.rest);
      to.ship('shaken');
      to.complete('fly');
      to.tell({ type: 'win', game: 'chase' });
    } else if (e.type === 'lost') {
      to.fight.chase(false, to.now);
      to.fight.clear();
      to.note(e.grounded ? SAYS.grounded : SAYS.lost);
      if (!e.grounded) to.again();
    } else if (e.type === 'wait') to.note(SAYS.wait);
    else if (e.type === 'off') to.fight.chase(false, to.now);
  }
}
