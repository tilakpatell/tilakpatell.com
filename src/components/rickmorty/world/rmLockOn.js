// The lock-on in C-137 (lib/combat/lockOn.js on this world's things),
// beside RmWorld.jsx, which is past its size. The Lock button (touch) and
// Tab toggle it; on a coarse pointer it's on by itself while a duel's
// hunter is within 14 m (Total Rickall's crowd aren't hostile: there it's
// only by hand). While it's on:
//   - in Total Rickall the camera stays on whoever was in the sights when
//     it came on (the sight line, rickall.js's, turned onto them as Morty
//     walks), till they're shot;
//   - in a duel Morty turns to face the hunter, so his shots (along his
//     facing, duel.js) go at him: the lock has his facing, turned on from
//     where it left him (not from where the walker's turned him since,
//     towards where he walks), so it holds as he backs off or strafes.
//
//   stepRmLockOn(lock, s, dt, { R, hunter }) — `lock` a createLockOn, `s`
//   RmWorld's sim (m, yaw, pitch, rickall), `R` Total Rickall's rules (or
//   null before they're loaded), `hunter` the duel's hunter as a bolt body
//   (npc.js's bodies()[0]) or null. Changes s.yaw, s.m.face, s.lockId and
//   s.lockFace (the facing it left him with, null when it isn't turning him).

import { turnTo } from '../../../lib/combat/lockOn';

export function stepRmLockOn(lock, s, dt, { R = null, hunter = null } = {}) {
  const m = s.m;
  const near = hunter ? Math.hypot(hunter.a[0] - m.x, hunter.a[2] - m.z) : Infinity;
  if (!lock.step({ near })) {
    s.lockId = null;
    s.lockFace = null;
    return;
  }
  const run = s.rickall;
  if (run?.phase === 'on' && R) {
    s.lockFace = null;
    const standing = (id) => id && !run.game.shot.includes(id) && run.game.people.find((p) => p.id === id);
    if (!standing(s.lockId)) s.lockId = run.aim ?? null;
    const p = standing(s.lockId);
    if (!p) return;
    // (the line starts over his shoulder, so where it points from moves as it turns: twice is near enough)
    let want = s.yaw;
    for (let i = 0; i < 2; i++) {
      const o = R.sight(m, want, s.pitch);
      want = Math.atan2(-(p.x - o.x), -(p.z - o.z));
    }
    s.yaw = turnTo(s.yaw, want, dt);
    return;
  }
  if (hunter && !s.flying) {
    // (a heading looks along (cos, −sin), rules.js's)
    const want = Math.atan2(-(hunter.a[2] - m.z), hunter.a[0] - m.x);
    s.lockFace = turnTo(s.lockFace ?? m.face, want, dt);
    s.m = { ...m, face: s.lockFace };
  } else s.lockFace = null;
}
