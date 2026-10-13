import { useCallback } from 'react';
import { tilesFor } from '../../../lib/bf2017/films';
import { offline, tabWays } from './menuHeader';
import { useFrameTree, useMenuHeader } from './useTree';
import GameScreen from './GameScreen.jsx';

// The main menu, HOME open: the game's header (its tabs: HOME, PLAY,
// COLLECTION, CAREER, OPTIONS) over HOME's own page, the game's StartScreen
// (the tab's link), painted from their trees on the multiplayer tile's
// film. The page's online parts (the footer of controller prompts, the
// timed challenges, the loot boxes) are left out: the site is offline. Play
// and the Collection go on; the tabs this world does not have yet say so
// (`onComing`). The HOME tab (`onStart`) and Escape (`onBack`) are two
// things: over a level's world the first goes nowhere and the second is the
// way out (cards.js's frontEndWays); `first` is where the focus starts.

// (and of the two news tiles the game's code picks between at the top right, the online one; the loader)
const ONLINE = new Set(['TimedChallengesWidget', 'LootBoxButton', 'smallTopTile MP', 'LoadingContainer']);
const home = (b, path) => offline(b, path) ?? (ONLINE.has(path.at(-1)) ? { hidden: true } : null);

export default function MainMenu({ onPlay, onStart, onBack = onStart, onCollection, onComing, first = null }) {
  const header = useMenuHeader({ tab: 'Start' });
  const page = useFrameTree('StartScreen');
  const values = useCallback((b, path) => header.values(b, path) ?? home(b, path), [header]);
  return (
    <GameScreen
      layers={[header.tree, page]}
      values={values}
      active={header.active}
      label="Main menu"
      backdrop={tilesFor('assault')[0] ?? null}
      onBack={onBack}
      first={first}
      onLink={tabWays({ onPlay, onStart, onCollection, onComing })}
      onAction={(id, cell) => onComing?.(cell.label)}
      className="bf-main-menu"
    />
  );
}
