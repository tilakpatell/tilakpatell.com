import { useMemo, useState } from 'react';
import { useEconomy } from '../EconomyProvider';
import { STATION_TYPES } from '../market/stations';
import { boardOf, buyGood, jettison, sellGood, stationFor } from '../market/trade';
import { coreOf } from '../ships/tiers';
import { MARKET } from '../words';

// A docked station's market: what it sells and buys, at what, and what's in
// the crew's hold. A unit at a time, or all of a good at once; each sale
// takes a little off the next one there (market/prices.js), and the prices
// drift with the hours. The rules are market/trade.js's.
export default function MarketTab({ dest = null, station: given = null, crew }) {
  const { economy, market, version } = useEconomy();
  const [said, setSaid] = useState(null);
  // (a generated station's trade from its place; a hand-made place's handed in: trade.js's placeMarket)
  const station = useMemo(() => given ?? stationFor(dest), [given, dest]);
  const room = useMemo(() => (version >= 0 && crew ? coreOf(economy, crew).hold : 0), [economy, crew, version]);
  const rows = useMemo(() => (version >= 0 && market && crew ? boardOf({ market, economy, station, crew, room, t: Date.now() }) : []), [market, economy, station, crew, room, version]);
  if (!market || !economy || !crew) return <p className="mt-4 text-sm text-muted">{MARKET.opening}</p>;
  const hold = market.hold(crew, room);
  const args = { market, economy, station, crew, room, t: Date.now() };
  const buy = (r) => {
    const b = buyGood({ ...args, good: r.id, n: 1 });
    setSaid(b.ok ? MARKET.bought(r.name, b.paid) : MARKET.why[b.why]);
  };
  const sell = (r, n) => {
    const s = sellGood({ ...args, good: r.id, n });
    setSaid(s.ok ? MARKET.sold(s.n, r.name, s.got) : MARKET.why[s.why]);
  };
  const dump = (r) => {
    const n = jettison({ ...args, good: r.id, n: 1 });
    setSaid(n ? MARKET.dumped(r.name) : null);
  };
  return (
    <section className="universe-market mt-5" aria-label={MARKET.title}>
      <div className="universe-market-head">
        <h3>{MARKET.title}</h3>
        <span>{station.label ?? MARKET.type(STATION_TYPES[station.type].name)}</span>
        <span>{MARKET.hold(hold.used, hold.room)}</span>
      </div>
      <ul className="universe-market-rows">
        {rows.map((r) => (
          <li key={r.id} data-good={r.id}>
            <span className="universe-market-name">
              {r.name}
              {r.have > 0 && <b> × {r.have}</b>}
            </span>
            {r.buy !== null && (
              <button type="button" className="chip" disabled={!r.canBuy} onClick={() => buy(r)}>
                {MARKET.buy(r.buy)}
              </button>
            )}
            <button type="button" className="chip" disabled={!r.canSell} onClick={() => sell(r, 1)}>
              {MARKET.sell(r.sell)}
            </button>
            {r.have > 1 && (
              <button type="button" className="chip" onClick={() => sell(r, r.have)}>
                {MARKET.sellAll}
              </button>
            )}
            {r.have > 0 && (
              <button type="button" className="chip" onClick={() => dump(r)}>
                {MARKET.dump}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted" role="status" aria-live="polite">
        {said ?? ''}
      </p>
    </section>
  );
}
