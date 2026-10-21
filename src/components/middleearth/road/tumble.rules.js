// A tumble’s replay, pure: how a beat’s physics (things knocked flying) is
// run so that it stays a function of the beat’s time, as every scene on the
// Road is. The world is put back and run from the beat’s start whenever its
// time goes backward (a step back, a jump), and run on by the time that
// passed otherwise; a beat long done is run a settled while at once.
//
//   replay(last, now) → { reset, run }: last, now the beat’s seconds (null
//     before it began, Infinity long done); reset: put every body back;
//     run: seconds to step after

export const SETTLED = 6; // s: long enough for anything knocked to come to rest

export function replay(last, now) {
  if (now == null) return { reset: last != null, run: 0 };
  const to = Number.isFinite(now) ? now : SETTLED;
  if (last == null || !Number.isFinite(last) || to < last) return { reset: true, run: Math.min(to, SETTLED) };
  return { reset: false, run: Math.max(0, Math.min(to, SETTLED) - Math.min(last, SETTLED)) };
}
