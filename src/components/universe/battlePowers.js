// The crews' ship powers in a battle (battle.js's): Force Focus's slowed
// clock, a ghost its fire flies through and Walt's magnet holding the other
// side's fighters. Pure (no three.js), so it's tested in Node; the galaxy's
// war (galaxy/warfront.js) steps its battle through stepBattle, and the
// galaxy's powers (powers.js) hold fighters with holdFighters and
// land their own shots through the battle's own hit() (shipPowers.js's
// shotAt), so a power's damage on a battle is a shot's: its objectives'
// shared tally, its shields and its aces all as the guns find them.
//
// It works only through what a battle shows outside (its fighters' pos,
// prev, vel, cool and team, its clock, its you, update and hit), which
// battleScene.js draws from too, so it's the same however battle.js fights
// it inside. The one thing battle.js reads back is `ghost`, while a step
// runs: its bolts fly on past you.
//
//   stepBattle(b, dt, you, { slow, ghost, magnet, pull }) → events (update's)
//   holdFighters(b, at, r, secs, daze) → how many it holds

import { pullStep } from './shipPowers';

// Where in the magnet's ball a held fighter goes: its own spot a little
// way round the point (by its id, so it keeps it), not all of them on the
// one point drawn inside each other
const BALL = 1.2;
const ballAt = (at, id) => {
  const a = id * 2.399963; // (the golden angle: spread evenly however many)
  const y = ((id * 0.618034) % 1) * 2 - 1;
  const r = Math.sqrt(1 - y * y) * BALL;
  return { x: at.x + Math.cos(a) * r, y: at.y + y * BALL, z: at.z + Math.sin(a) * r };
};

// One frame of the battle (`dt` real seconds), with whatever power is on:
// - slow (Force Focus): the whole battle stepped at that share of the time,
//   its fighters, its bolts and its batteries, but its clock put on to the
//   real time after (the defender wins on the clock: a power can't stretch
//   it). Your speed as it reckons it is then quicker by the same share,
//   which in its slowed time it is, so its fighters still lead you right.
// - ghost (Han's corkscrew, Rick's portal): its fire flies through you.
// - magnet (Walt's, a point; `pull` the most it drags at): the fighters it
//   holds dragged to it whatever their own flying would have them do. With
//   no magnet, they're let go.
export function stepBattle(b, dt, you, { slow = 1, ghost = false, magnet = null, pull = 16 } = {}) {
  const held = [];
  for (const f of b.fighters) if (f.alive && f.held > 0) held.push([f, f.pos.x, f.pos.y, f.pos.z]);
  const k = Math.min(1, Math.max(0, slow));
  b.ghost = Boolean(ghost);
  let events;
  try {
    events = b.update(dt * k, you);
  } finally {
    b.ghost = false;
  }
  if (k < 1 && !b.over) b.clock += dt * (1 - k);
  for (const [f, x, y, z] of held) {
    if (!f.alive || !magnet) {
      f.held = 0;
      continue;
    }
    const was = { x, y, z };
    const p = pullStep(was, ballAt(magnet, f.id), pull, dt);
    f.prev.x = x;
    f.prev.y = y;
    f.prev.z = z;
    f.pos.x = p.x;
    f.pos.y = p.y;
    f.pos.z = p.z;
    // (where it's drawn and locked on, where battle.js keeps that apart)
    if (f.seen) {
      f.seen.x = p.x;
      f.seen.y = p.y;
      f.seen.z = p.z;
    }
    const per = 1 / Math.max(dt, 1e-4);
    f.vel.x = (p.x - x) * per;
    f.vel.y = (p.y - y) * per;
    f.vel.z = (p.z - z) * per;
    f.held = Math.max(0, f.held - dt);
  }
  return events;
}

// Walt's magnet on a battle: every fighter of the other side's within `r` of
// `at` held for `secs`, its guns quiet the while and for `daze` after (its
// own cooldown, the gate its flying fires through, set past the both of
// them). Nobody while you're nobody's, or once it's over, as hit() does.
export function holdFighters(b, at, r, secs, daze = 0) {
  if (!b || b.over || b.you.team === null) return 0;
  let n = 0;
  for (const f of b.fighters) {
    if (!f.alive || f.team === b.you.team) continue;
    if (Math.hypot(f.pos.x - at.x, f.pos.y - at.y, f.pos.z - at.z) > r) continue;
    f.held = secs;
    f.cool = Math.max(f.cool ?? 0, secs + daze);
    n++;
  }
  return n;
}
