import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { GameIcon } from '../../../runtime/hud';
import { SPELLS } from '../rules/spells';
import './spellWheel.css';

// The wand’s face on the HUD (the design’s §4.5 and §4.11): the card at the
// foot with the spell on the wand, its key and its cooldown as a ring; and,
// while Q is held, the wheel of nine round the middle of the view: point
// at a spell and let Q go (or click one) to put it on the wand. The keys 1
// to 9 cast straight. Each spell’s glyph is the kit’s GameIcon (the game it
// draws from has none for spells, so its own fallback, drawn here). The
// cooldowns come through `readout(data)` on the handle, a few times a
// second from the world’s 'wand' event, written into the rings, not into
// React’s state (the kit’s rule: numbers through refs).
//
//   <SpellWheel part="card" ref active touch />   the card, for the HUD’s foot
//   <SpellWheel part="wheel" ref open active onChoose touch />   the wheel, over the view

const R = 15; // the rings’ radius, in the glyphs’ 36-unit box
const C = 2 * Math.PI * R;

// the glyphs, 24 units square, drawn in the text’s colour
const GLYPHS = {
  lumos: (
    <g>
      <circle cx="12" cy="12" r="4" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="12" y1="3" x2="12" y2="5.5" transform={`rotate(${a} 12 12)`} />
      ))}
    </g>
  ),
  leviosa: <path d="M18 3c-6 1-10 6-11 13l-2 5M7 16c3 0 7-1 9-4M9 11c2 0 5-1 7-3" />,
  alohomora: (
    <g>
      <circle cx="8" cy="12" r="3.5" />
      <path d="M11.5 12H21M17 12v3M20 12v2.5" />
    </g>
  ),
  accio: <path d="M20 5c-5 0-9 3-11 8M9 13l-1-4M9 13l4-1M5 19a1.6 1.6 0 1 0 0.1 0" />,
  incendio: <path d="M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 3 2 3 5 2 7 2-1 3-3 3-4 2 2 3 4 3 7 0 3-2 6-6 6z" />,
  expelliarmus: <path d="M13 2 5 13h6l-1 9 8-12h-6z" />,
  stupefy: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3M12 9a3 3 0 1 0 0.1 0" />,
  protego: <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" />,
  patronum: <path d="M12 21v-7M12 14c-3 0-5-2-5-5M12 14c3 0 5-2 5-5M7 9 4 4M7 9l-1-4M7 9l3-4M17 9l3-5M17 9l1-4M17 9l-3-4" />,
};

function Glyph({ id }) {
  return (
    <svg className="hw-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {GLYPHS[id]}
    </svg>
  );
}
const Icon = ({ id }) => <GameIcon name={`spell:${id}`} className="hw-glyph" fallback={<Glyph id={id} />} />;

// the ring round a glyph: full while it cools, emptying as it comes ready
function Ring({ refFor, id }) {
  return (
    <svg className="hw-ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle className="hw-ring-track" cx="18" cy="18" r={R} />
      <circle ref={refFor(id)} className="hw-ring-cool" cx="18" cy="18" r={R} strokeDasharray={C} strokeDashoffset={C} />
    </svg>
  );
}

const SpellWheel = forwardRef(function SpellWheel({ part = 'card', open = false, active = 'lumos', onChoose = () => {}, touch = false }, ref) {
  const rings = useRef({});
  const card = useRef({});
  const [aimed, setAimed] = useState(null);
  const aimedRef = useRef(null);
  const wheelEl = useRef(null);
  const refFor = (where) => (id) => (el) => {
    where.current[id] = el;
  };

  useImperativeHandle(ref, () => ({
    // { cooling: { id: 0…1 }, lit }: written straight into the rings
    readout(data) {
      for (const s of SPELLS) {
        const k = data?.cooling?.[s.id] ?? 0;
        for (const el of [rings.current[s.id], card.current[s.id]]) if (el) el.style.strokeDashoffset = String(C * (1 - Math.min(1, k)));
      }
    },
  }));

  // while it is open, the pointer anywhere points at a spell by its angle from the middle
  useEffect(() => {
    if (!open || touch) return undefined;
    const move = (e) => {
      const box = wheelEl.current?.getBoundingClientRect();
      if (!box) return;
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      if (Math.hypot(dx, dy) < 28) return;
      const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
      const i = Math.round(a / ((Math.PI * 2) / SPELLS.length)) % SPELLS.length;
      aimedRef.current = SPELLS[i].id;
      setAimed(SPELLS[i].id);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [open, touch]);
  // let go of Q on a spell: that one
  const was = useRef(open);
  useEffect(() => {
    if (was.current && !open && aimedRef.current) onChoose(aimedRef.current);
    if (!open) {
      aimedRef.current = null;
      setAimed(null);
    }
    was.current = open;
  }, [open, onChoose]);

  const spell = SPELLS.find((s) => s.id === active) ?? SPELLS[0];
  if (part === 'card') {
    return (
      <div className="hw-wand-card" style={{ '--spell': spell.colour }}>
        <span className="hw-wand-glyph">
          <Icon id={spell.id} />
          <Ring refFor={refFor(card)} id={spell.id} />
        </span>
        <span className="hw-wand-words">
          <span className="hw-wand-word">{spell.word}</span>
          {!touch && (
            <span className="hw-wand-keys">
              <kbd>F</kbd> cast · hold <kbd>Q</kbd> spells
            </span>
          )}
        </span>
      </div>
    );
  }
  return (
    open && (
      <div className="hw-wheel" ref={wheelEl} role="menu" aria-label="Spells">
        {SPELLS.map((s, i) => {
          const a = (i / SPELLS.length) * Math.PI * 2;
          return (
            <button
              key={s.id}
              type="button"
              role="menuitem"
              className="hw-wheel-item"
              data-on={s.id === (aimed ?? active) || undefined}
              style={{
                '--x': `${Math.sin(a) * 8.6}rem`,
                '--y': `${-Math.cos(a) * 8.6}rem`,
                '--spell': s.colour,
              }}
              onPointerUp={() => onChoose(s.id)}
            >
              <span className="hw-wheel-glyph">
                <Icon id={s.id} />
                <Ring refFor={refFor(rings)} id={s.id} />
              </span>
              <span className="hw-wheel-word">
                <kbd className="hud-cap">{s.key}</kbd> {s.word}
              </span>
            </button>
          );
        })}
        <p className="hw-wheel-middle">{SPELLS.find((s) => s.id === (aimed ?? active))?.word}</p>
      </div>
    )
  );
});

export default SpellWheel;
