// The night half, composed (Lane F): the castle’s people on their days
// (rules/people.js), read by the Marauder’s Map. The world gives the time
// (its clock, in world hours since the arrival day’s midnight), the term’s
// week and where you are on the Map’s frame; this keeps everyone’s places
// for the frame and hands the Map one object it reads every frame (the
// same object each time, written in place: nothing that moves goes through
// React).
//
//   createNight({ timeOf, weekOf, me }) → { step(dt), view(), people() }
//     timeOf() → world hours; weekOf() → the term’s week; me() → { x, z, yaw, moving, inside }
//     view() → { me: { id, name, x, z, dx, dz, moving }, people, night, hour, week, t }

import { ROSTER, everyone } from '../rules/people';
import { afterHours } from '../rules/curfew';

const META = new Map(ROSTER.map((r) => [r.id, r]));
const EVERY = 1 / 20; // s between two readings of everyone’s places: enough for a footprint’s stride

export function createNight({ timeOf, weekOf = () => 1, me }) {
  const people = [];
  const you = { id: 'you', name: 'You', x: 0, z: 0, dx: 0, dz: -1, moving: false, ghost: false };
  const out = { me: you, people, night: false, hour: 0, week: 1, t: 0 };
  let since = Infinity;

  const read = () => {
    const t = timeOf();
    const week = weekOf();
    everyone(t, week, people);
    for (const p of people) {
      const m = META.get(p.id);
      p.name = m.name;
      p.ghost = m.ghost;
    }
    out.t = t;
    out.week = week;
    out.hour = ((t % 24) + 24) % 24;
    out.night = afterHours(out.hour);
  };
  const place = () => {
    const m = me();
    if (!m) return;
    you.x = m.x;
    you.z = m.z;
    // (yaw 0 looks down −z, the walk’s way)
    you.dx = -Math.sin(m.yaw ?? 0);
    you.dz = -Math.cos(m.yaw ?? 0);
    you.moving = Boolean(m.moving);
    you.inside = m.inside ?? null;
  };

  return {
    step(dt) {
      since += dt;
      if (since >= EVERY) {
        since = 0;
        read();
      }
    },
    view() {
      if (since === Infinity) {
        read();
        since = 0;
      }
      place();
      return out;
    },
    people: () => people,
  };
}
