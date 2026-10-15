import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Film, Screen, ScreenCanvas } from '../../../runtime/hud';
import FrontEndBackdrop from '../backdrop/FrontEndBackdrop.jsx';
import '../../../lib/bf2017/fonts.css';
import './screens.css';

// The frame every one of the game's screens here sits in: the whole view,
// the backdrop (one of the game's films, or the dark of its menus), the
// tree drawn by the kit's Screen, the screen's own cards over it, and the
// keys at the foot in the site's words. A modal dialog: the focus starts on
// the first thing to press (or on `first`, a selector, where a screen names
// one); Escape goes back when there is a back, and a screen's own keys are
// heard wherever in it the focus is (`onKey`). In the
// page it is put at the body's end (the page's main is a stacking context
// under the site's bar; the game's screen covers the bar, as the game's do).
// With `layers` (trees at the frame's 1920 × 1080, useFrameTree's) the
// screen is painted on the kit's canvas, `values` filling what the game's
// code fills and `active` the cells drawn open (the 2026-10-13 canvas
// design); with `tree` it is drawn by the kit's Screen, as before. `room`
// puts the front end's 3D room behind it (../backdrop, the 2026-10-13
// backdrop design) where there is no film.
export default function GameScreen({ tree = null, layers = null, values = null, active = [], label, backdrop = null, room = false, onBack = null, onLink = null, onAction = null, fill = null, keys = null, className = '', children = null, first = null, onKey = null }) {
  const name = layers ? layers.at(-1)?.name : tree?.name;
  const ref = useRef(null);
  useEffect(() => {
    const el = (first && ref.current?.querySelector(first)) || ref.current?.querySelector('button:not([aria-disabled="true"]), [tabindex="0"]');
    // (a screen with nothing to press, the loading screen, takes the focus itself: its Escape is heard)
    (el ?? ref.current)?.focus({ preventScroll: true });
  }, [name, first]);
  const onKeyDown = (e) => {
    if (e.key === 'Escape' && onBack) {
      e.preventDefault();
      e.stopPropagation();
      onBack();
    } else onKey?.(e);
  };
  const node = (
    <div ref={ref} tabIndex={-1} className={`bf-game-screen ${className}`.trim()} role="dialog" aria-modal="true" aria-label={label} onKeyDown={onKeyDown} data-game-screen={name ?? label}>
      <div className={`bf-game-backdrop${room && !backdrop ? ' bf-game-room' : ''}`} aria-hidden="true">
        {backdrop ? <Film film={backdrop} className="bf-game-film" /> : room ? <FrontEndBackdrop /> : null}
      </div>
      {layers ? <ScreenCanvas layers={layers.filter(Boolean)} label={label} values={values} active={active} onLink={onLink} onAction={onAction} /> : <Screen tree={tree} label={label} onLink={onLink} onAction={onAction} fill={fill} />}
      {children}
      {keys !== false && (
        <p className="bf-game-keys">
          {(keys ?? [['Enter', 'Select'], onBack ? ['Esc', 'Back'] : null]).filter(Boolean).map(([k, what]) => (
            <span key={k}>
              <kbd className="hud-cap">{k}</kbd> {what}
            </span>
          ))}
        </p>
      )}
    </div>
  );
  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}
