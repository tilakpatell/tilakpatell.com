// Pickle Rick's sewer run ("Pickle Rick"), the game under the agency's
// floor: Pickle Rick rolls down the storm drain towards the agency's
// basement, three lanes wide, with the rats coming the other way, grates to
// hop, and screws to pick up for the rat-suit's laser. Pure, stepped at a
// fixed dt by ./Sewer.jsx and drawn by ./scene.js; tested in Node.
//
//   newRun(seed) → run
//   stepRun(run, input, dt, { press }) → run   input: { left, right, hop, fire } presses since the last step;
//     `press`, the hop's buffer (lib/press.js's createCooldownPress)
//   laneX(lane) → metres across the drain
//   laserOn(touch) → the HUD's word for what fires once the laser's on: on a
//     touch screen the star, as the first card says

export const TUNING = Object.freeze({
  lanes: 3,
  laneW: 1.7, // metres between lanes
  speed: 8, // m/s at the start
  top: 14, // and at the end
  goal: 420, // metres to the agency's drain
  air: 0.55, // seconds a hop lasts
  hp: 3,
  stun: 0.9, // seconds slowed after a bite or a splash
  gap: [7, 12], // metres between things in the drain
  ahead: 48, // how far ahead things are made
  rat: 3.2, // m/s, the rats come the other way
  screws: 3, // screws for the laser
  range: 11, // metres the laser reaches
  cooldown: 0.5, // seconds between shots
  reach: 0.7, // metres, how close a thing is before it counts
});

export const laneX = (lane) => (lane - 1) * TUNING.laneW;

// a small seeded random, as Roy's (rules.js's rand): the run's `seed` moves
function rand(run) {
  const s = (run.seed * 1103515245 + 12345) & 0x7fffffff;
  run.seed = s;
  return s / 0x7fffffff;
}

export function newRun(seed = 1) {
  return { seed: (seed >>> 0) || 1, t: 0, x: 0, lane: 1, speed: TUNING.speed, hop: 0, hp: TUNING.hp, screws: 0, laser: false, kills: 0, stun: 0, cd: 0, items: [], next: 14, n: 0, phase: 'run', events: [] };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function stepRun(prev, input = {}, dt = 1 / 60, { press = null } = {}) {
  if (prev.phase !== 'run') return { ...prev, events: [] };
  const r = { ...prev, items: prev.items.map((o) => ({ ...o })), events: [] };
  r.t += dt;
  // the lane, one press one lane; a hop if his wheels are down
  r.lane = clamp(r.lane + (input.right ? 1 : 0) - (input.left ? 1 : 0), 0, TUNING.lanes - 1);
  // a hop pressed a moment before his wheels come down (or the stun ends)
  // waits for them, with a press (lib/press.js's createCooldownPress); without
  // one, a press in the air is this step's alone
  const ready = r.hop <= 0 && r.stun <= 0;
  if (press && input.hop) press.press();
  press?.ready(ready, dt);
  if (press ? press.take() : input.hop && ready) {
    r.hop = TUNING.air;
    r.events.push({ type: 'hop' });
  }
  r.hop = Math.max(0, r.hop - dt);
  r.stun = Math.max(0, r.stun - dt);
  r.cd = Math.max(0, r.cd - dt);
  // the laser, once he has the screws: the nearest rat ahead in his lane
  if (input.fire && r.laser && r.cd <= 0) {
    r.cd = TUNING.cooldown;
    const rat = r.items.filter((o) => o.kind === 'rat' && !o.hit && o.lane === r.lane && o.at > r.x && o.at - r.x <= TUNING.range).sort((a, b) => a.at - b.at)[0];
    if (rat) {
      rat.hit = true;
      r.kills += 1;
      r.events.push({ type: 'zap', id: rat.id });
    } else r.events.push({ type: 'miss' });
  }
  // rolling on, faster as he goes, slower while stunned
  r.speed = TUNING.speed + (TUNING.top - TUNING.speed) * clamp(r.x / TUNING.goal, 0, 1);
  r.x += r.speed * (r.stun > 0 ? 0.5 : 1) * dt;
  // what's coming: made as the drain ahead comes into view
  while (r.next < r.x + TUNING.ahead) {
    const k = rand(r);
    const kind = k < 0.42 ? 'rat' : k < 0.68 ? 'grate' : 'screw';
    r.items.push({ id: r.n++, kind, lane: Math.floor(rand(r) * TUNING.lanes), at: r.next, hit: false });
    r.next += TUNING.gap[0] + rand(r) * (TUNING.gap[1] - TUNING.gap[0]);
  }
  // the rats run at him; everything else waits
  for (const o of r.items) if (o.kind === 'rat' && !o.hit) o.at -= TUNING.rat * dt;
  // what he's reached
  for (const o of r.items) {
    if (o.hit || o.lane !== r.lane || Math.abs(o.at - r.x) > TUNING.reach) continue;
    o.hit = true;
    if (o.kind === 'screw') {
      r.screws += 1;
      r.events.push({ type: 'screw', id: o.id });
      if (!r.laser && r.screws >= TUNING.screws) {
        r.laser = true;
        r.events.push({ type: 'laser' });
      }
    } else if (r.hop > 0) {
      // over a grate, or down onto a rat
      if (o.kind === 'rat') {
        r.kills += 1;
        r.events.push({ type: 'squash', id: o.id });
      } else r.events.push({ type: 'clear', id: o.id });
    } else {
      r.hp -= 1;
      r.stun = TUNING.stun;
      r.events.push({ type: o.kind === 'rat' ? 'bite' : 'splash', id: o.id });
    }
  }
  r.items = r.items.filter((o) => o.at > r.x - 6);
  if (r.hp <= 0) {
    r.phase = 'lost';
    r.events.push({ type: 'out' });
  } else if (r.x >= TUNING.goal) {
    r.phase = 'won';
    r.events.push({ type: 'won' });
  }
  return r;
}

// how far along, 0 … 1
export const progress = (run) => clamp(run.x / TUNING.goal, 0, 1);

export const laserOn = (touch) => `laser on: ${touch ? 'the star fires' : 'F fires'}`;
