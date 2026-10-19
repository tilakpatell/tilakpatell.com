import { useState } from 'react';
import { useReducedMotion } from '../../lib/hooks';
import { CASTS, WardrobeControls, WardrobeStage, castOfCrew, useLooks } from '../rickmorty/shared/wardrobe';
import { HILTS, SABER_COLORS, heroById, skinsOf } from '../galaxy/shared/arms';
import { cardOf, crewOf } from './crewTabRules';
import { useCrewStyle } from './useCrewStyle';

// The Hangar's Crew: how the ship's two look, wherever they walk. Rick and
// Morty (the cruiser's), Walt and Jesse (the RV's) are the Wardrobe's own
// (its turntable and its controls: body, colours, gear, kept in
// tp-wardrobe). Luke and Artoo (the X-wing's), Han and Chewie (the
// Falcon's) are a card, since their bodies are the 2017 game's and load only
// on the galaxy's worlds: their outfit, and Luke's blade (its colour and
// hilt), kept in the crew's style (tp-crew) and worn there.
export default function CrewTab({ ship }) {
  const pair = crewOf(ship);
  const cast = castOfCrew(ship);
  const [who, setWho] = useState(pair[0]);
  const shown = pair.includes(who) ? who : pair[0];
  const [looks, setLook] = useLooks();
  const reduced = useReducedMotion();
  const [crew, setStyle] = useCrewStyle();
  if (!shown) return null;

  if (cast) {
    const look = looks[shown];
    return (
      <div className="hangar-crew" data-cast={cast}>
        <WardrobeStage who={shown} look={look} reduced={reduced} />
        <WardrobeControls cast={cast} who={CASTS[cast].includes(shown) ? shown : CASTS[cast][0]} onWho={setWho} looks={looks} onLook={setLook} headless />
      </div>
    );
  }

  const style = crew[shown] ?? {};
  const card = cardOf(shown, style);
  const hero = heroById(shown);
  const outfits = skinsOf(shown);
  const jedi = hero?.weapon === 'saber';
  const saber = { color: style.saber?.color ?? hero?.saber?.color ?? 'blue', hilt: style.saber?.hilt ?? hero?.saber?.hilt ?? 'skywalker' };
  return (
    <div className="hangar-page hangar-crew-sw">
      <div className="hangar-chips" role="group" aria-label="Who">
        {pair.map((w) => (
          <button key={w} type="button" aria-pressed={w === shown} onClick={() => setWho(w)}>
            {cardOf(w).name}
          </button>
        ))}
      </div>
      <article className="hangar-card" style={card.blade ? { '--blade': card.blade.hex } : undefined}>
        <h3>{card.name}</h3>
        <p className="hangar-card-line">{card.line}</p>
        <dl>
          {card.outfit && (
            <div>
              <dt>Outfit</dt>
              <dd>{card.outfit}</dd>
            </div>
          )}
          {card.blade && (
            <div>
              <dt>Blade</dt>
              <dd>
                <i className="hangar-blade" aria-hidden="true" /> {card.blade.color}, {card.blade.hilt}
              </dd>
            </div>
          )}
          {card.gun && (
            <div>
              <dt>In his hand</dt>
              <dd>{card.gun} (Arms)</dd>
            </div>
          )}
        </dl>
      </article>
      <section aria-label="Outfit">
        <h3>Outfit</h3>
        {outfits.length ? (
          <div className="hangar-chips">
            {outfits.map((o) => (
              <button key={o.id} type="button" aria-pressed={(style.skin ?? outfits[0].id) === o.id} onClick={() => setStyle(shown, { skin: o.id })}>
                {o.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="hangar-note">{shown === 'artoo' ? 'Artoo comes as he is.' : 'One outfit, worn on the galaxy’s worlds.'}</p>
        )}
        {outfits.length > 0 && <p className="hangar-note">Worn on the galaxy’s worlds.</p>}
      </section>
      {jedi && (
        <section aria-label="Blade">
          <h3>Blade</h3>
          <div className="hangar-chips hangar-swatches" role="group" aria-label="Colour">
            {SABER_COLORS.map((c) => (
              <button key={c.id} type="button" className="hangar-swatch" style={{ '--swatch': c.hex }} aria-pressed={saber.color === c.id} aria-label={c.name} title={c.name} onClick={() => setStyle(shown, { saber: { ...saber, color: c.id } })} />
            ))}
          </div>
          <div className="hangar-chips" role="group" aria-label="Hilt">
            {HILTS.map((h) => (
              <button key={h.id} type="button" aria-pressed={saber.hilt === h.id} title={h.about} onClick={() => setStyle(shown, { saber: { ...saber, hilt: h.id } })}>
                {h.name}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
