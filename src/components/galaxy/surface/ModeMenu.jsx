import { useEffect, useRef, useState } from 'react';
import { Film } from '../../../runtime/hud';
import '../../../lib/bf2017/fonts.css';
import './flow.css';

// What to play, once you're down (the flow design's decision 1), laid out as
// Battlefront's own multiplayer screen (decision 7): Galactic Assault the
// large tile with the game's film, the other modes in the grid beside it
// (./modes.js's modesFor, in its order), the world's story and free roam in
// a last row, the keys at the foot. A live card goes there; one the game has
// here but the site hasn't made yet says so, and one the game never had here
// says that; the world's story lists its missions. ← → ↑ ↓ along the cards
// (the list's order, as the grid reads), Enter to go, Esc for free roam;
// Deploy opens the deploy screen first. "Don't ask on landing" keeps it shut
// next time (the Menu's Change mode opens it again).
//
// <ModeMenu place="Hoth" cards={modesFor('hoth')} onPick={(card, option) => …} onDeploy={…} onClose={…} ask onAsk={(on) => …} />

const LEAD = 'galacticAssault';
const LAST = new Set(['story', 'free']);

export default function ModeMenu({ place, cards, onPick, onDeploy, onClose, ask = true, onAsk = null }) {
  // (the tiles in the order they're drawn, which is the order the keys walk)
  const lead = cards.filter((c) => c.id === LEAD);
  const grid = cards.filter((c) => c.id !== LEAD && !LAST.has(c.id));
  const rest = cards.filter((c) => LAST.has(c.id));
  const order = [...lead, ...grid, ...rest];
  const first = Math.max(0, order.findIndex((c) => c.state === 'live' && c.id !== 'free'));
  const [at, setAt] = useState(first);
  const board = useRef(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    board.current?.querySelectorAll('.mode-card')[at]?.focus({ preventScroll: false });
  }, [at]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const move = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    setAt((i) => (i + step + order.length) % order.length);
  };

  // one tile: the large one plays the game's film, a grid tile shows its
  // film's poster (one film moving, as on the game's screen), a tile with
  // neither its mode's icon
  const tile = (c, large = false) => {
    const i = order.indexOf(c);
    const icon = <img className="mode-card-icon" src={c.icon} alt="" width="32" height="32" />;
    const picture = large ? <Film film={c.film} className="mode-card-film" still={icon} /> : c.film ? <img className="mode-card-still" src={c.film.poster} alt="" loading="lazy" decoding="async" /> : icon;
    return (
      <>
        <button type="button" className={`mode-card is-${c.state}`} data-mode={c.id} tabIndex={i === at ? 0 : -1} aria-disabled={c.state !== 'live'} onFocus={() => setAt(i)} onClick={() => c.state === 'live' && pick.current?.(c)}>
          {picture}
          {c.film && <span className="mode-card-scrim" aria-hidden="true" />}
          <span className="mode-card-name">{c.name}</span>
          {c.state !== 'live' && (
            <span className="mode-card-why">
              {c.state === 'soon' ? 'Coming: ' : ''}
              {c.why}
            </span>
          )}
          {c.id === 'free' && <span className="mode-card-state">Always open</span>}
          <span className="mode-card-about">{c.about}</span>
        </button>
        {c.options?.length > 1 && (
          <ul className="mode-card-options">
            {c.options.map((o) => (
              <li key={o.id}>
                <button type="button" className="chip" onClick={() => pick.current?.(c, o)}>
                  {o.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };
  const tiles = (list, kind) => (
    <ul className={`mode-${kind}`}>
      {list.map((c) => (
        <li key={c.id} className={`mode-tile is-${c.state}`}>
          {tile(c)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mode-menu" role="dialog" aria-label={`What to play on ${place}`}>
      <div className="mode-menu-body">
        <p className="mode-menu-kicker">{place}</p>
        <h2 className="mode-menu-title">Choose your battle</h2>
        <div className="mode-board" ref={board} onKeyDown={move}>
          {lead.map((c) => (
            <div key={c.id} className={`mode-lead mode-tile is-${c.state}`}>
              {tile(c, true)}
            </div>
          ))}
          {tiles(grid, 'grid')}
          {tiles(rest, 'rest')}
        </div>
        <div className="mode-menu-foot">
          <p className="mode-menu-keys">
            <span className="mode-menu-enter">
              <kbd className="hud-cap">Enter</kbd> Select
            </span>
            <button type="button" className="mode-menu-prompt" onClick={onClose}>
              <kbd className="hud-cap">Esc</kbd> Free roam
            </button>
          </p>
          <button type="button" className="surface-help-btn mode-menu-btn" onClick={onDeploy}>
            Deploy as…
          </button>
          {onAsk && (
            <label className="mode-menu-ask">
              <input type="checkbox" checked={!ask} onChange={(e) => onAsk(!e.target.checked)} /> Don’t ask on landing
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
