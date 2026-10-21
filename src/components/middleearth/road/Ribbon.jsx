import { useRef } from 'react';
import { at, markAt } from './line';

// The ribbon (the design’s §4.8): the sixteen stages as dots on an inked
// line along the foot, on glass, the walkers’ mark moving between them.
// Each dot is a 44 px button that jumps to its stage; a passed stage’s
// lore opens from a right click or a long press on its dot. The current
// stage’s name sits under its dot; with `names: 'all'` the others show on
// hover and focus, with 'current' (a phone) they don’t. The mark is moved
// by the page through `markRef` (--at, 0 to 1) between stage changes, so
// the frame loop’s numbers never go through React.
//
//   (line.js’s markAt places the mark between the evenly spaced dots)

const LONG_PRESS = 550; // ms

export default function Ribbon({ stages, s, names = 'all', onJump, onLore = null, markRef = null, className = '' }) {
  const here = at(stages, s);
  const press = useRef(null);
  const cancel = () => {
    clearTimeout(press.current);
    press.current = null;
  };
  return (
    <nav className={`road-ribbon ${className}`.trim()} aria-label="The Road’s stages" data-names={names}>
      <span className="road-ribbon-line" aria-hidden="true" />
      <span ref={markRef} className="road-ribbon-mark" style={{ '--at': markAt(stages, s) }} aria-hidden="true" />
      <ol className="road-ribbon-stops">
        {stages.map((st, i) => {
          const current = i === here.index;
          const passed = i < here.index;
          const lore = passed && onLore ? () => onLore(st.id) : null;
          return (
            <li key={st.id} className="road-ribbon-stop" style={{ '--i': i / (stages.length - 1) }}>
              <button
                type="button"
                className="road-ribbon-dot"
                aria-label={`${st.name} · ${st.date}`}
                aria-current={current ? 'step' : undefined}
                data-passed={passed || undefined}
                onClick={() => {
                  // (a long press that opened the lore isn’t also a jump)
                  if (press.current === false) press.current = null;
                  else onJump?.(st.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  lore?.();
                }}
                onPointerDown={() => {
                  if (!lore) return;
                  cancel();
                  press.current = setTimeout(() => {
                    press.current = false;
                    lore();
                  }, LONG_PRESS);
                }}
                onPointerUp={() => press.current && cancel()}
                onPointerLeave={() => press.current && cancel()}
              />
              {(names === 'all' || current) && (
                <span className="road-ribbon-name" data-current={current || undefined} aria-hidden="true">
                  <span>{st.name}</span>
                  <span className="road-ribbon-date">{st.date}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
