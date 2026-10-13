import { GameIcon } from '../../../runtime/hud';
import { character, label, portraitOf, roster } from '../../../lib/bf2017/collection';
import { word } from '../../../lib/bf2017/ui/screens';
import { findBox, OFFLINE, percentOf, prune } from './tree';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// The Collection's first screen as the game's tree lays it
// (CollectionCharacterScreen): the classes down the left, the reinforcements
// under them, the heroes' grid beside, each with its portrait; one chosen
// opens its customisation. The vehicles' and starfighters' lists stay out
// (the game's records give them no appearances to pick).
//
// <CollectionCharacters onOpen={(id) => …} onBack={…} />

const LEFT_OUT = /^(Vehicles|Starfighters|Specials|LoadingText|LoadingSpinner|OnboardingMeasurement|InfoRow)$/;
const LISTS = new Set(['standardList', 'grid', 'navigatableElementCollection', 'cell']);

function Tile({ id, wide = false, onOpen }) {
  const c = character(id);
  const face = portraitOf(id);
  const picture = face ? <img src={face} alt="" loading="lazy" /> : <span className="bf-collection-tile-blank" aria-hidden="true" />;
  return (
    <button type="button" className={`bf-collection-tile${wide ? ' bf-collection-tile-wide' : ''}`} data-character={id} data-side={c?.side ?? undefined} onClick={() => onOpen?.(id)}>
      {/* (a class is every faction's, so it wears the game's class icon; its
          portrait is one faction's trooper) */}
      {c?.kind === 'trooper' ? <GameIcon name={`class:${id}`} className="bf-collection-tile-icon" fallback={picture} /> : picture}
      <span className="bf-collection-tile-name">{c?.title ?? id}</span>
    </button>
  );
}

export default function CollectionCharacters({ onOpen, onBack }) {
  const raw = useTree('CollectionCharacterScreen');
  const tree = prune(raw, (b) => OFFLINE(b) || LISTS.has(b.type) || LEFT_OUT.test(b.id.split('/').pop()));
  const r = roster();
  const heroes = findBox(raw, 'HeroGrid');
  // (the left column below its CLASSES header: the classes, then the
  // reinforcements; the game sizes those lists at run time, so they are
  // laid out here in the column's box rather than in the boxes the tree
  // stacks over each other)
  const col = findBox(raw, '1stCol');
  const top = findBox(raw, 'Troopers');
  const column = col && top ? percentOf(raw, { x: col.x, y: top.y, w: col.w, h: col.y + col.h - top.y }) : null;
  return (
    <GameScreen tree={tree} label={word('ID_MAINMENU_SCR_CHARACTERS')} onBack={onBack} className="bf-collection">
      {column ? (
        <div className="bf-collection-column" style={column}>
          <ul className="bf-collection-classes" aria-label={word('ID_CHARACTER_SCR_CLASSES')}>
            {r.troopers.map((id) => (
              <li key={id}>
                <Tile id={id} wide onOpen={onOpen} />
              </li>
            ))}
          </ul>
          <p className="bf-collection-head">{label('reinforcements')}</p>
          <ul className="bf-collection-specials" aria-label={label('reinforcements')}>
            {r.specials.map((id) => (
              <li key={id}>
                <Tile id={id} wide onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {heroes ? (
        <ul className="bf-collection-heroes" style={percentOf(raw, heroes)} aria-label={word('ID_CHARACTER_SCR_CHARACTERS_TAB')}>
          {[...r.heroes.light, ...r.heroes.dark].map((id) => (
            <li key={id}>
              <Tile id={id} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      ) : null}
    </GameScreen>
  );
}
