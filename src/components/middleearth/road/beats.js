// A stage’s beats, read by the module and the stage’s own scene: which a
// step crossed, which the camera frames, how long they hold. Pure.
//
//   BEAT: { id, at (m into the stage), hold (s), kind?, rig (director’s RIGS), params?, cut?, lines?, clip?, fx?, reach? }
//   entered(beats, from, to) → ids crossed walking forward, at in [from, to)
//   left(beats, from, to) → ids crossed walking back (from > to), the mirror of entered
//   rigAt(beats, local) → { id, rig, params, cut, since } of the beat whose rig holds the camera, or null
//   holdsOf(beats) → seconds held in all
//   stepBeats(since, beats, { from, to, dt, jumped }) → { since, fired }: the beats under way
//     (since: { id: seconds since it began }); a step forward begins each beat it reaches
//     (on its mark counts: the clock stops on it to hold), a step back undoes each it
//     goes back over, a jump marks those behind as long done without playing them
//   fxAt(beats, since) → { black (0…1), vision (bool) }: the beats’ effects this moment

export const REACH = 18; // m past its mark a beat keeps the camera, unless it says

export const entered = (beats, from, to) => (to > from ? beats.filter((b) => b.at >= from && b.at < to).map((b) => b.id) : []);

export const left = (beats, from, to) => (from > to ? beats.filter((b) => b.at >= to && b.at < from).map((b) => b.id) : []);

export function rigAt(beats, local) {
  let found = null;
  for (const b of beats) if (b.at <= local && local - b.at <= (b.reach ?? REACH)) found = b;
  return found && { id: found.id, rig: found.rig, params: found.params ?? {}, cut: found.cut, since: local - found.at };
}

export const holdsOf = (beats) => beats.reduce((a, b) => a + (b.hold ?? 0), 0);

const ON = 1e-6; // m: on a beat’s mark is at it

export function stepBeats(since, beats, { from, to, dt = 0, jumped = false }) {
  const next = {};
  const fired = [];
  if (jumped) {
    for (const b of beats) if (b.at < to - ON) next[b.id] = Infinity;
  } else {
    for (const b of beats) {
      if (since[b.id] == null) continue;
      // (gone back over: undone, so walking on through it plays it again)
      if (to < from && b.at > to + ON) continue;
      next[b.id] = since[b.id] + dt;
    }
    if (to >= from)
      for (const b of beats)
        if (next[b.id] == null && b.at >= from - ON && b.at <= to + ON) {
          next[b.id] = 0;
          fired.push(b.id);
        }
  }
  return { since: next, fired };
}

// a black veil: whole for the first BLACK_HOLD of its seconds, then lifting
const BLACK_HOLD = 0.6;

export function fxAt(beats, since) {
  let black = 0;
  let vision = false;
  for (const b of beats) {
    const s = since[b.id];
    if (s == null || !Number.isFinite(s)) continue;
    for (const f of b.fx ?? []) {
      const t = s - (f.at ?? 0);
      if (t < 0 || t > f.seconds) continue;
      if (f.kind === 'black') black = Math.max(black, t < f.seconds * BLACK_HOLD ? 1 : 1 - (t - f.seconds * BLACK_HOLD) / (f.seconds * (1 - BLACK_HOLD)));
      if (f.kind === 'vision') vision = true;
    }
  }
  return { black, vision };
}
