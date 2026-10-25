// C-137 on a controller, beside RmWorld.jsx (which is past its size): what a
// frame's presses do, on their edges (../games/pad.js's readings, this
// frame's and the last). On foot A uses whatever the prompt says, X jumps, Y
// opens or shuts Things to do and B shuts it; in a fight RT fires and LT
// locks on (the lock-on's Tab, ./rmLockOn.js); in Total Rickall X or RT
// shoots and LT locks on; in the cruiser held X keeps the guns firing (RT
// and LT are its throttle). Things to do open holds the world: no jump, shot
// or lock under it. With an episode's card up, any press or the stick's first move closes it, and
// does nothing else.
//
//   padActs(now, before, { card, list, duel, rickall, flying }) → the acts,
//     of 'closeCard', 'act', 'jump', 'shoot', 'fire', 'lock', 'openList', 'closeList'
//   padFiring(now, { flying }) → whether the cruiser's guns are held on

import { edges, stirs } from '../../games/pad';

export function padActs(now, before, { card = false, list = false, duel = false, rickall = false, flying = false } = {}) {
  if (!now) return [];
  if (card) return stirs(now, before) ? ['closeCard'] : [];
  const e = edges(now, before);
  const out = [];
  if (e.a) out.push('act');
  if (rickall && (e.x || e.rt)) out.push('shoot');
  else if (!list) {
    if (e.x && !flying) out.push('jump');
    if (e.rt && duel) out.push('fire');
  }
  if (e.lt && (duel || rickall) && !list) out.push('lock');
  if (e.y) out.push(list ? 'closeList' : 'openList');
  else if (e.b && list) out.push('closeList');
  return out;
}

export const padFiring = (now, { flying = false } = {}) => Boolean(flying && now?.x);
