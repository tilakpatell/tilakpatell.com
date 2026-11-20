// Trading at a docked station: its board (what it sells, what you hold, the
// prices), buying, selling and dumping, against the wallet (economy.js:
// spend to buy, credit to sell) and the crew's hold (store.js). Pure: the
// clock and the station come in.
//
// stationFor(dest) → { stationId, sector, pocket, area, type }: a generated
//   station's trade from its place row (its id seeds its type); HOME the Core's
//   exchange, on the Home station
// boardOf({ market, economy, station, crew, room, t }) → [{ id, name, have,
//   sell, buy, canSell, canBuy }]: what it sells, and whatever's in the hold
// buyGood({ market, economy, station, crew, room, good, n, t }) → { ok, why, n, paid }
// sellGood({ market, economy, station, crew, room, good, n, t }) → { ok, why, n, got }
// jettison({ market, crew, room, good, n }) → the units dumped
// PLACE_MARKETS, placeMarket(id) → the trade of a hand-made place that keeps a
//   market (the Core's exchange on the Home station, the smugglers' posts at the
//   Maelstrom's gate and the Curve Rift's portal, the Citadel's market in the
//   Curve), or null; its sector is where the place is (ship.js's goalAt)

import { areaOf } from './areas';
import { GOODS } from './goods';
import { priceOf } from './prices';
import { stationTypeOf, tradesOf } from './stations';
import { goalAt } from '../ship';
import { sectorAt } from '../../../lib/space/address.js';

export function stationFor(dest) {
  const sector = Array.isArray(dest?.cube) ? dest.cube : [0, 0, 0];
  const area = areaOf(sector);
  return { stationId: String(dest?.id ?? 'station'), sector, pocket: dest?.pocket ?? null, area, type: stationTypeOf(String(dest?.id ?? ''), area) };
}
export const HOME = Object.freeze({ stationId: 'home', sector: [0, 0, 0], pocket: null, area: { id: 'core', kind: 'core', danger: 0, richness: 0, d: 0 }, type: 'industry' });

const where = (station) => ({ sector: station.sector, pocket: station.pocket ?? null });
const price = (market, station, good, from, t) =>
  priceOf({ stationId: station.stationId, type: station.type, area: station.area, good, from, at: where(station), t, shock: market.shockOf(station.stationId, good, t), yours: market.yours(station.stationId, good, t) });

export function boardOf({ market, economy, station, crew, room, t }) {
  if (!market || !station) return [];
  const hold = market.hold(crew, room);
  const { sells } = tradesOf(station.type, station.area);
  const held = hold.goods().map((g) => g.id);
  const ids = [...new Set([...sells, ...held])];
  return ids.map((id) => {
    const have = hold.count(id);
    const next = hold.lots.find((l) => l.good === id);
    const p = price(market, station, id, next?.from ?? where(station), t);
    const sold = sells.includes(id);
    return { id, name: GOODS[id].name, have, sell: p.sell, buy: sold ? p.buy : null, canSell: Boolean(economy) && have > 0, canBuy: Boolean(economy) && sold && hold.free > 0 && economy.credits >= p.buy };
  });
}

export function buyGood({ market, economy, station, crew, room, good, n = 1, t }) {
  if (!market || !economy || !station) return { ok: false, why: 'shop', n: 0, paid: 0 };
  if (!tradesOf(station.type, station.area).sells.includes(good)) return { ok: false, why: 'unsold', n: 0, paid: 0 };
  const hold = market.hold(crew, room);
  const want = Math.min(Math.floor(n), hold.free);
  if (!(want > 0)) return { ok: false, why: 'room', n: 0, paid: 0 };
  // (unit by unit: each one bought puts the next up)
  let paid = 0;
  let got = 0;
  for (; got < want; got++) {
    const p = price(market, station, good, where(station), t);
    if (economy.credits - paid < p.buy) break;
    paid += p.buy;
    market.note(station.stationId, good, -1, t);
  }
  if (!got) return { ok: false, why: 'credits', n: 0, paid: 0 };
  economy.spend(paid);
  hold.add(good, got, where(station));
  return { ok: true, why: null, n: got, paid };
}

export function sellGood({ market, economy, station, crew, room, good, n = 1, t }) {
  if (!market || !economy || !station) return { ok: false, why: 'shop', n: 0, got: 0 };
  const hold = market.hold(crew, room);
  const lots = hold.remove(good, Math.floor(n));
  if (!lots.length) return { ok: false, why: 'none', n: 0, got: 0 };
  let got = 0;
  let count = 0;
  for (const lot of lots)
    for (let i = 0; i < lot.n; i++) {
      got += price(market, station, good, lot.from, t).sell;
      market.note(station.stationId, good, 1, t);
      count++;
    }
  economy.credit(got, good);
  return { ok: true, why: null, n: count, got };
}

export const jettison = ({ market, crew, room, good, n = 1 }) => market?.hold(crew, room).remove(good, Math.floor(n)).reduce((k, l) => k + l.n, 0) ?? 0;

// (the layout session's place ids; each market's area one of AREAS')
export const PLACE_MARKETS = Object.freeze({
  home: { area: 'core', type: 'industry', pocket: null, label: 'The Core’s exchange' },
  starwars: { area: 'maelstrom', type: 'frontier', pocket: null, label: 'Smugglers’ post' },
  rmportal: { area: 'rift', type: 'frontier', pocket: null, label: 'Smugglers’ post' },
  citadel: { area: 'curve', type: 'research', pocket: 'curve', label: 'The Citadel’s market' },
});
export function placeMarket(id) {
  const m = typeof id === 'string' && Object.hasOwn(PLACE_MARKETS, id) ? PLACE_MARKETS[id] : null;
  if (!m) return null;
  const at = goalAt(id)?.at;
  const sector = id === 'home' || !at ? [0, 0, 0] : sectorAt(at[0], at[1] ?? 0, at[2]);
  return { stationId: id, label: m.label, sector, pocket: m.pocket, area: { ...areaOf(sector), id: m.area, kind: m.area === 'core' ? 'core' : m.pocket ? 'pocket' : 'portal' }, type: m.type };
}
