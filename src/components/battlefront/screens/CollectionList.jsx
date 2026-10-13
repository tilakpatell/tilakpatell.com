import { useState } from 'react';
import { label as words } from '../../../lib/bf2017/collection';
import { word } from '../../../lib/bf2017/ui/screens';
import { between, findBox, OFFLINE, percentOf, prune } from './tree';
import { useTree } from './useTree';
import CollectionStage from './CollectionStage.jsx';
import GameScreen from './GameScreen.jsx';

// One of the Collection's list screens as the game lays it (its trees:
// AppearanceHeroSkinsScreen, AppearanceEmotesCommoRoseScreen,
// VictoryPoseScreen, AppearanceVoiceLinesCommoRose): the list in the tree's
// ListContainer, the AppearanceScreenInfoWidget's box with the focused row's
// name, rarity and words, the 3D figure in the room the tree leaves, the
// game's chrome drawn by the tree itself. A row is chosen with Enter or a
// click; the arrows move along the list.
//
// <CollectionList screen="AppearanceHeroSkinsScreen" label="Appearances" items={[{ id, name, rarity, about, tag }]}
//   chosen={id => bool} onChoose={item => …} onFocus={item => …} stage={{ spec, play, playKey, still }} tabs={[{ id, label, on }]} onTab={id => …}
//   note="EQUIPPED 2 / 4" onBack={…} />

// the list's own nodes and the info panel are the site's (drawn over the boxes they sit in)
const DRAWN = /^(InfoWidget|AppearanceInfoWidget|CommoRose|EmotesEquippedContainer|Scrollbar|FooterActionBar)$/;
const LISTS = new Set(['standardList', 'staticList', 'grid', 'navigatableElementCollection', 'cell', 'input']);
// (the info widget's box is its first line's: the game grows it to its words
// at run time, so the panel keeps its place and width and takes its height)
const grown = (box) => ({ ...box, height: 'auto', maxHeight: `calc(100% - ${box.top} - 12%)` });

export default function CollectionList({ screen, label, items = [], chosen = () => false, onChoose, onFocus, stage = null, tabs = null, onTab, onBack, title = null, note = null }) {
  const raw = useTree(screen);
  const tree = prune(raw, (b) => OFFLINE(b) || LISTS.has(b.type) || DRAWN.test(b.id.split('/').pop()));
  const [focused, setFocused] = useState(() => items.find((i) => chosen(i))?.id ?? items[0]?.id ?? null);
  const list = findBox(raw, 'ListContainer');
  const info = findBox(raw, 'InfoWidget') ?? findBox(raw, 'AppearanceInfoWidget') ?? findBox(raw, 'RightPaneContainer');
  const room = between(raw, list, info);
  const at = items.find((i) => i.id === focused) ?? items[0] ?? null;
  const focus = (item) => {
    setFocused(item.id);
    onFocus?.(item);
  };
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const i = items.findIndex((x) => x.id === focused);
    const next = items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (!next) return;
    e.preventDefault();
    e.currentTarget.querySelector(`[data-item="${next.id}"]`)?.focus();
  };
  return (
    <GameScreen tree={tree} label={label} onBack={onBack} keys={[['Enter', word('ID_CUSTOMIZATION_EQUIP')], ['Esc', 'Back']]} className="bf-collection">
      {title ? <h2 className="bf-collection-title">{title}</h2> : null}
      {room && stage ? <CollectionStage {...stage} label={at?.name ?? label} style={room} /> : null}
      {tabs?.length ? (
        <div className="bf-collection-tabs" role="tablist" style={list ? { left: percentOf(raw, list).left, top: `calc(${percentOf(raw, list).top} - 3rem)` } : undefined}>
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={t.on} className="bf-collection-tab" onClick={() => onTab?.(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      {list ? (
        <ul className="bf-collection-list" style={percentOf(raw, list)} onKeyDown={onKeyDown}>
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" className="bf-collection-row" data-item={item.id} data-rarity={item.rarity} aria-pressed={chosen(item)} onFocus={() => focus(item)} onMouseEnter={() => focus(item)} onClick={() => onChoose?.(item)}>
                <span className="bf-collection-row-name">{item.name}</span>
                {item.tag ? <span className="bf-collection-row-tag">{item.tag}</span> : null}
                {chosen(item) ? <span className="bf-collection-row-on">{words('equipped')}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {info && at ? (
        <aside className="bf-collection-info" style={grown(percentOf(raw, info))} data-rarity={at.rarity}>
          <p className="bf-collection-rarity">{at.rarity}</p>
          <h3 className="bf-collection-info-name">{at.name}</h3>
          {at.about ? <p className="bf-collection-info-about">{at.about}</p> : null}
          {note ? <p className="bf-collection-info-note">{note}</p> : null}
        </aside>
      ) : null}
    </GameScreen>
  );
}
