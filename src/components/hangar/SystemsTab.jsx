import { useMemo, useState } from 'react';
import { signatureLine, systemRows } from '../universe/shared/hangar';
import { useEconomy } from '../universe/shared/wallet';

// The Hangar's Systems: the ship's seven core systems, Mk I to Mk V, each
// with what it does now and at the next tier, and the next tier for sale.
// A tier is bought for this crew alone (its ship, or the garage build it
// flies in its place) and never sold back; Mk IV and Mk V need a rare from
// far out as well (the rules: universe/ships/).

export default function SystemsTab({ ship, build = null }) {
  const { economy, version } = useEconomy();
  const [said, setSaid] = useState(null);
  // (the wallet's version says its credits or what it owns changed: read here, as useYard reads it)
  const sign = useMemo(() => signatureLine(ship, build), [ship, build]);
  const rows = useMemo(() => (version >= 0 ? systemRows({ crew: ship, build, economy }) : []), [ship, build, economy, version]);
  const buy = (row) => {
    const r = economy?.checkout([row.item]);
    setSaid(r?.ok ? `${row.item.name} fitted` : null);
  };
  return (
    <div className="hangar-page hangar-systems">
      <section aria-label="Core systems">
        <h3>{sign.role}</h3>
        <p className="hangar-note">{sign.line}</p>
        <h3>Core systems</h3>
        <p className="hangar-note">Each tier is this ship’s own. Mk IV and Mk V need a rare found far from the Core.</p>
        <ul className="hangar-lines">
          {rows.map((r) => (
            <li key={r.id} data-system={r.id} data-tier={r.tier}>
              <span className="hangar-line-key">{r.mk}</span>
              <b className="hangar-line-name">{r.label}</b>
              <span className="hangar-line-does">
                {r.value}
                {r.nextValue && ` → ${r.nextValue}`}
              </span>
              {r.pill ? (
                <button type="button" data-pill={r.pill.kind} disabled={r.pill.kind !== 'buy'} onClick={() => buy(r)}>
                  {r.pill.kind === 'buy' ? `${r.item.name} · ${r.item.price.toLocaleString('en-GB')} ¢` : r.pill.text}
                </button>
              ) : (
                <span className="hangar-unique-open">{r.item ? '' : 'Top tier'}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="hangar-note" role="status" aria-live="polite">
          {said ?? ''}
        </p>
      </section>
    </div>
  );
}
