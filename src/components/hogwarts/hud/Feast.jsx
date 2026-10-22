import { useEffect, useRef } from 'react';
import { GEMS, NAMES } from './houses';
import './term.css';

// The leaving feast (the design’s §4.7, quest 13): the hall dressed in the
// winner’s colours, the four hourglasses settled, and your own points on a
// card of their own. Shown when the feast is held; Close, or Esc, to go on
// (and, once the Cup is given, the year after can begin).
//
//   <Feast cup={{ winner, standings, mine, house }} onClose onNextYear />

const LINES = {
  won: (h) => `The hall turns ${NAMES[h]}’s colours from end to end, and your table is on its feet.`,
  lost: (h, you) => `The hall turns ${NAMES[h]}’s colours; ${NAMES[you]} claps as if it meant it, and means to win next year.`,
};

export default function Feast({ cup, onClose, onNextYear = null }) {
  const close = useRef(null);
  useEffect(() => {
    close.current?.focus();
    const key = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  if (!cup) return null;
  const won = cup.winner === cup.house;
  return (
    <div className="hogwarts-feast" role="dialog" aria-label="The leaving feast" style={{ '--winner': GEMS[cup.winner] }}>
      <div className="hogwarts-feast-banner" aria-hidden="true" />
      <p className="hogwarts-feast-eyebrow">The leaving feast</p>
      <p className="hogwarts-feast-title">The House Cup goes to {NAMES[cup.winner]}</p>
      <p className="hogwarts-feast-line">{won ? LINES.won(cup.winner) : LINES.lost(cup.winner, cup.house)}</p>
      <ol className="hogwarts-feast-standings">
        {cup.standings.map((s) => (
          <li key={s.house} data-you={s.you || undefined} style={{ '--gem': GEMS[s.house] }}>
            <span className="hogwarts-feast-house">{s.name}</span>
            <span className="hogwarts-feast-points">{s.points}</span>
          </li>
        ))}
      </ol>
      <p className="hogwarts-feast-mine">
        Your own points this year: <b>{cup.mine}</b>
      </p>
      <div className="hogwarts-feast-tools">
        {onNextYear && (
          <button type="button" className="hogwarts-map-btn" onClick={onNextYear}>
            Begin the next year
          </button>
        )}
        <button ref={close} type="button" className="hogwarts-map-btn hogwarts-map-shut" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
