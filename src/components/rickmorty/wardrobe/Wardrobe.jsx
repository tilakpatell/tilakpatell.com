import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from '../../../lib/hooks';
import { focusBack, wrapFocus } from '../../../lib/focus';
import { CASTS, defaultLook } from './looks';
import WardrobeControls from './WardrobeControls';
import WardrobeStage from './WardrobeStage';
import '@fontsource/luckiest-guy/400.css';
import './wardrobe.css';

// The wardrobe: how your Rick and your Morty look, wherever they turn up
// (the C-137 street, the Citadel, the cruiser's seats, out of the ship on a
// planet), or your Walt and your Jesse (the RV’s seats, out of it on a
// planet, Albuquerque): `cast` (looks.js’s CASTS) says whose. A turntable of
// the look on one side (WardrobeStage.jsx); on the other, the cast’s two,
// and for him a body (the show’s, a Citadel Rick, Evil or Cop Morty; Mr.
// White or Heisenberg, Jesse in the lab’s suit), a colour for each part of
// it that takes one, from his own show’s, and gear for his head, his face
// and his hand (WardrobeControls.jsx). Every change is kept at once
// (useLooks), and Reset puts him back as the show has him. Modal: Escape,
// the close button or the backdrop puts it away; Tab stays inside while
// it’s open, and focus goes back after (to `returnTo`, a selector, when
// what opened it has gone).

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Wardrobe({ open, onClose, looks, onLook, cast = 'rickmorty', who: asked = 'morty', returnTo = null }) {
  const id = useId();
  const reduced = useReducedMotion();
  const tabs = CASTS[cast] ?? CASTS.rickmorty;
  const start = tabs.includes(asked) ? asked : tabs[0]; // (Walt’s wardrobe opens on Walt, whoever was asked for)
  const [who, setWho] = useState(start);
  const panel = useRef(null);
  const shown = tabs.includes(who) ? who : start; // (the crew changed while it was shut)
  const look = looks[shown] ?? defaultLook(shown);

  useEffect(() => {
    if (open) setWho(start);
  }, [open, start]);

  // Escape closes it; Tab goes round inside it; focus goes in, and back
  // where it was after
  useEffect(() => {
    if (!open) return undefined;
    const was = document.activeElement === document.body ? null : document.activeElement;
    panel.current?.querySelector('.rm-wardrobe-tabs [aria-pressed="true"]')?.focus({ preventScroll: true }); // (whose wardrobe it is)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && panel.current) {
        const to = wrapFocus([...panel.current.querySelectorAll(FOCUSABLE)], document.activeElement, e.shiftKey);
        if (to) {
          e.preventDefault();
          to.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      focusBack(was, () => returnTo && document.querySelector(returnTo));
    };
  }, [open, onClose, returnTo]);

  if (!open) return null;
  return (
    <div className="rm-wardrobe" data-cast={cast} role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section ref={panel} className="rm-wardrobe-panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <WardrobeStage who={shown} look={look} reduced={reduced} />
        <WardrobeControls cast={cast} who={shown} onWho={setWho} looks={looks} onLook={onLook} onClose={onClose} titleId={`${id}-title`} />
      </section>
    </div>
  );
}
