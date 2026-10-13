import { useCallback } from 'react';
import { word } from '../../../lib/bf2017/ui/screens';
import { FOOTER_DROP, footerValues } from './footer';
import { homeValues } from './home';
import { tabWays } from './menuHeader';
import { useFrameTree, useMenuHeader } from './useTree';
import GameScreen from './GameScreen.jsx';

// The main menu, HOME open: the game's header (its tabs: HOME, PLAY,
// COLLECTION, CAREER, OPTIONS) over HOME's own page, the game's StartScreen
// (the tab's link), painted from their trees over the menus' dark (the
// game's own ground is its 3D front end, not built here yet: hand). The page's online parts (the footer of controller prompts, the
// timed challenges, the loot boxes) are left out: the site is offline. Play
// and the Collection go on; the tabs this world does not have yet say so
// (`onComing`). The HOME tab (`onStart`) and Escape (`onBack`) are two
// things: over a level's world the first goes nowhere and the second is the
// way out (cards.js's frontEndWays); `first` is where the focus starts.

export default function MainMenu({ onPlay, onStart, onBack = onStart, onCollection, onComing, first = null }) {
  const header = useMenuHeader({ tab: 'Start' });
  const page = useFrameTree('StartScreen', { drop: FOOTER_DROP });
  // (HOME's foot is QUIT, as the game's: Escape's way out)
  const values = useCallback(
    (b, path) => {
      const foot = footerValues(word('ID_PAUSE_SCR_QUIT'), page);
      return header.values(b, path) ?? foot(b, path) ?? homeValues(b, path);
    },
    [header, page],
  );
  return (
    <GameScreen
      layers={[header.tree, page]}
      values={values}
      active={header.active}
      label="Main menu"
      onBack={onBack}
      first={first}
      onLink={tabWays({ onPlay, onStart, onCollection, onComing })}
      onAction={(id, cell) => (id === 'Back' ? onBack?.() : onComing?.(cell.label))}
      keys={false}
      className="bf-main-menu"
    />
  );
}
