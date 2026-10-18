// Mark's fists, as rules: what the keys he already has do in a fight
// (part 3's brawl). A tap punches, as it always did (./foes.js finds who and
// lunges); held a quarter of a second within reach it grabs a foe up to a
// Mauler's size, or a car, and carries it; let go, it's thrown at his speed
// and 30 m/s more; carried into the ground or a tower over 40 m/s it takes
// two hits and leaves a crater. Space in the air over a foe from 30 m up
// dives onto it at 90 m/s, one hit from 30 m up to three from 200 m. Shift on
// the ground, facing a foe, blocks: what lands is halved, and a swing that
// meets it opens 0.6 s in which a punch counts double. C on the ground near
// foes is a ground pound, a ring out to 40 m every 4 s.
//
// Pure: stepBrawl(b, input, mark, world, dt) → { b, out }, where out is what
// happened this step for ./foes.js to do to the foes, ./flight.js to do to
// him and ./scene.js to draw:
//   { kind: 'punch' | 'counter', power }
//   { kind: 'grab', target, what, at }       { kind: 'throw', target, v, at }
//   { kind: 'slam', target, hits, at, force, crater, tower }
//   { kind: 'dive', target, at, speed }      { kind: 'diveHit', target, hits, at, force, crater }
//   { kind: 'pound', at, r, speed }
// input: { fist (the punch key held), punched (pressed this step), up (Space
// pressed this step), guard (Shift held), pound (C pressed this step) };
// mark: { p (his feet), v, mode, look, alt (over the ground), landed: { speed,
// at } | null, impact: { speed, at, tower } | null }; world: { things: [{ id,
// kind, at (its middle), grabbable, foe }], blocked (swings he blocked last
// step) }. A step is never longer than a twentieth of a second.

export const BRAWL = {
  punch: { cool: 0.35 },
  grab: { hold: 0.25, reach: 4.5, slow: 0.7 },
  throw: { add: 30 },
  slam: { speed: 40, hits: 2 },
  dive: { from: 30, speed: 90, cone: 0.5, top: 200, hits: [1, 3] },
  block: { cut: 0.5, stagger: 0.8, counter: 0.6, reach: 6, front: 0.5 },
  pound: { speed: 20, r: 40, cool: 4 },
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const chest = (m) => [m.p[0], m.p[1] + 1, m.p[2]];

export function newBrawl() {
  return { hold: 0, tried: false, carry: null, counter: 0, pound: 0, guard: false, dive: null };
}

// a punch now counts double: a blocked swing a moment ago
export const counterOpen = (b) => b.counter > 0;

// hits a dive does from `h` metres up: one from 30 m to three from 200 m
export function diveDamage(h) {
  const [lo, hi] = BRAWL.dive.hits;
  const k = Math.max(0, Math.min(1, (h - BRAWL.dive.from) / (BRAWL.dive.top - BRAWL.dive.from)));
  return Math.floor(lo + k * (hi - lo) + 1e-9);
}

// within his reach, and the kind that can be held
export const canGrab = (m, thing) => Boolean(thing.grabbable) && len(sub(thing.at, chest(m))) <= BRAWL.grab.reach;

const nearest = (list, from) => list.reduce((a, t) => (!a || len(sub(t.at, from)) < len(sub(a.at, from)) ? t : a), null);

export function stepBrawl(prev, input = {}, m, world = {}, rawDt) {
  const dt = Math.min(0.05, Math.max(0, rawDt || 0));
  const b = { ...prev };
  const out = [];
  const things = world.things ?? [];
  const c = chest(m);
  b.counter = Math.max(0, b.counter - dt);
  b.pound = Math.max(0, b.pound - dt);
  // a swing that met his block a moment ago: the counter's window
  if (world.blocked) b.counter = BRAWL.block.counter;

  // what he carries, into the ground or a tower hard: a slam
  const hit = m.impact ?? m.landed;
  if (b.carry && hit && hit.speed > BRAWL.slam.speed) {
    out.push({ kind: 'slam', target: b.carry.id, hits: BRAWL.slam.hits, at: [...hit.at], force: hit.speed, crater: true, tower: m.impact?.tower ?? null });
    b.carry = null;
  }

  // the punch key: held, a grab; let go of what's carried, a throw
  if (input.fist) {
    b.hold += dt;
    if (!b.carry && !b.tried && b.hold >= BRAWL.grab.hold) {
      b.tried = true;
      const t = nearest(things.filter((q) => canGrab(m, q)), c);
      if (t) {
        b.carry = { id: t.id, kind: t.kind };
        out.push({ kind: 'grab', target: t.id, what: t.kind, at: [...t.at] });
      }
    }
  } else {
    if (b.carry) {
      const speed = len(m.v) + BRAWL.throw.add;
      const l = len(m.look) || 1;
      out.push({ kind: 'throw', target: b.carry.id, v: m.look.map((x) => (x / l) * speed), at: c });
      b.carry = null;
    }
    b.hold = 0;
    b.tried = false;
  }
  // a tap: a punch, double in the counter's window
  if (input.punched && !b.carry) {
    const counter = counterOpen(b);
    out.push({ kind: counter ? 'counter' : 'punch', power: counter ? 2 : 1 });
    if (counter) b.counter = 0;
  }

  // Shift on the ground, facing a foe near him: the block
  const flat = Math.hypot(m.look[0], m.look[2]) || 1;
  const facing = (t) => {
    const d = sub(t.at, c);
    const l = Math.hypot(d[0], d[2]) || 1;
    return l <= BRAWL.block.reach && (d[0] * m.look[0] + d[2] * m.look[2]) / (l * flat) >= BRAWL.block.front;
  };
  b.guard = Boolean(input.guard) && m.mode === 'ground' && things.some((t) => t.foe && facing(t));

  // Space in the air, a foe under him and 30 m or more down: the dive
  if (input.up && m.mode === 'air' && !b.carry && !b.dive && m.alt >= BRAWL.dive.from) {
    const under = things.filter((t) => {
      if (!t.foe) return false;
      const d = sub(t.at, c);
      return d[1] < 0 && Math.acos(Math.min(1, -d[1] / (len(d) || 1))) <= BRAWL.dive.cone;
    });
    const t = nearest(under, c);
    if (t) {
      b.dive = { target: t.id, from: m.alt };
      out.push({ kind: 'dive', target: t.id, at: [...t.at], speed: BRAWL.dive.speed });
    }
  } else if (b.dive && m.landed) {
    out.push({ kind: 'diveHit', target: b.dive.target, hits: diveDamage(b.dive.from), at: [...m.landed.at], force: m.landed.speed, crater: true });
    b.dive = null;
  }

  // C on the ground with foes about: the ground pound
  if (input.pound && m.mode === 'ground' && b.pound <= 0 && things.some((t) => t.foe && len(sub(t.at, c)) <= BRAWL.pound.r)) {
    b.pound = BRAWL.pound.cool;
    out.push({ kind: 'pound', at: [...m.p], r: BRAWL.pound.r, speed: BRAWL.pound.speed });
  }
  return { b, out };
}
