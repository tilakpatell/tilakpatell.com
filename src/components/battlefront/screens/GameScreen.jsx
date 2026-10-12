import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Film, Screen } from '../../../runtime/hud';
import '../../../lib/bf2017/fonts.css';
import './screens.css';

// The frame every one of the game's screens here sits in: the whole view,
// the backdrop (one of the game's films, or the dark of its menus), the
// tree drawn by the kit's Screen, the screen's own cards over it, and the
// keys at the foot in the site's words. A modal dialog: the focus starts on
// the first thing to press; Escape goes back when there is a back. In the
// page it is put at the body's end (the page's main is a stacking context
// under the site's bar; the game's screen covers the bar, as the game's do).
export default function GameScreen({ tree, label, backdrop = null, onBack = null, onLink = null, onAction = null, fill = null, keys = null, className = '', children = null }) {
  const ref = useRef(null);
  useEffect(() => {
    const first = ref.current?.querySelector('button:not([aria-disabled="true"]), [tabindex="0"]');
    first?.focus({ preventScroll: true });
  }, [tree?.name]);
  const onKeyDown = (e) => {
    if (e.key === 'Escape' && onBack) {
      e.preventDefault();
      e.stopPropagation();
      onBack();
    }
  };
  const node = (
    <div ref={ref} className={`bf-game-screen ${className}`.trim()} role="dialog" aria-modal="true" aria-label={label} onKeyDown={onKeyDown} data-game-screen={tree?.name ?? label}>
      <div className="bf-game-backdrop" aria-hidden="true">
        {backdrop ? <Film film={backdrop} className="bf-game-film" /> : null}
      </div>
      <Screen tree={tree} label={label} onLink={onLink} onAction={onAction} fill={fill} />
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
