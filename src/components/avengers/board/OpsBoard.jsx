import { Link } from 'react-router-dom';
import { STONES } from '../../interests/stones';
import { useInView } from '../../../lib/hooks';
import { localSaves } from '../../../runtime/local';
import { fmt } from '../hq/gameScreen';
import { clock } from '../world/labels';
import { hqState } from '../world/links';
import { boardCards, readRecords } from './records';
import '../../../styles/lazy/avengers.css';

// The ops board (spec 2026-10-18-avengers-hq-fix-and-hub-design, §6),
// directly under the compound and its first screen without 3D: a records
// strip, then one card a building with its game, its stone, its best, Play,
// Go there (with 3D) and Try 3D (where its stone is won in the 3D game).

// one building's card; hook-free, so a test can call it
export function BoardCard({ card: c, onGo = null, onTry3D = null }) {
  const best = c.best ? [c.best.text, c.best.stars && `${c.best.stars.have} of ${c.best.stars.of} stars`].filter(Boolean).join(' · ') : 'No score yet';
  return (
    <li id={`hq-card-${c.id}`} className="hq-card" data-state={c.state} data-done={c.done || undefined} data-next={c.next || undefined} style={{ '--glow': c.glow }}>
      <p className="label">
        {c.n} · {c.where}
        {c.next && <span className="chip chip-sm chip-accent">Next</span>}
      </p>
      <h3 className="hq-card-name">{c.name}</h3>
      <p className="text-sm text-body">{c.game}</p>
      <p className="hq-card-stone">
        {c.state !== 'gate' && <i className="stone-dot" aria-hidden="true" />}
        {c.stoneText}
      </p>
      <p className="hq-card-best mono text-sm">{best}</p>
      <div className="hq-card-acts">
        {/* (with the page's own state, so Back comes back to the board) */}
        <Link to={c.link} state={hqState} className="btn btn-primary btn-sm">
          {c.play}
          <span className="sr-only"> {c.game}</span>
        </Link>
        {onGo && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo(c.id)}>
            Go there
            <span className="sr-only">: {c.name}</span>
          </button>
        )}
        {c.state === 'needs3d' && onTry3D && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTry3D(c.id)}>
            Try 3D
            <span className="sr-only">: {c.name}</span>
          </button>
        )}
      </div>
    </li>
  );
}

export default function OpsBoard({ prog, can3D, unlocked = [], onGo = null, onTry3D = null, get = localSaves().get }) {
  // (the flag's flip re-renders the board as it scrolls into view, so the
  // strip re-reads the tour, the style and the backpacks a walk wrote)
  const [box] = useInView({ rootMargin: '200px 0px' });
  const r = readRecords(get, { stones: prog.stones, unlocked });
  const cards = boardCards(prog, { get, can3D });
  return (
    <section ref={box} id="hq-board" className="hq-board shell relative z-10 py-14 md:py-20" aria-labelledby="hq-board-title">
      <p className="eyebrow">The compound</p>
      <h2 id="hq-board-title" className="title mt-4">
        Ops board
      </h2>
      <p className="lead mt-4 max-w-[62ch]">{prog.objective}</p>
      <dl className="hq-records mt-6">
        <div className="chip">
          <dt>Stones</dt>
          <dd>
            <span className="hq-records-dots">
              {STONES.map((st) => (
                <i key={st.id} className="stone-dot" aria-hidden="true" data-on={prog.have.includes(st.id) || undefined} style={{ '--glow': st.color }} />
              ))}
            </span>
            {`${r.stones.have} of 6`}
          </dd>
        </div>
        <div className="chip">
          <dt>Things to do</dt>
          <dd>{`${prog.count}/${prog.places.length}`}</dd>
        </div>
        <div className="chip">
          <dt>Swing tour</dt>
          <dd>{r.tour ? clock(r.tour) : 'Not yet'}</dd>
        </div>
        <div className="chip">
          <dt>Best style</dt>
          <dd>{r.style ? fmt(r.style) : 'Not yet'}</dd>
        </div>
        <div className="chip">
          <dt>Backpacks</dt>
          <dd>{`${r.packs.have} of 12`}</dd>
        </div>
        <div className="chip">
          <dt>Achievements</dt>
          <dd>{`${r.feats.have} of 14`}</dd>
        </div>
      </dl>
      <ol className="hq-cards mt-8">
        {cards.map((c) => (
          <BoardCard key={c.id} card={c} onGo={can3D ? onGo : null} onTry3D={onTry3D} />
        ))}
      </ol>
    </section>
  );
}
