import { RiLock2Line } from 'react-icons/ri';
import { READOUT_LABEL } from '../outfit';

// The shipyard's card over the showroom's right: what's pointed at (its
// name, what it does, what it weighs and draws, or why it's locked), then the
// ship's performance as a game garage shows it, each bar the ship as staged
// with what's pointed at drawn over it (more in green, less in red), and the
// power the fit draws of the plant's. `look`: YardList's onLook record.

const cr = (n) => `${n.toLocaleString('en-GB')} ¢`;
const pct = (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;

export default function YardStats({ look = null, now, then, checked }) {
  return (
    <aside className="ys" aria-label="Performance">
      {look && (
        <section className="ys-item" aria-live="polite">
          <h3 className="ys-name">
            {look.locked && <RiLock2Line aria-hidden="true" />}
            {look.name}
          </h3>
          {look.locked ? <p className="ys-why">Locked. {look.why}.</p> : look.blurb && <p className="ys-blurb">{look.blurb}</p>}
          {!look.locked && look.does?.length > 0 && (
            <ul className="ys-does">
              {look.does.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          {(look.power > 0 || look.mass > 0 || look.price > 0) && (
            <p className="ys-meta">
              {look.power > 0 && <span>{look.power} MW</span>}
              {look.mass > 0 && <span>{look.mass} t</span>}
              {look.price > 0 && <span>{cr(look.price)}</span>}
            </p>
          )}
        </section>
      )}
      <section className="ys-perf">
        <h3 className="ys-h">Performance</h3>
        <dl className="ys-bars">
          {now.map((r, i) => {
            const next = then?.[i];
            const diff = next ? next.change - r.change : 0;
            return (
              <div key={r.id} className="ys-bar-row">
                <dt>{READOUT_LABEL[r.id]}</dt>
                <dd>
                  <span className="ys-bar" style={{ '--now': r.bar, '--then': next ? next.bar : r.bar }} data-up={diff > 0 || undefined} data-down={diff < 0 || undefined}>
                    <i />
                    <b />
                  </span>
                  <span className="ys-change" data-up={diff > 0 || undefined} data-down={diff < 0 || undefined}>
                    {next && diff ? pct(diff) : r.change ? pct(r.change) : 'Stock'}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
        <div className="ys-power" data-full={checked.power >= checked.capacity || undefined}>
          <span className="ys-h">Power</span>
          <span className="ys-cells" role="img" aria-label={`${checked.power} of ${checked.capacity} megawatts in use`}>
            {Array.from({ length: Math.max(checked.capacity, Math.ceil(checked.power)) }, (_, i) => (
              <i key={i} data-on={i < checked.power || undefined} data-over={i >= checked.capacity || undefined} />
            ))}
          </span>
          <span className="ys-num">
            {checked.power}/{checked.capacity} MW · {checked.mass} t
          </span>
        </div>
      </section>
    </aside>
  );
}
