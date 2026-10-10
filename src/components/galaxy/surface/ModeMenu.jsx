import { useEffect, useRef, useState } from 'react';
import './flow.css';

// What to play, once you're down (the flow design's decision 1): the modes
// as Battlefront's own cards (./modes.js's modesFor), over the world you
// landed on. A live card goes there; one the game has here but the site
// hasn't made yet says so, and one the game never had here says that; the
// world's story lists its missions. ← → ↑ ↓ along the cards, Enter to go,
// Esc for free roam; Deploy opens the deploy screen first. "Don't ask on
// landing" keeps it shut next time (the Menu's Change mode opens it again).
//
// <ModeMenu place="Hoth" cards={modesFor('hoth')} onPick={(card, option) => …} onDeploy={…} onClose={…} ask onAsk={(on) => …} />

export default function ModeMenu({ place, cards, onPick, onDeploy, onClose, ask = true, onAsk = null }) {
  const first = Math.max(0, cards.findIndex((c) => c.state === 'live' && c.id !== 'free'));
  const [at, setAt] = useState(first);
  const list = useRef(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    list.current?.querySelectorAll('.mode-card')[at]?.focus({ preventScroll: false });
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
    setAt((i) => (i + step + cards.length) % cards.length);
  };
  return (
    <div className="mode-menu" role="dialog" aria-label={`What to play on ${place}`}>
      <div className="mode-menu-glass">
        <p className="mode-menu-kicker">{place}</p>
        <h2 className="mode-menu-title">Choose your battle</h2>
        <ul className="mode-cards" ref={list} onKeyDown={move}>
          {cards.map((c, i) => (
            <li key={c.id}>
              <button type="button" className={`mode-card is-${c.state}`} tabIndex={i === at ? 0 : -1} aria-disabled={c.state !== 'live'} onFocus={() => setAt(i)} onClick={() => c.state === 'live' && pick.current?.(c)}>
                <img className="mode-card-icon" src={c.icon} alt="" width="40" height="40" />
                <span className="mode-card-name">{c.name}</span>
                <span className="mode-card-about">{c.about}</span>
                {c.state === 'live' ? <span className="mode-card-state">{c.id === 'free' ? 'Always open' : 'Play'}</span> : <span className="mode-card-why">{c.state === 'soon' ? 'Coming: ' : ''}{c.why}</span>}
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
            </li>
          ))}
        </ul>
        <div className="mode-menu-foot">
          {onAsk && (
            <label className="mode-menu-ask">
              <input type="checkbox" checked={!ask} onChange={(e) => onAsk(!e.target.checked)} /> Don’t ask on landing
            </label>
          )}
          <button type="button" className="surface-help-btn" onClick={onDeploy}>
            Deploy as…
          </button>
          <button type="button" className="surface-help-btn" onClick={onClose}>
            Free roam <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
