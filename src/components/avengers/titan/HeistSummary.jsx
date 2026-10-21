import { useEffect, useRef } from 'react';
import { CloseButton } from '../../ui';

// The heist's summary (spec 2026-10-18-avengers-hq-fix-and-hub-design, §7),
// raised on glass over Titan's dust when Tony's earned snap plays: the time
// from the first stone to the sixth, and each building's tries and best.
// Text only, over the existing scene.
export default function HeistSummary({ summary, onClose }) {
  const title = useRef(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className="heist-summary" aria-labelledby="heist-summary-title">
      <div className="heist-summary-head">
        <h3 id="heist-summary-title" tabIndex={-1} ref={title} className="heist-summary-title">
          The heist
        </h3>
        <CloseButton label="Close the heist summary" onClick={onClose} />
      </div>
      <p className="heist-summary-span">
        <span>First stone to sixth</span>
        <strong>{summary.span}</strong>
      </p>
      <table className="heist-summary-table">
        <thead>
          <tr>
            <th scope="col">Building</th>
            <th scope="col">Tries</th>
            <th scope="col">Best</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.name}</th>
              <td>{r.tries}</td>
              <td>{r.best}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
