import { tilesFor } from '../../../lib/bf2017/films';
import { OFFLINE, prune } from './tree';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// The main menu: the game's tabs (Start, Play, Characters, Career, Options,
// Store) as its tree lays them, on the multiplayer tile's film. Play and
// the Collection (the Characters tab, its link CharacterScreen) go on; the
// tabs this world does not have yet say so (`onComing`).
export default function MainMenu({ onPlay, onStart, onCollection, onComing }) {
  // (a tab the game names at run time, the store's, is left out)
  const tree = prune(useTree('MainMenuScreen'), (b) => OFFLINE(b) || (b.type === 'cell' && !b.key));
  const onLink = (to, cell) => {
    if (/\/PlayScreen$/.test(to ?? '')) onPlay?.();
    else if (/\/StartScreen$/.test(to ?? '')) onStart?.();
    else if (/\/CharacterScreen$/.test(to ?? '') && onCollection) onCollection();
    else onComing?.(cell.label);
  };
  return <GameScreen tree={tree} label="Main menu" backdrop={tilesFor('assault')[0] ?? null} onBack={onStart} onLink={onLink} onAction={(id, cell) => onComing?.(cell.label)} className="bf-main-menu" />;
}
