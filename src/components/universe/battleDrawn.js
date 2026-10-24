// Where a battle's ships are drawn between its steps (battle.js steps it
// 1/30 s at a time, whatever the frame rate). A fighter or a runner is drawn
// between its last two steps, by how far the frame is into the next: its
// place (`seen`), its nose (`look`) and its bank (`lookBank`). Carried on
// along its velocity instead, as it was, a turning fighter left its line at
// every step and its nose snapped round thirty times a second, a judder on
// any screen faster than that; drawn a step behind, its way and its turn are
// both whole. Pure (no three.js), tested in Node.
//
// keepTurn(o) as a step starts (its nose and bank, `fwd0` and `bank0`);
// drawnAt(o, a) once the frame's steps are done, `a` the share of a step
// the frame is past the last one (0 to 1).

import { copy, norm, set, v3 } from './battleKit';

export function keepTurn(o) {
  if (!o.alive) return;
  o.fwd0 ??= v3();
  copy(o.fwd0, o.fwd);
  o.bank0 = o.bank ?? 0;
}

// (one put somewhere new in the step, launched, formed up or back from the
// dead, has its `prev` where it is: drawn there, turned as it is)
export function drawnAt(o, a) {
  const moved = o.prev.x !== o.pos.x || o.prev.y !== o.pos.y || o.prev.z !== o.pos.z;
  set(o.seen, o.prev.x + (o.pos.x - o.prev.x) * a, o.prev.y + (o.pos.y - o.prev.y) * a, o.prev.z + (o.pos.z - o.prev.z) * a);
  o.look ??= v3();
  if (moved && o.fwd0) norm(set(o.look, o.fwd0.x + (o.fwd.x - o.fwd0.x) * a, o.fwd0.y + (o.fwd.y - o.fwd0.y) * a, o.fwd0.z + (o.fwd.z - o.fwd0.z) * a));
  else copy(o.look, o.fwd);
  const bank = o.bank ?? 0;
  o.lookBank = moved && o.bank0 !== undefined ? o.bank0 + (bank - o.bank0) * a : bank;
}
