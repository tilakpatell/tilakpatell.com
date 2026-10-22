import { useEffect, useRef } from 'react';
import { binder, foundCount, CARDS } from '../rules/cards';
import './binder.css';

// The binder of Chocolate Frog cards (the design’s §4.9): twenty pockets in
// the parchment the HUD is skinned in, each card found shown face up (its
// witch or wizard, their title and the site’s own words on the back), each
// still to find an empty pocket with a hint of where it hides. From the
// Menu; Close, or Esc, to put it away. A card just found shows on its own
// for a moment (`<Binder card={id} />`).
//
//   <Binder found={[ids]} onClose />   <Binder card={id} found={[ids]} />  (the one just found)

function Face({ c }) {
  const initials = c.name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return (
    <div className="hogwarts-card-face">
      <div className="hogwarts-card-portrait" aria-hidden="true">
        <span>{initials}</span>
      </div>
      <p className="hogwarts-card-name">{c.name}</p>
      <p className="hogwarts-card-title">{c.title}</p>
      <p className="hogwarts-card-text">{c.text}</p>
    </div>
  );
}

export default function Binder({ found = [], card = null, onClose = null }) {
  const close = useRef(null);
  useEffect(() => {
    if (!onClose) return undefined;
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

  // the one just found, on its own
  if (card) {
    const c = binder(found).find((x) => x.id === card);
    if (!c) return null;
    return (
      <div className="hogwarts-card-new" role="status" aria-label={`A Chocolate Frog card: ${c.name}`}>
        <p className="hogwarts-card-eyebrow">A Chocolate Frog card</p>
        <Face c={c} />
      </div>
    );
  }

  const rows = binder(found);
  return (
    <div className="hogwarts-binder" role="dialog" aria-label="Chocolate Frog cards">
      <div className="hogwarts-binder-head">
        <p className="hogwarts-binder-title">Chocolate Frog cards</p>
        <p className="hogwarts-binder-count">
          {foundCount(found)} of {CARDS.length}
        </p>
        <button ref={close} type="button" className="hogwarts-map-btn hogwarts-map-shut" onClick={onClose}>
          Close
        </button>
      </div>
      <ol className="hogwarts-binder-pockets">
        {rows.map((c) => (
          <li key={c.id} data-found={c.found || undefined}>
            {c.found ? (
              <Face c={c} />
            ) : (
              <div className="hogwarts-card-empty">
                <span aria-hidden="true">?</span>
                <p>{c.hint}</p>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
