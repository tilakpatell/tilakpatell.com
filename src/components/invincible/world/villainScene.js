// The villains' events drawn and felt (split out of ./scene.js as a
// repair): ./villains.js draws each, the camera takes the knock and the
// hitstop by their size, the street runs from it, and a Mauler's thrown car
// is taken out of the traffic.

import { takeCar } from './traffic';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// what the villains do that's drawn and felt (./villains.js's fx)
export const VILLAIN_EV = new Set(['spawn', 'hit', 'ko', 'down', 'hurt', 'won', 'swing', 'throw', 'carHit', 'carAway', 'carDown', 'quake', 'blast', 'shake']);

// One of their events this frame; the traffic as it is after it.
export function villainFeel(e, { villains, feel, scare, traffic, h }) {
  // the villains (./foes.js): coming through, hit, knocked out, hitting him
  villains.fx(e);
  // (the camera's knock goes by their size; a punch that lands stops the
  // game 70 ms, ./InvWorld.jsx's loop slowed by timeScale: the stop
  // stays under reduced motion, where the knock is the feel's to hold)
  if (e.type === 'ko') {
    feel.trauma(e.kind === 'mauler' ? 0.5 : e.kind === 'seismic' ? 0.4 : 0.3);
    feel.hitstop(70);
    scare.push({ x: e.at[0], z: e.at[2], r: 30 });
  } else if (e.type === 'hit') {
    feel.trauma(e.kind === 'mauler' ? 0.25 : 0.15);
    feel.hitstop(70);
  } else if (e.type === 'hurt') feel.trauma(e.by === 'car' || e.by === 'mauler' ? 0.5 : 0.35);
  else if (e.type === 'shake') feel.trauma(clamp(0.9 - Math.hypot(e.at[0] - h.p[0], e.at[2] - h.p[2]) / 200, 0.2, 0.9));
  else if (e.type === 'carHit' || e.type === 'carDown') scare.push({ x: e.at[0], z: e.at[2], r: 25 });
  else if (e.type === 'throw' && e.car != null && traffic.cars[e.car]) return takeCar(traffic, traffic.cars[e.car].id);
  return traffic;
}
