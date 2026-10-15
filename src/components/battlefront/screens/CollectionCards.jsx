import { useState } from 'react';
import { CARD_SLOTS, cardLine, cardsFor, character, label, picksOf } from '../../../lib/bf2017/collection';
import { word } from '../../../lib/bf2017/ui/screens';
import { OFFLINE, prune } from './tree';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// A hero's star cards, as the game's EditCardScreen gives them: its nine
// cards with their art, the three it carries marked (EQUIPPED CARDS n / 3),
// the focused one's name, its words and its four levels' numbers (the
// game's common, uncommon, rare and epic). A card is equipped or put back
// with Enter or a click; a fourth waits for one to go.
//
// <CollectionCards id="luke" store={…} onToggle={cardId => …} onBack={…} />

const LEVELS = ['common', 'uncommon', 'rare', 'epic'];

export default function CollectionCards({ id, store, onToggle, onBack }) {
  const tree = prune(useTree('EditCardScreen'), (b) => OFFLINE(b) || b.type === 'widget');
  const cards = cardsFor(id);
  const p = picksOf(store, id);
  const [focused, setFocused] = useState(cards[0]?.id ?? null);
  const at = cards.find((k) => k.id === focused) ?? cards[0] ?? null;
  const full = p.cards.length >= CARD_SLOTS;
  return (
    <GameScreen tree={tree} label={`${character(id)?.title ?? id} · ${label('equipCards')}`} onBack={onBack} className="bf-collection bf-collection-cards-screen" keys={[['Enter', word('ID_CUSTOMIZATION_EQUIP')], ['Esc', 'Back']]}>
      <h2 className="bf-collection-title">
        {label('equipCards')}
        <span>
          {label('equippedCards')} {p.cards.length} / {CARD_SLOTS}
        </span>
      </h2>
      <ul className="bf-collection-cards">
        {cards.map((k) => {
          const on = p.cards.includes(k.id);
          return (
            <li key={k.id}>
              <button type="button" className="bf-collection-card" data-card={k.id} aria-pressed={on} aria-disabled={(!on && full) || undefined} onFocus={() => setFocused(k.id)} onMouseEnter={() => setFocused(k.id)} onClick={() => (on || !full ? onToggle?.(k.id) : null)}>
                {k.art ? <img src={k.art} alt="" loading="lazy" /> : <span className="bf-collection-tile-blank" aria-hidden="true" />}
                <span className="bf-collection-card-name">{k.name}</span>
                {on ? <span className="bf-collection-row-on">{label('equipped')}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {at ? (
        <aside className="bf-collection-info bf-collection-card-info">
          <p className="bf-collection-rarity">{label('starCard')}</p>
          <h3 className="bf-collection-info-name">{at.name}</h3>
          <p className="bf-collection-info-about">{at.description}</p>
          {at.levels ? (
            <ol className="bf-collection-levels">
              {at.levels.map((v, i) => (
                <li key={LEVELS[i]} data-rarity={LEVELS[i]}>
                  <span>{LEVELS[i]}</span> {cardLine(at, i)}
                </li>
              ))}
            </ol>
          ) : null}
        </aside>
      ) : null}
    </GameScreen>
  );
}
