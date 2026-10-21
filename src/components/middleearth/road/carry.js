// Where "Carry on" picks the ride up (the resume card): where it was left,
// unless that was inside one of the films' moments (a beat that holds, or
// takes the camera), when it's a few metres before the moment's mark, so
// the moment plays again rather than the camera holding on what's over.
// Pure; the module's alone (the beats of every stage come with it).
//
//   carryFrom(s) → s

import { REACH } from './beats';
import { at, sOf } from './line';
import { STAGES } from './stages/index';
import { BEATS_OF } from './stages/registry';

export const LEAD = 4; // m before a moment's mark
const ON = 1e-6; // m: on a mark is at it

const moment = (b) => (b.hold ?? 0) > 0 || (b.rig && b.rig !== 'follow');

export function carryFrom(s) {
  const here = at(STAGES, s);
  const inside = (BEATS_OF[here.stage] ?? []).filter((b) => moment(b) && b.at <= here.local + ON && here.local - b.at <= (b.reach ?? REACH));
  if (!inside.length) return s;
  // (the first of them, when one moment's reach runs into the next)
  const first = inside.reduce((a, b) => (b.at < a.at ? b : a));
  return sOf(STAGES, here.stage, Math.max(0, first.at - LEAD));
}
