// The street's Federation patrol (./ship.js flies it), in a fight: calm
// until a shot of yours hits it, then it fights back, with a hunter's laser
// (the universe's hunterRules.js: 12 a hit) and a pack's hp (sides.js's
// patrol takes two punches; the street's lone patrol stands in for a pack
// of three, so six); shot down, a new one comes round its loop a minute
// later. It goes back to its loop when your
// cruiser is down or landed. Pure: plain objects, each step a new one.
//
//   PATROL                 its numbers
//   newPatrol()            → { mode: 'calm' | 'fight' | 'down', hp, nextShot, downAt }
//   provoke(p, now)        → the patrol turned on you (a moment before its first shot)
//   hitPatrol(p, punch, now) → { patrol, down } (a hit provokes it; down at no hp)
//   patrolShot(p, from, at, now, rand) → { patrol, shot: { from, dir } | null }
//                            (`from` its place, `at` the cruiser's: at where you
//                            are, a little wide, only in range and at its pace)
//   stepPatrol(p, now)     → back, calm and whole, `back` seconds after it went down
//   calm(p)                → back to its loop, the damage it's taken kept

export const PATROL = { hp: 6, laser: { speed: 34, life: 1.1, damage: 12 }, fire: [0.8, 1.5], back: 60, range: 40, spread: 0.06, first: 1 };

export const newPatrol = () => ({ mode: 'calm', hp: PATROL.hp, nextShot: 0, downAt: null });

export const provoke = (p, now) => (p.mode === 'calm' ? { ...p, mode: 'fight', nextShot: now + PATROL.first } : p);

export function hitPatrol(p, punch, now) {
  if (p.mode === 'down') return { patrol: p, down: false };
  const hp = p.hp - (Number.isFinite(punch) && punch > 0 ? punch : 0);
  if (hp <= 0) return { patrol: { ...p, mode: 'down', hp: 0, downAt: now }, down: true };
  return { patrol: { ...provoke(p, now), hp }, down: false };
}

export function patrolShot(p, from, at, now, rand = Math.random) {
  if (p.mode !== 'fight' || now < p.nextShot) return { patrol: p, shot: null };
  const dx = at.x - from.x;
  const dy = at.y - from.y;
  const dz = at.z - from.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > PATROL.range || d < 1e-6) return { patrol: p, shot: null };
  const wide = () => (rand() * 2 - 1) * PATROL.spread;
  const v = [dx / d + wide(), dy / d + wide(), dz / d + wide()];
  const l = Math.hypot(v[0], v[1], v[2]);
  const pace = PATROL.fire[0] + (PATROL.fire[1] - PATROL.fire[0]) * rand();
  return { patrol: { ...p, nextShot: now + pace }, shot: { from: [from.x, from.y, from.z], dir: [v[0] / l, v[1] / l, v[2] / l] } };
}

export const stepPatrol = (p, now) => (p.mode === 'down' && now - p.downAt >= PATROL.back ? newPatrol() : p);

export const calm = (p) => (p.mode === 'fight' ? { ...p, mode: 'calm' } : p);
