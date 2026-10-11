import { useEffect, useId, useRef, useState } from 'react';
import ModelCredits from '../../ModelCredits';
import { useReducedMotion } from '../../../lib/hooks';
import { focusBack, wrapFocus } from '../../../lib/focus';
import { BODIES, CASTS, GEAR_SLOTS, bodyOf, defaultLook, gearOf, readLook, swatchesOf } from './looks';
import '@fontsource/luckiest-guy/400.css';
import './wardrobe.css';

// The wardrobe: how your Rick and your Morty look, wherever they turn up
// (the C-137 street, the Citadel, the cruiser's seats, out of the ship on a
// planet), or your Walt and your Jesse (the RV’s seats, out of it on a
// planet, Albuquerque): `cast` (looks.js’s CASTS) says whose. A turntable of
// the look on one side; on the other, the cast’s two, and for him a body
// (the show’s, a Citadel Rick, Evil or Cop Morty; Mr. White or Heisenberg,
// Jesse in the lab’s suit), a colour for each part of it that takes one,
// from his own show’s, and gear for his head, his face and his hand. Every
// change is kept at once (useLooks), and Reset puts him back as the show has
// him. Modal: Escape, the close button or the backdrop puts it away; Tab
// stays inside while it’s open, and focus goes back after (to `returnTo`, a
// selector, when what opened it has gone).

const SLOT_LABEL = { head: 'On his head', face: 'On his face', hand: 'In his hand' };
const NAME = { rick: 'Rick', morty: 'Morty', walt: 'Walt', jesse: 'Jesse' };
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Wardrobe({ open, onClose, looks, onLook, cast = 'rickmorty', who: asked = 'morty', returnTo = null }) {
  const id = useId();
  const reduced = useReducedMotion();
  const tabs = CASTS[cast] ?? CASTS.rickmorty;
  const start = tabs.includes(asked) ? asked : tabs[0]; // (Walt’s wardrobe opens on Walt, whoever was asked for)
  const [who, setWho] = useState(start);
  const canvas = useRef(null);
  const preview = useRef(null);
  const panel = useRef(null);
  const shown = tabs.includes(who) ? who : start; // (the crew changed while it was shut)
  const look = looks[shown] ?? defaultLook(shown);
  const body = bodyOf(shown, look.body);
  const latest = useRef(look); // (for the turntable, made after a wait)
  latest.current = look;

  useEffect(() => {
    if (open) setWho(start);
  }, [open, start]);

  // the turntable, while it's open
  useEffect(() => {
    if (!open || !canvas.current) return undefined;
    let gone = false;
    import('./preview').then(({ createWardrobePreview }) => {
      if (gone || !canvas.current) return;
      preview.current = createWardrobePreview(canvas.current, { reduced });
      preview.current?.show(latest.current);
    });
    return () => {
      gone = true;
      preview.current?.dispose();
      preview.current = null;
    };
    // (made once a time it's opened, showing the look as it is by then; changes after are the effect below's)
  }, [open, reduced]);
  useEffect(() => {
    preview.current?.show(look);
  }, [look]);

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
  const set = (patch) => onLook(shown, readLook(shown, { ...look, ...patch }));
  const setColor = (region, swatch) => set({ colors: { ...look.colors, [region]: swatch } });
  const clearColor = (region) => {
    const colors = { ...look.colors };
    delete colors[region];
    set({ colors });
  };
  const setGear = (slot, gear) => set({ gear: { ...look.gear, [slot]: gear } });

  return (
    <div className="rm-wardrobe" data-cast={cast} role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section ref={panel} className="rm-wardrobe-panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <div className="rm-wardrobe-stage">
          <canvas ref={canvas} className="rm-wardrobe-canvas" aria-label={`${NAME[shown]}, as ${body?.name ?? ''}: drag to turn him round`} />
          <p className="rm-wardrobe-who">{body?.name}</p>
        </div>
        <div className="rm-wardrobe-controls">
          <header className="rm-wardrobe-head">
            <h2 id={`${id}-title`}>Wardrobe</h2>
            <button type="button" className="rm-wardrobe-close" aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          </header>
          <div className="rm-wardrobe-tabs" role="group" aria-label="Who">
            {tabs.map((w) => (
              <button key={w} type="button" aria-pressed={shown === w} onClick={() => setWho(w)}>
                {NAME[w]}
              </button>
            ))}
          </div>

          <section className="rm-wardrobe-group" aria-labelledby={`${id}-body`}>
            <h3 id={`${id}-body`}>Who he is</h3>
            <div className="rm-wardrobe-bodies">
              {BODIES[shown].map((b) => (
                <button key={b.id} type="button" aria-pressed={look.body === b.id} onClick={() => set({ body: b.id, colors: {} })}>
                  {b.name}
                </button>
              ))}
            </div>
          </section>

          {body && Object.keys(body.regions).length > 0 && (
            <section className="rm-wardrobe-group" aria-labelledby={`${id}-colours`}>
              <h3 id={`${id}-colours`}>Colours</h3>
              {Object.entries(body.regions).map(([region, label]) => (
                <div key={region} className="rm-wardrobe-region" role="group" aria-label={label}>
                  <span className="rm-wardrobe-region-name">{label}</span>
                  <div className="rm-wardrobe-swatches">
                    <button type="button" className="rm-wardrobe-swatch rm-wardrobe-swatch-own" aria-pressed={!look.colors[region]} title="As it comes" aria-label={`${label}: as it comes`} onClick={() => clearColor(region)} />
                    {swatchesOf(shown).map((s) => (
                      <button key={s.id} type="button" className="rm-wardrobe-swatch" style={{ '--swatch': s.hex }} aria-pressed={look.colors[region] === s.id} title={s.name} aria-label={`${label}: ${s.name}`} onClick={() => setColor(region, s.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="rm-wardrobe-group" aria-labelledby={`${id}-gear`}>
            <h3 id={`${id}-gear`}>Gear</h3>
            {GEAR_SLOTS.map((slot) => {
              const hatted = slot === 'head' && body?.hat;
              return (
                <div key={slot} className="rm-wardrobe-region" role="group" aria-label={SLOT_LABEL[slot]}>
                  <span className="rm-wardrobe-region-name">{SLOT_LABEL[slot]}</span>
                  {hatted ? (
                    <p className="rm-wardrobe-note">{body.name} keeps his own hat on.</p>
                  ) : (
                    <div className="rm-wardrobe-chips">
                      {gearOf(shown)[slot].map((g) => (
                        <button key={g.id} type="button" aria-pressed={look.gear[slot] === g.id} onClick={() => setGear(slot, g.id)}>
                          {g.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <footer className="rm-wardrobe-foot">
            <button type="button" className="rm-wardrobe-reset" onClick={() => onLook(shown, defaultLook(shown))}>
              Reset {NAME[shown]}
            </button>
            {cast === 'breakingbad' ? <p className="rm-wardrobe-credit">Walt and Jesse are the site’s own figures, modelled with Meshy; their gear is made in code.</p> : <ModelCredits where="c-137" line className="rm-wardrobe-credit" />}
          </footer>
        </div>
      </section>
    </div>
  );
}
