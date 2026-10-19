// A stage’s beats, read by the module and the stage’s own scene: which a
// step crossed, which the camera frames, how long they hold. Pure.
//
//   BEAT: { id, at (m into the stage), hold (s), kind?, rig (director’s RIGS), params?, cut?, lines?, clip?, fx?, reach? }
//   entered(beats, from, to) → ids crossed walking forward, at in [from, to)
//   left(beats, from, to) → ids crossed walking back (from > to), the mirror of entered
//   rigAt(beats, local) → { id, rig, params, cut, since } of the beat whose rig holds the camera, or null
//   holdsOf(beats) → seconds held in all

export const REACH = 18; // m past its mark a beat keeps the camera, unless it says

export const entered = (beats, from, to) => (to > from ? beats.filter((b) => b.at >= from && b.at < to).map((b) => b.id) : []);

export const left = (beats, from, to) => (from > to ? beats.filter((b) => b.at >= to && b.at < from).map((b) => b.id) : []);

export function rigAt(beats, local) {
  let found = null;
  for (const b of beats) if (b.at <= local && local - b.at <= (b.reach ?? REACH)) found = b;
  return found && { id: found.id, rig: found.rig, params: found.params ?? {}, cut: found.cut, since: local - found.at };
}

export const holdsOf = (beats) => beats.reduce((a, b) => a + (b.hold ?? 0), 0);
