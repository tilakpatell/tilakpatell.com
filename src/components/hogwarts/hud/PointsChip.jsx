import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react';
import { GEMS, NAMES } from './houses';
import './term.css';

// The house points, small (the design’s §4.11): your house’s hourglass in
// its own colour by the Menu, its stones filled to where your house stands
// against the leader, the count, and where it stands; a tap opens the
// House Cup as it is, the four glasses side by side. The numbers are
// written through the ref (`readout(view)`, from the world’s 'school' and
// 'points' events), never re-rendering the HUD for a point; a point won or
// lost shows for a moment over the chip.
//
//   <PointsChip ref house label />   ref: { readout({ totals, standings, house }), flash(delta) }

const PLACE = ['first', 'second', 'third', 'fourth'];

// an hourglass: two bulbs, the lower filled to `k` (0…1) with its house’s stones
function Glass({ colour, fillRef = null, k = 0, size = 22 }) {
  const id = useId().replace(/:/g, '');
  const h = 26 * (1 - Math.min(1, Math.max(0, k)));
  return (
    <svg className="hogwarts-glass" width={size * 0.72} height={size} viewBox="0 0 18 50" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`low-${id}`}>
          <path d="M2 49 C2 38 8 33 8.6 26 L9.4 26 C10 33 16 38 16 49 Z" />
        </clipPath>
      </defs>
      <rect ref={fillRef} x="0" y={24 + h} width="18" height="26" fill={colour} clipPath={`url(#low-${id})`} />
      <path d="M2 1 C2 12 8 17 8.6 24 L9.4 24 C10 17 16 12 16 1 Z M2 49 C2 38 8 33 8.6 26 L9.4 26 C10 33 16 38 16 49 Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M0.5 0.8 H17.5 M0.5 49.2 H17.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

const PointsChip = forwardRef(function PointsChip({ house = 'gryffindor' }, ref) {
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState(null);
  const count = useRef(null);
  const place = useRef(null);
  const fill = useRef(null);
  const flashRef = useRef(null);
  const last = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      readout(view) {
        if (!view?.totals) return;
        last.current = view;
        const mine = view.totals[house] ?? 0;
        const top = Math.max(1, ...Object.values(view.totals));
        const rank = (view.standings ?? []).findIndex((s) => s.house === house);
        const text = String(mine);
        if (count.current && count.current.textContent !== text) count.current.textContent = text;
        const where = rank >= 0 ? PLACE[rank] : '';
        if (place.current && place.current.textContent !== where) place.current.textContent = where;
        if (fill.current) fill.current.setAttribute('y', String(24 + 26 * (1 - mine / top)));
        if (open) setBoard(view);
      },
      flash(delta) {
        const el = flashRef.current;
        if (!el || !delta) return;
        el.textContent = `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`;
        el.dataset.sign = delta > 0 ? 'up' : 'down';
        el.classList.remove('is-on');
        // (restarted: a second point soon after the first shows too)
        void el.offsetWidth;
        el.classList.add('is-on');
      },
    }),
    [house, open],
  );

  const toggle = () => {
    setBoard(last.current);
    setOpen((o) => !o);
  };

  return (
    <div className="hogwarts-points" data-house={house}>
      <button type="button" className="hogwarts-points-chip" onClick={toggle} aria-expanded={open} aria-label={`${NAMES[house]}’s house points: the House Cup`} style={{ '--house': GEMS[house] }}>
        <Glass colour={GEMS[house]} fillRef={fill} />
        <span className="hogwarts-points-count" ref={count}>
          0
        </span>
        <span className="hogwarts-points-place" ref={place} />
        <span className="hogwarts-points-flash" ref={flashRef} aria-hidden="true" />
      </button>
      {open && board && (
        <div className="hogwarts-cup" role="dialog" aria-label="The House Cup">
          <p className="hogwarts-cup-title">The House Cup</p>
          <p className="hogwarts-cup-week">{board.label}</p>
          <ol className="hogwarts-cup-glasses">
            {board.standings.map((s) => (
              <li key={s.house} data-you={s.you || undefined}>
                <Glass colour={GEMS[s.house]} k={s.points / Math.max(1, board.standings[0].points)} size={44} />
                <span className="hogwarts-cup-points">{s.points}</span>
                <span className="hogwarts-cup-house">{s.name}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="hogwarts-map-btn" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
});
export default PointsChip;
