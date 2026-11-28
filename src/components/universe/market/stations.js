// A generated station's trade: one of six types, from its seed and its area,
// each making some goods (sold cheap) and needing others (bought dear), so
// goods flow along a chain. Every station buys every good; it sells what it
// makes, its area's specialties and the basics. Pure.
//
// STATION_TYPES: { [type]: { name, makes, needs } }
// stationTypeOf(seed, area) → a type, the same for the same seed and area
// tradesOf(type, area) → { sells: [good ids], buys: [good ids] }

import { hash64 } from '../../expanse/shared/gen'; // (the Expanse's hash, by its face: worlds are islands)
import { AREAS } from './areas';
import { GOODS } from './goods';

const type = (name, makes, needs) => Object.freeze({ name, makes, needs });
export const STATION_TYPES = Object.freeze({
  mining: type('Mining', ['iron', 'titanium', 'ice'], ['food', 'machinery']),
  industry: type('Industry', ['machinery', 'alloys', 'electronics'], ['iron', 'titanium', 'gas']),
  farming: type('Farming', ['food'], ['machinery', 'medicine']),
  research: type('Research', ['medicine', 'electronics'], ['datacores', 'exotic', 'voidcrystal', 'relics', 'silk']),
  military: type('Military', ['fuelcells', 'munitions'], ['munitions', 'alloys']),
  frontier: type('Frontier', ['scrap', 'components'], []),
});
const TYPES = Object.keys(STATION_TYPES);
// which types an area's kind leans to (weights, in TYPES' order)
const LEAN = {
  core: [1, 1, 1, 1, 1, 0],
  neighbourhood: [1, 1, 2, 1, 1, 1],
  portal: [0, 0, 0, 1, 1, 4],
  pocket: [1, 1, 1, 1, 1, 2],
  forge: [2, 5, 0, 1, 1, 0],
  grave: [1, 1, 0, 1, 0, 4],
  haven: [0, 0, 0, 0, 1, 6],
  ice: [4, 1, 1, 1, 0, 1],
  reef: [2, 1, 0, 3, 0, 1],
  cradle: [1, 1, 2, 3, 0, 0],
  deep: [0, 0, 0, 3, 0, 2],
};

export function stationTypeOf(seed, where) {
  const w = LEAN[where?.id] ?? LEAN[where?.kind] ?? LEAN.core;
  const total = w.reduce((a, b) => a + b, 0);
  let roll = Number(hash64('station-type', String(seed)) % 10000n) / 10000 * total;
  for (let i = 0; i < TYPES.length; i++) if ((roll -= w[i]) < 0) return TYPES[i];
  return TYPES[0];
}

const BASICS = ['food', 'medicine', 'fuelcells'];
export function tradesOf(t, where) {
  const st = STATION_TYPES[t] ?? STATION_TYPES.frontier;
  const a = AREAS[where?.id] ?? AREAS.core;
  const sells = [...new Set([...st.makes, ...a.specialties, ...BASICS])].filter((id) => Object.hasOwn(GOODS, id) && !GOODS[id].rare);
  return { sells, buys: Object.keys(GOODS) };
}
