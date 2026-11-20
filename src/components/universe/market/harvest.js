// A generated planet's harvest into the crew's hold: what its traits give
// (yields.js's yieldOfPlanet), worked out for a while after PLANET_CAP
// harvests (store.js's empty and isEmpty, as a field is), the line to say
// with it. The planets' lane calls it from a landing or an orbit's action and
// shows `said`; one economy, the market's. Pure.
//
// harvest({ market, crew, room, traits, id, press, sector, d }) → { got: [{ good, n }], said }

import { HOLD } from '../words';
import { GOODS } from './goods';
import { PLANET_CAP, yieldOfPlanet } from './yields';

const key = (id) => `planet:${id}`;

export function harvest({ market, crew, room, traits, id, press = 0, sector = [0, 0, 0], d = 0 }) {
  if (!market || !crew || !id) return { got: [], said: HOLD.closed };
  if (market.isEmpty(key(id))) return { got: [], said: HOLD.workedOut };
  const hold = market.hold(crew, room);
  const from = { sector: Array.isArray(sector) ? sector : [0, 0, 0], pocket: null };
  const got = yieldOfPlanet(traits, { id, press, d })
    .map((g) => ({ ...g, n: hold.add(g.good, g.n, from) }))
    .filter((g) => g.n > 0);
  if (!got.length) return { got, said: HOLD.full };
  if (press + 1 >= PLANET_CAP) market.empty(key(id));
  return { got, said: HOLD.stowed(got.map((g) => `${g.n} ${GOODS[g.good].name.toLowerCase()}`).join(', ')) };
}
