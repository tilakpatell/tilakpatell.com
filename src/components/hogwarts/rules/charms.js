// Charms, the feather (quest 3, docs/superpowers/specs/2026-10-21-hogwarts-
// world-design.md §4.7): Wingardium Leviosa on your feather until it
// touches the ceiling. The swish and flick is a timing: hold the key (or
// draw the swish with the pointer) and let go (or flick up) on Flitwick’s
// beat, when the ring round the feather fills. On the beat the feather
// rises; near it, it rises a little; off it, it wobbles down. A jab, all
// flick and no swish, sets the feather alight, as a jab always has, and
// that costs the house five points and you a new feather. Between flicks
// it sinks, slowly, so it has to be kept at.
//
//   CHARMS, newCharms(), press(c, t), release(c, t) → { charms, grade,
//   says, points }, stepCharms(c, dt), burn(c) → { charms, points, says },
//   gesture(path) → { hold, jab, ok }: a pointer’s swish and flick read as
//   a hold of the key, result(c), charmsBot

export const CHARMS = {
  beat: 0.9, // seconds of swish before the flick: the ring’s fill
  perfect: 0.1, // within this of the beat
  good: 0.22,
  jab: 0.2, // let go sooner than this and it was a jab
  lift: { perfect: 0.9, good: 0.45, miss: -0.25 }, // metres
  sink: 0.08, // metres a second, between flicks
  ceiling: 3.6, // the classroom’s ceiling, above the desk
  points: 10,
  burn: 5,
};

export const SAYS = {
  perfect: 'Swish, and flick. Up it goes.',
  good: 'Nearly. It lifts a little.',
  miss: 'Off the beat. It wobbles and sinks.',
  jab: 'That was a jab. The feather is on fire.',
  burnt: 'Five points, and a fresh feather from the jar.',
  done: 'It touches the ceiling. Flitwick falls off his books with delight.',
};

export function newCharms() {
  return { h: 0, pressAt: null, flicks: 0, burnt: 0, done: false };
}

export const press = (c, t) => (c.done || c.pressAt != null ? c : { ...c, pressAt: t });

// how a hold of `hold` seconds lands against the beat
export function grade(hold) {
  if (hold < CHARMS.jab) return 'jab';
  const off = Math.abs(hold - CHARMS.beat);
  return off <= CHARMS.perfect ? 'perfect' : off <= CHARMS.good ? 'good' : 'miss';
}

export function release(c, t, hold = c.pressAt == null ? null : t - c.pressAt) {
  if (c.done || hold == null) return { charms: { ...c, pressAt: null }, grade: null, says: null, points: 0 };
  const g = grade(hold);
  if (g === 'jab') {
    const b = burn({ ...c, pressAt: null });
    return { ...b, grade: 'jab', says: `${SAYS.jab} ${SAYS.burnt}` };
  }
  const h = Math.min(CHARMS.ceiling, Math.max(0, c.h + CHARMS.lift[g]));
  const done = h >= CHARMS.ceiling;
  return { charms: { ...c, pressAt: null, h, flicks: c.flicks + 1, done }, grade: g, says: done ? SAYS.done : SAYS[g], points: done ? CHARMS.points : 0 };
}

export function stepCharms(c, dt) {
  if (c.done || c.h <= 0) return c;
  return { ...c, h: Math.max(0, c.h - CHARMS.sink * dt) };
}

// the feather alight (a jab, or Incendio at it: ./spells.js lists a
// feather among the things that burn)
export const burn = (c) => ({ charms: { ...c, h: 0, burnt: c.burnt + 1 }, points: -CHARMS.burn, says: SAYS.burnt });

// The pointer’s swish and flick, from its samples [{ x, y, t }] (pixels,
// y down; seconds): a swish across of 60 px or more, then a flick up of
// 20 px or more in the last 0.15 s. The hold is the swish’s time, up to
// the flick; a stroke that is all flick is a jab.
export function gesture(path) {
  if (!path || path.length < 2) return { ok: false, jab: false, hold: 0 };
  const end = path[path.length - 1];
  const start = path[0];
  const flickFrom = path.find((p) => end.t - p.t <= 0.15) ?? end;
  const flickUp = flickFrom.y - end.y;
  const across = Math.max(...path.map((p) => p.x)) - Math.min(...path.map((p) => p.x));
  const hold = flickFrom.t - start.t;
  if (flickUp >= 20 && (across < 60 || hold < CHARMS.jab)) return { ok: true, jab: true, hold: Math.min(hold, CHARMS.jab / 2) };
  if (flickUp < 20 || across < 60) return { ok: false, jab: false, hold };
  return { ok: true, jab: false, hold };
}

export function result(c) {
  return c.done ? { type: 'lesson', id: 'charms', done: true, points: CHARMS.points } : null;
}

// the bot: presses, and lets go on the beat
export function charmsBot(c, t) {
  if (c.done) return null;
  if (c.pressAt == null) return 'press';
  return t - c.pressAt >= CHARMS.beat ? 'release' : null;
}
