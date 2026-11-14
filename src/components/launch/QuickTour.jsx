import { useEffect, useMemo, useRef, useState } from 'react';
import { IconGo } from '../icons';
import { useMediaQuery } from '../../lib/hooks';
import { shortcutLabel } from '../../lib/palette';
import { cardsFor } from './cards';
import { ReadyLine } from './parts';

// The quick tour, the intro's first part: the site in five cards over the
// welcome's sky (cards.js), read in half a minute while the universe gets
// ready behind it. Next and Back, or the arrow keys; "Skip the tour" goes on
// to what follows it (the crawl, or with reduced motion the universe), "Skip
// the intro" and Esc (the frame's, Opening.jsx) straight to the universe.
// `onCard` hears each card as it's shown (the flying card stands in for the
// map's first-flight brief). Drawn in the launch's frame, after the welcome.
//
// <QuickTour next="crawl" | "arrive" map={…} onDone={() => …} onSkipIntro={() => …} onCard={(card) => …} />

const NEXT = { crawl: 'On to the opening crawl', arrive: 'Into the universe' };

export default function QuickTour({ next = 'crawl', map, onDone, onSkipIntro, onCard }) {
  const cards = useMemo(() => cardsFor({ key: shortcutLabel() }), []);
  const touch = useMediaQuery('(pointer: coarse)');
  const [i, setI] = useState(0);
  const card = cards[i];
  const last = i === cards.length - 1;
  const go = useRef(null);
  const cbs = useRef({ onDone, onSkipIntro, onCard });
  cbs.current = { onDone, onSkipIntro, onCard };

  useEffect(() => {
    go.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    cbs.current.onCard?.(card);
  }, [card]);
  const forward = () => (last ? cbs.current.onDone() : setI((n) => Math.min(cards.length - 1, n + 1)));
  const back = () => setI((n) => Math.max(0, n - 1));
  const keys = useRef({ forward, back });
  keys.current = { forward, back };
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') keys.current.forward();
      else if (e.key === 'ArrowLeft') keys.current.back();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="welcome-main launch-tour-main">
      <p className="welcome-name">
        A quick tour
        <span className="launch-tour-count">
          {i + 1} of {cards.length}
        </span>
      </p>
      <div className="launch-tour-card" key={card.id} aria-live="polite">
        <Art kind={card.art} />
        <div className="launch-tour-words">
          <h2 id="launch-tour-title" className="launch-tour-title">
            {card.title}
          </h2>
          {card.text && <p className="launch-tour-text">{card.text}</p>}
          {card.rows && !touch && (
            <ul className="launch-tour-keys">
              {card.rows.map((r) => (
                <li key={r.text}>
                  <span className="launch-tour-caps">
                    {r.keys.map((k) => (
                      <kbd key={k} className="kbd">
                        {k}
                      </kbd>
                    ))}
                  </span>
                  {r.text}
                </li>
              ))}
            </ul>
          )}
          {card.rows && touch && card.touch && <p className="launch-tour-text">{card.touch}</p>}
          {card.after && <p className="launch-tour-after">{card.after}</p>}
        </div>
      </div>

      <div className="launch-tour-dots" aria-hidden="true">
        {cards.map((c, n) => (
          <span key={c.id} data-on={n === i ? '' : undefined} data-seen={n < i ? '' : undefined} />
        ))}
      </div>
      <div className="welcome-buttons launch-tour-buttons">
        <button ref={go} type="button" className="btn btn-primary btn-lg" onClick={forward}>
          {last ? NEXT[next] : 'Next'} <IconGo className="h-4 w-4" aria-hidden="true" />
        </button>
        {i > 0 && (
          <button type="button" className="btn btn-ghost btn-lg" onClick={back}>
            Back
          </button>
        )}
      </div>
      <p className="welcome-alt launch-tour-skips">
        {!last && (
          <button type="button" className="link" onClick={() => cbs.current.onDone()}>
            Skip the tour
          </button>
        )}
        {next === 'crawl' && (
          <button type="button" className="link" onClick={() => cbs.current.onSkipIntro()}>
            Skip the intro
          </button>
        )}
      </p>
      <ReadyLine map={map} />
    </div>
  );
}

// Each card's drawing: a few lines in the page's ink and the theme's saber
function Art({ kind }) {
  return (
    <svg className="launch-tour-art" viewBox="0 0 200 200" aria-hidden="true" data-art={kind}>
      {kind === 'sun' && (
        <>
          <circle cx="100" cy="100" r="34" className="art-sun" />
          <ellipse cx="100" cy="100" rx="80" ry="30" className="art-line" />
          <ellipse cx="100" cy="100" rx="58" ry="20" className="art-line art-faint" />
          <circle cx="174" cy="112" r="6" className="art-dot" />
          <circle cx="48" cy="88" r="4" className="art-dot" />
        </>
      )}
      {kind === 'stations' && (
        <>
          <circle cx="100" cy="100" r="22" className="art-sun" />
          <circle cx="100" cy="100" r="62" className="art-line" />
          {[0, 72, 144, 216, 288].map((a) => {
            const r = (a * Math.PI) / 180;
            return <rect key={a} x={100 + 62 * Math.cos(r) - 7} y={100 + 62 * Math.sin(r) - 7} width="14" height="14" rx="3" className="art-mark" />;
          })}
        </>
      )}
      {kind === 'planets' && (
        <>
          <circle cx="70" cy="112" r="38" className="art-planet" />
          <ellipse cx="70" cy="112" rx="58" ry="12" className="art-line" transform="rotate(-16 70 112)" />
          <circle cx="150" cy="62" r="18" className="art-planet art-faint" />
          <circle cx="160" cy="146" r="10" className="art-planet art-faint" />
          <circle cx="30" cy="40" r="2" className="art-dot" />
          <circle cx="120" cy="20" r="2" className="art-dot" />
        </>
      )}
      {kind === 'ship' && (
        <>
          <path d="M150 100 L70 70 L86 100 L70 130 Z" className="art-mark" />
          <path d="M60 86 H20 M58 100 H8 M60 114 H20" className="art-line art-trail" />
          <circle cx="172" cy="100" r="3" className="art-dot" />
        </>
      )}
      {kind === 'compass' && (
        <>
          <circle cx="100" cy="100" r="70" className="art-line" />
          <circle cx="100" cy="100" r="36" className="art-line art-faint" />
          <path d="M100 22 V40 M100 160 V178 M22 100 H40 M160 100 H178" className="art-line" />
          <path d="M122 78 L108 108 L78 122 L92 92 Z" className="art-mark" />
        </>
      )}
    </svg>
  );
}
