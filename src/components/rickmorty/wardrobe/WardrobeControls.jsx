import { useId } from 'react';
import ModelCredits from '../../ModelCredits';
import { BODIES, CASTS, GEAR_SLOTS, NAME, bodyOf, defaultLook, gearOf, readLook, swatchesOf } from './looks';
import '@fontsource/luckiest-guy/400.css';
import './wardrobe.css';

// The wardrobe's controls: whose wardrobe it is (the cast's two), and for
// him a body, a colour for each part of it that takes one, and gear for his
// head, his face and his hand; Reset, and the credits. Every change goes to
// `onLook(who, look)` at once (useLooks keeps it). With `headless` there's
// no "Wardrobe" header and no close (the Hangar's Crew has its own); with
// `onClose`, the header has the dialog's close. The Wardrobe's dialog holds
// it, and so does the Hangar's Crew (through rickmorty/shared/wardrobe.js).

const SLOT_LABEL = { head: 'On his head', face: 'On his face', hand: 'In his hand' };

export default function WardrobeControls({ cast = 'rickmorty', who, onWho, looks, onLook, headless = false, onClose = null, titleId = null }) {
  const id = useId();
  const tabs = CASTS[cast] ?? CASTS.rickmorty;
  const look = looks[who] ?? defaultLook(who);
  const body = bodyOf(who, look.body);
  const set = (patch) => onLook(who, readLook(who, { ...look, ...patch }));
  const setColor = (region, swatch) => set({ colors: { ...look.colors, [region]: swatch } });
  const clearColor = (region) => {
    const colors = { ...look.colors };
    delete colors[region];
    set({ colors });
  };
  const setGear = (slot, gear) => set({ gear: { ...look.gear, [slot]: gear } });

  return (
    <div className="rm-wardrobe-controls">
      {!headless && (
        <header className="rm-wardrobe-head">
          <h2 id={titleId ?? undefined}>Wardrobe</h2>
          {onClose && (
            <button type="button" className="rm-wardrobe-close" aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </header>
      )}
      <div className="rm-wardrobe-tabs" role="group" aria-label="Who">
        {tabs.map((w) => (
          <button key={w} type="button" aria-pressed={who === w} onClick={() => onWho(w)}>
            {NAME[w]}
          </button>
        ))}
      </div>

      <section className="rm-wardrobe-group" aria-labelledby={`${id}-body`}>
        <h3 id={`${id}-body`}>Who he is</h3>
        <div className="rm-wardrobe-bodies">
          {BODIES[who].map((b) => (
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
                {swatchesOf(who).map((s) => (
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
                  {gearOf(who)[slot].map((g) => (
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
        <button type="button" className="rm-wardrobe-reset" onClick={() => onLook(who, defaultLook(who))}>
          Reset {NAME[who]}
        </button>
        {cast === 'breakingbad' ? <p className="rm-wardrobe-credit">Walt and Jesse are the site’s own figures, modelled with Meshy; their gear is made in code.</p> : <ModelCredits where="c-137" line className="rm-wardrobe-credit" />}
      </footer>
    </div>
  );
}
