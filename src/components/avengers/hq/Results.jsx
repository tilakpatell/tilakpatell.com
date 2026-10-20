import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { STONES } from '../../interests/stones';
import { GameScreen } from './HQGame';
import { scoreLine, stoneWords } from './gameScreen';

// The one card every building's game ends on (spec 2026-10-18-avengers-hq-
// fix-and-hub-design, §5): won or lost, the score against the best, the stone
// in its own colour, stars where the game keeps them, and the ways on: a way
// on inside the game, Play again, the next stone's building, Back to the
// compound and the game's own way back. Hook-free, so a test can call it.
export function ResultsCard({ won = false, kicker = '', title, line = '', stone = null, half = null, stoneText = '', score = null, best = 0, newBest = false, format, stars = null, onward = null, againLabel = 'Play again', onAgain, onBack = null, next = null, more = null, className = '', children, after = null }) {
  const row = stone ? STONES.find((s) => s.id === stone) : null;
  const sc = scoreLine({ score, best, newBest, format });
  // the one primary: the way on inside the game, else the next stone after a win, else Play again
  const lead = onward ? 'onward' : won && next ? 'next' : 'again';
  const cls = (k) => `btn ${lead === k ? 'btn-primary' : 'btn-ghost'}`;
  return (
    <div className={`hq-overlay hq-results ${className}`.trim()} data-tone={won ? 'won' : 'lost'}>
      {kicker && <p className="hq-overlay-kicker">{kicker}</p>}
      <p className="hq-overlay-title" role="status">
        {title}
      </p>
      {stars && (
        <p className="hq-stars" aria-label={`${stars.got} of ${stars.of} stars`}>
          {Array.from({ length: stars.of }, (_, i) => (
            <span key={i} data-on={i < stars.got || undefined}>
              ★
            </span>
          ))}
        </p>
      )}
      {line && <p className="hq-overlay-text">{line}</p>}
      {sc && (
        <p className="hq-overlay-score">
          {sc.big}
          <small>{sc.small}</small>
        </p>
      )}
      {row && (
        <p className="hq-stone" style={{ '--glow': row.color }}>
          <span className="stone-dot" aria-hidden="true" />
          {stoneText || stoneWords(row.name, half)}
        </p>
      )}
      {children}
      <div className="hq-results-actions">
        {onward && (
          <button type="button" className={cls('onward')} onClick={onward.onClick}>
            {onward.label}
          </button>
        )}
        <button type="button" className={cls('again')} onClick={onAgain}>
          {againLabel}
        </button>
        {next && (
          <Link to={next.to} replace state={next.state} className={cls('next')}>
            {`Next: ${next.label}`}
          </Link>
        )}
        {onBack && (
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Back to the compound
          </button>
        )}
        {more && (
          <button type="button" className="btn btn-ghost" onClick={more.onClick}>
            {more.label}
          </button>
        )}
      </div>
      {after /* (a long record, such as Infiltration's file: after the buttons, so the way on stays in view) */}
    </div>
  );
}

// The card, with Back and Next from the building's game screen unless the game says
export default function Results(props) {
  const s = useContext(GameScreen);
  return <ResultsCard {...props} onBack={props.onBack ?? s?.onBack ?? null} next={props.next !== undefined ? props.next : (s?.next?.() ?? null)} />;
}
